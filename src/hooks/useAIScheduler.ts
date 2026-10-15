import { useState } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useAI } from '../contexts/AIContext';
import { useCalendar } from '../contexts/CalendarContext';
import { useAuth } from '../contexts/AuthContext';
import { isTaskBlocked, calculateDependencyDepth, getDateString, parseTaskScheduledDate } from '../lib/utils';
import { KANBAN_TIME } from '../lib/kanban-constants';
import { findNextAvailableSlot, filterCalendarEventsForDay, buildCalendarConflictBlocksForDay, scheduleBlocksConflict, buildAISchedulerSlotOptions, expandTaskBlockEndForSchedulingPrep, expandCalendarBlockForSchedulingPrep, aiSchedulingTaskBlockConflicts, enforcePrepBufferUntilStable, type ConflictCalendarEvent } from '../lib/time-conflict';
import { applyRecurrenceTimeCorrections } from '../lib/calendar-recurrence-utils';
import { getCategoryHoursForTask, parseTimeToMinutes } from '../lib/category-hours-utils';
import { getTaskHours, getTaskMinutes } from '../lib/daily-hours-utils';
import { logger } from '../lib/logger';
import { TIMING_CONSTANTS, getBrowserTimezone } from '../lib/timing-constants';
import { isDateInRecurrence } from '../lib/recurrence';
import { CALENDAR_API_BASE } from '../lib/calendar-api-base';
import {
  MIN_HOURS_PER_DAY,
  DEFAULT_SCHEDULING_PERIOD_DAYS,
  DEFAULT_WEEK_RESCHEDULE_DAYS,
  TWO_WEEK_DAYS_OFFSET,
  ONE_WEEK_DAYS_OFFSET,
  TIME_ROUNDING_INTERVAL_MINUTES,
  DEFAULT_TIME_SLOTS,
  MAX_RECURRING_TASK_SCHEDULING_ATTEMPTS,
  PRIORITY_TIME_SLOTS,
  HIGH_PRIORITY_DISTRIBUTION_DAYS,
  DEFAULT_CATEGORY_HOURS,
  DEFAULT_TASK_CATEGORY,
  PRIORITY_WEIGHTS,
  STATUS_WEIGHTS,
  AI_SCHEDULING_PREP_BUFFER_MINUTES,
  getCategoryFromTags,
  isWeekend as isWeekendDate,
  DEFAULT_CATEGORY_WORK_WINDOW_HOURS,
} from '../lib/ai-config';
import {
  DEFAULT_WEEKDAY_WORK_START,
  DEFAULT_WEEKDAY_WORK_END,
  DEFAULT_WEEKDAY_PERSONAL_START,
  DEFAULT_WEEKDAY_PERSONAL_END,
  DEFAULT_WEEKDAY_PROJECTS_START,
  DEFAULT_WEEKDAY_PROJECTS_END,
  DEFAULT_WEEKEND_WORK_START,
  DEFAULT_WEEKEND_WORK_END,
  DEFAULT_WEEKEND_PERSONAL_START,
  DEFAULT_WEEKEND_PERSONAL_END,
  DEFAULT_WEEKEND_PROJECTS_START,
  DEFAULT_WEEKEND_PROJECTS_END,
  MINUTES_PER_HOUR,
  HOURS_PER_DAY,
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_HOUR,
  MILLISECONDS_PER_DAY,
  TWO_WEEKS_DAYS,
  DAYS_IN_WEEK,
  END_OF_DAY_HOUR,
  END_OF_DAY_MINUTE,
  END_OF_DAY_SECOND,
  END_OF_DAY_MILLISECOND,
  AI_SCHEDULER_MAX_END_HOUR,
} from '../lib/business-constants';
import type { Task, RecurrenceConfig } from '../types';

const AI_SCHEDULING_PREP_BUFFER_MS = AI_SCHEDULING_PREP_BUFFER_MINUTES * MILLISECONDS_PER_MINUTE;

export interface SchedulePlan {
  task: Task;
  scheduledDate: Date;
  reason?: string;
}

export interface ScheduleResult {
  scheduled: SchedulePlan[];
  exceedsLimit: Task[]; // Tasks that exceed the daily limit
  daysExceedingLimit: Array<{ date: string; hours: number; tasks: Task[] }>; // Days that exceed the daily limit
}

export function useAIScheduler() {
  const { tasks, updateTask, hoursSettings } = useTasks();
  const { settings: aiSettings } = useAI();
  const { calendarStatus } = useCalendar();
  const { accessToken } = useAuth();
  const [isScheduling, setIsScheduling] = useState(false);
  
  // Fetch calendar events for a date range
  const fetchCalendarEvents = async (startDate: Date, endDate: Date): Promise<ConflictCalendarEvent[]> => {
    if (!accessToken) return [];
    
    const events: ConflictCalendarEvent[] = [];
    
    // Fetch events from all connected calendar providers
    const providers: Array<'google' | 'apple' | 'outlook'> = [];
    if (calendarStatus.google) providers.push('google');
    if (calendarStatus.apple) providers.push('apple');
    if (calendarStatus.outlook) providers.push('outlook');
    
    for (const provider of providers) {
      try {
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          userTimezone: getBrowserTimezone(),
        });
        const response = await fetch(
          `${CALENDAR_API_BASE}/calendar/events/${provider}?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.events && Array.isArray(data.events)) {
            for (const event of data.events) {
              if (!event?.start || !event?.end) continue;
              events.push({
                start: String(event.start),
                end: String(event.end),
                title: event.title || 'Calendar Event',
              });
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch ${provider} calendar events:`, error);
      }
    }
    
    const correctedEvents = await applyRecurrenceTimeCorrections(
      events.map((event) => ({
        id: event.title,
        title: event.title,
        start: typeof event.start === 'string' ? event.start : event.start.toISOString(),
        end: typeof event.end === 'string' ? event.end : event.end.toISOString(),
        provider: 'google' as const,
      })),
      getBrowserTimezone(),
    );
    return correctedEvents.map((event) => ({
      start: event.start,
      end: event.end,
      title: event.title,
    }));
  };

  const getUnscheduledTasks = () => {
    // Consistent definition: unscheduled tasks are those with scheduledDate === null/undefined
    // This includes: regular tasks, recurring tasks, and rollover tasks (all have scheduledDate === null)
    const filtered = tasks.filter(t => {
      // Exclude done tasks
      if (t.status === 'done') {
        return false;
      }
      
      // Only include tasks with no scheduledDate (null or undefined)
      // This covers:
      // - Regular tasks that were never scheduled
      // - Recurring tasks without a scheduledDate
      // - Rollover tasks (which have scheduledDate set to null after rollover)
      return !t.scheduledDate;
    });
    
    logger.debug('getUnscheduledTasks result', {
      totalTasks: tasks.length,
      unscheduledCount: filtered.length,
      regularTasks: filtered.filter(t => !t.recurrence || t.recurrence.type === 'none').length,
      recurringTasks: filtered.filter(t => t.recurrence && t.recurrence.type !== 'none').length,
    });
    
    return filtered;
  };

  // Helper: Get date key for tracking (YYYY-MM-DD) using LOCAL timezone
  // This ensures tasks are assigned to the correct day based on user's local time
  const getDateKey = (date: Date): string => {
    return getDateString(date);
  };

  // Helper: Treat slot as valid only if it is on the requested day.
  // findNextAvailableSlot signals "no slot" by returning 24:00, which in JS rolls to next day 00:00 (12 AM).
  // So we must check calendar day: if the slot rolled to the next day, do not use it.
  const isSlotOnRequestedDay = (slot: Date, requestedDay: Date): boolean =>
    getDateString(slot) === getDateString(requestedDay);

  // Helper: Calculate the first occurrence date for a recurring task
  // This ensures recurring tasks are scheduled to a date that matches their recurrence pattern
  // IMPORTANT: Always returns a date in the future (after fromDate), never today or in the past
  const calculateFirstOccurrenceDate = (task: Task, fromDate: Date): Date | null => {
    if (!task.recurrence || task.recurrence.type === 'none') {
      logger.debug('Task has no recurrence', { taskId: task.id });
      return null;
    }

    const firstDate = new Date(fromDate);
    firstDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    

    switch (task.recurrence.type) {
      case 'daily':
        // For daily, first occurrence is always the next interval day(s) from fromDate
        // If fromDate is today, this ensures we schedule for tomorrow or later
        firstDate.setDate(firstDate.getDate() + task.recurrence.interval);
        // Ensure it's at least tomorrow (AI scheduler starts from tomorrow)
        if (firstDate <= today) {
          firstDate.setDate(today.getDate() + task.recurrence.interval);
        }
        break;
      
      case 'weekly':
        if (task.recurrence.daysOfWeek && Array.isArray(task.recurrence.daysOfWeek) && task.recurrence.daysOfWeek.length > 0) {
          const currentDay = firstDate.getDay();
          const sortedDays = [...task.recurrence.daysOfWeek].sort((a, b) => a - b);
          
          // Find the next matching day AFTER today (not today)
          // This ensures we always schedule for a future date
          const nextDayInWeek = sortedDays.find(day => day > currentDay);
          if (nextDayInWeek !== undefined) {
            // Found a day later in the current week
            firstDate.setDate(firstDate.getDate() + (nextDayInWeek - currentDay));
          } else {
            // No more days in current week, go to first day of next interval week
            const daysUntilNextWeek = TIMING_CONSTANTS.calendar.daysPerWeek - currentDay;
            const daysToFirstDay = sortedDays[0];
            const daysToAdd = daysUntilNextWeek + daysToFirstDay + (TIMING_CONSTANTS.calendar.daysPerWeek * (task.recurrence.interval - 1));
            firstDate.setDate(firstDate.getDate() + daysToAdd);
          }
          // Ensure it's at least tomorrow
          if (firstDate <= today) {
            // If we calculated today or earlier, find the next occurrence
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowDay = tomorrow.getDay();
            const nextDayAfterTomorrow = sortedDays.find(day => day > tomorrowDay);
            if (nextDayAfterTomorrow !== undefined) {
              firstDate.setTime(tomorrow.getTime());
              firstDate.setDate(firstDate.getDate() + (nextDayAfterTomorrow - tomorrowDay));
            } else {
              const daysUntilNextWeek = TIMING_CONSTANTS.calendar.daysPerWeek - tomorrowDay;
              const daysToFirstDay = sortedDays[0];
              const daysToAdd = daysUntilNextWeek + daysToFirstDay + (TIMING_CONSTANTS.calendar.daysPerWeek * (task.recurrence.interval - 1));
              firstDate.setTime(tomorrow.getTime());
              firstDate.setDate(firstDate.getDate() + daysToAdd);
            }
          }
        } else {
          // Simple weekly: same day of week every interval weeks
          const fromDayOfWeek = firstDate.getDay();
          firstDate.setDate(firstDate.getDate() + (TIMING_CONSTANTS.calendar.daysPerWeek * task.recurrence.interval));
          // Ensure it's at least tomorrow
          if (firstDate <= today) {
            firstDate.setDate(firstDate.getDate() + (TIMING_CONSTANTS.calendar.daysPerWeek * task.recurrence.interval));
          }
        }
        break;
      
      case 'monthly':
        if (task.recurrence.dayOfMonth) {
          // Set to the specified day of month
          const maxDayInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
          const dayOfMonth = Math.min(task.recurrence.dayOfMonth, maxDayInMonth);
          
          // If the day has passed this month, move to next month
          if (firstDate.getDate() > dayOfMonth || (firstDate.getDate() === dayOfMonth && firstDate.getHours() > 0)) {
            firstDate.setMonth(firstDate.getMonth() + task.recurrence.interval);
            const nextMaxDay = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
            firstDate.setDate(Math.min(task.recurrence.dayOfMonth, nextMaxDay));
          } else {
            firstDate.setDate(dayOfMonth);
          }
        } else {
          // Same day of month, next interval
          firstDate.setMonth(firstDate.getMonth() + task.recurrence.interval);
        }
        break;
      
      default:
        logger.warn('Unknown recurrence type', {
          taskId: task.id,
          recurrenceType: task.recurrence.type,
        });
        return null;
    }

    logger.debug('Calculated first occurrence date', {
      taskId: task.id,
      firstOccurrence: getDateString(firstDate),
    });
    
    return firstDate;
  };

  // Helper: Determine task category from tags
  const getTaskCategory = (task: Task): 'work' | 'personal' | 'projects' | null => {
    if (!task.tags || task.tags.length === 0) return null;
    return getCategoryFromTags(task.tags);
  };

  // Helper: Check if date is weekend
  const isWeekend = isWeekendDate;

  // Helper: Parse time string (HH:mm) to hours and minutes
  const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  };

  // Helper: Get appropriate time slot based on category and date
  // taskDurationMinutes: Duration of the task in minutes (for consistent gap checking)
  const getCategoryTimeSlot = (
    task: Task, 
    scheduleDate: Date, 
    timeSlot: number,
    forceCategoryHours: boolean = false,
    existingTasksForDay: Task[] = [],
    taskDurationMinutes?: number, // Optional: if provided, use this instead of task.estimatedTime
    calendarEventsForDay: ConflictCalendarEvent[] = [],
  ): { hours: number; minutes: number; reason: string } | null => {
    // When forceCategoryHours is true, always use category hours regardless of respectHours setting
    if (!forceCategoryHours && !hoursSettings.respectHours) return null;

    let category = getTaskCategory(task);
    // CRITICAL FIX: If forceCategoryHours is true but task has no category, use default category
    // This ensures recurring tasks always get a valid time slot even without category tags
    if (!category && forceCategoryHours) {
      category = DEFAULT_TASK_CATEGORY; // Default category for recurring tasks without category tags
    }
    if (!category) return null;

    const calendarBlocks = buildCalendarConflictBlocksForDay(calendarEventsForDay, scheduleDate);
    const slotConflictsWithCalendar = (startMs: number, durationMin: number) =>
      calendarBlocks.some((block) => {
        const expanded = expandCalendarBlockForSchedulingPrep(
          block.start,
          block.end,
          AI_SCHEDULING_PREP_BUFFER_MS,
        );
        return scheduleBlocksConflict(
          startMs,
          startMs + durationMin * MILLISECONDS_PER_MINUTE,
          expanded.start,
          expanded.end,
        );
      });

    const isWeekendDate = isWeekend(scheduleDate);
    const dayHours = isWeekendDate ? hoursSettings.weekendHours : hoursSettings.weekdayHours;
    const categoryHours = dayHours[category];

    // Check if scheduling for today
    const today = new Date();
    const scheduleDateKey = getDateKey(scheduleDate);
    const todayDateKey = getDateKey(today);
    const isToday = scheduleDateKey === todayDateKey;
    
    // Calculate current time rounded up to next interval (for today)
    let currentTimeRounded: Date | null = null;
    if (isToday) {
      currentTimeRounded = new Date(today);
      const minutes = currentTimeRounded.getMinutes();
      const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
      if (roundedMinutes >= MINUTES_PER_HOUR) {
        currentTimeRounded.setHours(currentTimeRounded.getHours() + 1, 0, 0, 0);
      } else {
        currentTimeRounded.setMinutes(roundedMinutes, 0, 0);
      }
      currentTimeRounded.setSeconds(0, 0);
      currentTimeRounded.setMilliseconds(0);
    }

    // If category hours are disabled for this day type, return null to use default
    // But when forceCategoryHours is true, we should still try to schedule within reasonable hours
    if (!categoryHours.enabled) {
      // If forcing category hours but category is disabled, use default work hours as fallback
      if (forceCategoryHours) {
        // Use default category hours as the time window (e.g., 9:00-17:00 for work)
        const defaultStartHour = DEFAULT_CATEGORY_HOURS[category] || DEFAULT_CATEGORY_HOURS[DEFAULT_TASK_CATEGORY];
        const defaultEndHour = Math.min(defaultStartHour + DEFAULT_CATEGORY_WORK_WINDOW_HOURS, AI_SCHEDULER_MAX_END_HOUR);
        const defaultTotalHours = defaultEndHour - defaultStartHour;
        
        // Determine the earliest time we can schedule
        let earliestAllowedTime = new Date(scheduleDate);
        earliestAllowedTime.setHours(defaultStartHour, 0, 0, 0);
        
        // For today, ensure we don't schedule before current time
        if (isToday && currentTimeRounded && currentTimeRounded > earliestAllowedTime) {
          earliestAllowedTime = currentTimeRounded;
        }
        
        // CRITICAL FIX: Check for existing tasks and distribute time slots properly
        // This ensures recurring tasks don't all get scheduled at the same default time
        const sameCategoryTasks = existingTasksForDay.filter(t => {
          const cat = getTaskCategory(t);
          if (cat !== category) return false;
          if (!t.scheduledDate) return false;
          const scheduledDate = typeof t.scheduledDate === 'string' 
            ? parseTaskScheduledDate(t.scheduledDate)
            : parseTaskScheduledDate(t.scheduledDate);
          return !isNaN(scheduledDate.getTime()) && (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
        });
        
        // If there are existing tasks, find gaps or place after last task
        if (sameCategoryTasks.length > 0) {
          const sortedCategoryTasks = [...sameCategoryTasks].sort((a, b) => {
            const aDate = parseTaskScheduledDate(a.scheduledDate);
            const bDate = parseTaskScheduledDate(b.scheduledDate);
            return aDate.getTime() - bDate.getTime();
          });
          
          // Find gaps between existing tasks
          for (let i = 0; i < sortedCategoryTasks.length; i++) {
            const currentTask = sortedCategoryTasks[i];
            if (!currentTask.scheduledDate) continue;
            
            const currentTaskStart = typeof currentTask.scheduledDate === 'string'
              ? parseTaskScheduledDate(currentTask.scheduledDate)
              : parseTaskScheduledDate(currentTask.scheduledDate);
            const currentTaskDuration = getTaskMinutes(currentTask, { useCachedAIAnalysis: true });
            const currentTaskEnd = new Date(currentTaskStart);
            currentTaskEnd.setMinutes(currentTaskEnd.getMinutes() + currentTaskDuration);
            
            let gapStart: Date;
            if (i === 0) {
              gapStart = new Date(earliestAllowedTime);
            } else {
              const prevTask = sortedCategoryTasks[i - 1];
              if (!prevTask.scheduledDate) continue;
              const prevTaskStart = typeof prevTask.scheduledDate === 'string'
                ? parseTaskScheduledDate(prevTask.scheduledDate)
                : parseTaskScheduledDate(prevTask.scheduledDate);
              const prevTaskDuration = getTaskMinutes(prevTask, { useCachedAIAnalysis: true });
              gapStart = new Date(prevTaskStart);
              gapStart.setMinutes(gapStart.getMinutes() + prevTaskDuration);
            }
            
            if (gapStart < earliestAllowedTime) {
              gapStart = new Date(earliestAllowedTime);
            }
            
            const gapDuration = (currentTaskStart.getTime() - gapStart.getTime()) / MILLISECONDS_PER_MINUTE;
            const taskDuration = taskDurationMinutes ?? getTaskMinutes(task, { useCachedAIAnalysis: true });
            
            if (gapDuration >= taskDuration) {
              return {
                hours: gapStart.getHours(),
                minutes: gapStart.getMinutes(),
                reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled in gap (category hours disabled, using default)`
              };
            }
          }
          
          // No gap found - place after last task
          const lastTask = sortedCategoryTasks[sortedCategoryTasks.length - 1];
          if (lastTask.scheduledDate) {
            const lastTaskStart = typeof lastTask.scheduledDate === 'string' 
              ? parseTaskScheduledDate(lastTask.scheduledDate)
              : parseTaskScheduledDate(lastTask.scheduledDate);
            const lastTaskDuration = getTaskMinutes(lastTask, { useCachedAIAnalysis: true });
            const nextAvailableTime = new Date(lastTaskStart);
            nextAvailableTime.setMinutes(nextAvailableTime.getMinutes() + lastTaskDuration);
            
            // Round to nearest interval
            const roundedMinutes = Math.ceil(nextAvailableTime.getMinutes() / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
            if (roundedMinutes >= MINUTES_PER_HOUR) {
              nextAvailableTime.setHours(nextAvailableTime.getHours() + 1, 0, 0, 0);
            } else {
              nextAvailableTime.setMinutes(roundedMinutes, 0, 0);
            }
            
            // Ensure we don't exceed default end hour
            if (nextAvailableTime.getHours() < defaultEndHour) {
              return {
                hours: nextAvailableTime.getHours(),
                minutes: nextAvailableTime.getMinutes(),
                reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled after other tasks (category hours disabled, using default)`
              };
            }
          }
        }
        
        // No existing tasks or couldn't find a slot - use time slot distribution
        const numSlots = DEFAULT_TIME_SLOTS;
        const slotPosition = timeSlot % numSlots;
        const offsetHours = (defaultTotalHours / numSlots) * slotPosition;
        
        const finalHours = Math.floor(defaultStartHour + offsetHours);
        const finalMinutes = Math.round((defaultStartHour + offsetHours - finalHours) * MINUTES_PER_HOUR);
        
        // Round minutes to nearest interval
        const roundedFinalMinutes = Math.round(finalMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
        const adjustedFinalHours = finalHours + Math.floor(roundedFinalMinutes / MINUTES_PER_HOUR);
        const adjustedFinalMinutes = roundedFinalMinutes % MINUTES_PER_HOUR;
        
        // For today, ensure we don't schedule before current time
        if (isToday && currentTimeRounded) {
          const proposedTime = new Date(scheduleDate);
          proposedTime.setHours(adjustedFinalHours, adjustedFinalMinutes, 0, 0);
          if (proposedTime < currentTimeRounded) {
            return {
              hours: currentTimeRounded.getHours(),
              minutes: currentTimeRounded.getMinutes(),
              reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled from current time (category hours disabled)`
            };
          }
        }
        
        // CRITICAL SAFEGUARD: Ensure we never return midnight (0:00) for any task
        // This is especially important for recurring tasks which must have valid times
        if (adjustedFinalHours === 0 && adjustedFinalMinutes === 0) {
          // If somehow we calculated midnight, use default start hour instead
          logger.warn('CRITICAL: getCategoryTimeSlot calculated midnight (category disabled), using default start hour', {
            taskId: task.id,
            category,
            defaultStartHour,
          });
          return {
            hours: defaultStartHour,
            minutes: 0,
            reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled at default start (midnight safeguard)`
          };
        }
        
        return {
          hours: adjustedFinalHours,
          minutes: adjustedFinalMinutes,
          reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled (category hours disabled, using default)`
        };
      }
      return null;
    }

    const startTime = parseTime(categoryHours.start);
    const endTime = parseTime(categoryHours.end);

    // Calculate total available hours
    const totalMinutes = (endTime.hours * MINUTES_PER_HOUR + endTime.minutes) - (startTime.hours * MINUTES_PER_HOUR + startTime.minutes);
    const totalHours = totalMinutes / MINUTES_PER_HOUR;

    // Get existing tasks in the same category for this day
    // existingTasksForDay now includes tasks from the current plan, so this should see all tasks
    // CRITICAL: Filter to only include tasks with valid scheduled times (not midnight)
    // This ensures we see tasks that have been fully scheduled, not just tasks with dates
    // This is the KEY fix - tasks from the plan must be visible here!
    const sameCategoryTasks = existingTasksForDay.filter(t => {
      const cat = getTaskCategory(t);
      if (cat !== category) return false;
      if (!t.scheduledDate) return false;
      // Parse and verify the scheduled time is valid (not just midnight)
      const scheduledDate = typeof t.scheduledDate === 'string' 
        ? parseTaskScheduledDate(t.scheduledDate)
        : parseTaskScheduledDate(t.scheduledDate);
      // Only include tasks with valid times (not just midnight/00:00:00)
      // This is critical - we must see tasks from the plan that have been scheduled!
      return !isNaN(scheduledDate.getTime()) && (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
    });
    
    // Determine the earliest time we can schedule
    const categoryStart = new Date(scheduleDate);
    categoryStart.setHours(startTime.hours, startTime.minutes, 0, 0);
    
    // For today, ensure we don't schedule before current time
    let earliestAllowedTime = categoryStart;
    if (isToday && currentTimeRounded) {
      // Use the later of: category start or current time rounded up
      earliestAllowedTime = currentTimeRounded > categoryStart ? currentTimeRounded : categoryStart;
    }
    
    // If there are existing tasks in this category, try to find gaps or distribute evenly
    // IMPORTANT: Use sameCategoryTasks.length (not timeSlot) to ensure proper distribution
    // The timeSlot parameter is already calculated based on categoryTasksCount, but we need
    // to ensure tasks are distributed based on actual existing tasks, not just the slot number
    if (sameCategoryTasks.length > 0) {
      // Sort existing tasks by scheduled time
      // CRITICAL: Ensure we parse scheduledDate correctly (could be ISO string or Date object)
      // This is especially important for tasks from the plan which are ISO strings
      const sortedCategoryTasks = [...sameCategoryTasks].sort((a, b) => {
        if (!a.scheduledDate || !b.scheduledDate) return 0;
        const aDate = parseTaskScheduledDate(a.scheduledDate);
        const bDate = parseTaskScheduledDate(b.scheduledDate);
        return aDate.getTime() - bDate.getTime();
      });
      
      // Find gaps between existing category tasks
      for (let i = 0; i < sortedCategoryTasks.length; i++) {
        const currentTask = sortedCategoryTasks[i];
        if (!currentTask.scheduledDate) continue;
        
        // CRITICAL: Parse scheduledDate correctly (could be ISO string or Date object)
        // This is especially important for tasks from the plan which are ISO strings
        const currentTaskStart = typeof currentTask.scheduledDate === 'string'
          ? parseTaskScheduledDate(currentTask.scheduledDate)
          : parseTaskScheduledDate(currentTask.scheduledDate);
        const currentTaskDuration = getTaskMinutes(currentTask); // Use AI estimator for existing tasks
        const currentTaskEnd = new Date(currentTaskStart);
        currentTaskEnd.setMinutes(currentTaskEnd.getMinutes() + currentTaskDuration);
        
        // Check if there's a gap before this task
        let gapStart: Date;
        if (i === 0) {
          // First task - check gap from earliest allowed time (category start or current time for today)
          gapStart = new Date(earliestAllowedTime);
        } else {
          // Gap from previous task end
          const prevTask = sortedCategoryTasks[i - 1];
          if (!prevTask.scheduledDate) continue;
          // CRITICAL: Parse scheduledDate correctly (could be ISO string or Date object)
          const prevTaskStart = typeof prevTask.scheduledDate === 'string'
            ? parseTaskScheduledDate(prevTask.scheduledDate)
            : parseTaskScheduledDate(prevTask.scheduledDate);
          const prevTaskDuration = getTaskMinutes(prevTask); // Use AI estimator for existing tasks
          gapStart = new Date(prevTaskStart);
          gapStart.setMinutes(gapStart.getMinutes() + prevTaskDuration);
          gapStart.setTime(gapStart.getTime() + AI_SCHEDULING_PREP_BUFFER_MS);
        }
        
        // Ensure gap start is not before earliest allowed time
        if (gapStart < earliestAllowedTime) {
          gapStart = new Date(earliestAllowedTime);
        }
        
        // Reserve prep time before the next task starts
        const gapEndMs = currentTaskStart.getTime() - AI_SCHEDULING_PREP_BUFFER_MS;
        const gapDuration = (gapEndMs - gapStart.getTime()) / MILLISECONDS_PER_MINUTE;
        // Use provided duration if available, otherwise use AI estimator
        // Uses cached AI Analysis results for consistency
        const taskDuration = taskDurationMinutes ?? getTaskMinutes(task, { useCachedAIAnalysis: true });
        
        // If gap is large enough for this task and clear of calendar events, use it
        if (gapDuration >= taskDuration && gapDuration > 0 && !slotConflictsWithCalendar(gapStart.getTime(), taskDuration)) {
          return {
            hours: gapStart.getHours(),
            minutes: gapStart.getMinutes(),
            reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled in ${isWeekendDate ? 'weekend' : 'weekday'} ${category} hours gap`
          };
        }
      }
      
      // No gap found - place after last category task
      const lastTask = sortedCategoryTasks[sortedCategoryTasks.length - 1];
      if (lastTask.scheduledDate) {
        const lastTaskStart = typeof lastTask.scheduledDate === 'string' 
          ? parseTaskScheduledDate(lastTask.scheduledDate)
          : parseTaskScheduledDate(lastTask.scheduledDate);
        const lastTaskDuration = getTaskMinutes(lastTask); // Use AI estimator for existing tasks
        let nextAvailableTime = new Date(lastTaskStart);
        nextAvailableTime.setMinutes(nextAvailableTime.getMinutes() + lastTaskDuration);
        nextAvailableTime.setTime(nextAvailableTime.getTime() + AI_SCHEDULING_PREP_BUFFER_MS);
        
        // CRITICAL: Check if this time conflicts with any other tasks from the plan
        // Even though we're placing after the last task, there might be tasks in the plan
        // that were scheduled after this last task but before we calculated nextAvailableTime
        const nextAvailableTimeMs = nextAvailableTime.getTime();
        // Uses cached AI Analysis results for consistency
        const taskDuration = taskDurationMinutes ?? getTaskMinutes(task, { useCachedAIAnalysis: true });
        const nextAvailableEndMs = nextAvailableTimeMs + (taskDuration * MILLISECONDS_PER_MINUTE);
        
        // Check all tasks in existingTasksForDay (which includes tasks from the plan) for conflicts
        let maxConflictEnd = nextAvailableTimeMs;
        let hasConflict = false;
        
        for (const existingTask of existingTasksForDay) {
          if (!existingTask.scheduledDate) continue;
          
          // Only check tasks with valid scheduled times (not midnight)
          const existingTaskScheduledDate = typeof existingTask.scheduledDate === 'string'
            ? parseTaskScheduledDate(existingTask.scheduledDate)
            : parseTaskScheduledDate(existingTask.scheduledDate);
          const hasValidTime = !isNaN(existingTaskScheduledDate.getTime()) && 
            (existingTaskScheduledDate.getHours() !== 0 || existingTaskScheduledDate.getMinutes() !== 0);
          if (!hasValidTime) continue;
          
          const existingTaskStart = existingTaskScheduledDate.getTime();
          const existingTaskDuration = getTaskMinutes(existingTask, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE;
          const existingTaskEnd = existingTaskStart + existingTaskDuration;
          
          if (aiSchedulingTaskBlockConflicts(
            nextAvailableTimeMs,
            nextAvailableEndMs,
            existingTaskStart,
            existingTaskEnd,
            AI_SCHEDULING_PREP_BUFFER_MS,
          )) {
            hasConflict = true;
            maxConflictEnd = Math.max(
              maxConflictEnd,
              expandTaskBlockEndForSchedulingPrep(existingTaskEnd, AI_SCHEDULING_PREP_BUFFER_MS),
            );
          }
        }

        for (const block of calendarBlocks) {
          const expandedBlock = expandCalendarBlockForSchedulingPrep(
            block.start,
            block.end,
            AI_SCHEDULING_PREP_BUFFER_MS,
          );
          if (scheduleBlocksConflict(nextAvailableTimeMs, nextAvailableEndMs, expandedBlock.start, expandedBlock.end)) {
            hasConflict = true;
            maxConflictEnd = Math.max(maxConflictEnd, expandedBlock.end);
          }
        }
        
        // If conflicts found, move to after ALL conflicting tasks
        if (hasConflict) {
          nextAvailableTime = new Date(maxConflictEnd);
        }
        
        // CRITICAL: Round to nearest interval to avoid scheduling at odd times
        const roundedMinutes = Math.ceil(nextAvailableTime.getMinutes() / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
        if (roundedMinutes >= MINUTES_PER_HOUR) {
          nextAvailableTime.setHours(nextAvailableTime.getHours() + 1, 0, 0, 0);
        } else {
          nextAvailableTime.setMinutes(roundedMinutes, 0, 0);
        }
        nextAvailableTime.setSeconds(0, 0);
        nextAvailableTime.setMilliseconds(0);
        
        // For today, ensure we don't schedule before current time
        if (isToday && currentTimeRounded && nextAvailableTime < currentTimeRounded) {
          nextAvailableTime.setTime(currentTimeRounded.getTime());
        }
        
        // Ensure we don't exceed category end time (check that task END time fits)
        const categoryEnd = new Date(scheduleDate);
        categoryEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
        const categoryEndMs = categoryEnd.getTime();
        const nextAvailableEndAfterAdjustment = nextAvailableTime.getTime() + (taskDuration * MILLISECONDS_PER_MINUTE);
        
        if (nextAvailableEndAfterAdjustment <= categoryEndMs) {
          return {
            hours: nextAvailableTime.getHours(),
            minutes: nextAvailableTime.getMinutes(),
            reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled after other ${category} tasks in ${isWeekendDate ? 'weekend' : 'weekday'} hours`
          };
        }
      }
    }
    
    // No existing tasks or no gaps - distribute evenly across the available time window
    // Use more slots for better distribution (DEFAULT_TIME_SLOTS slots)
    // IMPORTANT: Use the timeSlot parameter that was calculated based on totalCategoryTasksCount
    // This ensures tasks scheduled in the same batch get different time slots based on their
    // position in the batch, not just the count of existing tasks
    const numSlots = DEFAULT_TIME_SLOTS;
    // Use the timeSlot parameter that was passed in, which is already calculated based on
    // existingCategoryTasksCount + planCategoryTasksCount, ensuring proper distribution
    const slotPosition = timeSlot % numSlots;
    const offsetHours = (totalHours / numSlots) * slotPosition;

    const finalHours = Math.floor(startTime.hours + offsetHours);
    const finalMinutes = Math.round((startTime.hours + offsetHours - finalHours) * MINUTES_PER_HOUR + startTime.minutes);
    
    // CRITICAL: Round minutes to nearest interval to ensure clean scheduling times
    const roundedFinalMinutes = Math.round(finalMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
    const adjustedFinalHours = finalHours + Math.floor(roundedFinalMinutes / MINUTES_PER_HOUR);
    const adjustedFinalMinutes = roundedFinalMinutes % MINUTES_PER_HOUR;
    
    // CRITICAL: Before returning, check if this time conflicts with any tasks from the plan
    // This is a safeguard to prevent returning the same time when tasks are being scheduled in the same batch
    // Even if sameCategoryTasks was empty or didn't find gaps, we need to check if the calculated time
    // conflicts with tasks that are already in the plan (which might have been scheduled just before this call)
    const calculatedTime = new Date(scheduleDate);
    calculatedTime.setHours(adjustedFinalHours, adjustedFinalMinutes, 0, 0);
    const calculatedTimeMs = calculatedTime.getTime();
    // Uses cached AI Analysis results for consistency
    const taskDuration = taskDurationMinutes ?? getTaskMinutes(task, { useCachedAIAnalysis: true });
    const calculatedEndMs = calculatedTimeMs + (taskDuration * MILLISECONDS_PER_MINUTE);
    
    // BUG FIX 1: Sort tasks by scheduled time before checking conflicts
    // This ensures we check all conflicts and find the maximum conflict end time
    // If tasks are not sorted, we might return a time that conflicts with earlier-checked tasks
    // BUG FIX 2: Filter to only include tasks with valid scheduled times (not midnight)
    // This matches the gap-finding logic which excludes midnight-time tasks
    // CRITICAL: Use existingTasksForDay which is passed as a parameter - this should include tasks from the plan
    // when called from generateSchedulePlan, but we need to verify it's the combined list
    const scheduledTasksForConflictCheck = existingTasksForDay
      .filter(t => {
        if (!t.scheduledDate) return false;
        // CRITICAL: Only include tasks with valid scheduled times (not just midnight/00:00:00)
        // This matches the gap-finding logic at lines 368-379 which excludes midnight-time tasks
        // This prevents false conflicts with tasks that have dates but no actual scheduled times
        const scheduledDate = typeof t.scheduledDate === 'string'
          ? parseTaskScheduledDate(t.scheduledDate)
          : parseTaskScheduledDate(t.scheduledDate);
        const hasValidTime = !isNaN(scheduledDate.getTime()) && (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
        return hasValidTime;
      })
      .map(t => {
        const existingTaskStart = typeof t.scheduledDate === 'string'
          ? parseTaskScheduledDate(t.scheduledDate).getTime()
          : parseTaskScheduledDate(t.scheduledDate).getTime();
        const existingTaskDuration = getTaskMinutes(t, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE;
        const existingTaskEnd = existingTaskStart + existingTaskDuration;
        return {
          task: t,
          start: existingTaskStart,
          end: existingTaskEnd,
        };
      })
      .sort((a, b) => a.start - b.start); // Sort by start time
    
    // Check for conflicts with all tasks and track the maximum conflict end time
    let hasConflict = false;
    let maxConflictEnd = calculatedTimeMs;
    
    for (const existingTaskInfo of scheduledTasksForConflictCheck) {
      if (aiSchedulingTaskBlockConflicts(
        calculatedTimeMs,
        calculatedEndMs,
        existingTaskInfo.start,
        existingTaskInfo.end,
        AI_SCHEDULING_PREP_BUFFER_MS,
      )) {
        hasConflict = true;
        // Track the latest end time of all conflicts (not just the first one)
        maxConflictEnd = Math.max(
          maxConflictEnd,
          expandTaskBlockEndForSchedulingPrep(existingTaskInfo.end, AI_SCHEDULING_PREP_BUFFER_MS),
        );
      }
    }

    for (const block of calendarBlocks) {
      const expandedBlock = expandCalendarBlockForSchedulingPrep(
        block.start,
        block.end,
        AI_SCHEDULING_PREP_BUFFER_MS,
      );
      if (scheduleBlocksConflict(calculatedTimeMs, calculatedEndMs, expandedBlock.start, expandedBlock.end)) {
        hasConflict = true;
        maxConflictEnd = Math.max(maxConflictEnd, expandedBlock.end);
      }
    }
    
    // If conflicts found, move to after ALL conflicting tasks
    if (hasConflict) {
      // Move to after the latest conflict end time (prep buffer already included)
      const conflictFreeTime = new Date(maxConflictEnd);
      // Round up to nearest interval
      const conflictMinutes = conflictFreeTime.getMinutes();
      const roundedConflictMinutes = Math.ceil(conflictMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
      if (roundedConflictMinutes >= MINUTES_PER_HOUR) {
        conflictFreeTime.setHours(conflictFreeTime.getHours() + 1, 0, 0, 0);
      } else {
        conflictFreeTime.setMinutes(roundedConflictMinutes, 0, 0);
      }
      conflictFreeTime.setSeconds(0, 0);
      conflictFreeTime.setMilliseconds(0);
      
      // BUG FIX 2: Check that the task's END time (start + duration) fits within category hours
      // The previous check only verified the start time, which could allow tasks to exceed category end
      const conflictFreeTimeMs = conflictFreeTime.getTime();
      const conflictFreeEndMs = conflictFreeTimeMs + (taskDuration * MILLISECONDS_PER_MINUTE);
      const categoryEnd = new Date(scheduleDate);
      categoryEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
      const categoryEndMs = categoryEnd.getTime();
      
      // Only return the conflict-free time if the entire task (start + duration) fits within category hours
      if (conflictFreeEndMs <= categoryEndMs) {
        return {
          hours: conflictFreeTime.getHours(),
          minutes: conflictFreeTime.getMinutes(),
          reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled after conflict (from getCategoryTimeSlot)`
        };
      }
      
      // BUG FIX 1: If conflict-free time (including duration) exceeds category end, we cannot return
      // the original calculated time as it still conflicts. Instead, try to find a gap earlier in the day
      // that fits both the task duration and category hours, or return null to let findNextAvailableSlot handle it
      
      // Try to find a gap before the conflicts that fits the task
      // We'll check gaps between existing tasks, working backwards from the first conflict
      for (let i = sameCategoryTasksForConflictCheck.length - 1; i >= 0; i--) {
        const taskBeforeGap = sameCategoryTasksForConflictCheck[i];
        const gapEnd = taskBeforeGap.start - AI_SCHEDULING_PREP_BUFFER_MS; // Gap ends before next item with prep time
        
        // Find the task before this one (or category start if this is the first task)
        let gapStart: number;
        if (i === 0) {
          gapStart = earliestAllowedTime.getTime();
        } else {
          const prevTask = sameCategoryTasksForConflictCheck[i - 1];
          gapStart = expandTaskBlockEndForSchedulingPrep(prevTask.end, AI_SCHEDULING_PREP_BUFFER_MS);
        }
        
        // Calculate gap duration
        const gapDuration = (gapEnd - gapStart) / MILLISECONDS_PER_MINUTE;
        
        // If gap is large enough and the task would fit within category hours
        if (gapDuration >= taskDuration) {
          const gapTime = new Date(gapStart);
          const gapTimeMs = gapTime.getTime();
          const gapEndMs = gapTimeMs + (taskDuration * MILLISECONDS_PER_MINUTE);
          
          // Ensure the gap time fits within category hours and does not overlap calendar events
          if (gapEndMs <= categoryEndMs && !slotConflictsWithCalendar(gapTimeMs, taskDuration)) {
            // Round to nearest interval
            const gapMinutes = gapTime.getMinutes();
            const roundedGapMinutes = Math.round(gapMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
            const adjustedGapHours = gapTime.getHours() + Math.floor(roundedGapMinutes / MINUTES_PER_HOUR);
            const adjustedGapMinutes = roundedGapMinutes % MINUTES_PER_HOUR;
            
            return {
              hours: adjustedGapHours,
              minutes: adjustedGapMinutes,
              reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled in gap before conflict (from getCategoryTimeSlot)`
            };
          }
        }
      }
      
      // If no suitable gap found, return null to let findNextAvailableSlot handle it
      // This prevents returning a conflicting time
      return null;
    }
    
    // Ensure we don't exceed category end time
    const categoryEndMinutes = endTime.hours * MINUTES_PER_HOUR + endTime.minutes;
    const finalTotalMinutes = adjustedFinalHours * MINUTES_PER_HOUR + adjustedFinalMinutes;
    if (finalTotalMinutes >= categoryEndMinutes) {
      // Use category start time if we've exceeded
      return {
        hours: startTime.hours,
        minutes: startTime.minutes,
        reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled at start of ${isWeekendDate ? 'weekend' : 'weekday'} ${category} hours`
      };
    }

    // CRITICAL SAFEGUARD: Ensure we never return midnight (0:00) for any task
    // This is especially important for recurring tasks which must have valid times
    if (adjustedFinalHours === 0 && adjustedFinalMinutes === 0) {
      // If somehow we calculated midnight, use category start time instead
      logger.warn('CRITICAL: getCategoryTimeSlot calculated midnight, using category start time', {
        taskId: task.id,
        category,
        isWeekendDate,
        startTime: `${startTime.hours}:${startTime.minutes}`,
      });
      return {
        hours: startTime.hours,
        minutes: startTime.minutes,
        reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled at start of ${isWeekendDate ? 'weekend' : 'weekday'} ${category} hours (midnight safeguard)`
      };
    }

    const dayType = isWeekendDate ? 'weekend' : 'weekday';
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

    // For today, never return a distributed slot in the past or after category end
    if (isToday && currentTimeRounded) {
      const proposedTime = new Date(scheduleDate);
      proposedTime.setHours(adjustedFinalHours, adjustedFinalMinutes, 0, 0);
      const categoryEnd = new Date(scheduleDate);
      categoryEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
      const taskDuration = taskDurationMinutes ?? getTaskMinutes(task, { useCachedAIAnalysis: true });
      const proposedEndMs = proposedTime.getTime() + taskDuration * MILLISECONDS_PER_MINUTE;

      if (proposedTime < currentTimeRounded || proposedEndMs > categoryEnd.getTime()) {
        const currentEndMs = currentTimeRounded.getTime() + taskDuration * MILLISECONDS_PER_MINUTE;
        if (currentEndMs <= categoryEnd.getTime()) {
          return {
            hours: currentTimeRounded.getHours(),
            minutes: currentTimeRounded.getMinutes(),
            reason: `${categoryName} task scheduled from current time during ${dayType} ${category} hours`,
          };
        }
        return null;
      }
    }
    
    return {
      hours: adjustedFinalHours,
      minutes: adjustedFinalMinutes,
      reason: `${categoryName} task scheduled during ${dayType} ${category} hours`
    };
  };

  /**
   * Generate a schedule plan for unscheduled tasks
   * 
   * GUIDELINES REFERENCE: See src/guidelines/AI_SCHEDULING_GUIDELINES.md for complete scheduling rules
   * 
   * Key principles:
   * 1. Differentiate recurring tasks (appear on multiple days) from regular tasks (single day)
   * 2. Find available time slots by checking all tasks (existing + plan + recurring)
   * 3. Maintain chronological order within each day
   * 4. Respect category hours rules for each task category
   * 5. Prevent conflicts by checking all tasks on the target date
   * 6. Handle recurring tasks by making them visible on all occurrence days
   */
  const generateSchedulePlan = async (
    tasksToSchedule?: Task[],
    dateRange?: { startDate: Date; endDate: Date },
    options?: { forceCategoryHours?: boolean; shuffle?: boolean; enforceMinimumHours?: boolean }
  ): Promise<ScheduleResult> => {
    // Always log this - critical for debugging AI Duration Estimator
    logger.debug('generateSchedulePlan called', {
      tasksToScheduleCount: tasksToSchedule?.length || 0,
      hasDateRange: !!dateRange,
    });
    
    const unscheduledTasks = tasksToSchedule || getUnscheduledTasks();
    
    logger.debug('Tasks to schedule', { count: unscheduledTasks.length });
    
    if (unscheduledTasks.length === 0) {
      return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
    }
    
    // Fetch calendar events for the date range
    // CRITICAL: Ensure startDate is never in the past - always use today as minimum
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = dateRange ? (() => {
      const rangeStart = new Date(dateRange.startDate);
      rangeStart.setHours(0, 0, 0, 0);
      // Never allow scheduling in the past - use today as minimum
      return rangeStart < today ? new Date(today) : rangeStart;
    })() : new Date(today);
    
    const endDate = dateRange ? new Date(dateRange.endDate) : (() => {
      const future = new Date(startDate);
      future.setDate(future.getDate() + (TWO_WEEKS_DAYS - 1));
      return future;
    })();
    endDate.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
    
    // Fetch calendar events asynchronously
    const calendarEvents = await fetchCalendarEvents(startDate, endDate);
    logger.debug('Fetched calendar events for auto scheduling', {
      eventCount: calendarEvents.length,
      dateRange: `${getDateString(startDate)} to ${getDateString(endDate)}`,
    });
    const calendarEventsForDay = (date: Date) => filterCalendarEventsForDay(calendarEvents, date);
    
    // Helper: Shuffle array using Fisher-Yates algorithm
    const shuffleArray = <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // startDate and endDate are already defined above when fetching calendar events
    
    // Initialize dailyHours with already scheduled tasks
    const dailyHours: Map<string, number> = new Map();
    const dailyTasks: Map<string, Task[]> = new Map();
    
    // Helper: Intelligently estimate task duration based on task properties
    // Use shared AI Duration Estimator functions from daily-hours-utils
    // These functions use the formula: Base × Effort × Priority × Complexity
    // Effort and complexity are automatically calculated from verb analysis and task properties
    // The functions are imported from daily-hours-utils.ts to ensure consistency across the app
    
    // Pre-populate dailyHours with existing scheduled tasks
    // BUT: If we're rescheduling within a date range, exclude tasks being rescheduled
    // This ensures we don't double-count tasks that are being rescheduled
    const tasksBeingRescheduled = tasksToSchedule ? new Set(tasksToSchedule.map(t => t.id)) : new Set();
    
    // IMPORTANT: Use isDateInRecurrence to properly include both recurring and non-recurring tasks
    // This ensures recurring tasks are included for all days they occur on, not just their base scheduledDate
    tasks.forEach(task => {
      if (task.status === 'done') {
        return; // Skip done tasks
      }
      
      // Skip tasks that are being rescheduled (they'll be rescheduled)
      if (tasksBeingRescheduled.has(task.id)) {
        return; // Skip this task, it's being rescheduled
      }
      
      // For tasks without scheduledDate, skip (they'll be scheduled)
      if (!task.scheduledDate) {
        return;
      }
      
      // Check all days in the date range to see if this task applies
      // This ensures recurring tasks are included for all days they occur on
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = getDateKey(currentDate);
        
        // NOTE: We ALWAYS include existing scheduled tasks in dailyTasks/dailyHours
        // even when a date range is provided. The task filtering (tasksBeingRescheduled)
        // handles which tasks to skip - we should NOT skip all tasks in the date range!
        // This ensures "Schedule All" sees existing tasks and avoids conflicts.
        // The old logic skipped ALL tasks in date range, causing conflicts with existing tasks.
        
        // Check if this task applies to this date (works for both recurring and non-recurring)
        // Use isDateInRecurrence which handles both cases correctly
        if (isDateInRecurrence(task, currentDate)) {
          const taskHours = getTaskHours(task, { useCachedAIAnalysis: true });
          const currentHours = dailyHours.get(dateKey) || 0;
          dailyHours.set(dateKey, currentHours + taskHours);
          
          // Track existing tasks per day
          // This ensures both recurring and non-recurring tasks are included
          const tasksForDay = dailyTasks.get(dateKey) || [];
          // Only add if not already in the list (avoid duplicates for recurring tasks)
          if (!tasksForDay.find(t => t.id === task.id)) {
            tasksForDay.push(task);
            dailyTasks.set(dateKey, tasksForDay);
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Sort tasks by priority and status for intelligent scheduling
    // ALWAYS prioritize urgent and high priority tasks first, regardless of settings
    let sortedTasks = [...unscheduledTasks].sort((a, b) => {
      // ALWAYS prioritize urgent and high, regardless of priorityBasedScheduling setting
      const aPriority = PRIORITY_WEIGHTS[a.priority] || 1;
      const bPriority = PRIORITY_WEIGHTS[b.priority] || 1;
      
      const aStatus = STATUS_WEIGHTS[a.status] || 0;
      const bStatus = STATUS_WEIGHTS[b.status] || 0;
      
      // First sort by status (in-progress first)
      if (aStatus !== bStatus) return bStatus - aStatus;
      
      // Then by priority (urgent first, then high, medium, low)
      // This ensures urgent and high priority tasks are always scheduled first
      if (aPriority !== bPriority) return bPriority - aPriority;
    
      // Then by due date (if exists)
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      
      // Fallback to created date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    // Shuffle tasks if requested (for rescheduling to create variety)
    if (options?.shuffle) {
      // For rescheduling, perform a more complete shuffle while maintaining critical priorities
      // Keep urgent, high priority, and in-progress tasks at the front, but shuffle everything else more thoroughly
      const priorityTasks = sortedTasks.filter(t => 
        t.priority === 'urgent' || 
        t.priority === 'high' || 
        t.status === 'in-progress'
      );
      const otherTasks = sortedTasks.filter(t => 
        t.priority !== 'urgent' && 
        t.priority !== 'high' && 
        t.status !== 'in-progress'
      );
      
      // Shuffle the non-priority tasks more thoroughly
      const shuffledOther = shuffleArray(otherTasks);
      
      // Combine: urgent and high priority tasks first, then shuffled others
      // This creates variety while ensuring urgent and high priority tasks are still prioritized
      sortedTasks = [...priorityTasks, ...shuffledOther];
    }
    
    const plan: SchedulePlan[] = [];
    const exceedsLimit: Task[] = [];
    const daysExceedingLimit: Array<{ date: string; hours: number; tasks: Task[] }> = [];
    
    // Use startDate as the base for scheduling (selected date for rescheduling, or tomorrow for new scheduling)
    // This ensures rescheduling uses the selected date properly
    // Note: startDate and endDate are already defined above (before the dailyTasks population loop)
    const baseDate = startDate;
    
    // Use configuration constants for daily hours limits
    
    // Helper: Check if adding task would exceed daily limit
    // Allow tasks that would make the day exactly at the limit (for efficient packing)
    const maxHoursPerDay = aiSettings.maxHoursPerDay;
    const wouldExceedLimit = (date: Date, taskHours: number): boolean => {
      const dateKey = getDateKey(date);
      const currentHours = dailyHours.get(dateKey) || 0;
      // Use > to allow tasks that would make the day exactly at the limit (efficient packing)
      return (currentHours + taskHours) > maxHoursPerDay;
    };
    
    // Helper: Check if day has minimum hours requirement met
    const hasMinimumHours = (date: Date): boolean => {
      const dateKey = getDateKey(date);
      const currentHours = dailyHours.get(dateKey) || 0;
      return currentHours >= MIN_HOURS_PER_DAY;
    };
    
    // Helper: Get hours remaining to reach minimum
    const getHoursToMinimum = (date: Date): number => {
      const dateKey = getDateKey(date);
      const currentHours = dailyHours.get(dateKey) || 0;
      return Math.max(0, MIN_HOURS_PER_DAY - currentHours);
    };
    
    // Helper: Find day with least hours (for minimum hours enforcement)
    const findDayWithLeastHours = (startDate: Date, endDate: Date): Date | null => {
      let minHours = Infinity;
      let minDate: Date | null = null;
      
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = getDateKey(currentDate);
        const hours = dailyHours.get(dateKey) || 0;
        
        // Only consider days that don't have minimum hours yet
        if (hours < MIN_HOURS_PER_DAY && hours < minHours) {
          minHours = hours;
          minDate = new Date(currentDate);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return minDate;
    };
    
    // Helper: Add task hours to daily tracking
    // This is called when scheduling a task, so we track the hours for that day
    // CRITICAL FIX: For recurring tasks, add them to ALL days they occur on, not just the scheduled date
    // This ensures subsequent tasks in the same batch can see recurring tasks on all their occurrence days
    const addToDailyHours = (date: Date, taskHours: number, task: Task): void => {
      const isRecurring = task.recurrence && task.recurrence.type !== 'none';
      
      if (isRecurring) {
        // For recurring tasks, add to ALL days they occur on within the date range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateKey = getDateKey(currentDate);
          
          // Check if this recurring task applies to this date
          if (isDateInRecurrence(task, currentDate)) {
            // Add hours for this day
            const currentHours = dailyHours.get(dateKey) || 0;
            const newHours = currentHours + taskHours;
            dailyHours.set(dateKey, newHours);
            
            // Add task to dailyTasks for this day (only if not already present)
            // IMPORTANT: Keep the task's original scheduledDate (base date) for recurrence logic
            // The filtering logic in existingTasksForDay will use isDateInRecurrence to check if it applies
            const dayTasks = dailyTasks.get(dateKey) || [];
            if (!dayTasks.find(t => t.id === task.id)) {
              dayTasks.push(task);
              dailyTasks.set(dateKey, dayTasks);
            }
            
            // Check if this day now exceeds the limit (for tracking/reporting)
            // Note: Allow exactly maxHoursPerDay for efficient packing
            if (newHours > maxHoursPerDay) {
              // Check if we already have this day in exceedsLimit
              const existing = daysExceedingLimit.find(d => d.date === dateKey);
              if (!existing) {
                const tasksForDay = dailyTasks.get(dateKey) || [];
                daysExceedingLimit.push({
                  date: dateKey,
                  hours: newHours,
                  tasks: [...tasksForDay]
                });
              } else {
                // Update existing entry
                existing.hours = newHours;
                const tasksForDay = dailyTasks.get(dateKey) || [];
                existing.tasks = [...tasksForDay];
              }
            }
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        // For non-recurring tasks, only add to the scheduled date
        const dateKey = getDateKey(date);
        const currentHours = dailyHours.get(dateKey) || 0;
        const newHours = currentHours + taskHours;
        dailyHours.set(dateKey, newHours);
        
        // Also track the task in dailyTasks for time slot calculations
        const dayTasks = dailyTasks.get(dateKey) || [];
        dayTasks.push(task);
        dailyTasks.set(dateKey, dayTasks);
        
        // Check if this day now exceeds the limit (for tracking/reporting)
        // Note: Allow exactly maxHoursPerDay for efficient packing
        if (newHours > maxHoursPerDay) {
          // Check if we already have this day in exceedsLimit
          const existing = daysExceedingLimit.find(d => d.date === dateKey);
          if (!existing) {
            daysExceedingLimit.push({
              date: dateKey,
              hours: newHours,
              tasks: [...dayTasks]
            });
          } else {
            // Update existing entry
            existing.hours = newHours;
            existing.tasks = [...dayTasks];
          }
        }
      }
    };
    
    // Helper: Find next available day of preferred type (weekday/weekend)
    const findNextPreferredDay = (startDate: Date, preferWeekend: boolean, maxDaysToSearch: number = DEFAULT_SCHEDULING_PERIOD_DAYS): number => {
      let daysToAdd = 0;
      for (let i = 0; i < maxDaysToSearch; i++) {
        const testDate = new Date(startDate);
        testDate.setDate(testDate.getDate() + i);
        const isWeekendDate = isWeekend(testDate);
        
        if (preferWeekend === isWeekendDate) {
          daysToAdd = i;
          break;
        }
      }
      return daysToAdd;
    };
    
    // Calculate total days in date range for better distribution
    const totalDaysInRange = dateRange 
      ? Math.ceil((endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_HOUR / HOURS_PER_DAY) + 1
      : DEFAULT_SCHEDULING_PERIOD_DAYS;
    
    // Track tasks scheduled per day for better distribution
    const tasksPerDayCount: Map<number, number> = new Map();
    
    // Helper: Get the day index with least tasks for even distribution
    const getDayWithLeastTasks = (maxDays: number): number => {
      let minCount = Infinity;
      let minDay = 0;
      for (let day = 0; day < maxDays; day++) {
        const count = tasksPerDayCount.get(day) || 0;
        if (count < minCount) {
          minCount = count;
          minDay = day;
        }
      }
      return minDay;
    };
    
    sortedTasks.forEach((task, taskIndex) => {
      // Determine scheduling based on priority and status (if priority-based scheduling is enabled)
      // When rescheduling within a date range, distribute tasks evenly across days
      let daysToAdd = 0;
      let reason = '';
      
      if (aiSettings.priorityBasedScheduling) {
        // Priority-based scheduling logic
        // For rescheduling, distribute tasks across the week based on priority
        if (task.status === 'in-progress') {
          daysToAdd = 0;
          reason = 'In-progress - scheduled ASAP';
        } else if (task.priority === 'urgent') {
          daysToAdd = 0;
          reason = 'Urgent priority - scheduled first';
        } else if (task.priority === 'high') {
          // Distribute high priority tasks across first few days (0-2), but use round-robin
          daysToAdd = Math.min(taskIndex % HIGH_PRIORITY_DISTRIBUTION_DAYS, totalDaysInRange - 1);
          reason = daysToAdd === 0 ? 'High priority - scheduled soon' : 'High priority - distributed across week';
        } else if (task.priority === 'medium') {
          // Distribute medium priority tasks evenly across the week using round-robin
          daysToAdd = Math.min(taskIndex % totalDaysInRange, totalDaysInRange - 1);
          reason = 'Medium priority - distributed across week';
        } else {
          // Distribute low priority tasks evenly across the week using round-robin
          daysToAdd = Math.min(taskIndex % totalDaysInRange, totalDaysInRange - 1);
          reason = 'Low priority - distributed across week';
        }
      } else {
        // Simple sequential scheduling without priority consideration
        // For rescheduling, distribute tasks evenly across the date range using round-robin
        // This ensures tasks are spread evenly across all days
        daysToAdd = Math.min(taskIndex % totalDaysInRange, totalDaysInRange - 1);
        reason = 'Scheduled - distributed across week';
      }
      
      // Check if task has a due date and adjust if needed
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const suggestedDate = new Date(baseDate);
        suggestedDate.setDate(suggestedDate.getDate() + daysToAdd);
        
        // If suggested date is after due date, schedule closer to due date
        // But respect the date range constraint
        if (suggestedDate > dueDate) {
          const daysDiff = Math.max(0, Math.floor((dueDate.getTime() - baseDate.getTime()) / MILLISECONDS_PER_HOUR / HOURS_PER_DAY));
          const newDaysToAdd = Math.max(0, daysDiff);
          
          // Only adjust if the new date is within the allowed range
          if (!dateRange || (new Date(baseDate.getTime() + newDaysToAdd * HOURS_PER_DAY * MILLISECONDS_PER_HOUR) >= startDate && 
                             new Date(baseDate.getTime() + newDaysToAdd * MILLISECONDS_PER_DAY) <= endDate)) {
            daysToAdd = newDaysToAdd;
            reason = 'Due date approaching - prioritized';
          }
        }
      }
      
      // ALWAYS enforce weekend avoidance for work/projects tasks (unconditional rule)
      const category = getTaskCategory(task);
      // Define preferWeekend in outer scope so it's available in both blocks below
      const preferWeekend = category === 'personal';
      
      if (category) {
        const testDate = new Date(baseDate);
        testDate.setDate(testDate.getDate() + daysToAdd);
        const isCurrentWeekend = isWeekend(baseDate);
        
        // Work and projects should ALWAYS avoid weekends, personal prefers weekends
        const shouldAvoidWeekend = (category === 'work' || category === 'projects') && isCurrentWeekend;
        
        // If work/projects task is scheduled on weekend, ALWAYS try to find a weekday
        if (shouldAvoidWeekend) {
          const maxSearchDays = dateRange ? Math.ceil((endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_DAY) : DEFAULT_SCHEDULING_PERIOD_DAYS;
          const preferredDaysToAdd = findNextPreferredDay(baseDate, false, maxSearchDays); // false = prefer weekday
          
          // Only switch days if we found a weekday and it's within the date range
          const preferredDate = new Date(baseDate);
          preferredDate.setDate(preferredDate.getDate() + preferredDaysToAdd);
          const isWithinRange = !dateRange || (preferredDate >= startDate && preferredDate <= endDate);
          
          if (isWithinRange && preferredDaysToAdd < daysToAdd + maxSearchDays) {
            daysToAdd = preferredDaysToAdd;
            if (!reason.includes('Due date') && !reason.includes('minimum hours')) {
              reason = `${category.charAt(0).toUpperCase() + category.slice(1)} task - scheduled for weekday (avoiding weekend)`;
            }
          }
        }
      }
      
      // Apply category-based date preference if respectHours is enabled OR forceCategoryHours is true
      if (hoursSettings.respectHours || options?.forceCategoryHours) {
        if (category) {
          const testDate = new Date(baseDate);
          testDate.setDate(testDate.getDate() + daysToAdd);
          
          // Check if category hours are enabled for the current day type
          const isCurrentWeekend = isWeekend(testDate);
          const dayHours = isCurrentWeekend ? hoursSettings.weekendHours : hoursSettings.weekdayHours;
          const categoryHours = dayHours[category];
          
          // If category hours are disabled for the current day type, try to find a preferred day
          // When forceCategoryHours is true, we should still try to schedule on appropriate days
          if (!categoryHours.enabled) {
            const maxSearchDays = dateRange ? Math.ceil((endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_DAY) : DEFAULT_WEEK_RESCHEDULE_DAYS;
            const preferredDaysToAdd = findNextPreferredDay(baseDate, preferWeekend, maxSearchDays);
            
            // Only switch days if we found a preferred day and it's within the date range
            const preferredDate = new Date(baseDate);
            preferredDate.setDate(preferredDate.getDate() + preferredDaysToAdd);
            const isWithinRange = !dateRange || (preferredDate >= startDate && preferredDate <= endDate);
            
            if (isWithinRange && preferredDaysToAdd < daysToAdd + maxSearchDays) {
              daysToAdd = preferredDaysToAdd;
              const dayType = preferWeekend ? 'weekend' : 'weekday';
              if (!reason.includes('Due date') && !reason.includes('minimum hours')) {
                reason = `${category.charAt(0).toUpperCase() + category.slice(1)} task - scheduled for ${dayType}`;
              }
            }
          }
        }
      }
      
      // Get task hours using AI Duration Estimator
      // This integrates with all AI scheduling functions (scheduleAllTasks, generateSchedulePlan, rescheduleDay/Week/Month)
      // Uses cached AI Analysis results for consistency
      const taskHours = getTaskHours(task, { useCachedAIAnalysis: true });
      
      // Log AI estimator usage for debugging (only in dev mode)
      if (import.meta.env.DEV) {
        logger.debug('Using AI Duration Estimator', {
          taskId: task.id,
          taskTitle: task.title,
          aiEstimatedHours: taskHours,
        });
      }
      
      // SPECIAL HANDLING FOR RECURRING TASKS: Calculate first occurrence date FIRST
      // This ensures recurring tasks are scheduled to their correct occurrence date, not just any available day
      const isRecurringTask = task.recurrence && task.recurrence.type !== 'none';
      let recurringFirstOccurrence: Date | null = null;
      let foundDay = false; // Declare foundDay early for recurring task logic
      
      if (isRecurringTask) {
        const fromDate = new Date(startDate);
        fromDate.setHours(0, 0, 0, 0);
        
        // For recurring tasks without a scheduledDate, we need to calculate the first occurrence
        // If the task already has a scheduledDate, use it as the base, but ensure it's not in the past
        let baseDateForCalculation = fromDate;
        if (task.scheduledDate) {
          const existingScheduledDate = parseTaskScheduledDate(task.scheduledDate);
          existingScheduledDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // If existing scheduledDate is in the past, recalculate from today
          if (existingScheduledDate < today) {
            baseDateForCalculation = today;
          } else {
            // Use existing scheduledDate as the base (it's already the first occurrence)
            recurringFirstOccurrence = existingScheduledDate;
          }
        }
        
        // Calculate first occurrence if not already set
        if (!recurringFirstOccurrence) {
          recurringFirstOccurrence = calculateFirstOccurrenceDate(task, baseDateForCalculation);
        }
        
        if (recurringFirstOccurrence) {
          // Check if first occurrence fits within date range
          const isWithinRange = !dateRange || (recurringFirstOccurrence >= startDate && recurringFirstOccurrence <= endDate);
          
          // CRITICAL FIX: Check ALL occurrence days, not just the first one
          // A recurring task adds hours to EVERY day it occurs on, so we must ensure
          // NONE of those days would exceed the 5-hour limit
          let wouldExceedOnAnyDay = false;
          if (isWithinRange) {
            const checkDate = new Date(recurringFirstOccurrence);
            while (checkDate <= endDate) {
              if (isDateInRecurrence(task, checkDate)) {
                if (wouldExceedLimit(checkDate, taskHours)) {
                  wouldExceedOnAnyDay = true;
                  logger.debug('Recurring task would exceed limit on occurrence day', {
                    taskId: task.id,
                    taskTitle: task.title,
                    occurrenceDay: getDateString(checkDate),
                    taskHours,
                    currentHours: dailyHours.get(getDateKey(checkDate)) || 0,
                  });
                  break;
                }
              }
              checkDate.setDate(checkDate.getDate() + 1);
            }
          }
          
          // CRITICAL SAFEGUARD: Ensure first occurrence is not in the past
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const firstOccurrenceDateOnly = new Date(recurringFirstOccurrence);
          firstOccurrenceDateOnly.setHours(0, 0, 0, 0);
          const isFirstOccurrenceInPast = firstOccurrenceDateOnly < today;
          
          // If first occurrence is valid, within range, not in the past, and NO occurrence day would exceed limits, use it
          if (isWithinRange && !isFirstOccurrenceInPast && !wouldExceedOnAnyDay) {
            // Calculate daysToAdd based on first occurrence
            const daysDiff = Math.floor((recurringFirstOccurrence.getTime() - baseDate.getTime()) / MILLISECONDS_PER_DAY);
            // Ensure daysToAdd is not negative (shouldn't happen, but safeguard)
            daysToAdd = Math.max(0, daysDiff);
            foundDay = true;
            reason = `Recurring task - scheduled to first occurrence (${getDateString(recurringFirstOccurrence)})`;
            logger.debug('Recurring task scheduled to first occurrence', {
              taskId: task.id,
              firstOccurrence: getDateString(recurringFirstOccurrence),
            });
          } else if (isFirstOccurrenceInPast) {
            // First occurrence is in the past - recalculate from today
            logger.warn('Recurring task first occurrence is in the past, recalculating from today', {
              taskId: task.id,
              originalFirstOccurrence: getDateString(recurringFirstOccurrence),
            });
            const recalculatedFirstOccurrence = calculateFirstOccurrenceDate(task, today);
            if (recalculatedFirstOccurrence) {
              const recalculatedIsWithinRange = !dateRange || (recalculatedFirstOccurrence >= startDate && recalculatedFirstOccurrence <= endDate);
              if (recalculatedIsWithinRange && !wouldExceedOnAnyDay) {
                const daysDiff = Math.floor((recalculatedFirstOccurrence.getTime() - baseDate.getTime()) / MILLISECONDS_PER_DAY);
                daysToAdd = Math.max(0, daysDiff);
                foundDay = true;
                recurringFirstOccurrence = recalculatedFirstOccurrence; // Update for later use
                reason = `Recurring task - scheduled to first occurrence (${getDateString(recalculatedFirstOccurrence)}, recalculated from today)`;
              }
            }
          }
        }
      }
      
      // PRIORITY 1: If enforcing minimum hours, ALWAYS try to fill days that don't meet minimum first
      // This ensures we meet the 5-hour requirement per day
      // Skip this for recurring tasks that already have a valid first occurrence
      let finalDaysToAdd = daysToAdd;
      
      // Only search for days if recurring task doesn't already have a valid first occurrence
      if (!foundDay && options?.enforceMinimumHours) {
        // Find ALL days that need hours to reach minimum, sorted by hours needed (most needed first)
        const daysNeedingHours: Array<{ date: Date; hoursNeeded: number; currentHours: number }> = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateKey = getDateKey(currentDate);
          const currentHours = dailyHours.get(dateKey) || 0;
          
          // ALWAYS skip weekends for work and projects tasks (unconditional rule)
          const shouldSkipWeekend = (getTaskCategory(task) === 'work' || getTaskCategory(task) === 'projects') &&
                                    isWeekend(currentDate);
          
          if (!shouldSkipWeekend && currentHours < MIN_HOURS_PER_DAY) {
            const hoursNeeded = MIN_HOURS_PER_DAY - currentHours;
            daysNeedingHours.push({
              date: new Date(currentDate),
              hoursNeeded,
              currentHours
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Sort by hours needed (most needed first), then by date (earlier first)
        // This ensures we BALANCE days by filling the emptiest days first
        // Following AI_SCHEDULING_GUIDELINES.md: "round-robin or priority-based distribution"
        daysNeedingHours.sort((a, b) => {
          // Most hours needed first - prioritize emptier days to balance the schedule
          if (b.hoursNeeded !== a.hoursNeeded) {
            return b.hoursNeeded - a.hoursNeeded; // Emptiest day first (most hours needed)
          }
          // If same hours needed, earlier date first
          return a.date.getTime() - b.date.getTime();
        });
        
        // Try each day that needs hours, starting with the earliest day (sequential filling)
        for (const dayInfo of daysNeedingHours) {
          // Check if this task can fit in this day (doesn't exceed 5-hour limit)
          if (!wouldExceedLimit(dayInfo.date, taskHours)) {
            const daysDiff = Math.floor((dayInfo.date.getTime() - baseDate.getTime()) / MILLISECONDS_PER_DAY);
            const maxDays = dateRange ? Math.ceil((endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_DAY) : DEFAULT_SCHEDULING_PERIOD_DAYS;
            if (daysDiff >= 0 && daysDiff < maxDays) {
              finalDaysToAdd = daysDiff;
              foundDay = true;
              reason = `${reason} - filling minimum hours requirement (${dayInfo.currentHours.toFixed(1)}h → ${(dayInfo.currentHours + taskHours).toFixed(1)}h)`;
              break; // Found a day, use it
            }
          }
        }
      }
      
      // PRIORITY 2: If not found yet, search for days with available time slots
      // This ensures tasks are distributed to wherever there's available time
      // Skip this for recurring tasks that already have a valid first occurrence
      if (!foundDay) {
        // Calculate max days to search based on date range or default to TWO_WEEKS_DAYS days
        const maxDaysToSearch = dateRange 
          ? Math.ceil((endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_DAY)
          : DEFAULT_SCHEDULING_PERIOD_DAYS;
        let daysSearched = 0;
        
        // Build list of candidate days with available space, sorted by available hours (most space first)
        const candidateDays: Array<{ date: Date; availableHours: number; daysToAdd: number }> = [];
        
        // First pass: collect all days with available space
        for (let dayOffset = 0; dayOffset < maxDaysToSearch; dayOffset++) {
          const testDate = new Date(baseDate);
          testDate.setDate(testDate.getDate() + dayOffset);
          
          // Check if testDate is within the allowed date range
          if (dateRange && (testDate < startDate || testDate > endDate)) {
            continue;
          }
          
          // ALWAYS skip weekends for work and projects tasks (unconditional rule)
          const category = getTaskCategory(task);
          if (category === 'work' || category === 'projects') {
            const isTestWeekend = isWeekend(testDate);
            if (isTestWeekend) {
              continue;
            }
          }
          
          // Check if this day has space for the task (within maxHoursPerDay limit)
          if (!wouldExceedLimit(testDate, taskHours)) {
            const dateKey = getDateKey(testDate);
            const currentHours = dailyHours.get(dateKey) || 0;
            const availableHours = maxHoursPerDay - currentHours;
            candidateDays.push({
              date: new Date(testDate),
              availableHours,
              daysToAdd: dayOffset
            });
          }
        }
        
        // Sort by available hours (most space first), then by date (earlier first)
        candidateDays.sort((a, b) => {
          if (b.availableHours !== a.availableHours) {
            return b.availableHours - a.availableHours; // Most space first
          }
          return a.date.getTime() - b.date.getTime(); // Earlier date first
        });
        
        // Use the day with the most available space (or earliest if tied)
        if (candidateDays.length > 0) {
          const bestDay = candidateDays[0];
          finalDaysToAdd = bestDay.daysToAdd;
          foundDay = true;
        }
      }
      
      // If no available day found within search window, add to exceedsLimit and skip
      // This applies to BOTH recurring and non-recurring tasks to respect the 5-hour daily limit
      if (!foundDay) {
        // Log why the task couldn't be scheduled
        if (isRecurringTask && recurringFirstOccurrence) {
          logger.debug('Recurring task exceeds daily limit on one or more occurrence days', {
            taskId: task.id,
            taskTitle: task.title,
            firstOccurrence: getDateString(recurringFirstOccurrence),
            taskHours,
          });
        }
        exceedsLimit.push(task);
      }
      
      // NOTE: Removed the "FINAL SAFEGUARD" that forced recurring tasks to schedule even when exceeding limits
      // Recurring tasks should respect the 5-hour daily limit like all other tasks
      // If a recurring task exceeds the limit on any occurrence day, it will be added to exceedsLimit
      
      if (foundDay) {
        // Update reason if we had to move to a later day (for non-recurring tasks)
        if (finalDaysToAdd > daysToAdd && !isRecurringTask) {
          if (!reason.includes('Due date') && !reason.includes('moved') && !reason.includes('minimum hours') && !reason.includes('Recurring task')) {
            reason = `${reason} - moved to available slot (5-hour limit)`;
          }
        }
        
        // Calculate time slot intelligently based on task duration and existing schedule
        // For recurring tasks, use the pre-calculated first occurrence date (but reset time to midnight)
        // CRITICAL: For recurring tasks, we need to check ALL occurrence days in the scheduling range
        // to find a time that doesn't conflict on any occurrence day
        // Otherwise, use the calculated date
        // CRITICAL: Declare allOccurrenceDays at a higher scope so it's accessible later in the code
        let allOccurrenceDays: Date[] | undefined = undefined;
        let scheduleDate: Date;
        if (isRecurringTask && recurringFirstOccurrence) {
          // Use the pre-calculated first occurrence date, but ensure time is reset to midnight
          // This allows the category time slot logic to properly assign the time
          scheduleDate = new Date(recurringFirstOccurrence);
          scheduleDate.setHours(0, 0, 0, 0);
          
          // CRITICAL SAFEGUARD: Ensure recurring task first occurrence is never in the past
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (scheduleDate < today) {
            logger.warn('CRITICAL: Recurring task first occurrence is in the past, recalculating', {
              taskId: task.id,
              originalFirstOccurrence: getDateString(recurringFirstOccurrence),
            });
            // Recalculate first occurrence starting from today
            const recalculated = calculateFirstOccurrenceDate(task, today);
            if (recalculated) {
              scheduleDate = new Date(recalculated);
              scheduleDate.setHours(0, 0, 0, 0);
            } else {
              // Fallback: use today if calculation fails
              scheduleDate = new Date(today);
            }
          }
          
          // CRITICAL: For recurring tasks, check ALL occurrence days within the scheduling range
          // to ensure the selected time doesn't conflict on any occurrence day
          // This prevents scheduling a recurring task at a time that conflicts with existing tasks
          // on other occurrence days
          allOccurrenceDays = [];
          const currentOccurrenceDate = new Date(recurringFirstOccurrence);
          currentOccurrenceDate.setHours(0, 0, 0, 0);
          
          // Collect all occurrence days within the scheduling range
          while (currentOccurrenceDate <= endDate) {
            if (isDateInRecurrence(task, currentOccurrenceDate)) {
              allOccurrenceDays.push(new Date(currentOccurrenceDate));
            }
            // Move to next day
            currentOccurrenceDate.setDate(currentOccurrenceDate.getDate() + 1);
          }
          
          if (import.meta.env.DEV && allOccurrenceDays.length > 0) {
            logger.debug('Recurring task occurrence days to check', {
              taskId: task.id,
              taskTitle: task.title,
              firstOccurrence: getDateString(recurringFirstOccurrence),
              occurrenceDaysCount: allOccurrenceDays.length,
              occurrenceDays: allOccurrenceDays.map(d => getDateString(d)),
              dateRange: {
                start: getDateString(startDate),
                end: getDateString(endDate),
              },
            });
          }
        } else {
          // Non-recurring task: use calculated date
          scheduleDate = new Date(baseDate);
          scheduleDate.setDate(scheduleDate.getDate() + finalDaysToAdd);
          
          // CRITICAL SAFEGUARD: Ensure scheduleDate is never in the past
          // If somehow the calculation resulted in a past date, use today instead
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const scheduleDateOnly = new Date(scheduleDate);
          scheduleDateOnly.setHours(0, 0, 0, 0);
          
          if (scheduleDateOnly < today) {
            logger.warn('CRITICAL: Task scheduled date is in the past, correcting to today', {
              taskId: task.id,
              calculatedDate: getDateString(scheduleDate),
              correctedDate: getDateString(today),
              finalDaysToAdd,
              baseDate: getDateString(baseDate),
            });
            scheduleDate = new Date(today);
            scheduleDate.setHours(0, 0, 0, 0);
          }
        }
        
        // GUIDELINE 4: RESPECT CATEGORY HOURS RULES
        // Each category (work, personal, projects) has defined hours for weekdays/weekends
        // Tasks must be scheduled within their category's allowed hours
        // See: src/guidelines/AI_SCHEDULING_GUIDELINES.md Section 4
        // Search for an available slot within the two-week span; never default to next-day 12 AM
        while (scheduleDate <= endDate) {
        const dateKey = getDateKey(scheduleDate);
        // GUIDELINE 2: FIND AVAILABLE TIME - Get all tasks for the target date
        // Must include: existing tasks + tasks in current plan + recurring tasks that apply to this date
        // For recurring tasks: Use isDateInRecurrence() to check if they apply (they appear on multiple days)
        // For regular tasks: Check if scheduledDate matches the target date exactly
        // See: src/guidelines/AI_SCHEDULING_GUIDELINES.md Section 2
        // CRITICAL FIX: Build existingTasksForDay and adjust scheduledDate for recurring tasks
        // For recurring tasks, we need to set scheduledDate to the target date while preserving the time
        // This ensures conflict detection sees recurring tasks on the correct day with the correct time
        const existingTasksForDay = (dailyTasks.get(dateKey) || [])
          .filter(t => {
            // Check if this is a recurring task
            const isRecurring = t.recurrence && t.recurrence.type !== 'none';
            
            if (isRecurring) {
              // For recurring tasks, check if they apply to this date using isDateInRecurrence
              // This ensures recurring tasks are visible on ALL days they occur, not just their base scheduledDate
              if (!isDateInRecurrence(t, scheduleDate)) {
                return false;
              }
              // Also verify the task has a scheduledDate (base date for recurrence)
              if (!t.scheduledDate) return false;
              // Parse the base scheduledDate to get the time
              const baseScheduledDate = typeof t.scheduledDate === 'string' 
                ? parseTaskScheduledDate(t.scheduledDate)
                : parseTaskScheduledDate(t.scheduledDate);
              // Only include if it has a valid time (not just midnight/00:00:00)
              return !isNaN(baseScheduledDate.getTime()) && (baseScheduledDate.getHours() !== 0 || baseScheduledDate.getMinutes() !== 0);
            } else {
              // For non-recurring tasks, check if scheduledDate matches this date and has a valid time
              if (!t.scheduledDate) return false;
              const scheduledDate = typeof t.scheduledDate === 'string' 
                ? parseTaskScheduledDate(t.scheduledDate)
                : parseTaskScheduledDate(t.scheduledDate);
              // Check if the scheduled date matches the target date
              const scheduledDateKey = getDateKey(scheduledDate);
              if (scheduledDateKey !== dateKey) return false;
              // Only include tasks with valid times (not just midnight/00:00:00)
              return !isNaN(scheduledDate.getTime()) && (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
            }
          })
          .map(t => {
            // CRITICAL FIX: For recurring tasks, adjust scheduledDate to the target date while preserving time
            // This ensures conflict detection sees the recurring task on the correct day
            const isRecurring = t.recurrence && t.recurrence.type !== 'none';
            if (isRecurring && t.scheduledDate) {
              const baseScheduledDate = typeof t.scheduledDate === 'string' 
                ? parseTaskScheduledDate(t.scheduledDate)
                : parseTaskScheduledDate(t.scheduledDate);
              // Create a date for the target day (scheduleDate) but with the time from the base scheduledDate
              const occurrenceDate = new Date(scheduleDate);
              occurrenceDate.setHours(baseScheduledDate.getHours(), baseScheduledDate.getMinutes(), baseScheduledDate.getSeconds(), baseScheduledDate.getMilliseconds());
              return {
                ...t,
                scheduledDate: occurrenceDate.toISOString()
              };
            }
            // For non-recurring tasks, return as-is
            return t;
          });
        
        // CRITICAL FIX: Get tasks from the current plan that apply to this date
        // For recurring tasks in the plan: Use isDateInRecurrence() to check if they apply to this date
        // For regular tasks in the plan: Check if scheduledDate matches the target date
        // This ensures recurring tasks scheduled earlier in the batch are visible on ALL their occurrence days
        const tasksInPlanSameDay = plan
          .filter(p => {
            if (!p.scheduledDate) {
              if (import.meta.env.DEV) {
                logger.debug('Plan item has no scheduledDate', { taskId: p.task.id, taskTitle: p.task.title });
              }
              return false;
            }
            
            // Check if this is a recurring task
            const isPlanTaskRecurring = p.task.recurrence && p.task.recurrence.type !== 'none';
            
            if (isPlanTaskRecurring) {
              // For recurring tasks, check if they apply to this date using isDateInRecurrence
              // The plan's scheduledDate is the first occurrence, but the task applies to multiple days
              if (!isDateInRecurrence(p.task, scheduleDate)) {
                return false;
              }
            } else {
              // For regular tasks, check if scheduledDate matches the target date
              const pDateKey = getDateKey(p.scheduledDate);
              if (pDateKey !== dateKey) return false;
            }
            
            // Only include tasks that have a scheduled time set (not just the date at midnight)
            // This ensures we only count tasks that have been fully scheduled
            // CRITICAL: Parse the scheduledDate to ensure we're checking the actual time
            const scheduledTime = p.scheduledDate instanceof Date ? p.scheduledDate : parseTaskScheduledDate(p.scheduledDate);
            const hasTimeSet = scheduledTime.getHours() !== 0 || scheduledTime.getMinutes() !== 0;
            if (!hasTimeSet && import.meta.env.DEV) {
              logger.debug('Plan item has no time set (midnight)', { 
                taskId: p.task.id, 
                taskTitle: p.task.title,
                scheduledDate: p.scheduledDate,
                scheduledTime: scheduledTime.toISOString()
              });
            }
            return hasTimeSet;
          })
          .map(p => {
            // Create a task object with scheduledDate set from the plan
            // CRITICAL FIX: For recurring tasks, we need to adjust the scheduledDate to the target date
            // while preserving the time from the first occurrence. This ensures conflict detection works correctly.
            const planScheduledDate = p.scheduledDate instanceof Date ? p.scheduledDate : parseTaskScheduledDate(p.scheduledDate);
            const isPlanTaskRecurring = p.task.recurrence && p.task.recurrence.type !== 'none';
            
            let taskScheduledDate: string;
            if (isPlanTaskRecurring) {
              // For recurring tasks, create a date for the target day (scheduleDate) but with the time from the first occurrence
              // This ensures the recurring task appears on the correct day with the correct time for conflict detection
              const occurrenceDate = new Date(scheduleDate);
              occurrenceDate.setHours(planScheduledDate.getHours(), planScheduledDate.getMinutes(), planScheduledDate.getSeconds(), planScheduledDate.getMilliseconds());
              taskScheduledDate = occurrenceDate.toISOString();
            } else {
              // For regular tasks, use the exact scheduledDate from the plan
              taskScheduledDate = planScheduledDate.toISOString();
            }
            
            const taskWithDate = { 
              ...p.task, 
              scheduledDate: taskScheduledDate
            };
            
            // CRITICAL DEBUG: Log the conversion for recurring tasks
            if (import.meta.env.DEV && (isPlanTaskRecurring || (task.recurrence && task.recurrence.type !== 'none'))) {
              logger.debug('Task from plan converted for conflict check', {
                currentTaskId: task.id,
                currentTaskTitle: task.title,
                currentTaskIsRecurring: !!(task.recurrence && task.recurrence.type !== 'none'),
                planTaskId: taskWithDate.id,
                planTaskTitle: taskWithDate.title,
                planTaskIsRecurring: isPlanTaskRecurring,
                planTaskScheduledDate: taskWithDate.scheduledDate,
                planTaskScheduledTime: parseTaskScheduledDate(taskWithDate.scheduledDate).toLocaleTimeString(),
                planTaskScheduledDateKey: getDateKey(parseTaskScheduledDate(taskWithDate.scheduledDate)),
                targetDateKey: dateKey,
                originalPlanScheduledDate: p.scheduledDate,
                originalPlanScheduledDateType: typeof p.scheduledDate,
              });
            }
            
            return taskWithDate;
          });
        
        // CRITICAL DEBUG: Log tasks in plan for this day
        if (import.meta.env.DEV && isRecurringTask) {
          logger.debug('Tasks in plan for same day', {
            taskId: task.id,
            taskTitle: task.title,
            dateKey,
            planLength: plan.length,
            tasksInPlanSameDayCount: tasksInPlanSameDay.length,
            tasksInPlanSameDay: tasksInPlanSameDay.map(t => ({
              id: t.id,
              title: t.title,
              scheduledDate: t.scheduledDate,
              scheduledTime: t.scheduledDate ? parseTaskScheduledDate(t.scheduledDate).toLocaleTimeString() : 'none',
              category: getTaskCategory(t),
            })),
          });
        }
        
        // Combine existing tasks with tasks in the current plan for this day.
        // CRITICAL: Dedupe by task id with plan winning—so we only have one block per task at its plan time.
        // Otherwise the same task would appear twice (existing + plan) and the scheduler could place another task
        // in the "gap" between old and new time, causing overlap and timeline misalignment.
        const taskMapForDay = new Map<string, Task>();
        existingTasksForDay.forEach(t => {
          if (t.id) taskMapForDay.set(t.id, t);
        });
        tasksInPlanSameDay.forEach(t => {
          if (t.id) taskMapForDay.set(t.id, t);
        });
        const allTasksForDay = Array.from(taskMapForDay.values());
        
        // CRITICAL: Count ALL tasks (recurring and regular, across all categories) for time slot distribution
        // This ensures recurring tasks see regular tasks and vice versa when calculating time slots
        // The goal is to distribute tasks chronologically across the day, not just within categories
        const category = getTaskCategory(task);
        
        // Count ALL existing tasks (regardless of category) that have a scheduledDate
        // This includes both recurring and regular tasks
        const existingAllTasksCount = existingTasksForDay.filter(t => {
          return t.scheduledDate && (typeof t.scheduledDate === 'string' 
            ? parseTaskScheduledDate(t.scheduledDate).getHours() !== 0 || parseTaskScheduledDate(t.scheduledDate).getMinutes() !== 0
            : t.scheduledDate.getHours() !== 0 || t.scheduledDate.getMinutes() !== 0);
        }).length;
        
        // Count ALL tasks in the current plan for this day (regardless of category)
        // This includes both recurring and regular tasks being scheduled in the same batch
        const planAllTasksCount = tasksInPlanSameDay.filter(t => {
          return t.scheduledDate && (typeof t.scheduledDate === 'string' 
            ? parseTaskScheduledDate(t.scheduledDate).getHours() !== 0 || parseTaskScheduledDate(t.scheduledDate).getMinutes() !== 0
            : t.scheduledDate.getHours() !== 0 || t.scheduledDate.getMinutes() !== 0);
        }).length;
        
        // Total tasks = existing + tasks in current plan (ALL categories, ALL types)
        // CRITICAL: Do NOT include the current task being scheduled in the count
        // This ensures proper chronological distribution: Task A gets slot 0, Task B gets slot 1, etc.
        // regardless of whether they're recurring or regular, or what category they're in
        const totalAllTasksCount = existingAllTasksCount + planAllTasksCount;
        
        // Also count same-category tasks for category-specific distribution (used by getCategoryTimeSlot)
        const existingCategoryTasksCount = existingTasksForDay.filter(t => {
          const cat = getTaskCategory(t);
          return cat === category && t.scheduledDate;
        }).length;
        
        const planCategoryTasksCount = tasksInPlanSameDay.filter(t => {
          const cat = getTaskCategory(t);
          return cat === category;
        }).length;
        
        const totalCategoryTasksCount = existingCategoryTasksCount + planCategoryTasksCount;
        
        // CRITICAL: Use total ALL tasks count for time slot calculation to ensure chronological distribution
        // This ensures recurring tasks and regular tasks are distributed chronologically across the day
        // regardless of category, preventing overlaps between different task types
        // IMPORTANT: This gives us the slot number for the NEXT task (the current one being scheduled)
        // We use totalAllTasksCount to ensure proper chronological order across all task types
        // 
        // FIX FOR RECURRING TASKS: Also factor in taskIndex (global position in batch) to ensure
        // recurring tasks on different days don't all get the same time slot.
        // Without this, recurring tasks would all get timeSlot 0 since they're each on different days
        // with no existing tasks on those days yet.
        let timeSlot = (totalAllTasksCount + taskIndex) % DEFAULT_TIME_SLOTS; // Include taskIndex for recurring task distribution
        
        // CRITICAL DEBUG: Log time slot calculation (for both recurring and regular tasks)
        if (import.meta.env.DEV) {
          logger.debug('Time slot calculation', {
            taskId: task.id,
            taskTitle: task.title,
            isRecurringTask,
            category,
            taskIndex, // Global position in batch - ensures recurring tasks get different times
            existingAllTasksCount,
            planAllTasksCount,
            totalAllTasksCount,
            existingCategoryTasksCount,
            planCategoryTasksCount,
            totalCategoryTasksCount,
            timeSlot,
            allTasksForDayCount: allTasksForDay.length,
            tasksInPlanSameDay: tasksInPlanSameDay.map(t => ({
              id: t.id,
              title: t.title,
              isRecurring: !!(t.recurrence && t.recurrence.type !== 'none'),
              category: getTaskCategory(t),
              scheduledDate: t.scheduledDate,
              scheduledTime: t.scheduledDate ? parseTaskScheduledDate(t.scheduledDate).toLocaleTimeString() : 'none',
            })),
            existingTasksForDay: existingTasksForDay.map(t => ({
              id: t.id,
              title: t.title,
              isRecurring: !!(t.recurrence && t.recurrence.type !== 'none'),
              category: getTaskCategory(t),
              scheduledDate: t.scheduledDate,
              scheduledTime: t.scheduledDate ? parseTaskScheduledDate(t.scheduledDate).toLocaleTimeString() : 'none',
            })),
          });
        }
        
        // Use consistent duration calculation for all scheduling operations
        // Uses cached AI Analysis results for consistency
        const taskHours = getTaskHours(task, { useCachedAIAnalysis: true });
        const taskDurationMinutes = Math.round(taskHours * MINUTES_PER_HOUR); // Convert hours to minutes
        
          // CRITICAL FIX FOR RECURRING TASKS: Always force category hours for recurring tasks
          // This ensures recurring tasks always get a proper time slot assigned, not defaulting to midnight
          // Recurring tasks must follow guidelines and be placed in available timeline slots
          const shouldForceCategoryHours = (options?.forceCategoryHours ?? false) || isRecurringTask;
        
        // Pass allTasksForDay (including tasks in current plan) to getCategoryTimeSlot
        // This ensures it can find gaps and distribute tasks correctly
        const categoryTime = getCategoryTimeSlot(
          task,
          scheduleDate,
          timeSlot,
          shouldForceCategoryHours, // Force category hours for recurring tasks
          allTasksForDay, // Include tasks from current plan
          taskDurationMinutes, // Pass consistent duration for gap checking
          calendarEventsForDay(scheduleDate),
        );
        
        // CRITICAL SAFEGUARD FOR RECURRING TASKS: If getCategoryTimeSlot returns null for a recurring task,
        // this is a critical error since we forced category hours. Log it and ensure we still get a time.
        let effectiveCategoryTime = categoryTime;
        if (isRecurringTask && !categoryTime) {
          logger.error('CRITICAL: getCategoryTimeSlot returned null for recurring task despite forcing category hours', {
            taskId: task.id,
            taskTitle: task.title,
            shouldForceCategoryHours,
            respectHours: hoursSettings.respectHours,
            category: getTaskCategory(task),
          });
          // Force category hours by getting them directly and using category start time
          const categoryHours = getCategoryHoursForTask(task, scheduleDate, hoursSettings);
          if (categoryHours) {
            // categoryHours.start is already in minutes, not a string
            const startMinutes = typeof categoryHours.start === 'string' 
              ? parseTimeToMinutes(categoryHours.start) 
              : categoryHours.start;
            effectiveCategoryTime = {
              hours: Math.floor(startMinutes / MINUTES_PER_HOUR),
              minutes: startMinutes % MINUTES_PER_HOUR,
              reason: 'Recurring task scheduled at category start (getCategoryTimeSlot returned null)'
            };
          } else {
            // Last resort: use default work start time
            const [workStartHour] = DEFAULT_WEEKDAY_WORK_START.split(':').map(Number);
            effectiveCategoryTime = {
              hours: workStartHour,
              minutes: 0,
              reason: 'Recurring task scheduled at default work start (getCategoryTimeSlot returned null, no category hours)'
            };
          }
        }
        
        // CRITICAL: Define validTasksForDay BEFORE the if/else blocks so it's available everywhere
        // This ensures conflict detection works in all code paths, including the final safeguard
        const validTasksForDay = allTasksForDay.filter(t => {
          if (!t.scheduledDate) return false;
          // Parse and verify the scheduled time is valid
          const scheduledDate = typeof t.scheduledDate === 'string' 
            ? parseTaskScheduledDate(t.scheduledDate)
            : parseTaskScheduledDate(t.scheduledDate);
          // Only include tasks with valid times (not just midnight/00:00:00)
          // This ensures we see all scheduled tasks regardless of category
          return !isNaN(scheduledDate.getTime()) && (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
        });
        
        if (effectiveCategoryTime) {
          // Use category hours if available and respectHours is enabled
          // But first, use findNextAvailableSlot to find actual open time slot
          const proposedTime = new Date(scheduleDate);
          proposedTime.setHours(effectiveCategoryTime.hours, effectiveCategoryTime.minutes, 0, 0);
          
          // CRITICAL SAFEGUARD FOR RECURRING TASKS: Ensure proposed time is never midnight
          // This should not happen if getCategoryTimeSlot worked correctly, but add extra protection
          if (isRecurringTask && proposedTime.getHours() === 0 && proposedTime.getMinutes() === 0) {
            logger.error('CRITICAL: Recurring task proposed time is midnight, adjusting to category start', {
              taskId: task.id,
              taskTitle: task.title,
              categoryTime: `${effectiveCategoryTime.hours}:${effectiveCategoryTime.minutes}`,
            });
            // Use category start time as fallback
            const categoryHours = getCategoryHoursForTask(task, scheduleDate, hoursSettings);
            if (categoryHours) {
              // categoryHours.start is already in minutes, not a string
              const startMinutes = typeof categoryHours.start === 'string' 
                ? parseTimeToMinutes(categoryHours.start) 
                : categoryHours.start;
              proposedTime.setHours(Math.floor(startMinutes / MINUTES_PER_HOUR), startMinutes % MINUTES_PER_HOUR, 0, 0);
            } else {
              const [workStartHour] = DEFAULT_WEEKDAY_WORK_START.split(':').map(Number);
              proposedTime.setHours(workStartHour, 0, 0, 0);
            }
          }
          
          // Check if scheduling for today
          const today = new Date();
          const scheduleDateKey = getDateKey(scheduleDate);
          const todayDateKey = getDateKey(today);
          const isToday = scheduleDateKey === todayDateKey;
          
          // Get category hours for the task - ALWAYS use them if available
          let categoryHours = getCategoryHoursForTask(task, scheduleDate, hoursSettings);
          
          // If forceCategoryHours is enabled, try to get category hours even if respectHours is disabled
          if (!categoryHours && options?.forceCategoryHours) {
            const category = getTaskCategory(task);
            if (category) {
              const isWeekendDate = isWeekend(scheduleDate);
              const dayHours = isWeekendDate ? hoursSettings.weekendHours : hoursSettings.weekdayHours;
              const catHours = dayHours[category];
              if (catHours && catHours.enabled) {
                const startMinutes = parseTimeToMinutes(catHours.start);
                const endMinutes = parseTimeToMinutes(catHours.end);
                categoryHours = { start: startMinutes, end: endMinutes };
              }
            }
          }
          
          // Find the actual available slot using findNextAvailableSlot
          // This ensures we find open slots, respect current time for today, and use category hours
          // IMPORTANT: Pass allTasksForDay (which includes tasks from current plan) to findNextAvailableSlot
          // so it can see tasks being scheduled in the same batch and avoid conflicts
          // taskDurationMinutes already calculated above for consistency
          
          // Debug: Log tasks being checked for conflicts (especially for recurring tasks)
          // Note: validTasksForDay is now defined before this block
          if (import.meta.env.DEV && isRecurringTask) {
            logger.debug('Recurring task conflict check', {
              taskId: task.id,
              taskTitle: task.title,
              proposedTime: proposedTime.toISOString(),
              validTasksForDayCount: validTasksForDay.length,
              validTasks: validTasksForDay.map(t => ({
                id: t.id,
                title: t.title,
                category: getTaskCategory(t),
                scheduledDate: t.scheduledDate,
                scheduledTime: t.scheduledDate ? parseTaskScheduledDate(t.scheduledDate).toLocaleTimeString() : 'none',
              })),
            });
          }
          
          // CRITICAL DEBUG: Log what tasks are being passed to findNextAvailableSlot
          if (import.meta.env.DEV) {
            logger.debug('findNextAvailableSlot called', {
              taskId: task.id,
              taskTitle: task.title,
              isRecurringTask,
              proposedTime: proposedTime.toISOString(),
              taskDurationMinutes,
              validTasksForDayCount: validTasksForDay.length,
              validTasksForDay: validTasksForDay.map(t => ({
                id: t.id,
                title: t.title,
                scheduledDate: t.scheduledDate,
                scheduledTime: t.scheduledDate ? parseTaskScheduledDate(t.scheduledDate).toLocaleTimeString() : 'none',
                category: getTaskCategory(t),
              })),
            });
          }
          
          // CRITICAL: For recurring tasks, check conflicts on ALL occurrence days, not just the first one
          // This ensures the selected time doesn't conflict with existing tasks on any occurrence day
          // IMPORTANT: Use allTasksForDay (which includes both existing and in-plan tasks) for consistency
          let availableSlot: Date;
          if (isRecurringTask && allOccurrenceDays && allOccurrenceDays.length > 0) {
            // For recurring tasks, we need to find a time that works for ALL occurrence days
            // Start with the proposed time and check each occurrence day
            let candidateTime = new Date(proposedTime);
            let foundValidTime = false;
            const maxAttempts = MAX_RECURRING_TASK_SCHEDULING_ATTEMPTS;
            let attempts = 0;
            
            while (!foundValidTime && attempts < maxAttempts) {
              // Check if this time works for ALL occurrence days
              let conflictsOnAnyDay = false;
              
              for (const occurrenceDay of allOccurrenceDays) {
                // CRITICAL FIX: Use the same logic as existingTasksForDay and tasksInPlanSameDay
                // to get all tasks for this occurrence day. This ensures consistency and that
                // we see all tasks (existing and in-plan) with their scheduledDate properly adjusted.
                const occurrenceDateKey = getDateKey(occurrenceDay);
                const occurrenceIsToday = occurrenceDateKey === getDateKey(new Date());
                
                // Get existing tasks for this occurrence day (same logic as existingTasksForDay above)
                const occurrenceExistingTasks = (dailyTasks.get(occurrenceDateKey) || [])
                  .filter(t => {
                    const isRecurring = t.recurrence && t.recurrence.type !== 'none';
                    if (isRecurring) {
                      if (!isDateInRecurrence(t, occurrenceDay)) return false;
                      if (!t.scheduledDate) return false;
                      const baseScheduledDate = typeof t.scheduledDate === 'string' 
                        ? parseTaskScheduledDate(t.scheduledDate)
                        : parseTaskScheduledDate(t.scheduledDate);
                      return !isNaN(baseScheduledDate.getTime()) && (baseScheduledDate.getHours() !== 0 || baseScheduledDate.getMinutes() !== 0);
                    } else {
                      if (!t.scheduledDate) return false;
                      const scheduledDate = typeof t.scheduledDate === 'string' 
                        ? parseTaskScheduledDate(t.scheduledDate)
                        : parseTaskScheduledDate(t.scheduledDate);
                      const scheduledDateKey = getDateKey(scheduledDate);
                      if (scheduledDateKey !== occurrenceDateKey) return false;
                      return !isNaN(scheduledDate.getTime()) && (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
                    }
                  })
                  .map(t => {
                    // Adjust scheduledDate for recurring tasks to the occurrence day
                    const isRecurring = t.recurrence && t.recurrence.type !== 'none';
                    if (isRecurring && t.scheduledDate) {
                      const baseScheduledDate = typeof t.scheduledDate === 'string' 
                        ? parseTaskScheduledDate(t.scheduledDate)
                        : parseTaskScheduledDate(t.scheduledDate);
                      const occurrenceDate = new Date(occurrenceDay);
                      occurrenceDate.setHours(baseScheduledDate.getHours(), baseScheduledDate.getMinutes(), baseScheduledDate.getSeconds(), baseScheduledDate.getMilliseconds());
                      return {
                        ...t,
                        scheduledDate: occurrenceDate.toISOString()
                      };
                    }
                    return t;
                  });
                
                // Get tasks from the plan that apply to this occurrence day (same logic as tasksInPlanSameDay above)
                const occurrencePlanTasks = plan
                  .filter(p => {
                    if (!p.scheduledDate) return false;
                    const isPlanTaskRecurring = p.task.recurrence && p.task.recurrence.type !== 'none';
                    if (isPlanTaskRecurring) {
                      return isDateInRecurrence(p.task, occurrenceDay);
                    } else {
                      const planDate = p.scheduledDate instanceof Date ? p.scheduledDate : parseTaskScheduledDate(p.scheduledDate);
                      return getDateKey(planDate) === occurrenceDateKey;
                    }
                  })
                  .map(p => {
                    const planScheduledDate = p.scheduledDate instanceof Date ? p.scheduledDate : parseTaskScheduledDate(p.scheduledDate);
                    const isPlanTaskRecurring = p.task.recurrence && p.task.recurrence.type !== 'none';
                    if (isPlanTaskRecurring) {
                      const occurrenceDate = new Date(occurrenceDay);
                      occurrenceDate.setHours(planScheduledDate.getHours(), planScheduledDate.getMinutes(), planScheduledDate.getSeconds(), planScheduledDate.getMilliseconds());
                      return {
                        ...p.task,
                        scheduledDate: occurrenceDate.toISOString()
                      };
                    } else {
                      return {
                        ...p.task,
                        scheduledDate: planScheduledDate.toISOString()
                      };
                    }
                  });
                
                // Combine existing and plan tasks, excluding the current task being scheduled
                const allOccurrenceTasks = [...occurrenceExistingTasks, ...occurrencePlanTasks]
                  .filter(t => t.id !== task.id && t.scheduledDate); // Exclude current task
                
                // CRITICAL FIX: Use findNextAvailableSlot for consistent conflict detection
                // This ensures we use the same strict conflict detection logic as the standard path
                // and catch all edge cases (overlaps, same start time, starts within existing, etc.)
                const testTime = new Date(occurrenceDay);
                testTime.setHours(candidateTime.getHours(), candidateTime.getMinutes(), candidateTime.getSeconds(), candidateTime.getMilliseconds());
                
                // Get calendar events for this specific occurrence day
                const occurrenceDayCalendarEvents = calendarEventsForDay(occurrenceDay);
                
                // Use findNextAvailableSlot to check if this time conflicts
                // If the result is different from the test time, it means there's a conflict
                const conflictCheckResult = findNextAvailableSlot(
                  task.id,
                  testTime,
                  taskDurationMinutes,
                  allOccurrenceTasks, // Use all tasks for this occurrence day (existing + from plan)
                  buildAISchedulerSlotOptions({
                    ensureAfterCurrentTime: occurrenceIsToday,
                    categoryHours: categoryHours ? {
                      start: categoryHours.start,
                      end: categoryHours.end,
                    } : undefined,
                    calendarEvents: occurrenceDayCalendarEvents, // Include calendar events for this occurrence day
                  })
                );
                
                // Check if the result is different from the test time (indicates conflict)
                // Use 1 minute tolerance to account for rounding
                const timeDifference = Math.abs(conflictCheckResult.getTime() - testTime.getTime());
                const hasConflict = timeDifference > MILLISECONDS_PER_MINUTE; // More than 1 minute difference means conflict
                
                if (hasConflict) {
                  conflictsOnAnyDay = true;
                  // CRITICAL FIX: Use the conflict-free slot returned by findNextAvailableSlot
                  // This ensures we skip past ALL conflicts, not just increment by 15 minutes
                  // Extract the time from the conflict-free slot (preserve date, update time)
                  const conflictFreeTime = new Date(conflictCheckResult);
                  candidateTime.setHours(conflictFreeTime.getHours(), conflictFreeTime.getMinutes(), conflictFreeTime.getSeconds(), conflictFreeTime.getMilliseconds());
                  
                  if (import.meta.env.DEV) {
                    logger.debug('Recurring task conflict found on occurrence day - using conflict-free slot', {
                      taskId: task.id,
                      taskTitle: task.title,
                      occurrenceDay: getDateString(occurrenceDay),
                      originalCandidateTime: testTime.toLocaleTimeString(),
                      conflictCheckResult: conflictCheckResult.toLocaleTimeString(),
                      newCandidateTime: candidateTime.toLocaleTimeString(),
                      timeDifferenceMinutes: Math.round(timeDifference / MILLISECONDS_PER_MINUTE),
                      allOccurrenceTasksCount: allOccurrenceTasks.length,
                      allOccurrenceTasks: allOccurrenceTasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        scheduledDate: t.scheduledDate,
                        scheduledTime: t.scheduledDate ? parseTaskScheduledDate(t.scheduledDate).toLocaleTimeString() : 'none',
                        isRecurring: !!(t.recurrence && t.recurrence.type !== 'none'),
                      })),
                    });
                  }
                  // Break to re-check all occurrence days with the new candidate time
                  break;
                }
              }
              
              if (!conflictsOnAnyDay) {
                // CRITICAL: Double-check with findNextAvailableSlot to ensure consistency
                // This catches any edge cases that the manual check might have missed
                // Get calendar events for the schedule date
                const scheduleDayCalendarEvents = calendarEventsForDay(scheduleDate);
                
                const doubleCheckSlot = findNextAvailableSlot(
                  task.id,
                  candidateTime,
                  taskDurationMinutes,
                  validTasksForDay, // Use the main task list for consistency
                  buildAISchedulerSlotOptions({
                    ensureAfterCurrentTime: isToday,
                    categoryHours: categoryHours ? {
                      start: categoryHours.start,
                      end: categoryHours.end,
                    } : undefined,
                    calendarEvents: scheduleDayCalendarEvents, // Include calendar events
                  })
                );
                
                // Only accept if the double-check confirms the time is valid (within 1 minute)
                const timeDifference = Math.abs(doubleCheckSlot.getTime() - candidateTime.getTime());
                if (timeDifference <= MILLISECONDS_PER_MINUTE) {
                  foundValidTime = true;
                  availableSlot = candidateTime;
                  if (import.meta.env.DEV) {
                    logger.debug('Recurring task found valid time for all occurrence days', {
                      taskId: task.id,
                      taskTitle: task.title,
                      selectedTime: candidateTime.toLocaleTimeString(),
                      occurrenceDaysCount: allOccurrenceDays.length,
                      doubleCheckConfirmed: true,
                    });
                  }
                } else {
                  // Double-check found a conflict, use the conflict-free slot
                  if (import.meta.env.DEV) {
                    logger.debug('Recurring task calendar check passed but double-check found conflict', {
                      taskId: task.id,
                      taskTitle: task.title,
                      candidateTime: candidateTime.toLocaleTimeString(),
                      doubleCheckSlot: doubleCheckSlot.toLocaleTimeString(),
                      timeDifferenceMinutes: Math.round(timeDifference / MILLISECONDS_PER_MINUTE),
                    });
                  }
                  // Continue to next attempt
                  candidateTime.setMinutes(candidateTime.getMinutes() + TIME_ROUNDING_INTERVAL_MINUTES);
                  if (candidateTime.getMinutes() >= MINUTES_PER_HOUR) {
                    candidateTime.setHours(candidateTime.getHours() + 1);
                    candidateTime.setMinutes(0);
                  }
                  attempts++;
                }
              } else {
                // Conflict was found and candidateTime was already updated to the conflict-free slot
                // Just increment attempts and continue the while loop to re-check all occurrence days
                // with the new candidateTime
                attempts++;
              }
            }
            
            // If we couldn't find a time that works for all days, fall back to standard conflict detection
            if (!foundValidTime) {
              if (import.meta.env.DEV) {
                logger.warn('Could not find time that works for all occurrence days, using standard conflict detection', {
                  taskId: task.id,
                  taskTitle: task.title,
                  attempts,
                });
              }
              // Get calendar events for this specific day
              const dayCalendarEvents = calendarEventsForDay(scheduleDate);
              
              availableSlot = findNextAvailableSlot(
                task.id,
                proposedTime,
                taskDurationMinutes,
                validTasksForDay,
                buildAISchedulerSlotOptions({
                  ensureAfterCurrentTime: isToday,
                  categoryHours: categoryHours ? {
                    start: categoryHours.start,
                    end: categoryHours.end,
                  } : undefined,
                  calendarEvents: dayCalendarEvents,
                })
              );
            }
          } else {
            // For non-recurring tasks, use standard conflict detection
            // Get calendar events for this specific day
            const dayCalendarEvents = calendarEventsForDay(scheduleDate);
            
            availableSlot = findNextAvailableSlot(
              task.id,
              proposedTime,
              taskDurationMinutes,
              validTasksForDay, // Use validated tasks to ensure conflict detection works
              buildAISchedulerSlotOptions({
                ensureAfterCurrentTime: isToday,
                categoryHours: categoryHours ? {
                  start: categoryHours.start,
                  end: categoryHours.end,
                } : undefined,
                calendarEvents: dayCalendarEvents,
              })
            );
          }
          
          // CRITICAL DEBUG: Log the result
          if (import.meta.env.DEV) {
            const timeDifference = Math.abs(availableSlot.getTime() - proposedTime.getTime());
            logger.debug('findNextAvailableSlot result', {
              taskId: task.id,
              taskTitle: task.title,
              isRecurringTask,
              proposedTime: proposedTime.toISOString(),
              availableSlot: availableSlot.toISOString(),
              timeDifferenceMinutes: Math.round(timeDifference / MILLISECONDS_PER_MINUTE),
              wasAdjusted: timeDifference > MILLISECONDS_PER_MINUTE,
            });
          }
          
          // ALWAYS use findNextAvailableSlot result, even if it's different from proposed time
          // This ensures we never schedule at the same time as existing tasks
          // CRITICAL: For recurring tasks, we MUST use the conflict-free slot, never the proposed time
          if (isSlotOnRequestedDay(availableSlot, scheduleDate)) {
            scheduleDate.setTime(availableSlot.getTime());
            // Check if the slot was moved from the proposed time (indicates conflict was detected)
            const proposedTimeMs = proposedTime.getTime();
            const availableSlotMs = availableSlot.getTime();
            const timeDifference = Math.abs(availableSlotMs - proposedTimeMs);
            
            if (timeDifference > MILLISECONDS_PER_MINUTE) { // More than 1 minute difference
              reason = `${effectiveCategoryTime.reason} - moved to available slot (conflict avoided)`;
              // Log for recurring tasks to help debug
              if (isRecurringTask && import.meta.env.DEV) {
                logger.debug('Recurring task time adjusted due to conflict', {
                  taskId: task.id,
                  taskTitle: task.title,
                  proposedTime: proposedTime.toISOString(),
                  finalTime: availableSlot.toISOString(),
                  timeDifferenceMinutes: Math.round(timeDifference / MILLISECONDS_PER_MINUTE),
                });
              }
            } else {
              reason = `${effectiveCategoryTime.reason} - placed in available slot`;
            }
          } else {
            // No slot found within category hours - try again WITHOUT category hour constraints
            // CRITICAL: We MUST find a conflict-free slot, never use the proposed time if it conflicts
              logger.warn('No available slot found within category hours, trying without constraints', {
                taskId: task.id,
                taskTitle: task.title,
                isRecurringTask,
                proposedTime: proposedTime.toISOString(),
                categoryTime: `${effectiveCategoryTime.hours}:${effectiveCategoryTime.minutes}`,
                validTasksForDayCount: validTasksForDay.length,
              });
            
            // Try again without category hours constraint to find ANY available slot
            // This ensures we NEVER schedule at the same time as existing tasks
            // Get calendar events for this specific day (filter from main calendarEvents array)
            const dayCalendarEventsForFallback = calendarEventsForDay(scheduleDate);
            const fallbackSlot = findNextAvailableSlot(
              task.id,
              proposedTime,
              taskDurationMinutes,
              validTasksForDay, // Use validated tasks which includes tasks from current plan
              buildAISchedulerSlotOptions({
                ensureAfterCurrentTime: isToday,
                categoryHours: undefined, // Remove category hours constraint to find ANY slot
                calendarEvents: dayCalendarEventsForFallback, // Include calendar events to avoid conflicts
              })
            );
            
            if (isSlotOnRequestedDay(fallbackSlot, scheduleDate)) {
              scheduleDate.setTime(fallbackSlot.getTime());
              reason = `${effectiveCategoryTime.reason} - moved to available slot (conflict avoided)`;
              // Log for recurring tasks to help debug
              if (isRecurringTask && import.meta.env.DEV) {
                logger.debug('Recurring task moved outside category hours to avoid conflict', {
                  taskId: task.id,
                  taskTitle: task.title,
                  proposedTime: proposedTime.toISOString(),
                  finalTime: fallbackSlot.toISOString(),
                });
              }
            } else {
              // Still no slot found - this is a critical error
              // CRITICAL: Even in this case, we should NOT use the proposed time if it conflicts
              // Instead, try to find ANY slot by starting from the earliest possible time
              logger.error('CRITICAL: No available slot found even without category hours', {
                taskId: task.id,
                taskTitle: task.title,
                proposedTime: proposedTime.toISOString(),
                validTasksForDayCount: validTasksForDay.length,
              });
              
              // Last resort: try to find a slot starting from the earliest time
              const earliestTime = new Date(scheduleDate);
              earliestTime.setHours(6, 0, 0, 0); // Start from 6 AM
              const dayCalendarEventsForLastResort = calendarEventsForDay(scheduleDate);
              const lastResortSlot = findNextAvailableSlot(
                task.id,
                earliestTime,
                taskDurationMinutes,
                validTasksForDay,
                buildAISchedulerSlotOptions({
                  ensureAfterCurrentTime: isToday,
                  categoryHours: undefined,
                  calendarEvents: dayCalendarEventsForLastResort, // Include calendar events to avoid conflicts
                })
              );
              
              if (isSlotOnRequestedDay(lastResortSlot, scheduleDate)) {
                scheduleDate.setTime(lastResortSlot.getTime());
                reason = `${effectiveCategoryTime.reason} - moved to available slot (last resort)`;
              } else {
                // No slot on this day - try next day within the two-week span instead of defaulting to 12 AM
                if (isRecurringTask) {
                  scheduleDate.setDate(scheduleDate.getDate() + 1);
                  scheduleDate.setHours(0, 0, 0, 0);
                  while (scheduleDate <= endDate && !isDateInRecurrence(task, scheduleDate)) {
                    scheduleDate.setDate(scheduleDate.getDate() + 1);
                    scheduleDate.setHours(0, 0, 0, 0);
                  }
                } else {
                  scheduleDate.setDate(scheduleDate.getDate() + 1);
                  scheduleDate.setHours(0, 0, 0, 0);
                }
                if (scheduleDate > endDate) {
                  logger.warn('No available slot found within two-week span, skipping day iteration', {
                    taskId: task.id,
                    taskTitle: task.title,
                  });
                }
                continue;
              }
            }
          }
          
          // CRITICAL SAFEGUARD: Ensure scheduled time is never midnight (12 AM)
          // If somehow the time is midnight, use current time (if today) or category start time
          if (scheduleDate.getHours() === 0 && scheduleDate.getMinutes() === 0) {
            const today = new Date();
            const scheduleDateKey = getDateKey(scheduleDate);
            const todayDateKey = getDateKey(today);
            const isToday = scheduleDateKey === todayDateKey;
            
            if (isToday) {
              // Use current time rounded up to next 15-minute interval
              const currentTime = new Date(today);
              const minutes = currentTime.getMinutes();
              const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
              if (roundedMinutes >= MINUTES_PER_HOUR) {
                currentTime.setHours(currentTime.getHours() + 1, 0, 0, 0);
              } else {
                currentTime.setMinutes(roundedMinutes, 0, 0);
              }
              currentTime.setSeconds(0, 0);
              currentTime.setMilliseconds(0);
              scheduleDate.setTime(currentTime.getTime());
              logger.warn('CRITICAL: Scheduled time was midnight, adjusted to current time', {
                taskId: task.id,
                taskTitle: task.title,
                adjustedTime: scheduleDate.toISOString(),
              });
            } else {
              // For future dates, use category start time or default work start time
              const categoryHours = getCategoryHoursForTask(task, scheduleDate, hoursSettings);
              if (categoryHours) {
                // categoryHours.start is already in minutes, not a string
                const startMinutes = typeof categoryHours.start === 'string' 
                  ? parseTimeToMinutes(categoryHours.start) 
                  : categoryHours.start;
                scheduleDate.setHours(Math.floor(startMinutes / MINUTES_PER_HOUR), startMinutes % MINUTES_PER_HOUR, 0, 0);
              } else {
                // Use default work start time
                const [workStartHour] = DEFAULT_WEEKDAY_WORK_START.split(':').map(Number);
                scheduleDate.setHours(workStartHour, 0, 0, 0);
              }
              logger.warn('CRITICAL: Scheduled time was midnight, adjusted to category/default start time', {
                taskId: task.id,
                taskTitle: task.title,
                adjustedTime: scheduleDate.toISOString(),
              });
            }
          }
        } else {
          // Find available time slot by checking existing scheduled tasks for this day
          // Use allTasksForDay (already calculated above) which includes tasks from current plan
          // Use consistent duration calculation: convert hours to minutes
          // CRITICAL: This path should rarely be taken for recurring tasks since we force category hours above
          // But if it is taken, ensure recurring tasks still get a proper time assigned
          if (isRecurringTask && import.meta.env.DEV) {
            logger.warn('Recurring task taking else path (categoryTime was null), ensuring proper time assignment', {
              taskId: task.id,
              taskTitle: task.title,
              respectHours: hoursSettings.respectHours,
              forceCategoryHours: options?.forceCategoryHours,
            });
          }
          const taskHours = getTaskHours(task, { useCachedAIAnalysis: true });
          const taskDurationMinutes = Math.round(taskHours * MINUTES_PER_HOUR); // Convert hours back to minutes
          
          // Determine default hours based on task category
          // Even if category hours are disabled, we should still use category-appropriate defaults
          const category = getTaskCategory(task);
          const isWeekendDate = isWeekend(scheduleDate);
          
          // Get default hours from constants based on category and day type
          let defaultStartTimeStr: string;
          let defaultEndTimeStr: string;
          
          if (category) {
            // Try to get category hours from settings (even if disabled, we can use them as defaults)
            const dayHours = isWeekendDate ? hoursSettings.weekendHours : hoursSettings.weekdayHours;
            const categoryHours = dayHours[category];
            
            if (categoryHours) {
              // Use category hours as defaults (even if disabled)
              // This ensures personal tasks use evening hours (18:00-22:00) even if category hours are disabled
              defaultStartTimeStr = categoryHours.start;
              defaultEndTimeStr = categoryHours.end;
            } else {
              // Fall back to default constants from business-constants.ts
              if (isWeekendDate) {
                if (category === 'work') {
                  defaultStartTimeStr = DEFAULT_WEEKEND_WORK_START;
                  defaultEndTimeStr = DEFAULT_WEEKEND_WORK_END;
                } else if (category === 'personal') {
                  defaultStartTimeStr = DEFAULT_WEEKEND_PERSONAL_START;
                  defaultEndTimeStr = DEFAULT_WEEKEND_PERSONAL_END;
                } else if (category === 'projects') {
                  defaultStartTimeStr = DEFAULT_WEEKEND_PROJECTS_START;
                  defaultEndTimeStr = DEFAULT_WEEKEND_PROJECTS_END;
                } else {
                  defaultStartTimeStr = DEFAULT_WEEKEND_WORK_START;
                  defaultEndTimeStr = DEFAULT_WEEKEND_WORK_END;
                }
              } else {
                if (category === 'work') {
                  defaultStartTimeStr = DEFAULT_WEEKDAY_WORK_START;
                  defaultEndTimeStr = DEFAULT_WEEKDAY_WORK_END;
                } else if (category === 'personal') {
                  defaultStartTimeStr = DEFAULT_WEEKDAY_PERSONAL_START;
                  defaultEndTimeStr = DEFAULT_WEEKDAY_PERSONAL_END;
                } else if (category === 'projects') {
                  defaultStartTimeStr = DEFAULT_WEEKDAY_PROJECTS_START;
                  defaultEndTimeStr = DEFAULT_WEEKDAY_PROJECTS_END;
                } else {
                  defaultStartTimeStr = DEFAULT_WEEKDAY_WORK_START;
                  defaultEndTimeStr = DEFAULT_WEEKDAY_WORK_END;
                }
              }
            }
          } else {
            // No category - use work hours as default
            if (isWeekendDate) {
              defaultStartTimeStr = DEFAULT_WEEKEND_WORK_START;
              defaultEndTimeStr = DEFAULT_WEEKEND_WORK_END;
            } else {
              defaultStartTimeStr = DEFAULT_WEEKDAY_WORK_START;
              defaultEndTimeStr = DEFAULT_WEEKDAY_WORK_END;
            }
          }
          
          // Parse time strings to hours
          const startTime = parseTime(defaultStartTimeStr);
          const endTime = parseTime(defaultEndTimeStr);
          const defaultStartHour = startTime.hours;
          const defaultEndHour = endTime.hours;
          
          // Default work hours: use category-appropriate defaults
          const workStartHour = defaultStartHour;
          const workEndHour = defaultEndHour;
          
          // Helper: Find available time slot - prioritizes filling gaps in schedule
          const findAvailableTimeSlot = (): { hour: number; minute: number } => {
            // Determine the earliest time we can schedule (current time if today, otherwise category start)
            const today = new Date();
            const scheduleDateKey = getDateKey(scheduleDate);
            const todayDateKey = getDateKey(today);
            const isToday = scheduleDateKey === todayDateKey;
            
            // If scheduling for today, start from current time (rounded up to next 15 minutes)
            // Otherwise, start from category start hour
            let earliestTime: Date;
            if (isToday) {
              earliestTime = new Date(today);
              // Round up to next 15-minute interval
              const minutes = earliestTime.getMinutes();
              const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
              if (roundedMinutes >= MINUTES_PER_HOUR) {
                earliestTime.setHours(earliestTime.getHours() + 1, 0, 0, 0);
              } else {
                earliestTime.setMinutes(roundedMinutes, 0, 0);
              }
              // Don't schedule before category start hours
              if (earliestTime.getHours() < workStartHour) {
                earliestTime.setHours(workStartHour, 0, 0, 0);
              }
            } else {
              earliestTime = new Date(scheduleDate);
              earliestTime.setHours(workStartHour, 0, 0, 0);
            }
            
            // If no existing tasks, use priority-based initial time (but not before earliestTime)
            // For personal tasks, prefer later in the day even for high priority
            // Use allTasksForDay (includes tasks from current plan) to avoid scheduling conflicts
            if (allTasksForDay.length === 0) {
              const priorityTime = (() => {
                // For personal tasks, use category start hour (evening) regardless of priority
                if (category === 'personal') {
                  return { hour: workStartHour, minute: 0 };
                }
                // For other categories, use priority-based times
                if (task.status === 'in-progress' || task.priority === 'urgent') {
                  return { hour: workStartHour, minute: 0 };
                } else if (task.priority === 'high') {
                  return { hour: workStartHour, minute: 0 };
                } else {
                  return PRIORITY_TIME_SLOTS[task.priority] || PRIORITY_TIME_SLOTS.low;
                }
              })();
              
              const priorityDateTime = new Date(scheduleDate);
              priorityDateTime.setHours(priorityTime.hour, priorityTime.minute, 0, 0);
              
              // Use the later of priority time or earliest time
              if (priorityDateTime >= earliestTime) {
                return priorityTime;
              } else {
                return { hour: earliestTime.getHours(), minute: earliestTime.getMinutes() };
              }
            }
            
            // Sort existing tasks by scheduled time
            // Use allTasksForDay (includes tasks from current plan) to avoid scheduling conflicts
            const sortedTasks = [...allTasksForDay].sort((a, b) => {
              const timeA = parseTaskScheduledDate(a.scheduledDate!).getTime();
              const timeB = parseTaskScheduledDate(b.scheduledDate!).getTime();
              return timeA - timeB;
            });
            
            // Find ALL available gaps between existing tasks
            const availableGaps: Array<{ start: Date; duration: number; end: Date }> = [];
            
            // Check gap before first task
            if (sortedTasks.length > 0) {
              const firstTask = sortedTasks[0];
              const firstTaskStart = parseTaskScheduledDate(firstTask.scheduledDate!);
              let gapStart = new Date(earliestTime);
              if (gapStart < firstTaskStart) {
                const gapDuration = (firstTaskStart.getTime() - gapStart.getTime()) / MILLISECONDS_PER_MINUTE;
                if (gapDuration >= taskDurationMinutes) {
                  availableGaps.push({
                    start: gapStart,
                    duration: gapDuration,
                    end: firstTaskStart
                  });
                }
              }
            }
            
            // Find gaps between tasks
            for (let i = 1; i < sortedTasks.length; i++) {
              const prevTask = sortedTasks[i - 1];
              const currentTask = sortedTasks[i];
              
              const prevTaskStart = parseTaskScheduledDate(prevTask.scheduledDate!);
              const prevTaskDuration = getTaskMinutes(prevTask, { useCachedAIAnalysis: true }); // Use AI estimator for existing tasks
              const prevTaskEnd = new Date(prevTaskStart);
              prevTaskEnd.setMinutes(prevTaskEnd.getMinutes() + prevTaskDuration);
              
              const currentTaskStart = parseTaskScheduledDate(currentTask.scheduledDate!);
              
              // Calculate gap
              const gapStart = new Date(prevTaskEnd);
              const gapDuration = (currentTaskStart.getTime() - gapStart.getTime()) / MILLISECONDS_PER_MINUTE;
              
              // If gap is large enough for this task, add it to available gaps
              if (gapDuration >= taskDurationMinutes) {
                availableGaps.push({
                  start: gapStart,
                  duration: gapDuration,
                  end: currentTaskStart
                });
              }
            }
            
            // Check gap after last task (if there's room before work end)
            if (sortedTasks.length > 0) {
              const lastTask = sortedTasks[sortedTasks.length - 1];
              const lastTaskStart = parseTaskScheduledDate(lastTask.scheduledDate!);
              const lastTaskDuration = getTaskMinutes(lastTask, { useCachedAIAnalysis: true }); // Use AI estimator for existing tasks
              const lastTaskEnd = new Date(lastTaskStart);
              lastTaskEnd.setMinutes(lastTaskEnd.getMinutes() + lastTaskDuration);
              
              const workEnd = new Date(scheduleDate);
              workEnd.setHours(workEndHour, 0, 0, 0);
              
              if (lastTaskEnd < workEnd) {
                const gapDuration = (workEnd.getTime() - lastTaskEnd.getTime()) / MILLISECONDS_PER_MINUTE;
                if (gapDuration >= taskDurationMinutes) {
                  availableGaps.push({
                    start: lastTaskEnd,
                    duration: gapDuration,
                    end: workEnd
                  });
                }
              }
            }
            
            // If we found available gaps, use the best one
            if (availableGaps.length > 0) {
              // Sort gaps by size (smallest first to fill small gaps, or largest first to use big gaps)
              // For minimum hours enforcement, prefer smaller gaps to fill them up
              // Otherwise, prefer earlier gaps
              availableGaps.sort((a, b) => {
                if (options?.enforceMinimumHours) {
                  // When enforcing minimum, prefer smaller gaps to fill them
                  return a.duration - b.duration;
                } else {
                  // Otherwise, prefer earlier gaps
                  return a.start.getTime() - b.start.getTime();
                }
              });
              
              const bestGap = availableGaps[0];
              
              // Priority-based positioning within gap
              if (task.status === 'in-progress' || task.priority === 'urgent') {
                // Urgent: start as early as possible in gap
                return { 
                  hour: bestGap.start.getHours(), 
                  minute: bestGap.start.getMinutes() 
                };
              } else if (task.priority === 'high') {
                // High: start early in gap
                return { 
                  hour: bestGap.start.getHours(), 
                  minute: bestGap.start.getMinutes() 
                };
              } else {
                // Medium/Low: can start later in gap, but for minimum hours, fill from start
                if (options?.enforceMinimumHours) {
                  return { 
                    hour: bestGap.start.getHours(), 
                    minute: bestGap.start.getMinutes() 
                  };
                } else {
                  const gapCenter = new Date(bestGap.start);
                  gapCenter.setMinutes(gapCenter.getMinutes() + Math.floor(bestGap.duration / 2));
                  return { 
                    hour: gapCenter.getHours(), 
                    minute: gapCenter.getMinutes() 
                  };
                }
              }
            }
            
            // No gaps found - place after last task or at earliest time
            if (sortedTasks.length > 0) {
              const lastTask = sortedTasks[sortedTasks.length - 1];
              const lastTaskStart = parseTaskScheduledDate(lastTask.scheduledDate!);
              const lastTaskDuration = getTaskMinutes(lastTask, { useCachedAIAnalysis: true }); // Use AI estimator for existing tasks
              const nextAvailableTime = new Date(lastTaskStart);
              nextAvailableTime.setMinutes(nextAvailableTime.getMinutes() + lastTaskDuration);
              
              // If scheduling for today, ensure we don't schedule before current time
              if (isToday && nextAvailableTime < earliestTime) {
                return { 
                  hour: earliestTime.getHours(), 
                  minute: earliestTime.getMinutes() 
                };
              }
              
              // Ensure we don't exceed work hours
              if (nextAvailableTime.getHours() >= workEndHour) {
                // This shouldn't happen due to 5-hour limit, but handle it
                // If today, try to use earliest time, otherwise use work start
                if (isToday && earliestTime.getHours() < workEndHour) {
                  return { hour: earliestTime.getHours(), minute: earliestTime.getMinutes() };
                }
                return { hour: workStartHour, minute: 0 };
              }
              
              return { 
                hour: nextAvailableTime.getHours(), 
                minute: nextAvailableTime.getMinutes() 
              };
            }
            
            // No tasks at all - use priority-based time
            const priorityTime = (() => {
              if (task.status === 'in-progress' || task.priority === 'urgent') {
                return { hour: workStartHour, minute: 0 };
              } else if (task.priority === 'high') {
                return { hour: workStartHour, minute: 0 };
              } else {
                return PRIORITY_TIME_SLOTS[task.priority] || PRIORITY_TIME_SLOTS.low;
              }
            })();
            
            const priorityDateTime = new Date(scheduleDate);
            priorityDateTime.setHours(priorityTime.hour, priorityTime.minute, 0, 0);
            
            if (priorityDateTime >= earliestTime) {
              return priorityTime;
            } else {
              return { hour: earliestTime.getHours(), minute: earliestTime.getMinutes() };
            }
          };
          
          const availableSlot = findAvailableTimeSlot();
          
          // Always use findNextAvailableSlot to ensure we find actual open slots
          // This properly handles conflicts, respects current time, and uses category hours
          const today = new Date();
          const scheduleDateKey = getDateKey(scheduleDate);
          const todayDateKey = getDateKey(today);
          const isToday = scheduleDateKey === todayDateKey;
          
          // Create proposed time from availableSlot
          const proposedTime = new Date(scheduleDate);
          let proposedMinute = Math.round(availableSlot.minute / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
          let proposedHour = availableSlot.hour;
          if (proposedMinute >= MINUTES_PER_HOUR) {
            proposedHour += 1;
            proposedMinute = 0;
          }
          // Ensure time doesn't exceed work hours (fallback if no category hours)
          if (proposedHour >= workEndHour) {
            proposedHour = workEndHour - 1;
            proposedMinute = 0;
          }
          proposedTime.setHours(proposedHour, proposedMinute, 0, 0);
          
          // Get category hours for the task - ALWAYS use them if available
          const categoryHours = getCategoryHoursForTask(task, scheduleDate, hoursSettings);
          
          // If forceCategoryHours is enabled, try to get category hours even if respectHours is disabled
          let effectiveCategoryHours = categoryHours;
          if (!categoryHours && options?.forceCategoryHours) {
            const category = getTaskCategory(task);
            if (category) {
              const isWeekendDate = isWeekend(scheduleDate);
              const dayHours = isWeekendDate ? hoursSettings.weekendHours : hoursSettings.weekdayHours;
              const catHours = dayHours[category];
              if (catHours && catHours.enabled) {
                const startMinutes = parseTimeToMinutes(catHours.start);
                const endMinutes = parseTimeToMinutes(catHours.end);
                effectiveCategoryHours = { start: startMinutes, end: endMinutes };
              }
            }
          }
          
          // Use findNextAvailableSlot to find actual open slot with category hours
          // IMPORTANT: Pass allTasksForDay (which includes tasks from current plan) to findNextAvailableSlot
          // so it can see tasks being scheduled in the same batch and avoid conflicts.
          // CRITICAL: Pass calendar events for this day so the AI does not schedule at the same time as calendar events.
          const dayCalendarEventsForFinalSlot = calendarEventsForDay(scheduleDate);
          const finalSlot = findNextAvailableSlot(
            task.id,
            proposedTime,
            taskDurationMinutes,
            validTasksForDay, // Use validated tasks to ensure conflict detection works
            buildAISchedulerSlotOptions({
              ensureAfterCurrentTime: isToday,
              categoryHours: effectiveCategoryHours ? {
                start: effectiveCategoryHours.start,
                end: effectiveCategoryHours.end,
              } : undefined,
              calendarEvents: dayCalendarEventsForFinalSlot,
            })
          );
          
          // If a valid slot was found (on the requested day, not next-day 12 AM), use it
          if (isSlotOnRequestedDay(finalSlot, scheduleDate)) {
            scheduleDate.setTime(finalSlot.getTime());
          } else {
            // No slot in category window — still run conflict resolution (tasks + calendar events)
            const fallbackProposed = new Date(scheduleDate);
            let selectedMinute = Math.round(availableSlot.minute / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
            let selectedHour = availableSlot.hour;
            if (selectedMinute >= MINUTES_PER_HOUR) {
              selectedHour += 1;
              selectedMinute = 0;
            }
            if (effectiveCategoryHours) {
              const maxHour = Math.floor(effectiveCategoryHours.end / MINUTES_PER_HOUR);
              const maxMinute = effectiveCategoryHours.end % MINUTES_PER_HOUR;
              if (selectedHour > maxHour || (selectedHour === maxHour && selectedMinute > maxMinute)) {
                selectedHour = Math.floor(effectiveCategoryHours.start / MINUTES_PER_HOUR);
                selectedMinute = effectiveCategoryHours.start % MINUTES_PER_HOUR;
              }
            } else if (selectedHour >= workEndHour) {
              selectedHour = workEndHour - 1;
              selectedMinute = 0;
            }
            fallbackProposed.setHours(selectedHour, selectedMinute, 0, 0);
            const fallbackSlot = findNextAvailableSlot(
              task.id,
              fallbackProposed,
              taskDurationMinutes,
              validTasksForDay,
              buildAISchedulerSlotOptions({
                ensureAfterCurrentTime: isToday,
                categoryHours: effectiveCategoryHours ? {
                  start: effectiveCategoryHours.start,
                  end: effectiveCategoryHours.end,
                } : undefined,
                calendarEvents: dayCalendarEventsForFinalSlot,
              })
            );
            if (isSlotOnRequestedDay(fallbackSlot, scheduleDate)) {
              scheduleDate.setTime(fallbackSlot.getTime());
            }
          }
          
          // CRITICAL: Final conflict check using findNextAvailableSlot to ensure no conflicts
          // This is a safeguard to catch any conflicts that might have been missed
          // IMPORTANT: Use allTasksForDay (includes tasks from current plan) not just existingTasksForDay
          // Get calendar events for this specific day
          const finalCheckCalendarEvents = calendarEventsForDay(scheduleDate);
          
          const finalConflictCheck = findNextAvailableSlot(
            task.id,
            scheduleDate,
            taskDurationMinutes,
            validTasksForDay, // Use validated tasks which includes tasks from current plan
            buildAISchedulerSlotOptions({
              ensureAfterCurrentTime: isToday,
              categoryHours: effectiveCategoryHours ? {
                start: effectiveCategoryHours.start,
                end: effectiveCategoryHours.end,
              } : undefined,
              calendarEvents: finalCheckCalendarEvents, // Include calendar events
            })
          );
          
          // ALWAYS use the conflict-free slot from findNextAvailableSlot (tasks + calendar events)
          if (isSlotOnRequestedDay(finalConflictCheck, scheduleDate)) {
            scheduleDate.setTime(finalConflictCheck.getTime());
            const roundedMinutes = Math.round(scheduleDate.getMinutes() / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
            scheduleDate.setMinutes(roundedMinutes);
          } else {
            // This should never happen if findNextAvailableSlot worked correctly earlier
            logger.error('CRITICAL: Final conflict check found no slot', {
              taskId: task.id,
              taskTitle: task.title,
              isRecurringTask,
              scheduleDate: scheduleDate.toISOString(),
            });
          }
          
          // CRITICAL SAFEGUARD: Ensure scheduled time is never midnight (12 AM)
          // If somehow the time is midnight, use current time (if today) or category start time
          if (scheduleDate.getHours() === 0 && scheduleDate.getMinutes() === 0) {
            const today = new Date();
            const scheduleDateKey = getDateKey(scheduleDate);
            const todayDateKey = getDateKey(today);
            const isToday = scheduleDateKey === todayDateKey;
            
            if (isToday) {
              // Use current time rounded up to next 15-minute interval
              const currentTime = new Date(today);
              const minutes = currentTime.getMinutes();
              const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
              if (roundedMinutes >= MINUTES_PER_HOUR) {
                currentTime.setHours(currentTime.getHours() + 1, 0, 0, 0);
              } else {
                currentTime.setMinutes(roundedMinutes, 0, 0);
              }
              currentTime.setSeconds(0, 0);
              currentTime.setMilliseconds(0);
              scheduleDate.setTime(currentTime.getTime());
              logger.warn('CRITICAL: Scheduled time was midnight, adjusted to current time', {
                taskId: task.id,
                taskTitle: task.title,
                adjustedTime: scheduleDate.toISOString(),
              });
            } else {
              // For future dates, use category start time or default work start time
              const categoryHours = getCategoryHoursForTask(task, scheduleDate, hoursSettings);
              if (categoryHours) {
                // categoryHours.start is already in minutes, not a string
                const startMinutes = typeof categoryHours.start === 'string' 
                  ? parseTimeToMinutes(categoryHours.start) 
                  : categoryHours.start;
                scheduleDate.setHours(Math.floor(startMinutes / MINUTES_PER_HOUR), startMinutes % MINUTES_PER_HOUR, 0, 0);
              } else {
                // Use default work start time
                const [workStartHour] = DEFAULT_WEEKDAY_WORK_START.split(':').map(Number);
                scheduleDate.setHours(workStartHour, 0, 0, 0);
              }
              logger.warn('CRITICAL: Scheduled time was midnight, adjusted to category/default start time', {
                taskId: task.id,
                taskTitle: task.title,
                adjustedTime: scheduleDate.toISOString(),
              });
            }
          }
          
          // Update reason with time information
          if (!reason.includes('scheduled') && !reason.includes('hours')) {
            const timeStr = scheduleDate.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            reason = `${reason} - scheduled at ${timeStr}`;
          }
        }
        
        // CRITICAL: Final safeguard - ALWAYS run findNextAvailableSlot one more time before adding to plan
        // This ensures we catch any conflicts that might have been missed, especially for recurring tasks
        // IMPORTANT: Recalculate validTasksForDay to ensure it includes ALL tasks from the plan with their final scheduled times
        // This is critical because tasks in the plan might have had their times adjusted by previous conflict checks
        // CRITICAL FIX: For recurring tasks in the plan, check if they apply to this date using isDateInRecurrence()
        // This ensures recurring tasks are visible on ALL their occurrence days in the final safeguard
        const updatedTasksInPlanSameDay = plan
          .filter(p => {
            if (!p.scheduledDate) return false;
            
            // Check if this is a recurring task
            const isPlanTaskRecurring = p.task.recurrence && p.task.recurrence.type !== 'none';
            
            if (isPlanTaskRecurring) {
              // For recurring tasks, check if they apply to this date using isDateInRecurrence
              if (!isDateInRecurrence(p.task, scheduleDate)) {
                return false;
              }
            } else {
              // For regular tasks, check if scheduledDate matches the target date
              const planDate = p.scheduledDate instanceof Date ? p.scheduledDate : parseTaskScheduledDate(p.scheduledDate);
              const pDateKey = getDateKey(planDate);
              if (pDateKey !== dateKey) return false;
            }
            
            // Only include tasks that have a scheduled time set (not just midnight)
            const planDate = p.scheduledDate instanceof Date ? p.scheduledDate : parseTaskScheduledDate(p.scheduledDate);
            const hasTimeSet = planDate.getHours() !== 0 || planDate.getMinutes() !== 0;
            return hasTimeSet;
          })
          .map(p => {
            const planScheduledDate = p.scheduledDate instanceof Date ? p.scheduledDate : parseTaskScheduledDate(p.scheduledDate);
            const isPlanTaskRecurring = p.task.recurrence && p.task.recurrence.type !== 'none';
            
            // CRITICAL FIX: For recurring tasks, adjust scheduledDate to the target date while preserving time
            // This ensures conflict detection sees the recurring task on the correct day
            let taskScheduledDate: string;
            if (isPlanTaskRecurring) {
              // Create a date for the target day (scheduleDate) but with the time from the first occurrence
              const occurrenceDate = new Date(scheduleDate);
              occurrenceDate.setHours(planScheduledDate.getHours(), planScheduledDate.getMinutes(), planScheduledDate.getSeconds(), planScheduledDate.getMilliseconds());
              taskScheduledDate = occurrenceDate.toISOString();
            } else {
              // For regular tasks, use the exact scheduledDate from the plan
              taskScheduledDate = planScheduledDate.toISOString();
            }
            
            // CRITICAL: Create a new task object with the scheduledDate as an ISO string
            // This ensures findNextAvailableSlot can correctly parse it
            const taskWithScheduledDate = {
              ...p.task,
              scheduledDate: taskScheduledDate
            };
            // CRITICAL: Ensure the scheduledDate is properly set and not null/undefined
            if (!taskWithScheduledDate.scheduledDate) {
              logger.error('CRITICAL: Task in plan has no scheduledDate after conversion', {
                taskId: p.task.id,
                taskTitle: p.task.title,
                originalScheduledDate: p.scheduledDate,
              });
              return null;
            }
            return taskWithScheduledDate;
          })
          .filter((t): t is Task => t !== null); // Remove any null entries
        
        // Combine with existing tasks to get the most up-to-date list
        // CRITICAL: Remove duplicates by task ID (plan tasks take precedence as they have the most recent scheduled times)
        const taskMap = new Map<string, Task>();
        
        // First, add existing tasks
        existingTasksForDay.forEach(t => {
          if (t.id && t.scheduledDate) {
            taskMap.set(t.id, t);
          }
        });
        
        // Then, add/overwrite with tasks from plan (these have the most recent scheduled times)
        updatedTasksInPlanSameDay.forEach(t => {
          if (t.id && t.scheduledDate) {
            taskMap.set(t.id, t);
          }
        });
        
        const updatedValidTasksForDay = Array.from(taskMap.values()).filter(t => {
          if (!t.scheduledDate) return false;
          const scheduledDate = typeof t.scheduledDate === 'string' 
            ? parseTaskScheduledDate(t.scheduledDate)
            : parseTaskScheduledDate(t.scheduledDate);
          const isValid = !isNaN(scheduledDate.getTime()) && (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
          if (!isValid && import.meta.env.DEV) {
            logger.debug('Filtered out task with invalid scheduledDate in final safeguard', {
              taskId: t.id,
              taskTitle: t.title,
              scheduledDate: t.scheduledDate,
              scheduledDateType: typeof t.scheduledDate,
            });
          }
          return isValid;
        });
        
        // CRITICAL DEBUG: Log what tasks are being checked in the final safeguard
        if (import.meta.env.DEV) {
          logger.debug('Final safeguard conflict check', {
            taskId: task.id,
            taskTitle: task.title,
            isRecurringTask,
            scheduleDate: scheduleDate.toISOString(),
            updatedValidTasksForDayCount: updatedValidTasksForDay.length,
            updatedValidTasksForDay: updatedValidTasksForDay.map(t => ({
              id: t.id,
              title: t.title,
              scheduledDate: t.scheduledDate,
              scheduledTime: t.scheduledDate ? parseTaskScheduledDate(t.scheduledDate).toLocaleTimeString() : 'none',
              category: getTaskCategory(t),
            })),
          });
        }
        
        // Get calendar events for this specific day for final safeguard
        const finalSafeguardCalendarEvents = calendarEventsForDay(scheduleDate);
        
        const finalSafeguardIsToday = getDateKey(scheduleDate) === getDateKey(new Date());

        const finalSafeguardSlot = findNextAvailableSlot(
          task.id,
          scheduleDate,
          taskDurationMinutes,
          updatedValidTasksForDay, // Use updated list with all tasks from plan
          buildAISchedulerSlotOptions({
            ensureAfterCurrentTime: finalSafeguardIsToday,
            categoryHours: undefined, // Remove constraints for final check
            calendarEvents: finalSafeguardCalendarEvents, // Include calendar events
          })
        );
        
        // ALWAYS use the final safeguard slot if it's on the requested day
        if (isSlotOnRequestedDay(finalSafeguardSlot, scheduleDate)) {
          const originalTime = scheduleDate.getTime();
          const safeguardTime = finalSafeguardSlot.getTime();
          const timeDifference = Math.abs(safeguardTime - originalTime);
          
          if (timeDifference > MILLISECONDS_PER_MINUTE) {
            // Time was adjusted - this means there was a conflict
            if (import.meta.env.DEV) {
              logger.debug('Final safeguard adjusted time - conflict detected!', {
                taskId: task.id,
                taskTitle: task.title,
                isRecurringTask,
                originalTime: new Date(originalTime).toISOString(),
                safeguardTime: new Date(safeguardTime).toISOString(),
                timeDifferenceMinutes: Math.round(timeDifference / MILLISECONDS_PER_MINUTE),
                updatedValidTasksForDayCount: updatedValidTasksForDay.length,
              });
            }
            scheduleDate.setTime(safeguardTime);
            // Round to nearest interval
            const roundedMinutes = Math.round(scheduleDate.getMinutes() / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
            scheduleDate.setMinutes(roundedMinutes);
            scheduleDate.setSeconds(0, 0);
            scheduleDate.setMilliseconds(0);
          } else if (import.meta.env.DEV) {
            logger.debug('Final safeguard - no conflict detected', {
              taskId: task.id,
              taskTitle: task.title,
              isRecurringTask,
              scheduleDate: scheduleDate.toISOString(),
              updatedValidTasksForDayCount: updatedValidTasksForDay.length,
            });
          }
        } else {
          logger.error('CRITICAL: Final safeguard found no slot', {
            taskId: task.id,
            taskTitle: task.title,
            isRecurringTask,
            scheduleDate: scheduleDate.toISOString(),
            updatedValidTasksForDayCount: updatedValidTasksForDay.length,
          });
        }
        
        // CRITICAL: One final direct check - iterate through plan and check for ALL conflicts
        // This is a last-resort check to catch any conflicts that findNextAvailableSlot might have missed
        // We need to check ALL tasks in the plan, not just the first conflict
        // CRITICAL FIX: For recurring tasks in the plan, check if they apply to this date using isDateInRecurrence()
        let maxConflictEnd = scheduleDate.getTime();
        let hasConflict = false;
        const scheduleTimeMs = scheduleDate.getTime();
        const scheduleEndMs = scheduleTimeMs + (taskDurationMinutes * MILLISECONDS_PER_MINUTE);
        
        // First pass: Find all conflicts and track the latest end time
        for (const planItem of plan) {
          if (!planItem.scheduledDate) continue;
          if (planItem.task.id === task.id) continue; // Skip self
          
          const planScheduledDate = planItem.scheduledDate instanceof Date 
            ? planItem.scheduledDate 
            : parseTaskScheduledDate(planItem.scheduledDate);
          
          // Check if this task applies to the target date
          const isPlanItemRecurring = planItem.task.recurrence && planItem.task.recurrence.type !== 'none';
          let appliesToDate = false;
          
          if (isPlanItemRecurring) {
            // For recurring tasks, check if they apply to this date using isDateInRecurrence
            appliesToDate = isDateInRecurrence(planItem.task, scheduleDate);
          } else {
            // For regular tasks, check if scheduledDate matches the target date
            const planDateKey = getDateKey(planScheduledDate);
            appliesToDate = planDateKey === dateKey;
          }
          
          // Only check tasks that apply to this date
          if (!appliesToDate) continue;
          
          // Check if times overlap
          // CRITICAL FIX: For recurring tasks, use the time from the first occurrence but on the target date
          // This ensures we check conflicts correctly for recurring tasks on their occurrence days
          let planTimeMs: number;
          if (isPlanItemRecurring) {
            // For recurring tasks, create a date for the target day with the time from the first occurrence
            const occurrenceDate = new Date(scheduleDate);
            occurrenceDate.setHours(planScheduledDate.getHours(), planScheduledDate.getMinutes(), planScheduledDate.getSeconds(), planScheduledDate.getMilliseconds());
            planTimeMs = occurrenceDate.getTime();
          } else {
            // For regular tasks, use the exact scheduledDate
            planTimeMs = planScheduledDate.getTime();
          }
          const planTaskDuration = getTaskMinutes(planItem.task, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE;
          const planEndMs = planTimeMs + planTaskDuration;
          
          if (aiSchedulingTaskBlockConflicts(
            scheduleTimeMs,
            scheduleEndMs,
            planTimeMs,
            planEndMs,
            AI_SCHEDULING_PREP_BUFFER_MS,
          )) {
            hasConflict = true;
            // Track the latest end time of all conflicts
            maxConflictEnd = Math.max(
              maxConflictEnd,
              expandTaskBlockEndForSchedulingPrep(planEndMs, AI_SCHEDULING_PREP_BUFFER_MS),
            );
            
            if (import.meta.env.DEV) {
              logger.error('🚨 DIRECT CONFLICT DETECTED BEFORE ADDING TO PLAN!', {
                currentTask: { id: task.id, title: task.title, time: scheduleDate.toISOString() },
                conflictingTask: { id: planItem.task.id, title: planItem.task.title, time: planScheduledDate.toISOString() },
                planEndMs: new Date(planEndMs).toISOString(),
                maxConflictEnd: new Date(maxConflictEnd).toISOString(),
              });
            }
          }
        }

        for (const block of buildCalendarConflictBlocksForDay(calendarEventsForDay(scheduleDate), scheduleDate)) {
          const expandedBlock = expandCalendarBlockForSchedulingPrep(
            block.start,
            block.end,
            AI_SCHEDULING_PREP_BUFFER_MS,
          );
          if (scheduleBlocksConflict(scheduleTimeMs, scheduleEndMs, expandedBlock.start, expandedBlock.end)) {
            hasConflict = true;
            maxConflictEnd = Math.max(maxConflictEnd, expandedBlock.end);
            if (import.meta.env.DEV) {
              logger.error('🚨 DIRECT CALENDAR CONFLICT BEFORE ADDING TO PLAN!', {
                currentTask: { id: task.id, title: task.title, time: scheduleDate.toISOString() },
                eventTitle: block.title,
                eventStart: new Date(block.start).toISOString(),
                eventEnd: new Date(block.end).toISOString(),
              });
            }
          }
        }
        
        // If conflicts found, move to after ALL conflicting tasks and calendar events
        if (hasConflict) {
          // Move to after the latest conflict end time (prep buffer already included)
          scheduleDate.setTime(maxConflictEnd);
          // Round up to nearest interval to ensure we're past the conflict
          const minutes = scheduleDate.getMinutes();
          const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
          if (roundedMinutes >= MINUTES_PER_HOUR) {
            scheduleDate.setHours(scheduleDate.getHours() + 1);
            scheduleDate.setMinutes(0);
          } else {
            scheduleDate.setMinutes(roundedMinutes);
          }
          scheduleDate.setSeconds(0, 0);
          scheduleDate.setMilliseconds(0);
          
          // CRITICAL: Re-check for conflicts after adjustment (in case we moved into another conflict)
          // This is a recursive check to ensure we don't create new conflicts
          // CRITICAL FIX: Must check both regular and recurring tasks correctly
          const adjustedTimeMs = scheduleDate.getTime();
          const adjustedEndMs = adjustedTimeMs + (taskDurationMinutes * MILLISECONDS_PER_MINUTE);
          let stillHasConflict = false;
          let newMaxConflictEnd = adjustedTimeMs;
          
          for (const planItem of plan) {
            if (!planItem.scheduledDate) continue;
            if (planItem.task.id === task.id) continue;
            
            const planScheduledDate = planItem.scheduledDate instanceof Date 
              ? planItem.scheduledDate 
              : parseTaskScheduledDate(planItem.scheduledDate);
            
            // CRITICAL FIX: Check if this task applies to the target date (same logic as first pass)
            const isPlanItemRecurring = planItem.task.recurrence && planItem.task.recurrence.type !== 'none';
            let appliesToDate = false;
            
            if (isPlanItemRecurring) {
              // For recurring tasks, check if they apply to this date using isDateInRecurrence
              appliesToDate = isDateInRecurrence(planItem.task, scheduleDate);
            } else {
              // For regular tasks, check if scheduledDate matches the target date
              const planDateKey = getDateKey(planScheduledDate);
              appliesToDate = planDateKey === dateKey;
            }
            
            // Only check tasks that apply to this date
            if (!appliesToDate) continue;
            
            // CRITICAL FIX: For recurring tasks, use the time from the first occurrence but on the target date
            // This ensures we check conflicts correctly for recurring tasks on their occurrence days
            let planTimeMs: number;
            if (isPlanItemRecurring) {
              // For recurring tasks, create a date for the target day with the time from the first occurrence
              const occurrenceDate = new Date(scheduleDate);
              occurrenceDate.setHours(planScheduledDate.getHours(), planScheduledDate.getMinutes(), planScheduledDate.getSeconds(), planScheduledDate.getMilliseconds());
              planTimeMs = occurrenceDate.getTime();
            } else {
              // For regular tasks, use the exact scheduledDate
              planTimeMs = planScheduledDate.getTime();
            }
            
            const planTaskDuration = getTaskMinutes(planItem.task, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE;
            const planEndMs = planTimeMs + planTaskDuration;
            
            if (aiSchedulingTaskBlockConflicts(
              adjustedTimeMs,
              adjustedEndMs,
              planTimeMs,
              planEndMs,
              AI_SCHEDULING_PREP_BUFFER_MS,
            )) {
              stillHasConflict = true;
              newMaxConflictEnd = Math.max(
                newMaxConflictEnd,
                expandTaskBlockEndForSchedulingPrep(planEndMs, AI_SCHEDULING_PREP_BUFFER_MS),
              );
              
              if (import.meta.env.DEV) {
                logger.error('🚨 DIRECT CONFLICT STILL EXISTS AFTER ADJUSTMENT!', {
                  currentTask: { id: task.id, title: task.title, time: scheduleDate.toISOString() },
                  conflictingTask: { 
                    id: planItem.task.id, 
                    title: planItem.task.title, 
                    isRecurring: isPlanItemRecurring,
                    time: planScheduledDate.toISOString(),
                    adjustedTime: new Date(planTimeMs).toISOString()
                  },
                  planEndMs: new Date(planEndMs).toISOString(),
                  newMaxConflictEnd: new Date(newMaxConflictEnd).toISOString(),
                });
              }
            }
          }
          
          // If still has conflict, move again (this should be rare, but handle it)
          if (stillHasConflict) {
            scheduleDate.setTime(newMaxConflictEnd);
            const minutes = scheduleDate.getMinutes();
            const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
            if (roundedMinutes >= MINUTES_PER_HOUR) {
              scheduleDate.setHours(scheduleDate.getHours() + 1);
              scheduleDate.setMinutes(0);
            } else {
              scheduleDate.setMinutes(roundedMinutes);
            }
            scheduleDate.setSeconds(0, 0);
            scheduleDate.setMilliseconds(0);
            
            if (import.meta.env.DEV) {
              logger.warn('Direct conflict required second adjustment', {
                taskId: task.id,
                taskTitle: task.title,
                finalTime: scheduleDate.toISOString(),
              });
            }
          }
          
          if (import.meta.env.DEV) {
            logger.debug('Direct conflict resolved - time adjusted', {
              taskId: task.id,
              taskTitle: task.title,
              originalTime: new Date(scheduleTimeMs).toISOString(),
              finalTime: scheduleDate.toISOString(),
              conflictsFound: hasConflict,
              stillHasConflict,
            });
          }
        }
        
        // Schedule the task (we've verified it has no conflicts)
        // CRITICAL FIX: Create task object with updated scheduledDate for dailyTasks
        // The original task.scheduledDate might be null or outdated, but dailyTasks needs
        // the task with the correct scheduledDate so that subsequent tasks can see it
        // during conflict detection in existingTasksForDay
        
        // FINAL SAFEGUARD: Check if this time conflicts with any task already in the plan
        // This ensures no two tasks are scheduled at the exact same time even if earlier detection failed
        // Uses cached AI Analysis results for consistency
        const safeguardTaskHours = getTaskHours(task, { useCachedAIAnalysis: true });
        const safeguardTaskDuration = Math.round(safeguardTaskHours * MINUTES_PER_HOUR);
        const safeguardScheduleTimeMs = scheduleDate.getTime();
        const safeguardScheduleEndMs = safeguardScheduleTimeMs + (safeguardTaskDuration * MILLISECONDS_PER_MINUTE);
        
        // Check all tasks in the plan for the same day
        const safeguardScheduleDateKey = getDateKey(scheduleDate);
        let hasConflictInPlan = false;
        let maxConflictEndInPlan = safeguardScheduleTimeMs;
        
        for (const planItem of plan) {
          if (!planItem.scheduledDate) continue;
          const planDate = planItem.scheduledDate instanceof Date ? planItem.scheduledDate : parseTaskScheduledDate(planItem.scheduledDate);
          
          // Check if same day
          const planDateKey = getDateKey(planDate);
          if (planDateKey !== safeguardScheduleDateKey) {
            // For recurring tasks in plan, check if they apply to this day
            const isPlanRecurring = planItem.task.recurrence && planItem.task.recurrence.type !== 'none';
            if (!isPlanRecurring) continue;
            if (!isDateInRecurrence(planItem.task, scheduleDate)) continue;
          }
          
          const planTaskStart = planDate.getTime();
          const planTaskDuration = getTaskMinutes(planItem.task, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE;
          const planTaskEnd = planTaskStart + planTaskDuration;
          
          if (aiSchedulingTaskBlockConflicts(
            safeguardScheduleTimeMs,
            safeguardScheduleEndMs,
            planTaskStart,
            planTaskEnd,
            AI_SCHEDULING_PREP_BUFFER_MS,
          )) {
            hasConflictInPlan = true;
            maxConflictEndInPlan = Math.max(
              maxConflictEndInPlan,
              expandTaskBlockEndForSchedulingPrep(planTaskEnd, AI_SCHEDULING_PREP_BUFFER_MS),
            );
          }
        }
        
        // If conflict found, move to after all conflicts
        if (hasConflictInPlan) {
          const conflictFreeTime = new Date(maxConflictEndInPlan);
          // Round up to nearest 15-minute interval
          const roundedMinutes = Math.ceil(conflictFreeTime.getMinutes() / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
          if (roundedMinutes >= MINUTES_PER_HOUR) {
            conflictFreeTime.setHours(conflictFreeTime.getHours() + 1, 0, 0, 0);
          } else {
            conflictFreeTime.setMinutes(roundedMinutes, 0, 0);
          }
          conflictFreeTime.setSeconds(0, 0);
          conflictFreeTime.setMilliseconds(0);
          
          // Use the conflict-free time
          scheduleDate.setTime(conflictFreeTime.getTime());
          reason = `${reason} - moved to avoid conflict (final safeguard)`;
          
          if (import.meta.env.DEV) {
            logger.debug('FINAL SAFEGUARD: Task time adjusted to avoid conflict', {
              taskId: task.id,
              taskTitle: task.title,
              originalTime: new Date(safeguardScheduleTimeMs).toLocaleTimeString(),
              newTime: scheduleDate.toLocaleTimeString(),
            });
          }
        }
        
        // FINAL CRITICAL SAFEGUARD: Ensure scheduled time is never midnight (12 AM) before adding to plan
        // This is the last check before the task is saved, ensuring we never schedule at midnight
        if (scheduleDate.getHours() === 0 && scheduleDate.getMinutes() === 0) {
          const today = new Date();
          const scheduleDateKey = getDateKey(scheduleDate);
          const todayDateKey = getDateKey(today);
          const isToday = scheduleDateKey === todayDateKey;
          
          if (isToday) {
            // Use current time rounded up to next 15-minute interval
            const currentTime = new Date(today);
            const minutes = currentTime.getMinutes();
            const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
            if (roundedMinutes >= MINUTES_PER_HOUR) {
              currentTime.setHours(currentTime.getHours() + 1, 0, 0, 0);
            } else {
              currentTime.setMinutes(roundedMinutes, 0, 0);
            }
            currentTime.setSeconds(0, 0);
            currentTime.setMilliseconds(0);
            scheduleDate.setTime(currentTime.getTime());
            logger.error('CRITICAL: Final check - scheduled time was midnight, adjusted to current time', {
              taskId: task.id,
              taskTitle: task.title,
              adjustedTime: scheduleDate.toISOString(),
            });
          } else {
            // For future dates, use category start time or default work start time
            const categoryHours = getCategoryHoursForTask(task, scheduleDate, hoursSettings);
            if (categoryHours) {
              // categoryHours.start is already in minutes, not a string
              const startMinutes = typeof categoryHours.start === 'string' 
                ? parseTimeToMinutes(categoryHours.start) 
                : categoryHours.start;
              scheduleDate.setHours(Math.floor(startMinutes / MINUTES_PER_HOUR), startMinutes % MINUTES_PER_HOUR, 0, 0);
            } else {
              // Use default work start time
              const [workStartHour] = DEFAULT_WEEKDAY_WORK_START.split(':').map(Number);
              scheduleDate.setHours(workStartHour, 0, 0, 0);
            }
            logger.error('CRITICAL: Final check - scheduled time was midnight, adjusted to category/default start time', {
              taskId: task.id,
              taskTitle: task.title,
              adjustedTime: scheduleDate.toISOString(),
            });
          }
        }
        break;
        } // end while (scheduleDate <= endDate)
        if (scheduleDate > endDate) {
          logger.warn('No available slot in two-week span', { taskId: task.id, taskTitle: task.title });
          return;
        }
        const taskWithScheduledDate = {
          ...task,
          scheduledDate: scheduleDate.toISOString()
        };
        plan.push({ task: taskWithScheduledDate, scheduledDate: scheduleDate, reason });
        addToDailyHours(scheduleDate, taskHours, taskWithScheduledDate);
        
        // CRITICAL DEBUG: Log when task is added to plan
        if (import.meta.env.DEV) {
          logger.debug('Task added to plan', {
            taskId: task.id,
            taskTitle: task.title,
            isRecurringTask: !!(task.recurrence && task.recurrence.type !== 'none'),
            scheduledDate: scheduleDate.toISOString(),
            scheduledTime: scheduleDate.toLocaleTimeString(),
            planLength: plan.length,
            tasksInPlanSameDayCount: plan.filter(p => {
              if (!p.scheduledDate) return false;
              const pDateKey = getDateKey(p.scheduledDate);
              const scheduleDateKey = getDateKey(scheduleDate);
              return pDateKey === scheduleDateKey;
            }).length,
          });
        }
        
        // Track tasks per day for distribution
        const scheduledDayIndex = finalDaysToAdd;
        const currentCount = tasksPerDayCount.get(scheduledDayIndex) || 0;
        tasksPerDayCount.set(scheduledDayIndex, currentCount + 1);
      }
    });

    // Final pass: enforce prep buffer across plan items, existing daily tasks, and calendar events.
    const planByDate = new Map<string, typeof plan>();
    for (const item of plan) {
      if (!item.scheduledDate) continue;
      const dateKey = getDateKey(item.scheduledDate);
      const list = planByDate.get(dateKey) || [];
      list.push(item);
      planByDate.set(dateKey, list);
    }
    for (const [dateKey, dayItems] of planByDate) {
      if (dayItems.length === 0) continue;
      const targetDate = parseTaskScheduledDate(dayItems[0].scheduledDate);
      targetDate.setHours(0, 0, 0, 0);
      const existingForDay = dailyTasks.get(dateKey) || [];
      const planTaskIds = new Set(dayItems.map((item) => item.task.id));
      const mergedTasks: Task[] = [
        ...existingForDay.filter((t) => !planTaskIds.has(t.id)),
        ...dayItems.map((item) => ({
          ...item.task,
          scheduledDate: item.scheduledDate instanceof Date
            ? item.scheduledDate.toISOString()
            : item.scheduledDate,
        })),
      ];
      const dayCalendarEventsForOverlap = calendarEventsForDay(targetDate);
      const moves = enforcePrepBufferUntilStable(
        targetDate,
        mergedTasks,
        buildAISchedulerSlotOptions({
          calendarEvents: dayCalendarEventsForOverlap,
          ensureAfterCurrentTime: false,
          onlyFixOverlaps: true,
        }),
      );
      for (const move of moves) {
        const planItem = dayItems.find((item) => item.task.id === move.taskId);
        if (planItem) {
          planItem.scheduledDate = move.newTime;
          planItem.task = { ...planItem.task, scheduledDate: move.newTime.toISOString() };
          if (import.meta.env.DEV) {
            logger.debug('Plan prep buffer enforced in final pass', {
              taskId: planItem.task.id,
              taskTitle: planItem.task.title,
              newTime: move.newTime.toLocaleTimeString(),
            });
          }
        }
      }
    }

    return { scheduled: plan, exceedsLimit, daysExceedingLimit };
  };

  const applySchedulePlan = async (plan: SchedulePlan[], manageState: boolean = true): Promise<void> => {
    if (manageState) {
      setIsScheduling(true);
    }
    try {
      // Validate plan before applying
      if (!plan || plan.length === 0) {
        return;
      }
      
      // Apply all scheduled dates
      for (const { task, scheduledDate } of plan) {
        // Validate task and scheduledDate
        if (!task || !task.id) {
          console.warn('Invalid task in schedule plan:', task);
          continue;
        }
        
        if (!scheduledDate || !(scheduledDate instanceof Date) || isNaN(scheduledDate.getTime())) {
          console.warn('Invalid scheduledDate for task:', task.id, scheduledDate);
          continue;
        }
        
        try {
          await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
          logger.debug('Task scheduled successfully', {
            taskId: task.id,
            scheduledDate: getDateString(scheduledDate),
          });
        } catch (taskError) {
          console.error(`❌ Error updating task ${task.id}:`, taskError);
          // Continue with other tasks even if one fails
        }
      }
    } catch (error) {
      console.error('Error in applySchedulePlan:', error);
      throw error;
    } finally {
      if (manageState) {
        setIsScheduling(false);
      }
    }
  };

  const scheduleAllTasks = async (options?: { 
    dateRange?: { startDate: Date; endDate: Date }; 
    forceCategoryHours?: boolean;
    onlyWithoutDueDate?: boolean;
    period?: 'day' | 'twoWeeks';
  }): Promise<ScheduleResult> => {
    logger.debug('scheduleAllTasks called', { 
      hasDateRange: !!options?.dateRange,
      forceCategoryHours: options?.forceCategoryHours,
    });
    setIsScheduling(true);
    try {
      // Filter tasks: only schedule tasks without due dates if requested
      let tasksToSchedule: Task[] | undefined = undefined;
      if (options?.onlyWithoutDueDate) {
        const unscheduledTasks = getUnscheduledTasks();
        tasksToSchedule = unscheduledTasks.filter(task => !task.dueDate);
        logger.debug('Filtered tasks without due dates', {
          totalUnscheduled: unscheduledTasks.length,
          filteredCount: tasksToSchedule.length,
        });
      }
      
      // Validate that we have tasks to schedule
      if (tasksToSchedule && tasksToSchedule.length === 0) {
        logger.debug('No tasks to schedule after filtering');
        return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
      }
      
      // Determine date range: day or two weeks
      // AI Scheduler starts from today (current date) to allow scheduling tasks for the current day
      let dateRange = options?.dateRange;
      if (!dateRange && options?.period) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (options.period === 'day') {
          const end = new Date(today);
          end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
          dateRange = { startDate: today, endDate: end };
        } else {
          // Default scheduling period starting from today
          const end = new Date(today);
          end.setDate(end.getDate() + TWO_WEEK_DAYS_OFFSET); // Default period total (today + offset)
          end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
          dateRange = { startDate: today, endDate: end };
        }
      }
      
      const result = await generateSchedulePlan(
        tasksToSchedule, 
        dateRange, 
        { 
          forceCategoryHours: options?.forceCategoryHours ?? true,
          enforceMinimumHours: true // Always enforce 5-hour minimum before pushing to next day
        }
      );
      
      // Validate result
      if (!result || !Array.isArray(result.scheduled)) {
        console.error('Invalid result from generateSchedulePlan:', result);
        throw new Error('Failed to generate schedule plan');
      }
      
      if (result.scheduled.length > 0) {
        // Don't manage state here since scheduleAllTasks already manages it
        await applySchedulePlan(result.scheduled, false).catch((planError) => {
          // Handle plan application errors separately
          console.error('❌ Error applying schedule plan:', planError);
          // Don't throw - result is still valid even if some tasks failed to update
        });
      }
      return result;
    } catch (error) {
      console.error('❌ ERROR in scheduleAllTasks:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Filter out browser extension errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isExtensionError = errorMessage.includes('message channel') || 
                               errorMessage.includes('listener indicated') ||
                               errorMessage.includes('asynchronous response');
      
      if (!isExtensionError) {
        throw error; // Only throw non-extension errors
      } else {
        console.warn('⚠️ Browser extension error detected (non-critical):', errorMessage);
        // Return empty result instead of throwing for extension errors
        return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
      }
    } finally {
      setIsScheduling(false);
    }
  };

  // Helper: Get tasks scheduled for a specific day (using LOCAL timezone)
  const getScheduledTasksForDay = (date: Date): Task[] => {
    const dateKey = getDateString(date);
    return tasks.filter(task => {
      if (!task.scheduledDate || task.status === 'done') return false;
      const taskDate = getDateString(parseTaskScheduledDate(task.scheduledDate));
      return taskDate === dateKey;
    });
  };

  // Helper: Get tasks scheduled for a week (starting from date)
  const getScheduledTasksForWeek = (startDate: Date): Task[] => {
    // Find the Monday of the week containing startDate
    const weekStart = new Date(startDate);
    weekStart.setHours(0, 0, 0, 0);
    const dayOfWeek = weekStart.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Use constants for Monday calculation: if Sunday (0), go back (DAYS_IN_WEEK - 1) days; otherwise go to Monday
    const daysToMonday = dayOfWeek === 0 ? -(DAYS_IN_WEEK - 1) : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + daysToMonday);
    
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + (KANBAN_TIME.daysInWeek - 1));
    endDate.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
    
    return tasks.filter(task => {
      if (!task.scheduledDate || task.status === 'done') return false;
      const taskDate = parseTaskScheduledDate(task.scheduledDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate >= weekStart && taskDate <= endDate;
    });
  };

  // Helper: Get tasks scheduled for a month
  const getScheduledTasksForMonth = (date: Date): Task[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND);
    
    return tasks.filter(task => {
      if (!task.scheduledDate || task.status === 'done') return false;
      const taskDate = parseTaskScheduledDate(task.scheduledDate);
      return taskDate >= startDate && taskDate <= endDate;
    });
  };

  // Helper: Unschedule tasks (clear their scheduledDate)
  const unscheduleTasks = async (tasksToUnschedule: Task[]): Promise<void> => {
    for (const task of tasksToUnschedule) {
      await updateTask(task.id, { scheduledDate: null });
    }
  };

  /** Reorganize affected days so rescheduled tasks honor the AI prep buffer vs tasks and calendar events. */
  const enforcePrepBufferOnScheduledDays = async (
    scheduledPlans: SchedulePlan[],
    calendarEvents: ConflictCalendarEvent[],
  ): Promise<void> => {
    if (scheduledPlans.length === 0) return;

    const scheduledById = new Map<string, Date>(
      scheduledPlans.map(({ task, scheduledDate }) => [task.id, scheduledDate]),
    );
    const dayDates = new Map<string, Date>();
    for (const { scheduledDate } of scheduledPlans) {
      dayDates.set(getDateKey(scheduledDate), parseTaskScheduledDate(scheduledDate));
    }

    for (const [, date] of dayDates) {
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      const dayCalendarEvents = filterCalendarEventsForDay(calendarEvents, normalizedDate);
      const dayTasks = tasks
        .filter((t) => t.status !== 'done' && isDateInRecurrence(t, normalizedDate))
        .filter((t) => scheduledById.has(t.id) || t.scheduledDate)
        .map((t) => {
          const override = scheduledById.get(t.id);
          return override
            ? { ...t, scheduledDate: override.toISOString() }
            : t;
        });

      let workingDayTasks = [...dayTasks];
      const moves = enforcePrepBufferUntilStable(
        normalizedDate,
        workingDayTasks,
        buildAISchedulerSlotOptions({
          calendarEvents: dayCalendarEvents,
          ensureAfterCurrentTime: false,
          onlyFixOverlaps: true,
        }),
      );

      for (const move of moves) {
        await updateTask(move.taskId, { scheduledDate: move.newTime.toISOString() });
        scheduledById.set(move.taskId, move.newTime);
        workingDayTasks = workingDayTasks.map((t) =>
          t.id === move.taskId ? { ...t, scheduledDate: move.newTime.toISOString() } : t,
        );
      }
    }
  };

  // Reschedule tasks for a specific day
  const rescheduleDay = async (date: Date): Promise<ScheduleResult> => {
    setIsScheduling(true);
    try {
      const dayTasks = getScheduledTasksForDay(date);
      if (dayTasks.length === 0) {
        return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
      }
      
      // Store task IDs and full task objects before unscheduling
      const taskIds = dayTasks.map(t => t.id);
      const tasksToReschedule = dayTasks.map(t => ({ ...t })); // Clone tasks
      
      // Unschedule the tasks first
      await unscheduleTasks(dayTasks);
      
      // Wait a bit for state to sync, then get fresh task data
      await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.aiScheduler));
      
      // Get the tasks again (they're now unscheduled) using the cloned tasks as fallback
      const freshTasks = tasks.filter(t => taskIds.includes(t.id) && !t.scheduledDate && t.status !== 'done');
      const tasksForReschedule = freshTasks.length > 0 ? freshTasks : tasksToReschedule.map(t => ({ ...t, scheduledDate: null }));
      
      // Create date range for the selected day
      // If the selected day is today or in the past, start from tomorrow
      // Otherwise, schedule within the selected day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDay = new Date(date);
      selectedDay.setHours(0, 0, 0, 0);
      
      // Use selected day directly - allow scheduling from today (current date)
      const scheduleStartDate = selectedDay.getTime() < today.getTime()
        ? today // Selected day is in the past, start from today
        : selectedDay; // Selected day is today or in the future, use it
      
      // End date: end of the selected day (or tomorrow if selected day is today/past)
      const scheduleEndDate = new Date(scheduleStartDate);
      scheduleEndDate.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      
      // Generate new schedule for these specific tasks within the selected day
      // Shuffle tasks and enforce minimum hours for rescheduling
      const calendarEvents = await fetchCalendarEvents(scheduleStartDate, scheduleEndDate);
      const result = await generateSchedulePlan(
        tasksForReschedule,
        { startDate: scheduleStartDate, endDate: scheduleEndDate },
        { forceCategoryHours: true, shuffle: true, enforceMinimumHours: true }
      );
      if (result.scheduled.length > 0) {
        // Don't set isScheduling again - we're already in scheduling mode
        for (const { task, scheduledDate } of result.scheduled) {
          await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
        }
        await enforcePrepBufferOnScheduledDays(result.scheduled, calendarEvents);
      }
      return result;
    } catch (error) {
      console.error('Error in rescheduleDay:', error);
      throw error;
    } finally {
      setIsScheduling(false);
    }
  };

  // Reschedule tasks for multiple days (up to 3 days)
  const rescheduleDays = async (dates: Date[]): Promise<ScheduleResult> => {
    if (dates.length === 0) {
      return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
    }

    // If only one day, use the single day reschedule
    if (dates.length === 1) {
      return rescheduleDay(dates[0]);
    }

    setIsScheduling(true);
    try {
      // Sort dates chronologically
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
      
      // Collect tasks from all selected days
      const allDayTasks: Task[] = [];
      const seenTaskIds = new Set<string>();
      
      for (const date of sortedDates) {
        const dayTasks = getScheduledTasksForDay(date);
        for (const task of dayTasks) {
          if (!seenTaskIds.has(task.id)) {
            seenTaskIds.add(task.id);
            allDayTasks.push(task);
          }
        }
      }

      if (allDayTasks.length === 0) {
        return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
      }
      
      // Store task IDs and full task objects before unscheduling
      const taskIds = allDayTasks.map(t => t.id);
      const tasksToReschedule = allDayTasks.map(t => ({ ...t })); // Clone tasks
      
      // Unschedule the tasks first
      await unscheduleTasks(allDayTasks);
      
      // Wait a bit for state to sync, then get fresh task data
      await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.aiScheduler));
      
      // Get the tasks again (they're now unscheduled) using the cloned tasks as fallback
      const freshTasks = tasks.filter(t => taskIds.includes(t.id) && !t.scheduledDate && t.status !== 'done');
      const tasksForReschedule = freshTasks.length > 0 ? freshTasks : tasksToReschedule.map(t => ({ ...t, scheduledDate: null }));
      
      // Use the first selected date as start, last selected date as end
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const firstDate = new Date(sortedDates[0]);
      firstDate.setHours(0, 0, 0, 0);
      
      const lastDate = new Date(sortedDates[sortedDates.length - 1]);
      lastDate.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      
      // If first date is in the past, start from today
      const scheduleStartDate = firstDate.getTime() < today.getTime() ? today : firstDate;
      
      // Ensure end date is at least the last selected date
      const scheduleEndDate = lastDate;
      
      // Generate new schedule for these specific tasks within the selected date range
      // Shuffle tasks and enforce minimum hours for rescheduling
      const calendarEvents = await fetchCalendarEvents(scheduleStartDate, scheduleEndDate);
      const result = await generateSchedulePlan(
        tasksForReschedule,
        { startDate: scheduleStartDate, endDate: scheduleEndDate },
        { forceCategoryHours: true, shuffle: true, enforceMinimumHours: true }
      );
      if (result.scheduled.length > 0) {
        // Don't set isScheduling again - we're already in scheduling mode
        for (const { task, scheduledDate } of result.scheduled) {
          await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
        }
        await enforcePrepBufferOnScheduledDays(result.scheduled, calendarEvents);
      }
      return result;
    } catch (error) {
      console.error('Error in rescheduleDays:', error);
      throw error;
    } finally {
      setIsScheduling(false);
    }
  };

  // Reschedule tasks for a week
  const rescheduleWeek = async (startDate: Date): Promise<ScheduleResult> => {
    setIsScheduling(true);
    try {
      const weekTasks = getScheduledTasksForWeek(startDate);
      if (weekTasks.length === 0) {
        return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
      }
      
      // Store task IDs and full task objects before unscheduling
      const taskIds = weekTasks.map(t => t.id);
      const tasksToReschedule = weekTasks.map(t => ({ ...t })); // Clone tasks
      
      // Unschedule the tasks first
      await unscheduleTasks(weekTasks);
      
      // Wait a bit for state to sync, then get fresh task data
      await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.aiScheduler));
      
      // Get the tasks again (they're now unscheduled) using the cloned tasks as fallback
      const freshTasks = tasks.filter(t => taskIds.includes(t.id) && !t.scheduledDate && t.status !== 'done');
      const tasksForReschedule = freshTasks.length > 0 ? freshTasks : tasksToReschedule.map(t => ({ ...t, scheduledDate: null }));
      
      // Use the selected date as the base for rescheduling
      // For rescheduling, we want to use the selected date directly, not always go to Monday
      // This allows users to reschedule tasks starting from any selected date
      const selectedDate = new Date(startDate);
      selectedDate.setHours(0, 0, 0, 0);
      
      // Determine the actual start date: allow scheduling from today (current date)
      // If the selected date is in the past, start from today; otherwise use selected date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduleStartDate = selectedDate.getTime() < today.getTime() 
        ? today // Selected date is in the past, start from today
        : selectedDate; // Selected date is today or in the future, use it
      
      // Calculate end date: one week from the start date
      const weekEnd = new Date(scheduleStartDate);
      weekEnd.setDate(weekEnd.getDate() + ONE_WEEK_DAYS_OFFSET); // One week total (start date + offset)
      weekEnd.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      
      // Generate new schedule for these specific tasks within the selected week
      // Shuffle tasks and enforce minimum hours for rescheduling
      const calendarEvents = await fetchCalendarEvents(scheduleStartDate, weekEnd);
      const result = await generateSchedulePlan(
        tasksForReschedule,
        { startDate: scheduleStartDate, endDate: weekEnd },
        { forceCategoryHours: true, shuffle: true, enforceMinimumHours: true }
      );
      if (result.scheduled.length > 0) {
        // Don't set isScheduling again - we're already in scheduling mode
        for (const { task, scheduledDate } of result.scheduled) {
          await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
        }
        await enforcePrepBufferOnScheduledDays(result.scheduled, calendarEvents);
      }
      return result;
    } catch (error) {
      console.error('Error in rescheduleWeek:', error);
      throw error;
    } finally {
      setIsScheduling(false);
    }
  };

  // Reschedule tasks for a month
  const rescheduleMonth = async (date: Date): Promise<ScheduleResult> => {
    setIsScheduling(true);
    try {
      const monthTasks = getScheduledTasksForMonth(date);
      if (monthTasks.length === 0) {
        return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
      }
      
      // Store task IDs and full task objects before unscheduling
      const taskIds = monthTasks.map(t => t.id);
      const tasksToReschedule = monthTasks.map(t => ({ ...t })); // Clone tasks
      
      // Unschedule the tasks first
      await unscheduleTasks(monthTasks);
      
      // Wait a bit for state to sync, then get fresh task data
      await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.delays.aiScheduler));
      
      // Get the tasks again (they're now unscheduled) using the cloned tasks as fallback
      const freshTasks = tasks.filter(t => taskIds.includes(t.id) && !t.scheduledDate && t.status !== 'done');
      const tasksForReschedule = freshTasks.length > 0 ? freshTasks : tasksToReschedule.map(t => ({ ...t, scheduledDate: null }));
      
      // Calculate the month range from the selected date (first day to last day of month)
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthStart = new Date(year, month, 1);
      monthStart.setHours(0, 0, 0, 0);
      
      // Determine the actual start date: allow scheduling from today (current date)
      // If month start is in the past, start from today; otherwise use month start
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduleStartDate = monthStart.getTime() < today.getTime() 
        ? today // Month start is in the past, start from today
        : monthStart; // Month start is today or in the future, use it
      
      // Calculate end date: last day of the selected month
      const monthEnd = new Date(year, month + 1, 0, END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      
      // Generate new schedule for these specific tasks within the selected month
      // Shuffle tasks and enforce minimum hours for rescheduling
      const calendarEvents = await fetchCalendarEvents(scheduleStartDate, monthEnd);
      const result = await generateSchedulePlan(
        tasksForReschedule,
        { startDate: scheduleStartDate, endDate: monthEnd },
        { forceCategoryHours: true, shuffle: true, enforceMinimumHours: true }
      );
      if (result.scheduled.length > 0) {
        // Don't set isScheduling again - we're already in scheduling mode
        for (const { task, scheduledDate } of result.scheduled) {
          await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
        }
        await enforcePrepBufferOnScheduledDays(result.scheduled, calendarEvents);
      }
      return result;
    } catch (error) {
      console.error('Error in rescheduleMonth:', error);
      throw error;
    } finally {
      setIsScheduling(false);
    }
  };

  return {
    getUnscheduledTasks,
    generateSchedulePlan,
    applySchedulePlan,
    scheduleAllTasks,
    getScheduledTasksForDay,
    getScheduledTasksForWeek,
    getScheduledTasksForMonth,
    rescheduleDay,
    rescheduleDays,
    rescheduleWeek,
    rescheduleMonth,
    isScheduling,
    unscheduledCount: getUnscheduledTasks().length,
  };
}

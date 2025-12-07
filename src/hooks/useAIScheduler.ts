import { useState } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useAI } from '../contexts/AIContext';
import { isTaskBlocked, calculateDependencyDepth } from '../lib/utils';
import { KANBAN_TIME } from '../lib/kanban-constants';
import { findNextAvailableSlot } from '../lib/time-conflict';
import { getCategoryHoursForTask, parseTimeToMinutes } from '../lib/category-hours-utils';
import { getTaskHours, getTaskMinutes } from '../lib/daily-hours-utils';
import { logger } from '../lib/logger';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import {
  MAX_HOURS_PER_DAY,
  MIN_HOURS_PER_DAY,
  DEFAULT_SCHEDULING_PERIOD_DAYS,
  DEFAULT_WEEK_RESCHEDULE_DAYS,
  TWO_WEEK_DAYS_OFFSET,
  ONE_WEEK_DAYS_OFFSET,
  TIME_ROUNDING_INTERVAL_MINUTES,
  DEFAULT_TIME_SLOTS,
  PRIORITY_TIME_SLOTS,
  DEFAULT_CATEGORY_HOURS,
  PRIORITY_WEIGHTS,
  STATUS_WEIGHTS,
  getCategoryFromTags,
  isWeekend as isWeekendDate,
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
} from '../lib/business-constants';
import type { Task, RecurrenceConfig } from '../types';
import { TIMING_CONSTANTS } from '../lib/timing-constants';

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
  const [isScheduling, setIsScheduling] = useState(false);

  const getUnscheduledTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const filtered = tasks.filter(t => {
      // Exclude done tasks
      if (t.status === 'done') {
        return false;
      }
      
      // Exclude blocked tasks
      if (isTaskBlocked(t, tasks)) {
        return false;
      }
      
      // Check if this is a recurring task
      const isRecurring = t.recurrence && t.recurrence.type !== 'none';
      
      // ALWAYS include recurring tasks that don't have a scheduledDate
      // Recurring tasks need a base scheduledDate to function properly
      if (isRecurring && !t.scheduledDate) {
        console.log('🔄 Including recurring task without scheduledDate:', {
          taskId: t.id,
          title: t.title,
          recurrenceType: t.recurrence.type,
          recurrenceInterval: t.recurrence.interval,
        });
        logger.debug('Including recurring task without scheduledDate', {
          taskId: t.id,
          title: t.title,
          recurrenceType: t.recurrence.type,
        });
        return true;
      }
      
      // Include non-recurring tasks without scheduledDate
      if (!t.scheduledDate && !isRecurring) {
        return true;
      }
      
      // Include recurring tasks that need rescheduling:
      // If scheduled date is today or in the past, it needs to be rescheduled to next occurrence
      if (isRecurring && t.scheduledDate) {
        try {
          const scheduledDate = new Date(t.scheduledDate);
          scheduledDate.setHours(0, 0, 0, 0);
          
          // If scheduled date is today or in the past, it needs to be rescheduled to next occurrence
          // This ensures recurring tasks are properly scheduled for future dates
          if (scheduledDate <= today) {
            console.log('🔄 Including recurring task with past/today scheduledDate:', {
              taskId: t.id,
              title: t.title,
              recurrenceType: t.recurrence.type,
              scheduledDate: t.scheduledDate,
              scheduledDateKey: scheduledDate.toISOString().split('T')[0],
              todayKey: today.toISOString().split('T')[0],
            });
            logger.debug('Including recurring task with past/today scheduledDate', {
              taskId: t.id,
              title: t.title,
              scheduledDate: t.scheduledDate,
            });
            return true;
          }
          
          // If scheduled date is in the future, don't reschedule (already properly scheduled)
          console.log('⏭️ Skipping recurring task with future scheduledDate:', {
            taskId: t.id,
            title: t.title,
            scheduledDate: t.scheduledDate,
            scheduledDateKey: scheduledDate.toISOString().split('T')[0],
            todayKey: today.toISOString().split('T')[0],
          });
          return false;
        } catch (error) {
          // If date parsing fails, include the task to be rescheduled
          console.error('❌ Error parsing scheduledDate for recurring task, including in schedule:', {
            taskId: t.id,
            title: t.title,
            scheduledDate: t.scheduledDate,
            error: error instanceof Error ? error.message : String(error),
          });
          logger.warn('Error parsing scheduledDate for recurring task, including in schedule:', {
            taskId: t.id,
            scheduledDate: t.scheduledDate,
            error,
          });
          return true;
        }
      }
      
      // For non-recurring tasks, only include if they don't have a scheduledDate
      return false;
    });
    
    console.log('📋 getUnscheduledTasks result:', {
      totalTasks: tasks.length,
      unscheduledCount: filtered.length,
      recurringTasksIncluded: filtered.filter(t => t.recurrence && t.recurrence.type !== 'none').length,
      recurringTasks: filtered
        .filter(t => t.recurrence && t.recurrence.type !== 'none')
        .map(t => ({
          id: t.id,
          title: t.title,
          recurrenceType: t.recurrence.type,
          scheduledDate: t.scheduledDate,
        })),
    });
    logger.debug('getUnscheduledTasks result', {
      totalTasks: tasks.length,
      unscheduledCount: filtered.length,
      recurringTasksIncluded: filtered.filter(t => t.recurrence && t.recurrence.type !== 'none').length,
    });
    
    return filtered;
  };

  // Helper: Get date key for tracking (YYYY-MM-DD)
  const getDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Helper: Calculate the first occurrence date for a recurring task
  // This ensures recurring tasks are scheduled to a date that matches their recurrence pattern
  // IMPORTANT: Always returns a date in the future (after fromDate), never today or in the past
  const calculateFirstOccurrenceDate = (task: Task, fromDate: Date): Date | null => {
    if (!task.recurrence || task.recurrence.type === 'none') {
      console.log('⚠️ calculateFirstOccurrenceDate: Task has no recurrence', {
        taskId: task.id,
        title: task.title,
        recurrence: task.recurrence,
      });
      return null;
    }

    const firstDate = new Date(fromDate);
    firstDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log('📅 calculateFirstOccurrenceDate called', {
      taskId: task.id,
      title: task.title,
      recurrenceType: task.recurrence.type,
      recurrenceInterval: task.recurrence.interval,
      fromDate: fromDate.toISOString().split('T')[0],
      today: today.toISOString().split('T')[0],
    });

    switch (task.recurrence.type) {
      case 'daily':
        // For daily, first occurrence is always the next interval day(s) from fromDate
        // If fromDate is today, this ensures we schedule for tomorrow or later
        firstDate.setDate(firstDate.getDate() + task.recurrence.interval);
        // Ensure it's at least tomorrow (AI scheduler starts from tomorrow)
        if (firstDate <= today) {
          firstDate.setDate(today.getDate() + task.recurrence.interval);
        }
        console.log('📅 Daily recurrence calculated', {
          taskId: task.id,
          fromDate: fromDate.toISOString().split('T')[0],
          firstOccurrence: firstDate.toISOString().split('T')[0],
          interval: task.recurrence.interval,
        });
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
          console.log('📅 Weekly recurrence (no daysOfWeek) calculated', {
            taskId: task.id,
            fromDate: fromDate.toISOString().split('T')[0],
            fromDayOfWeek,
            firstOccurrence: firstDate.toISOString().split('T')[0],
            firstOccurrenceDayOfWeek: firstDate.getDay(),
            interval: task.recurrence.interval,
          });
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
        console.log('⚠️ calculateFirstOccurrenceDate: Unknown recurrence type', {
          taskId: task.id,
          recurrenceType: task.recurrence.type,
        });
        return null;
    }

    console.log('✅ calculateFirstOccurrenceDate result', {
      taskId: task.id,
      title: task.title,
      recurrenceType: task.recurrence.type,
      fromDate: fromDate.toISOString().split('T')[0],
      firstOccurrence: firstDate.toISOString().split('T')[0],
      isFuture: firstDate > today,
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
    taskDurationMinutes?: number // Optional: if provided, use this instead of task.estimatedTime
  ): { hours: number; minutes: number; reason: string } | null => {
    // When forceCategoryHours is true, always use category hours regardless of respectHours setting
    if (!forceCategoryHours && !hoursSettings.respectHours) return null;

    const category = getTaskCategory(task);
    if (!category) return null;

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
      if (roundedMinutes >= 60) {
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
        // Return a default time slot based on category
        const defaultHour = DEFAULT_CATEGORY_HOURS[category] || DEFAULT_CATEGORY_HOURS.work;
        const defaultTime = new Date(scheduleDate);
        defaultTime.setHours(defaultHour, 0, 0, 0);
        
        // For today, ensure we don't schedule before current time
        if (isToday && currentTimeRounded && defaultTime < currentTimeRounded) {
          return {
            hours: currentTimeRounded.getHours(),
            minutes: currentTimeRounded.getMinutes(),
            reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled from current time (category hours disabled)`
          };
        }
        
        return {
          hours: defaultHour,
          minutes: 0,
          reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled (category hours disabled, using default)`
        };
      }
      return null;
    }

    const startTime = parseTime(categoryHours.start);
    const endTime = parseTime(categoryHours.end);

    // Calculate total available hours
    const totalMinutes = (endTime.hours * 60 + endTime.minutes) - (startTime.hours * 60 + startTime.minutes);
    const totalHours = totalMinutes / 60;

    // Get existing tasks in the same category for this day
    const sameCategoryTasks = existingTasksForDay.filter(t => getTaskCategory(t) === category);
    
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
    if (sameCategoryTasks.length > 0) {
      // Sort existing tasks by scheduled time
      const sortedCategoryTasks = [...sameCategoryTasks].sort((a, b) => {
        if (!a.scheduledDate || !b.scheduledDate) return 0;
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      });
      
      // Find gaps between existing category tasks
      for (let i = 0; i < sortedCategoryTasks.length; i++) {
        const currentTask = sortedCategoryTasks[i];
        if (!currentTask.scheduledDate) continue;
        
        const currentTaskStart = new Date(currentTask.scheduledDate);
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
          const prevTaskStart = new Date(prevTask.scheduledDate);
          const prevTaskDuration = getTaskMinutes(prevTask); // Use AI estimator for existing tasks
          gapStart = new Date(prevTaskStart);
          gapStart.setMinutes(gapStart.getMinutes() + prevTaskDuration);
        }
        
        // Ensure gap start is not before earliest allowed time
        if (gapStart < earliestAllowedTime) {
          gapStart = new Date(earliestAllowedTime);
        }
        
        // Calculate gap duration in minutes
        const gapDuration = (currentTaskStart.getTime() - gapStart.getTime()) / (1000 * 60);
        // Use provided duration if available, otherwise use AI estimator
        const taskDuration = taskDurationMinutes ?? getTaskMinutes(task);
        
        // If gap is large enough for this task, use it
        if (gapDuration >= taskDuration) {
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
        const lastTaskStart = new Date(lastTask.scheduledDate);
        const lastTaskDuration = getTaskMinutes(lastTask); // Use AI estimator for existing tasks
        const nextAvailableTime = new Date(lastTaskStart);
        nextAvailableTime.setMinutes(nextAvailableTime.getMinutes() + lastTaskDuration);
        
        // For today, ensure we don't schedule before current time
        if (isToday && currentTimeRounded && nextAvailableTime < currentTimeRounded) {
          nextAvailableTime.setTime(currentTimeRounded.getTime());
        }
        
        // Ensure we don't exceed category end time
        const categoryEnd = new Date(scheduleDate);
        categoryEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
        
        if (nextAvailableTime <= categoryEnd) {
          return {
            hours: nextAvailableTime.getHours(),
            minutes: nextAvailableTime.getMinutes(),
            reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled after other ${category} tasks in ${isWeekendDate ? 'weekend' : 'weekday'} hours`
          };
        }
      }
    }
    
    // No existing tasks or no gaps - distribute evenly across the available time window
    // Use more slots for better distribution (5 slots instead of 3)
    const numSlots = 5;
    const slotPosition = timeSlot % numSlots; // 0, 1, 2, 3, or 4
    const offsetHours = (totalHours / numSlots) * slotPosition;

    const finalHours = Math.floor(startTime.hours + offsetHours);
    const finalMinutes = Math.round((startTime.hours + offsetHours - finalHours) * 60 + startTime.minutes);
    
    // Ensure we don't exceed category end time
    const categoryEndMinutes = endTime.hours * 60 + endTime.minutes;
    const finalTotalMinutes = finalHours * 60 + finalMinutes;
    if (finalTotalMinutes >= categoryEndMinutes) {
      // Use category start time if we've exceeded
      return {
        hours: startTime.hours,
        minutes: startTime.minutes,
        reason: `${category.charAt(0).toUpperCase() + category.slice(1)} task scheduled at start of ${isWeekendDate ? 'weekend' : 'weekday'} ${category} hours`
      };
    }

    const dayType = isWeekendDate ? 'weekend' : 'weekday';
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    
    return {
      hours: finalHours,
      minutes: finalMinutes,
      reason: `${categoryName} task scheduled during ${dayType} ${category} hours`
    };
  };

  const generateSchedulePlan = (
    tasksToSchedule?: Task[],
    dateRange?: { startDate: Date; endDate: Date },
    options?: { forceCategoryHours?: boolean; shuffle?: boolean; enforceMinimumHours?: boolean }
  ): ScheduleResult => {
    // Always log this - critical for debugging AI Duration Estimator
    console.log('🚀 generateSchedulePlan called', {
      tasksToScheduleCount: tasksToSchedule?.length || 0,
      dateRange,
      options,
      timestamp: new Date().toISOString(),
    });
    logger.debug('🚀 generateSchedulePlan called', {
      tasksToScheduleCount: tasksToSchedule?.length || 0,
      dateRange,
      options,
    });
    
    const unscheduledTasks = tasksToSchedule || getUnscheduledTasks();
    
    // Always log this - critical for debugging
    console.log('📋 Tasks to schedule:', {
      count: unscheduledTasks.length,
      tasks: unscheduledTasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        hasEstimatedTime: !!t.estimatedTime,
        estimatedTime: t.estimatedTime,
        isRecurring: !!(t.recurrence && t.recurrence.type !== 'none'),
        recurrenceType: t.recurrence?.type,
        hasScheduledDate: !!t.scheduledDate,
        scheduledDate: t.scheduledDate,
      })),
    });
    logger.debug('📋 Tasks to schedule', {
      count: unscheduledTasks.length,
      taskTitles: unscheduledTasks.map(t => t.title),
    });
    
    if (unscheduledTasks.length === 0) {
      return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
    }
    
    // Helper: Shuffle array using Fisher-Yates algorithm
    const shuffleArray = <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

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
    
    tasks.forEach(task => {
      if (task.scheduledDate && task.status !== 'done') {
        // Skip tasks that are being rescheduled (they'll be rescheduled)
        if (tasksBeingRescheduled.has(task.id)) {
          return; // Skip this task, it's being rescheduled
        }
        
        const taskDate = new Date(task.scheduledDate);
        const dateKey = getDateKey(taskDate);
        
        // If we're rescheduling within a date range, clear hours for those days
        // This ensures we start fresh for the rescheduled days
        if (dateRange && taskDate >= dateRange.startDate && taskDate <= dateRange.endDate) {
          // This task is in the reschedule range but not being rescheduled
          // Keep it in the tracking (it's an existing task outside the reschedule)
          // Actually, if it's in the range, we should exclude it too
          return; // Skip tasks in the reschedule range
        }
        
        const taskHours = getTaskHours(task);
        const currentHours = dailyHours.get(dateKey) || 0;
        dailyHours.set(dateKey, currentHours + taskHours);
        
        // Log AI estimator usage for pre-populating daily hours
        console.log('📊 Pre-populating daily hours: Using AI Duration Estimator', {
          taskId: task.id,
          taskTitle: task.title,
          date: dateKey,
          taskHours: taskHours.toFixed(2),
          currentHours: currentHours.toFixed(2),
          newTotalHours: (currentHours + taskHours).toFixed(2),
        });
        
        // Track existing tasks per day
        const tasksForDay = dailyTasks.get(dateKey) || [];
        tasksForDay.push(task);
        dailyTasks.set(dateKey, tasksForDay);
      }
    });

    console.log('🔄 Starting task sorting and scheduling process');
    
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
    
    // Determine start date: use provided dateRange start, or default to beginning of tomorrow
    // AI scheduling should always start from the next day (tomorrow), not today
    const startDate = dateRange ? new Date(dateRange.startDate) : (() => {
      // Default to beginning of tomorrow (00:00:00) to schedule from next day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    })();
    
    // Determine end date: use provided dateRange end, or default to 14th day from tomorrow
    // "From tomorrow up to 14th day" means: tomorrow (day 1) through day 14 = 14 days total
    // So end date is tomorrow + 13 days (the 14th day)
    const endDate = dateRange ? new Date(dateRange.endDate) : (() => {
      const future = new Date(startDate);
      // Add 13 days to get to the 14th day (tomorrow is day 1, so day 14 is 13 days from tomorrow)
      future.setDate(future.getDate() + 13);
      return future;
    })();
    
    // Ensure end date is at end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Use startDate as the base for scheduling (selected date for rescheduling, or tomorrow for new scheduling)
    // This ensures rescheduling uses the selected date properly
    const baseDate = startDate;
    
    // Use configuration constants for daily hours limits
    
    // Helper: Check if adding task would exceed daily limit
    // Allow tasks that would make the day exactly at the limit (for efficient packing)
    const wouldExceedLimit = (date: Date, taskHours: number): boolean => {
      const dateKey = getDateKey(date);
      const currentHours = dailyHours.get(dateKey) || 0;
      // Use > to allow tasks that would make the day exactly at the limit (efficient packing)
      return (currentHours + taskHours) > MAX_HOURS_PER_DAY;
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
    const addToDailyHours = (date: Date, taskHours: number, task: Task): void => {
      const dateKey = getDateKey(date);
      const currentHours = dailyHours.get(dateKey) || 0;
      const newHours = currentHours + taskHours;
      dailyHours.set(dateKey, newHours);
      
      // Also track the task in dailyTasks for time slot calculations
      const dayTasks = dailyTasks.get(dateKey) || [];
      dayTasks.push(task);
      dailyTasks.set(dateKey, dayTasks);
      
      // Check if this day now exceeds the limit (for tracking/reporting)
      // Note: Allow exactly 5 hours for efficient packing
      const totalHours = currentHours + taskHours;
      if (totalHours > MAX_HOURS_PER_DAY) {
        // Check if we already have this day in exceedsLimit
        const existing = daysExceedingLimit.find(d => d.date === dateKey);
        if (!existing) {
          daysExceedingLimit.push({
            date: dateKey,
            hours: totalHours,
            tasks: [...tasksForDay]
          });
        } else {
          // Update existing entry
          existing.hours = totalHours;
          existing.tasks = [...tasksForDay];
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
    
    console.log('📝 Processing tasks for scheduling', {
      totalTasks: sortedTasks.length,
      taskTitles: sortedTasks.map(t => t.title),
    });
    
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
          daysToAdd = Math.min(taskIndex % 3, totalDaysInRange - 1);
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
                             new Date(baseDate.getTime() + newDaysToAdd * 24 * 60 * 60 * 1000) <= endDate)) {
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
          const maxSearchDays = dateRange ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : DEFAULT_SCHEDULING_PERIOD_DAYS;
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
            const maxSearchDays = dateRange ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : DEFAULT_WEEK_RESCHEDULE_DAYS;
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
      const taskHours = getTaskHours(task);
      
      // Log AI estimator usage for debugging
      console.log('📅 generateSchedulePlan: Using AI Duration Estimator', {
        taskId: task.id,
        taskTitle: task.title,
        taskPriority: task.priority,
        hasUserEstimatedTime: task.estimatedTime !== null && task.estimatedTime !== undefined && task.estimatedTime > 0,
        userEstimatedTime: task.estimatedTime,
        aiEstimatedHours: taskHours,
        aiEstimatedMinutes: Math.round(taskHours * 60),
      });
      
      // SPECIAL HANDLING FOR RECURRING TASKS: Calculate first occurrence date FIRST
      // This ensures recurring tasks are scheduled to their correct occurrence date, not just any available day
      const isRecurringTask = task.recurrence && task.recurrence.type !== 'none';
      let recurringFirstOccurrence: Date | null = null;
      let foundDay = false; // Declare foundDay early for recurring task logic
      
      if (isRecurringTask) {
        const fromDate = new Date(startDate);
        fromDate.setHours(0, 0, 0, 0);
        
        console.log('🔄 Processing recurring task - calculating first occurrence', {
          taskId: task.id,
          title: task.title,
          recurrenceType: task.recurrence.type,
          fromDate: fromDate.toISOString().split('T')[0],
        });
        
        recurringFirstOccurrence = calculateFirstOccurrenceDate(task, fromDate);
        
        if (recurringFirstOccurrence) {
          // Check if first occurrence fits within date range and doesn't exceed limits
          const firstOccurrenceKey = getDateKey(recurringFirstOccurrence);
          const isWithinRange = !dateRange || (recurringFirstOccurrence >= startDate && recurringFirstOccurrence <= endDate);
          const wouldExceed = wouldExceedLimit(recurringFirstOccurrence, taskHours);
          
          console.log('🔄 Recurring task first occurrence check', {
            taskId: task.id,
            firstOccurrence: recurringFirstOccurrence.toISOString().split('T')[0],
            isWithinRange,
            wouldExceed,
            taskHours,
          });
          
          // If first occurrence is valid and fits, use it directly
          const conditionMet = isWithinRange && !wouldExceed;
          console.log('🔍 Recurring task condition check', {
            taskId: task.id,
            isWithinRange,
            wouldExceed,
            conditionMet,
            isWithinRangeType: typeof isWithinRange,
            wouldExceedType: typeof wouldExceed,
          });
          
          if (conditionMet) {
            // Calculate daysToAdd based on first occurrence
            const daysDiff = Math.floor((recurringFirstOccurrence.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
            daysToAdd = daysDiff;
            foundDay = true;
            reason = `Recurring task - scheduled to first occurrence (${recurringFirstOccurrence.toISOString().split('T')[0]})`;
            console.log('✅ Recurring task first occurrence is valid, using it', {
              taskId: task.id,
              firstOccurrence: recurringFirstOccurrence.toISOString().split('T')[0],
              daysToAdd,
              foundDay,
            });
          } else {
            console.log('❌ Recurring task first occurrence condition not met', {
              taskId: task.id,
              isWithinRange,
              wouldExceed,
              conditionMet,
            });
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
        
        // Sort by date first (earlier first), then by hours needed (most needed first)
        // This ensures we fill days sequentially to meet the 5-hour requirement before moving to the next day
        daysNeedingHours.sort((a, b) => {
          const dateDiff = a.date.getTime() - b.date.getTime();
          if (dateDiff !== 0) {
            return dateDiff; // Earlier date first - fill days sequentially
          }
          return b.hoursNeeded - a.hoursNeeded; // If same date, most needed first
        });
        
        // Try each day that needs hours, starting with the earliest day (sequential filling)
        for (const dayInfo of daysNeedingHours) {
          // Check if this task can fit in this day (doesn't exceed 5-hour limit)
          if (!wouldExceedLimit(dayInfo.date, taskHours)) {
            const daysDiff = Math.floor((dayInfo.date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
            const maxDays = dateRange ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : DEFAULT_SCHEDULING_PERIOD_DAYS;
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
        // Calculate max days to search based on date range or default to 14 days
        const maxDaysToSearch = dateRange 
          ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
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
          
          // Check if this day has space for the task (within 5-hour limit)
          if (!wouldExceedLimit(testDate, taskHours)) {
            const dateKey = getDateKey(testDate);
            const currentHours = dailyHours.get(dateKey) || 0;
            const availableHours = MAX_HOURS_PER_DAY - currentHours;
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
      // EXCEPT for recurring tasks - they should always be scheduled to their first occurrence
      if (!foundDay) {
        // For recurring tasks, try to use the first occurrence even if it exceeds limits
        // This ensures recurring tasks are always scheduled, even if they need to exceed the daily limit
        if (isRecurringTask && recurringFirstOccurrence) {
          const isWithinRange = !dateRange || (recurringFirstOccurrence >= startDate && recurringFirstOccurrence <= endDate);
          if (isWithinRange) {
            // Use the first occurrence date even if it exceeds limits
            const daysDiff = Math.floor((recurringFirstOccurrence.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
            finalDaysToAdd = daysDiff;
            foundDay = true;
            reason = `Recurring task - scheduled to first occurrence (${recurringFirstOccurrence.toISOString().split('T')[0]}) - may exceed daily limit`;
            console.log('⚠️ Recurring task scheduled despite exceeding limit', {
              taskId: task.id,
              firstOccurrence: recurringFirstOccurrence.toISOString().split('T')[0],
              taskHours,
            });
          } else {
            // First occurrence is outside range - add to exceedsLimit
            console.log('❌ Recurring task first occurrence outside date range', {
              taskId: task.id,
              firstOccurrence: recurringFirstOccurrence.toISOString().split('T')[0],
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
            });
            exceedsLimit.push(task);
          }
        } else {
          exceedsLimit.push(task);
        }
      }
      
      if (foundDay) {
        // Update reason if we had to move to a later day (for non-recurring tasks)
        if (finalDaysToAdd > daysToAdd && !isRecurringTask) {
          if (!reason.includes('Due date') && !reason.includes('moved') && !reason.includes('minimum hours') && !reason.includes('Recurring task')) {
            reason = `${reason} - moved to available slot (5-hour limit)`;
          }
        }
        
        // Calculate time slot intelligently based on task duration and existing schedule
        // For recurring tasks, use the pre-calculated first occurrence date
        // Otherwise, use the calculated date
        let scheduleDate: Date;
        if (isRecurringTask && recurringFirstOccurrence) {
          // Use the pre-calculated first occurrence
          scheduleDate = recurringFirstOccurrence;
          console.log('✅ Using pre-calculated first occurrence for recurring task', {
            taskId: task.id,
            firstOccurrence: recurringFirstOccurrence.toISOString().split('T')[0],
          });
        } else {
          // Non-recurring task: use calculated date
          scheduleDate = new Date(baseDate);
          scheduleDate.setDate(scheduleDate.getDate() + finalDaysToAdd);
        }
        
        // Try to get category-based time slot first
        // For rescheduling with shuffle, distribute tasks more evenly across category hours
        const dateKey = getDateKey(scheduleDate);
        const existingTasksForDay = dailyTasks.get(dateKey) || [];
        const categoryTasksCount = existingTasksForDay.filter(t => {
          const cat = getTaskCategory(t);
          return cat === getTaskCategory(task);
        }).length;
        
        let timeSlot = categoryTasksCount % 5; // Use category-specific slot count (5 slots for better distribution)
        // Use consistent duration calculation for all scheduling operations
        const taskHours = getTaskHours(task);
        const taskDurationMinutes = Math.round(taskHours * 60); // Convert hours to minutes
        const categoryTime = getCategoryTimeSlot(
          task,
          scheduleDate,
          timeSlot,
          options?.forceCategoryHours ?? false,
          existingTasksForDay,
          taskDurationMinutes // Pass consistent duration for gap checking
        );
        
        if (categoryTime) {
          // Use category hours if available and respectHours is enabled
          // But first, use findNextAvailableSlot to find actual open time slot
          const proposedTime = new Date(scheduleDate);
          proposedTime.setHours(categoryTime.hours, categoryTime.minutes, 0, 0);
          
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
          // taskDurationMinutes already calculated above for consistency
          const availableSlot = findNextAvailableSlot(
            task.id,
            proposedTime,
            taskDurationMinutes,
            tasks,
            {
              ensureAfterCurrentTime: isToday,
              categoryHours: categoryHours ? {
                start: categoryHours.start,
                end: categoryHours.end,
              } : undefined,
            }
          );
          
          // If a valid slot was found (not 24:00 or later), use it
          if (availableSlot.getHours() < HOURS_PER_DAY) {
            scheduleDate.setTime(availableSlot.getTime());
            reason = `${categoryTime.reason} - placed in available slot`;
          } else {
            // Fall back to proposed time if no slot found (shouldn't happen, but handle gracefully)
            scheduleDate.setHours(categoryTime.hours, categoryTime.minutes, 0, 0);
            reason = categoryTime.reason;
          }
        } else {
          // Find available time slot by checking existing scheduled tasks for this day
          const dateKey = getDateKey(scheduleDate);
          const existingTasksForDay = dailyTasks.get(dateKey) || [];
          // Use consistent duration calculation: convert hours to minutes
          const taskHours = getTaskHours(task);
          const taskDurationMinutes = Math.round(taskHours * 60); // Convert hours back to minutes
          
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
            if (existingTasksForDay.length === 0) {
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
            const sortedTasks = [...existingTasksForDay].sort((a, b) => {
              const timeA = new Date(a.scheduledDate!).getTime();
              const timeB = new Date(b.scheduledDate!).getTime();
              return timeA - timeB;
            });
            
            // Find ALL available gaps between existing tasks
            const availableGaps: Array<{ start: Date; duration: number; end: Date }> = [];
            
            // Check gap before first task
            if (sortedTasks.length > 0) {
              const firstTask = sortedTasks[0];
              const firstTaskStart = new Date(firstTask.scheduledDate!);
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
              
              const prevTaskStart = new Date(prevTask.scheduledDate!);
              const prevTaskDuration = getTaskMinutes(prevTask); // Use AI estimator for existing tasks
              const prevTaskEnd = new Date(prevTaskStart);
              prevTaskEnd.setMinutes(prevTaskEnd.getMinutes() + prevTaskDuration);
              
              const currentTaskStart = new Date(currentTask.scheduledDate!);
              
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
              const lastTaskStart = new Date(lastTask.scheduledDate!);
              const lastTaskDuration = getTaskMinutes(lastTask); // Use AI estimator for existing tasks
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
              const lastTaskStart = new Date(lastTask.scheduledDate!);
              const lastTaskDuration = getTaskMinutes(lastTask); // Use AI estimator for existing tasks
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
          if (proposedMinute >= 60) {
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
          const finalSlot = findNextAvailableSlot(
            task.id,
            proposedTime,
            taskDurationMinutes,
            tasks,
            {
              ensureAfterCurrentTime: isToday,
              categoryHours: effectiveCategoryHours ? {
                start: effectiveCategoryHours.start,
                end: effectiveCategoryHours.end,
              } : undefined,
            }
          );
          
          // If a valid slot was found (not 24:00 or later), use it
          if (finalSlot.getHours() < HOURS_PER_DAY) {
            scheduleDate.setTime(finalSlot.getTime());
          } else {
            // Fall back to availableSlot if findNextAvailableSlot couldn't find a slot
            // This shouldn't happen often, but handle gracefully
            let selectedMinute = Math.round(availableSlot.minute / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
            let selectedHour = availableSlot.hour;
            if (selectedMinute >= 60) {
              selectedHour += 1;
              selectedMinute = 0;
            }
            // Ensure time doesn't exceed work hours or category hours
            if (effectiveCategoryHours) {
              const maxHour = Math.floor(effectiveCategoryHours.end / 60);
              const maxMinute = effectiveCategoryHours.end % 60;
              if (selectedHour > maxHour || (selectedHour === maxHour && selectedMinute > maxMinute)) {
                selectedHour = Math.floor(effectiveCategoryHours.start / 60);
                selectedMinute = effectiveCategoryHours.start % 60;
              }
            } else if (selectedHour >= workEndHour) {
              selectedHour = workEndHour - 1;
              selectedMinute = 0;
            }
            scheduleDate.setHours(selectedHour, selectedMinute, 0, 0);
          }
          
          // Verify no double booking - check for time overlaps with existing tasks
          const newTaskStart = scheduleDate.getTime();
          const newTaskDuration = taskDurationMinutes;
          const newTaskEnd = newTaskStart + (newTaskDuration * MILLISECONDS_PER_MINUTE);
          
          let hasConflict = false;
          for (const existingTask of existingTasksForDay) {
            if (!existingTask.scheduledDate) continue;
            
            const existingTaskStart = new Date(existingTask.scheduledDate).getTime();
            const existingTaskDuration = getTaskMinutes(existingTask) * MILLISECONDS_PER_MINUTE; // Use AI estimator for existing tasks
            const existingTaskEnd = existingTaskStart + existingTaskDuration;
            
            // Check for overlap: new task overlaps if it starts before existing ends AND ends after existing starts
            if (newTaskStart < existingTaskEnd && newTaskEnd > existingTaskStart) {
              hasConflict = true;
              break;
            }
          }
          
          // If conflict found, find next available slot after all existing tasks
          if (hasConflict) {
            if (existingTasksForDay.length > 0) {
              // Find the latest task end time
              let latestEndTime = 0;
              for (const existingTask of existingTasksForDay) {
                if (!existingTask.scheduledDate) continue;
                const existingTaskStart = new Date(existingTask.scheduledDate).getTime();
                const existingTaskDuration = getTaskMinutes(existingTask) * MILLISECONDS_PER_MINUTE; // Use AI estimator for existing tasks
                const existingTaskEnd = existingTaskStart + existingTaskDuration;
                if (existingTaskEnd > latestEndTime) {
                  latestEndTime = existingTaskEnd;
                }
              }
              
              // Schedule after the latest task
              const conflictFreeDate = new Date(latestEndTime);
              scheduleDate.setHours(conflictFreeDate.getHours(), conflictFreeDate.getMinutes(), 0, 0);
              
              // Round to nearest 15 minutes
              const roundedMinutes = Math.round(scheduleDate.getMinutes() / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
              scheduleDate.setMinutes(roundedMinutes);
              
              // Ensure we don't exceed work hours
              if (scheduleDate.getHours() >= workEndHour) {
                // Move to next day
                scheduleDate.setDate(scheduleDate.getDate() + 1);
                scheduleDate.setHours(workStartHour, 0, 0, 0);
              }
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
        
        // Schedule the task (we've already verified it fits and has no conflicts)
        console.log('✅ Adding task to schedule plan', {
          taskId: task.id,
          title: task.title,
          isRecurring: !!(task.recurrence && task.recurrence.type !== 'none'),
          recurrenceType: task.recurrence?.type,
          scheduledDate: scheduleDate.toISOString(),
          scheduledDateKey: scheduleDate.toISOString().split('T')[0],
          reason,
        });
        plan.push({ task, scheduledDate: scheduleDate, reason });
        addToDailyHours(scheduleDate, taskHours, task);
        
        // Track tasks per day for distribution
        const scheduledDayIndex = finalDaysToAdd;
        const currentCount = tasksPerDayCount.get(scheduledDayIndex) || 0;
        tasksPerDayCount.set(scheduledDayIndex, currentCount + 1);
      }
    });
    
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
      console.log('📝 applySchedulePlan: Applying schedule to tasks', {
        planLength: plan.length,
        tasks: plan.map(p => ({
          taskId: p.task.id,
          title: p.task.title,
          isRecurring: !!(p.task.recurrence && p.task.recurrence.type !== 'none'),
          scheduledDate: p.scheduledDate.toISOString(),
        })),
      });
      
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
          console.log('💾 Updating task with scheduledDate', {
            taskId: task.id,
            title: task.title,
            isRecurring: !!(task.recurrence && task.recurrence.type !== 'none'),
            scheduledDate: scheduledDate.toISOString(),
            scheduledDateKey: scheduledDate.toISOString().split('T')[0],
          });
          await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
          console.log('✅ Task updated successfully', {
            taskId: task.id,
            title: task.title,
            scheduledDate: scheduledDate.toISOString(),
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
    console.log('🎬 scheduleAllTasks CALLED', { options });
    setIsScheduling(true);
    try {
      // Filter tasks: only schedule tasks without due dates if requested
      let tasksToSchedule: Task[] | undefined = undefined;
      if (options?.onlyWithoutDueDate) {
        const unscheduledTasks = getUnscheduledTasks();
        console.log('🔍 Filtering tasks without due dates', {
          totalUnscheduled: unscheduledTasks.length,
          tasks: unscheduledTasks.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate }))
        });
        tasksToSchedule = unscheduledTasks.filter(task => !task.dueDate);
        console.log('✅ Filtered tasks (no due dates)', {
          count: tasksToSchedule.length,
          tasks: tasksToSchedule.map(t => ({ id: t.id, title: t.title }))
        });
      }
      
      // Validate that we have tasks to schedule
      if (tasksToSchedule && tasksToSchedule.length === 0) {
        console.log('⚠️ No tasks to schedule after filtering - returning empty result');
        return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
      }
      
      // Determine date range: day or two weeks
      // AI Scheduler should always start from tomorrow (next day), not today
      let dateRange = options?.dateRange;
      if (!dateRange && options?.period) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        if (options.period === 'day') {
          const end = new Date(tomorrow);
          end.setHours(23, 59, 59, 999);
          dateRange = { startDate: tomorrow, endDate: end };
        } else {
          // Default scheduling period starting from tomorrow
          const end = new Date(tomorrow);
          end.setDate(end.getDate() + TWO_WEEK_DAYS_OFFSET); // Default period total (tomorrow + offset)
          end.setHours(23, 59, 59, 999);
          dateRange = { startDate: tomorrow, endDate: end };
        }
      }
      
      const result = generateSchedulePlan(
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

  // Helper: Get tasks scheduled for a specific day
  const getScheduledTasksForDay = (date: Date): Task[] => {
    const dateKey = date.toISOString().split('T')[0];
    return tasks.filter(task => {
      if (!task.scheduledDate || task.status === 'done') return false;
      const taskDate = new Date(task.scheduledDate).toISOString().split('T')[0];
      return taskDate === dateKey;
    });
  };

  // Helper: Get tasks scheduled for a week (starting from date)
  const getScheduledTasksForWeek = (startDate: Date): Task[] => {
    // Find the Monday of the week containing startDate
    const weekStart = new Date(startDate);
    weekStart.setHours(0, 0, 0, 0);
    const dayOfWeek = weekStart.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days; otherwise go to Monday
    weekStart.setDate(weekStart.getDate() + daysToMonday);
    
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + (KANBAN_TIME.daysInWeek - 1));
    endDate.setHours(23, 59, 59, 999);
    
    return tasks.filter(task => {
      if (!task.scheduledDate || task.status === 'done') return false;
      const taskDate = new Date(task.scheduledDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate >= weekStart && taskDate <= endDate;
    });
  };

  // Helper: Get tasks scheduled for a month
  const getScheduledTasksForMonth = (date: Date): Task[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    
    return tasks.filter(task => {
      if (!task.scheduledDate || task.status === 'done') return false;
      const taskDate = new Date(task.scheduledDate);
      return taskDate >= startDate && taskDate <= endDate;
    });
  };

  // Helper: Unschedule tasks (clear their scheduledDate)
  const unscheduleTasks = async (tasksToUnschedule: Task[]): Promise<void> => {
    for (const task of tasksToUnschedule) {
      await updateTask(task.id, { scheduledDate: null });
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
      
      const scheduleStartDate = selectedDay.getTime() <= today.getTime()
        ? (() => {
            // Selected day is today or in the past, start from tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            return tomorrow;
          })()
        : selectedDay; // Selected day is in the future, use it
      
      // End date: end of the selected day (or tomorrow if selected day is today/past)
      const scheduleEndDate = new Date(scheduleStartDate);
      scheduleEndDate.setHours(23, 59, 59, 999);
      
      // Generate new schedule for these specific tasks within the selected day
      // Shuffle tasks and enforce minimum hours for rescheduling
      const result = generateSchedulePlan(
        tasksForReschedule,
        { startDate: scheduleStartDate, endDate: scheduleEndDate },
        { forceCategoryHours: true, shuffle: true, enforceMinimumHours: true }
      );
      if (result.scheduled.length > 0) {
        // Don't set isScheduling again - we're already in scheduling mode
        for (const { task, scheduledDate } of result.scheduled) {
          await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
        }
      }
      return result;
    } catch (error) {
      console.error('Error in rescheduleDay:', error);
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
      
      // Determine the actual start date: if the selected date is today or in the past, start from tomorrow
      // Otherwise, start from the selected date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduleStartDate = selectedDate.getTime() <= today.getTime() 
        ? (() => {
            // Selected date is today or in the past, start from tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            return tomorrow;
          })()
        : selectedDate; // Selected date is in the future, use it
      
      // Calculate end date: one week from the start date
      const weekEnd = new Date(scheduleStartDate);
      weekEnd.setDate(weekEnd.getDate() + ONE_WEEK_DAYS_OFFSET); // One week total (start date + offset)
      weekEnd.setHours(23, 59, 59, 999);
      
      // Generate new schedule for these specific tasks within the selected week
      // Shuffle tasks and enforce minimum hours for rescheduling
      const result = generateSchedulePlan(
        tasksForReschedule,
        { startDate: scheduleStartDate, endDate: weekEnd },
        { forceCategoryHours: true, shuffle: true, enforceMinimumHours: true }
      );
      if (result.scheduled.length > 0) {
        // Don't set isScheduling again - we're already in scheduling mode
        for (const { task, scheduledDate } of result.scheduled) {
          await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
        }
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
      
      // Determine the actual start date: if month start is today or in the past, start from tomorrow
      // Otherwise, start from the month start date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduleStartDate = monthStart.getTime() <= today.getTime() 
        ? (() => {
            // Month start is today or in the past, start from tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            return tomorrow;
          })()
        : monthStart; // Month start is in the future, use it
      
      // Calculate end date: last day of the selected month
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      // Generate new schedule for these specific tasks within the selected month
      // Shuffle tasks and enforce minimum hours for rescheduling
      const result = generateSchedulePlan(
        tasksForReschedule,
        { startDate: scheduleStartDate, endDate: monthEnd },
        { forceCategoryHours: true, shuffle: true, enforceMinimumHours: true }
      );
      if (result.scheduled.length > 0) {
        // Don't set isScheduling again - we're already in scheduling mode
        for (const { task, scheduledDate } of result.scheduled) {
          await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
        }
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
    rescheduleWeek,
    rescheduleMonth,
    isScheduling,
    unscheduledCount: getUnscheduledTasks().length,
  };
}

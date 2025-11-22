import { useState } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useAI } from '../contexts/AIContext';
import { isTaskBlocked, calculateDependencyDepth } from '../lib/utils';
import type { Task } from '../types';

export interface SchedulePlan {
  task: Task;
  scheduledDate: Date;
  reason?: string;
}

export interface ScheduleResult {
  scheduled: SchedulePlan[];
  exceedsLimit: Task[]; // Tasks that exceed the 5-hour daily limit
  daysExceedingLimit: Array<{ date: string; hours: number; tasks: Task[] }>; // Days that exceed 5 hours
}

export function useAIScheduler() {
  const { tasks, updateTask, hoursSettings } = useTasks();
  const { settings: aiSettings } = useAI();
  const [isScheduling, setIsScheduling] = useState(false);

  const getUnscheduledTasks = () => {
    return tasks.filter(t => !t.scheduledDate && t.status !== 'done' && !isTaskBlocked(t, tasks));
  };

  // Helper: Determine task category from tags
  const getTaskCategory = (task: Task): 'work' | 'personal' | 'projects' | null => {
    if (!task.tags || task.tags.length === 0) return null;
    
    // Check for category tags (case-insensitive)
    const tagLowerCase = task.tags.map(t => t.toLowerCase());
    if (tagLowerCase.includes('work')) return 'work';
    if (tagLowerCase.includes('personal')) return 'personal';
    if (tagLowerCase.includes('projects') || tagLowerCase.includes('project')) return 'projects';
    
    return null;
  };

  // Helper: Check if date is weekend
  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  };

  // Helper: Parse time string (HH:mm) to hours and minutes
  const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  };

  // Helper: Get appropriate time slot based on category and date
  const getCategoryTimeSlot = (
    task: Task, 
    scheduleDate: Date, 
    timeSlot: number
  ): { hours: number; minutes: number; reason: string } | null => {
    if (!hoursSettings.respectHours) return null;

    const category = getTaskCategory(task);
    if (!category) return null;

    const isWeekendDate = isWeekend(scheduleDate);
    const dayHours = isWeekendDate ? hoursSettings.weekendHours : hoursSettings.weekdayHours;
    const categoryHours = dayHours[category];

    // If category hours are disabled for this day type, return null to use default
    if (!categoryHours.enabled) return null;

    const startTime = parseTime(categoryHours.start);
    const endTime = parseTime(categoryHours.end);

    // Calculate total available hours
    const totalMinutes = (endTime.hours * 60 + endTime.minutes) - (startTime.hours * 60 + startTime.minutes);
    const totalHours = totalMinutes / 60;

    // Distribute tasks across the available time window
    // Divide the time window into slots and place task in appropriate slot
    const slotPosition = timeSlot % 3; // 0, 1, or 2
    const offsetHours = (totalHours / 3) * slotPosition;

    const finalHours = Math.floor(startTime.hours + offsetHours);
    const finalMinutes = Math.round((startTime.hours + offsetHours - finalHours) * 60 + startTime.minutes);

    const dayType = isWeekendDate ? 'weekend' : 'weekday';
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    
    return {
      hours: finalHours,
      minutes: finalMinutes,
      reason: `${categoryName} task scheduled during ${dayType} ${category} hours`
    };
  };

  const generateSchedulePlan = (tasksToSchedule?: Task[], dateRange?: { startDate: Date; endDate: Date }): ScheduleResult => {
    const unscheduledTasks = tasksToSchedule || getUnscheduledTasks();
    
    if (unscheduledTasks.length === 0) {
      return { scheduled: [], exceedsLimit: [], daysExceedingLimit: [] };
    }

    // Initialize dailyHours with already scheduled tasks
    const dailyHours: Map<string, number> = new Map();
    const dailyTasks: Map<string, Task[]> = new Map();
    
    // Helper: Get date key for tracking (YYYY-MM-DD)
    const getDateKey = (date: Date): string => {
      return date.toISOString().split('T')[0];
    };
    
    // Helper: Intelligently estimate task duration based on task properties
    // This needs to be defined before we use it to pre-populate dailyHours
    // IMPORTANT: This function NEVER uses default time - it either uses:
    // 1. task.estimatedTime if explicitly set by user
    // 2. Intelligent estimation based on task properties (priority, description, subtasks, keywords, etc.)
    // The 30-minute base is just a starting point that gets adjusted by multiple factors
    const estimateTaskHours = (task: Task): number => {
      // Priority 1: If estimated time is explicitly set by user, use it directly
      if (task.estimatedTime && task.estimatedTime > 0) {
        return task.estimatedTime / 60; // Convert minutes to hours
      }
      
      // Priority 2: Intelligent estimation based on task properties
      // Starting with 30 minutes as base, but this gets heavily modified by factors below
      let estimatedMinutes = 30; // Base estimate (NOT a default - gets adjusted)
      
      // Factor 1: Priority-based time adjustment
      const priorityMultiplier = {
        urgent: 0.7,   // 30 * 0.7 = 21 minutes base
        high: 1.0,     // 30 minutes base
        medium: 1.5,   // 45 minutes base
        low: 2.0       // 60 minutes base
      };
      estimatedMinutes *= priorityMultiplier[task.priority] || 1.0;
      
      // Factor 2: Description length (more detail = potentially longer task)
      if (task.description) {
        const descLength = task.description.length;
        if (descLength > 500) {
          estimatedMinutes *= 1.8; // Detailed descriptions = complex tasks
        } else if (descLength > 200) {
          estimatedMinutes *= 1.4;
        } else if (descLength > 50) {
          estimatedMinutes *= 1.2;
        }
      }
      
      // Factor 3: Subtasks (more subtasks = longer task)
      if (task.subtasks && task.subtasks.length > 0) {
        const subtaskCount = task.subtasks.length;
        // Each subtask adds ~15 minutes
        estimatedMinutes += subtaskCount * 15;
      }
      
      // Factor 4: Title keywords analysis
      const titleLower = task.title.toLowerCase();
      const titleWords = titleLower.split(/\s+/);
      
      // Meeting/Conference/Call keywords = 30-60 minutes
      if (titleWords.some(word => ['meeting', 'call', 'conference', 'standup', 'sync'].includes(word))) {
        estimatedMinutes = Math.max(estimatedMinutes, 30);
        estimatedMinutes = Math.min(estimatedMinutes, 90);
      }
      // Review keywords = 15-45 minutes
      else if (titleWords.some(word => ['review', 'check', 'verify', 'audit'].includes(word))) {
        estimatedMinutes = Math.max(estimatedMinutes, 15);
        estimatedMinutes = Math.min(estimatedMinutes, 45);
      }
      // Plan/Design/Architecture keywords = 60-180 minutes
      else if (titleWords.some(word => ['plan', 'design', 'architecture', 'strategy', 'research'].includes(word))) {
        estimatedMinutes = Math.max(estimatedMinutes, 60);
        estimatedMinutes = Math.min(estimatedMinutes, 180);
      }
      // Write/Draft keywords = 45-120 minutes
      else if (titleWords.some(word => ['write', 'draft', 'create', 'document', 'blog'].includes(word))) {
        estimatedMinutes = Math.max(estimatedMinutes, 45);
        estimatedMinutes = Math.min(estimatedMinutes, 120);
      }
      // Code/Development keywords = 60-240 minutes
      else if (titleWords.some(word => ['code', 'develop', 'implement', 'build', 'fix', 'debug'].includes(word))) {
        estimatedMinutes = Math.max(estimatedMinutes, 60);
        estimatedMinutes = Math.min(estimatedMinutes, 240);
      }
      // Project keywords = 120-300 minutes
      else if (titleWords.some(word => ['project', 'feature', 'module', 'system'].includes(word))) {
        estimatedMinutes = Math.max(estimatedMinutes, 120);
        estimatedMinutes = Math.min(estimatedMinutes, 300);
      }
      
      // Factor 5: Status-based adjustment
      if (task.status === 'in-progress') {
        // If task has been in progress, estimate remaining time
        estimatedMinutes *= 0.6;
      }
      
      // Factor 6: Dependencies (tasks with dependencies might be more complex)
      if (task.dependencies && task.dependencies.length > 0) {
        estimatedMinutes *= 1.2; // Slightly longer due to coordination
      }
      
      // Factor 7: Tags-based adjustment
      if (task.tags && task.tags.length > 0) {
        const tagLower = task.tags.map(t => t.toLowerCase());
        // Quick/Simple tags = shorter
        if (tagLower.some(t => ['quick', 'simple', 'easy', 'small'].includes(t))) {
          estimatedMinutes *= 0.6;
        }
        // Complex/Difficult tags = longer
        else if (tagLower.some(t => ['complex', 'difficult', 'large', 'major'].includes(t))) {
          estimatedMinutes *= 2.0;
        }
      }
      
      // Clamp between 15 minutes (minimum) and 300 minutes (5 hours maximum)
      estimatedMinutes = Math.max(15, Math.min(300, estimatedMinutes));
      
      // Round to nearest 15 minutes for cleaner scheduling
      estimatedMinutes = Math.round(estimatedMinutes / 15) * 15;
      
      return estimatedMinutes / 60; // Convert to hours
    };
    
    // Helper: Get task duration in hours (using intelligent estimation)
    const getTaskHours = (task: Task): number => {
      return estimateTaskHours(task);
    };
    
    // Pre-populate dailyHours with existing scheduled tasks
    tasks.forEach(task => {
      if (task.scheduledDate && task.status !== 'done') {
        const taskDate = new Date(task.scheduledDate);
        const dateKey = getDateKey(taskDate);
        const taskHours = getTaskHours(task);
        const currentHours = dailyHours.get(dateKey) || 0;
        dailyHours.set(dateKey, currentHours + taskHours);
        
        // Track existing tasks per day
        const tasksForDay = dailyTasks.get(dateKey) || [];
        tasksForDay.push(task);
        dailyTasks.set(dateKey, tasksForDay);
      }
    });

    // Sort tasks by priority and status for intelligent scheduling
    const sortedTasks = [...unscheduledTasks].sort((a, b) => {
      // If priority-based scheduling is enabled, prioritize by priority
      if (aiSettings.priorityBasedScheduling) {
        // Priority weights: urgent=4, high=3, medium=2, low=1
        const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityWeight[a.priority] || 1;
        const bPriority = priorityWeight[b.priority] || 1;
        
        // Status weights: on-hold=1, todo=2, in-progress=3
        const statusWeight = { 'on-hold': 1, todo: 2, 'in-progress': 3, done: 0 };
        const aStatus = statusWeight[a.status] || 0;
        const bStatus = statusWeight[b.status] || 0;
        
        // First sort by status (in-progress first)
        if (aStatus !== bStatus) return bStatus - aStatus;
        
        // Then by priority (urgent first, then high, medium, low)
        if (aPriority !== bPriority) return bPriority - aPriority;
      
        // Then by due date (if exists)
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        
        return 0;
      } else {
        // If priority-based scheduling is disabled, sort by due date and creation date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        
        // Fallback to created date
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    
    const plan: SchedulePlan[] = [];
    const exceedsLimit: Task[] = [];
    const daysExceedingLimit: Array<{ date: string; hours: number; tasks: Task[] }> = [];
    
    // Determine start date: use provided dateRange start, or default to current time
    // For rescheduling, we want to schedule within the selected period starting from current time if today
    const startDate = dateRange ? new Date(dateRange.startDate) : (() => {
      // Default to current time (not beginning of day) to schedule forward from now
      return new Date();
    })();
    
    // Determine end date: use provided dateRange end, or default to 14 days ahead
    const endDate = dateRange ? new Date(dateRange.endDate) : (() => {
      const future = new Date(startDate);
      future.setDate(future.getDate() + 14);
      return future;
    })();
    
    // Ensure end date is at end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Use startDate as the base for scheduling (not tomorrow)
    // This ensures rescheduling starts from the beginning of the selected period
    const tomorrow = startDate;
    
    const MAX_HOURS_PER_DAY = 5;
    
    // Helper: Check if adding task would exceed daily limit
    const wouldExceedLimit = (date: Date, taskHours: number): boolean => {
      const dateKey = getDateKey(date);
      const currentHours = dailyHours.get(dateKey) || 0;
      // Use >= to strictly enforce the 5-hour limit (no going over)
      return (currentHours + taskHours) >= MAX_HOURS_PER_DAY;
    };
    
    // Helper: Add task hours to daily tracking
    const addToDailyHours = (date: Date, taskHours: number, task: Task): void => {
      const dateKey = getDateKey(date);
      const currentHours = dailyHours.get(dateKey) || 0;
      dailyHours.set(dateKey, currentHours + taskHours);
      
      // Track tasks per day
      const tasksForDay = dailyTasks.get(dateKey) || [];
      tasksForDay.push(task);
      dailyTasks.set(dateKey, tasksForDay);
      
      // Check if this day now exceeds or equals the limit (for tracking/reporting)
      const totalHours = currentHours + taskHours;
      if (totalHours >= MAX_HOURS_PER_DAY) {
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
    
    let tasksScheduledToday = 0;
    const maxTasksPerDay = 3;
    
    // Helper: Find next available day of preferred type (weekday/weekend)
    const findNextPreferredDay = (startDate: Date, preferWeekend: boolean, maxDaysToSearch: number = 14): number => {
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
    
    sortedTasks.forEach((task) => {
      // Determine scheduling based on priority and status (if priority-based scheduling is enabled)
      // When rescheduling within a date range, prefer earlier dates and only push forward if necessary
      let daysToAdd = 0;
      let reason = '';
      
      if (aiSettings.priorityBasedScheduling) {
        // Priority-based scheduling logic
        // For rescheduling, start from the beginning of the date range
        if (task.status === 'in-progress') {
          daysToAdd = 0;
          reason = 'In-progress - scheduled ASAP';
        } else if (task.priority === 'urgent') {
          daysToAdd = 0;
          reason = 'Urgent priority - scheduled first';
        } else if (task.priority === 'high') {
          daysToAdd = tasksScheduledToday >= maxTasksPerDay ? 1 : 0;
          reason = daysToAdd === 0 ? 'High priority - scheduled soon' : 'High priority - next available slot';
        } else if (task.priority === 'medium') {
          daysToAdd = Math.floor(tasksScheduledToday / 2) + 1;
          reason = 'Medium priority - balanced schedule';
        } else {
          daysToAdd = Math.floor(tasksScheduledToday / 2) + 2;
          reason = 'Low priority - scheduled for later';
        }
      } else {
        // Simple sequential scheduling without priority consideration
        // For rescheduling, distribute tasks evenly across the date range
        daysToAdd = Math.floor(tasksScheduledToday / maxTasksPerDay);
        reason = 'Scheduled in next available slot';
      }
      
      // Check if task has a due date and adjust if needed
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const suggestedDate = new Date(tomorrow);
        suggestedDate.setDate(suggestedDate.getDate() + daysToAdd);
        
        // If suggested date is after due date, schedule closer to due date
        // But respect the date range constraint
        if (suggestedDate > dueDate) {
          const daysDiff = Math.max(0, Math.floor((dueDate.getTime() - tomorrow.getTime()) / (1000 * 60 * 60 * 24)));
          const newDaysToAdd = Math.max(0, daysDiff);
          
          // Only adjust if the new date is within the allowed range
          if (!dateRange || (new Date(tomorrow.getTime() + newDaysToAdd * 24 * 60 * 60 * 1000) >= startDate && 
                             new Date(tomorrow.getTime() + newDaysToAdd * 24 * 60 * 60 * 1000) <= endDate)) {
            daysToAdd = newDaysToAdd;
            reason = 'Due date approaching - prioritized';
          }
        }
      }
      
      // Apply category-based date preference if respectHours is enabled
      if (hoursSettings.respectHours) {
        const category = getTaskCategory(task);
        if (category) {
          const baseDate = new Date(tomorrow);
          baseDate.setDate(baseDate.getDate() + daysToAdd);
          
          // Check if category hours are enabled for the current day type
          const isCurrentWeekend = isWeekend(baseDate);
          const dayHours = isCurrentWeekend ? hoursSettings.weekendHours : hoursSettings.weekdayHours;
          const categoryHours = dayHours[category];
          
          // If category hours are disabled for the current day type, try to find a preferred day
          if (!categoryHours.enabled) {
            const preferWeekend = category === 'personal'; // Personal tasks prefer weekends
            const preferredDaysToAdd = findNextPreferredDay(tomorrow, preferWeekend, 7);
            
            // Only switch days if we found a preferred day and it's not too far out
            if (preferredDaysToAdd < daysToAdd + 7) {
              daysToAdd = preferredDaysToAdd;
              const dayType = preferWeekend ? 'weekend' : 'weekday';
              if (!reason.includes('Due date')) {
                reason = `${category.charAt(0).toUpperCase() + category.slice(1)} task - scheduled for ${dayType}`;
              }
            }
          }
        }
      }
      
      // Get task hours first
      const taskHours = getTaskHours(task);
      
      // Find the next available day that has space for this task (within 5-hour limit)
      let foundDay = false;
      let finalDaysToAdd = daysToAdd;
      // Calculate max days to search based on date range or default to 14 days
      const maxDaysToSearch = dateRange 
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : 14;
      let daysSearched = 0;
      
      // Keep searching for a day with enough space within the date range
      while (daysSearched < maxDaysToSearch && !foundDay) {
        const testDate = new Date(tomorrow);
        testDate.setDate(testDate.getDate() + finalDaysToAdd);
        
        // Check if testDate is within the allowed date range
        if (dateRange && (testDate < startDate || testDate > endDate)) {
          // Date is outside the allowed range, try next day
          finalDaysToAdd++;
          daysSearched++;
          continue;
        }
        
        // Check if this day has space for the task (within 5-hour limit)
        if (!wouldExceedLimit(testDate, taskHours)) {
          // Found a day with space - use it
          foundDay = true;
        } else {
          // This day is full, try the next day (but only if within date range)
          finalDaysToAdd++;
          daysSearched++;
        }
      }
      
      // If no available day found within search window, add to exceedsLimit and skip
      if (!foundDay) {
        exceedsLimit.push(task);
      } else {
        // Update reason if we had to move to a later day
        if (finalDaysToAdd > (tasksScheduledToday >= maxTasksPerDay ? 1 : 0)) {
          if (!reason.includes('Due date') && !reason.includes('moved')) {
            reason = `${reason} - moved to available slot (5-hour limit)`;
          }
        }
        
        // Calculate time slot intelligently based on task duration and existing schedule
        const scheduleDate = new Date(tomorrow);
        scheduleDate.setDate(scheduleDate.getDate() + finalDaysToAdd);
        
        // Try to get category-based time slot first
        let timeSlot = tasksScheduledToday % maxTasksPerDay;
        const categoryTime = getCategoryTimeSlot(task, scheduleDate, timeSlot);
        
        if (categoryTime) {
          // Use category hours if available and respectHours is enabled
          scheduleDate.setHours(categoryTime.hours, categoryTime.minutes, 0, 0);
          reason = categoryTime.reason;
        } else {
          // Find available time slot by checking existing scheduled tasks for this day
          const dateKey = getDateKey(scheduleDate);
          const existingTasksForDay = dailyTasks.get(dateKey) || [];
          const taskDurationMinutes = task.estimatedTime || 30;
          
          // Default work hours: 9 AM to 5 PM
          const workStartHour = 9;
          const workEndHour = 17;
          
          // Helper: Find available time slot
          const findAvailableTimeSlot = (): { hour: number; minute: number } => {
            // Determine the earliest time we can schedule (current time if today, otherwise work start)
            const today = new Date();
            const scheduleDateKey = getDateKey(scheduleDate);
            const todayDateKey = getDateKey(today);
            const isToday = scheduleDateKey === todayDateKey;
            
            // If scheduling for today, start from current time (rounded up to next 15 minutes)
            // Otherwise, start from work start hour
            let earliestTime: Date;
            if (isToday) {
              earliestTime = new Date(today);
              // Round up to next 15-minute interval
              const minutes = earliestTime.getMinutes();
              const roundedMinutes = Math.ceil(minutes / 15) * 15;
              if (roundedMinutes >= 60) {
                earliestTime.setHours(earliestTime.getHours() + 1, 0, 0, 0);
              } else {
                earliestTime.setMinutes(roundedMinutes, 0, 0);
              }
              // Don't schedule before work hours
              if (earliestTime.getHours() < workStartHour) {
                earliestTime.setHours(workStartHour, 0, 0, 0);
              }
            } else {
              earliestTime = new Date(scheduleDate);
              earliestTime.setHours(workStartHour, 0, 0, 0);
            }
            
            // If no existing tasks, use priority-based initial time (but not before earliestTime)
            if (existingTasksForDay.length === 0) {
              const priorityTime = (() => {
                if (task.status === 'in-progress' || task.priority === 'urgent') {
                  return { hour: workStartHour, minute: 0 };
                } else if (task.priority === 'high') {
                  return { hour: workStartHour, minute: 0 };
                } else if (task.priority === 'medium') {
                  return { hour: 11, minute: 0 }; // Mid-day
                } else {
                  return { hour: 14, minute: 0 }; // Afternoon
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
            
            // Find gaps between existing tasks
            for (let i = 0; i < sortedTasks.length; i++) {
              const currentTask = sortedTasks[i];
              const currentTaskStart = new Date(currentTask.scheduledDate!);
              const currentTaskDuration = currentTask.estimatedTime || 30;
              const currentTaskEnd = new Date(currentTaskStart);
              currentTaskEnd.setMinutes(currentTaskEnd.getMinutes() + currentTaskDuration);
              
              // Check if there's a gap before this task
              let gapStart: Date;
              if (i === 0) {
                // First task - check gap from earliest time (current time if today, otherwise work start)
                gapStart = new Date(earliestTime);
              } else {
                // Gap from previous task end
                const prevTask = sortedTasks[i - 1];
                const prevTaskStart = new Date(prevTask.scheduledDate!);
                const prevTaskDuration = prevTask.estimatedTime || 30;
                gapStart = new Date(prevTaskStart);
                gapStart.setMinutes(gapStart.getMinutes() + prevTaskDuration);
              }
              
              // Ensure gap start is not before earliest time (current time if today)
              if (gapStart < earliestTime) {
                gapStart = new Date(earliestTime);
              }
              
              // Calculate gap duration in minutes
              const gapDuration = (currentTaskStart.getTime() - gapStart.getTime()) / (1000 * 60);
              
              // If gap is large enough for this task, use it
              if (gapDuration >= taskDurationMinutes) {
                // Priority-based positioning within gap
                if (task.status === 'in-progress' || task.priority === 'urgent') {
                  // Urgent: start as early as possible in gap
                  return { 
                    hour: gapStart.getHours(), 
                    minute: gapStart.getMinutes() 
                  };
                } else if (task.priority === 'high') {
                  // High: start early in gap
                  return { 
                    hour: gapStart.getHours(), 
                    minute: gapStart.getMinutes() 
                  };
                } else {
                  // Medium/Low: can start later in gap
                  const gapCenter = new Date(gapStart);
                  gapCenter.setMinutes(gapCenter.getMinutes() + Math.floor(gapDuration / 2));
                  return { 
                    hour: gapCenter.getHours(), 
                    minute: gapCenter.getMinutes() 
                  };
                }
              }
            }
            
            // No gap found - place after last task
            const lastTask = sortedTasks[sortedTasks.length - 1];
            const lastTaskStart = new Date(lastTask.scheduledDate!);
            const lastTaskDuration = lastTask.estimatedTime || 30;
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
          };
          
          const availableSlot = findAvailableTimeSlot();
          
          // Round minutes to nearest 15-minute interval
          let selectedMinute = Math.round(availableSlot.minute / 15) * 15;
          let selectedHour = availableSlot.hour;
          if (selectedMinute >= 60) {
            selectedHour += 1;
            selectedMinute = 0;
          }
          
          // Ensure time doesn't exceed work hours
          if (selectedHour >= workEndHour) {
            selectedHour = workEndHour - 1;
            selectedMinute = 0;
          }
          
          scheduleDate.setHours(selectedHour, selectedMinute, 0, 0);
          
          // Verify no double booking - check for time overlaps with existing tasks
          const newTaskStart = scheduleDate.getTime();
          const newTaskDuration = taskDurationMinutes;
          const newTaskEnd = newTaskStart + (newTaskDuration * 60 * 1000);
          
          let hasConflict = false;
          for (const existingTask of existingTasksForDay) {
            if (!existingTask.scheduledDate) continue;
            
            const existingTaskStart = new Date(existingTask.scheduledDate).getTime();
            const existingTaskDuration = (existingTask.estimatedTime || 30) * 60 * 1000;
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
                const existingTaskDuration = (existingTask.estimatedTime || 30) * 60 * 1000;
                const existingTaskEnd = existingTaskStart + existingTaskDuration;
                if (existingTaskEnd > latestEndTime) {
                  latestEndTime = existingTaskEnd;
                }
              }
              
              // Schedule after the latest task
              const conflictFreeDate = new Date(latestEndTime);
              scheduleDate.setHours(conflictFreeDate.getHours(), conflictFreeDate.getMinutes(), 0, 0);
              
              // Round to nearest 15 minutes
              const roundedMinutes = Math.round(scheduleDate.getMinutes() / 15) * 15;
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
        plan.push({ task, scheduledDate: scheduleDate, reason });
        addToDailyHours(scheduleDate, taskHours, task);
        tasksScheduledToday++;
      }
    });
    
    return { scheduled: plan, exceedsLimit, daysExceedingLimit };
  };

  const applySchedulePlan = async (plan: SchedulePlan[]): Promise<void> => {
    setIsScheduling(true);
    try {
      // Apply all scheduled dates
      for (const { task, scheduledDate } of plan) {
        await updateTask(task.id, { scheduledDate: scheduledDate.toISOString() });
      }
    } finally {
      setIsScheduling(false);
    }
  };

  const scheduleAllTasks = async (): Promise<ScheduleResult> => {
    const result = generateSchedulePlan();
    if (result.scheduled.length > 0) {
      await applySchedulePlan(result.scheduled);
    }
    return result;
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
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // 7 days including start
    
    return tasks.filter(task => {
      if (!task.scheduledDate || task.status === 'done') return false;
      const taskDate = new Date(task.scheduledDate);
      return taskDate >= startDate && taskDate <= endDate;
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
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get the tasks again (they're now unscheduled) using the cloned tasks as fallback
      const freshTasks = tasks.filter(t => taskIds.includes(t.id) && !t.scheduledDate && t.status !== 'done');
      const tasksForReschedule = freshTasks.length > 0 ? freshTasks : tasksToReschedule.map(t => ({ ...t, scheduledDate: null }));
      
      // Create date range for the selected day (start and end of the same day)
      // Use the selected date, not tomorrow - allows rescheduling today's tasks
      const today = new Date();
      const todayDateKey = today.toISOString().split('T')[0];
      const selectedDateKey = date.toISOString().split('T')[0];
      
      // If rescheduling for today, start from current time, otherwise start from beginning of day
      const startOfDay = new Date(date);
      if (selectedDateKey === todayDateKey) {
        // Rescheduling for today - use current time as start
        startOfDay.setTime(today.getTime());
      } else {
        // Rescheduling for future day - start from beginning of day
        startOfDay.setHours(0, 0, 0, 0);
      }
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Generate new schedule for these specific tasks, constrained to the selected day
      const result = generateSchedulePlan(tasksForReschedule, { startDate: startOfDay, endDate: endOfDay });
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
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get the tasks again (they're now unscheduled) using the cloned tasks as fallback
      const freshTasks = tasks.filter(t => taskIds.includes(t.id) && !t.scheduledDate && t.status !== 'done');
      const tasksForReschedule = freshTasks.length > 0 ? freshTasks : tasksToReschedule.map(t => ({ ...t, scheduledDate: null }));
      
      // Create date range for the selected week (Monday to Sunday)
      const today = new Date();
      const todayDateKey = today.toISOString().split('T')[0];
      const weekStartDateKey = startDate.toISOString().split('T')[0];
      
      const weekStart = new Date(startDate);
      // If rescheduling for current week (today is within this week), start from current time
      if (weekStartDateKey === todayDateKey || (weekStart <= today && today <= new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000))) {
        // Current week - use current time as start
        weekStart.setTime(today.getTime());
      } else {
        // Future week - start from beginning of week
        weekStart.setHours(0, 0, 0, 0);
      }
      
      const weekEnd = new Date(startDate);
      weekEnd.setDate(weekEnd.getDate() + 6); // 7 days including start
      weekEnd.setHours(23, 59, 59, 999);
      
      // Generate new schedule for these specific tasks, constrained to the selected week
      const result = generateSchedulePlan(tasksForReschedule, { startDate: weekStart, endDate: weekEnd });
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
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get the tasks again (they're now unscheduled) using the cloned tasks as fallback
      const freshTasks = tasks.filter(t => taskIds.includes(t.id) && !t.scheduledDate && t.status !== 'done');
      const tasksForReschedule = freshTasks.length > 0 ? freshTasks : tasksToReschedule.map(t => ({ ...t, scheduledDate: null }));
      
      // Create date range for the selected month (first day to last day of month)
      const today = new Date();
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      
      // If rescheduling for current month (today is within this month), start from current time
      const isCurrentMonth = today.getFullYear() === date.getFullYear() && today.getMonth() === date.getMonth();
      if (isCurrentMonth) {
        // Current month - use current time as start
        monthStart.setTime(today.getTime());
      } else {
        // Future month - start from beginning of month
        monthStart.setHours(0, 0, 0, 0);
      }
      
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      // Generate new schedule for these specific tasks, constrained to the selected month
      const result = generateSchedulePlan(tasksForReschedule, { startDate: monthStart, endDate: monthEnd });
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

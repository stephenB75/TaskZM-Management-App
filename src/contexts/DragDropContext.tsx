import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DndContext, DragStartEvent, DragEndEvent, DragOverEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useTasks } from './TaskContext';
import { DraggableTaskCard } from '../components/DraggableTaskCard';
import { isTaskBlocked, getIncompleteDependencies, cn } from '../lib/utils';
import { checkTimeConflict, findNextAvailableSlot, formatTime } from '../lib/time-conflict';
import { checkDailyLimit, getDailyHoursWarningLevel, MAX_HOURS_PER_DAY } from '../lib/daily-hours-utils';
import { getCategoryHoursForTask } from '../lib/category-hours-utils';
import { TASK_CALCULATION_CONSTANTS } from '../lib/task-calculation-constants';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import type { Task } from '../types';

interface DragDropContextType {
  activeId: string | null;
}

const DragDropContext = createContext<DragDropContextType | undefined>(undefined);

export function useDragDrop() {
  const context = useContext(DragDropContext);
  if (context === undefined) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return context;
}

interface DragDropProviderProps {
  children: ReactNode;
}

export function DragDropProvider({ children }: DragDropProviderProps) {
  const { tasks, updateTask, folders, hoursSettings } = useTasks();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingTaskUpdate, setPendingTaskUpdate] = useState<{
    taskId: string;
    requestedTime: Date;
    alternativeTime: Date;
  } | null>(null);

  // Initialize sensors once - useSensors hook is stable and won't cause re-renders
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: TASK_CALCULATION_CONSTANTS.dragDrop.activationDistance,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    setActiveId(taskId);
    document.body.classList.add('dragging');
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Store drop position for time calculation
    // This will be used in handleDragEnd to calculate time slot
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    document.body.classList.remove('dragging');

    if (!over) {
      return;
    }

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      return;
    }

    // Check if task is blocked by incomplete dependencies
    if (isTaskBlocked(task, tasks)) {
      const incompleteDeps = getIncompleteDependencies(task, tasks);
      toast.error('Cannot schedule blocked task', {
        description: `This task depends on ${incompleteDeps.length} incomplete task${incompleteDeps.length > 1 ? 's' : ''}. Complete them first.`,
      });
      return;
    }

      // Check if dropped on Today Agenda
      if (over.id === 'today-agenda') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();
        const isToday = today.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        
        // Get category hours if applicable
        const categoryHours = getCategoryHoursForTask(task, today, hoursSettings);
        const taskDuration = task.estimatedTime || 30; // Default to 30 minutes if not specified
        
        // For today, always start from current time (rounded up to next 15-minute slot)
        // This ensures we never schedule tasks in the past
        const getCurrentTimeRounded = (): Date => {
          const currentTime = new Date(now);
          const currentMinutes = currentTime.getMinutes();
          const roundedMinutes = Math.ceil(currentMinutes / 15) * 15;
          if (roundedMinutes >= 60) {
            currentTime.setHours(currentTime.getHours() + 1);
            currentTime.setMinutes(0);
          } else {
            currentTime.setMinutes(roundedMinutes);
          }
          currentTime.setSeconds(0);
          currentTime.setMilliseconds(0);
          return currentTime;
        };
        
        // Calculate time from drop position (if available)
        // Get the droppable element (the timeline container)
        const droppableElement = document.querySelector('[data-droppable-id="today-agenda"]');
        let requestedTime: Date | null = null;
      
      // Try to get drop coordinates from event
      if (event.over && 'rect' in event.over && droppableElement) {
        const overRect = (event.over as any).rect;
        const droppableRect = droppableElement.getBoundingClientRect();
        
        if (droppableRect && overRect) {
          // Get the center Y of the drop area
          const dropY = overRect.top + (overRect.height / 2);
          const relativeY = dropY - droppableRect.top;
          
          // Get scroll position to account for scrolled content
          const scrollViewport = droppableElement.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
          const scrollTop = scrollViewport?.scrollTop || 0;
          const adjustedY = relativeY + scrollTop;
          
          // Estimate time based on position
          // Timeline padding: 27.6px on mobile, 16px on desktop
          const paddingTop = window.innerWidth < 1024 ? 27.6 : 16;
          const contentY = Math.max(0, adjustedY - paddingTop);
          
          // Get existing tasks to calculate more accurate time from position
          const existingTasksForDate = tasks.filter((t) => {
            if (t.id === taskId || t.status === 'done') return false;
            if (!t.scheduledDate) return false;
            const taskDate = new Date(t.scheduledDate);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === today.getTime();
          });
          
          // Try to find which task the drop position corresponds to
          let dropTime: Date | null = null;
          
          if (existingTasksForDate.length > 0) {
            // Calculate accumulated heights to find which task/time slot we're in
            const sortedTasks = existingTasksForDate
              .map((t) => ({
                task: t,
                start: new Date(t.scheduledDate!).getTime(),
                end: new Date(t.scheduledDate!).getTime() + ((t.estimatedTime || 30) * 60 * 1000),
              }))
              .sort((a, b) => a.start - b.start);
            
            // Calculate task heights using the same logic as getTaskHeight in TodayAgendaView
            // This provides more accurate positioning
            const calculateTaskHeight = (task: Task): number => {
              const minutes = task.estimatedTime || 30;
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
              
              // Simplified version of getTaskHeight logic
              if (minutes < 45) {
                const baseHeight = isMobile ? 72 : 60;
                const scalingFactor = 0.8;
                return Math.max(baseHeight, baseHeight + (minutes - 15) * scalingFactor);
              } else if (minutes >= 60) {
                const baseHeight = 140;
                const scalingFactor = 2.0;
                return baseHeight + (minutes - 60) * scalingFactor;
              } else {
                // 45-59 minutes
                return Math.max(80, minutes * 1.5);
              }
            };
            
            let accumulatedHeight = 0;
            const gapBetweenTasks = 12; // space-y-3 = 12px
            
            for (const taskInfo of sortedTasks) {
              const taskHeight = calculateTaskHeight(taskInfo.task);
              
              if (contentY >= accumulatedHeight && contentY < accumulatedHeight + taskHeight) {
                // Drop is within this task - place after it
                dropTime = new Date(taskInfo.end);
                break;
              } else if (contentY < accumulatedHeight && accumulatedHeight > 0) {
                // Drop is before this task - check if there's space before it
                const prevTask = sortedTasks[sortedTasks.indexOf(taskInfo) - 1];
                if (prevTask) {
                  const gapStart = accumulatedHeight - gapBetweenTasks;
                  if (contentY >= gapStart) {
                    // Drop is in the gap - use time between tasks
                    const timeDiff = taskInfo.start - prevTask.end;
                    const positionInGap = (contentY - gapStart) / gapBetweenTasks;
                    dropTime = new Date(prevTask.end + (timeDiff * positionInGap));
                  } else {
                    // Drop is before all tasks - use earliest time
                    dropTime = new Date(taskInfo.start);
                    dropTime.setMinutes(0, 0, 0);
                  }
                } else {
                  // First task - use time before it
                  dropTime = new Date(taskInfo.start);
                  dropTime.setMinutes(0, 0, 0);
                }
                break;
              }
              
              accumulatedHeight += taskHeight + gapBetweenTasks;
            }
            
            // If drop is after all tasks, place after the last one
            if (!dropTime && sortedTasks.length > 0) {
              const lastTask = sortedTasks[sortedTasks.length - 1];
              dropTime = new Date(lastTask.end);
            }
          }
          
          // If we couldn't determine from existing tasks, calculate time from pixel position
          // Use a more accurate calculation based on timeline structure
          if (!dropTime) {
            // For today, always start calculation from current time (not category start)
            // This ensures we respect the current time of day
            const currentTimeRounded = getCurrentTimeRounded();
            const currentTotalMinutes = currentTimeRounded.getHours() * 60 + currentTimeRounded.getMinutes();
            
            // Calculate time based on pixel position in timeline
            // Start from current time, not category start
            const pixelsPerMinute = 1.5; // More accurate estimate
            const minutesFromCurrent = Math.max(0, contentY / pixelsPerMinute);
            
            const totalMinutes = currentTotalMinutes + minutesFromCurrent;
            let hours = Math.floor(totalMinutes / 60);
            let minutes = totalMinutes % 60;
            
            // Round to nearest 15-minute slot
            minutes = Math.round(minutes / 15) * 15;
            if (minutes >= 60) {
              hours += 1;
              minutes = 0;
            }
            
            // Clamp to category hours if available
            if (categoryHours) {
              const totalMinutesInDay = hours * 60 + minutes;
              const categoryEndMinutes = categoryHours.end;
              
              // Ensure we're not before category start (but also not before current time)
              const effectiveStart = Math.max(categoryHours.start, currentTotalMinutes);
              
              if (totalMinutesInDay < effectiveStart) {
                // Before effective start - move to effective start
                hours = Math.floor(effectiveStart / 60);
                minutes = effectiveStart % 60;
                // Round up to next 15-minute slot
                minutes = Math.ceil(minutes / 15) * 15;
                if (minutes >= 60) {
                  hours += 1;
                  minutes = 0;
                }
              } else if (totalMinutesInDay + taskDuration > categoryEndMinutes) {
                // Would exceed category end - clamp to fit within category hours
                const maxStartMinutes = categoryEndMinutes - taskDuration;
                if (maxStartMinutes >= effectiveStart) {
                  hours = Math.floor(maxStartMinutes / 60);
                  minutes = maxStartMinutes % 60;
                  // Round down to nearest 15-minute slot
                  minutes = Math.floor(minutes / 15) * 15;
                } else {
                  // Task doesn't fit in category hours - use effective start
                  hours = Math.floor(effectiveStart / 60);
                  minutes = effectiveStart % 60;
                  minutes = Math.ceil(minutes / 15) * 15;
                  if (minutes >= 60) {
                    hours += 1;
                    minutes = 0;
                  }
                }
              }
            } else {
              // Clamp to valid hours and ensure not before current time
              const minHours = Math.floor(currentTotalMinutes / 60);
              const minMinutes = currentTotalMinutes % 60;
              hours = Math.max(minHours, Math.min(TASK_CALCULATION_CONSTANTS.dragDrop.hourMax, hours));
              if (hours === minHours && minutes < minMinutes) {
                minutes = minMinutes;
                // Round up to next 15-minute slot
                minutes = Math.ceil(minutes / 15) * 15;
                if (minutes >= 60) {
                  hours += 1;
                  minutes = 0;
                }
              }
              if (hours === TASK_CALCULATION_CONSTANTS.dragDrop.hourMax && minutes > 0) {
                hours = TASK_CALCULATION_CONSTANTS.dragDrop.hourMax;
                minutes = 0;
              }
            }
            
            // Ensure hours is in valid 24-hour range (0-23)
            if (hours >= 24) {
              hours = 23;
              minutes = 0;
            }
            
            dropTime = new Date(today);
            dropTime.setHours(hours, minutes, 0, 0);
          }
          
          // Round to nearest 15-minute slot
          const finalMinutes = dropTime.getMinutes();
          const roundedMinutes = Math.round(finalMinutes / 15) * 15;
          if (roundedMinutes >= 60) {
            dropTime.setHours(dropTime.getHours() + 1);
            dropTime.setMinutes(0);
          } else {
            dropTime.setMinutes(roundedMinutes);
          }
          dropTime.setSeconds(0);
          dropTime.setMilliseconds(0);
          
          // For today, ensure drop time is not before current time
          if (isToday) {
            const currentTimeRounded = getCurrentTimeRounded();
            if (dropTime.getTime() >= currentTimeRounded.getTime()) {
              requestedTime = dropTime;
            } else {
              // Drop position is before current time - use current time as starting point
              requestedTime = currentTimeRounded;
            }
          } else {
            requestedTime = dropTime;
          }
        }
      }
      
      // If no valid drop position was detected, calculate from drop coordinates or use category hours
      // Never use default times - always calculate from actual position or category hours
      if (!requestedTime) {
        // Try to get drop coordinates from the event to calculate time
        if (event.over && 'rect' in event.over) {
          const overRect = (event.over as any).rect;
          const droppableElement = document.querySelector('[data-droppable-id="today-agenda"]');
          
          if (droppableElement && overRect) {
            const droppableRect = droppableElement.getBoundingClientRect();
            const dropY = overRect.top + (overRect.height / 2);
            const relativeY = dropY - droppableRect.top;
            
            // Get scroll position
            const scrollViewport = droppableElement.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
            const scrollTop = scrollViewport?.scrollTop || 0;
            const adjustedY = relativeY + scrollTop;
            
            // Timeline padding
            const paddingTop = window.innerWidth < 1024 ? 27.6 : 16;
            const contentY = Math.max(0, adjustedY - paddingTop);
            
            // For today, always start calculation from current time (not category start)
            // This ensures we respect the current time of day
            if (isToday) {
              const currentTimeRounded = getCurrentTimeRounded();
              const currentTotalMinutes = currentTimeRounded.getHours() * 60 + currentTimeRounded.getMinutes();
              
              // Convert pixels to minutes from current time
              const pixelsPerMinute = 1.5;
              const minutesFromCurrent = Math.max(0, contentY / pixelsPerMinute);
              
              const totalMinutes = currentTotalMinutes + minutesFromCurrent;
              let hours = Math.floor(totalMinutes / 60);
              let minutes = totalMinutes % 60;
              
              // Round to nearest 15-minute slot
              minutes = Math.round(minutes / 15) * 15;
              if (minutes >= 60) {
                hours += 1;
                minutes = 0;
              }
              
              // Apply category hours constraints (but respect current time)
              if (categoryHours) {
                const totalMinutesInDay = hours * 60 + minutes;
                const effectiveStart = Math.max(categoryHours.start, currentTotalMinutes);
                
                if (totalMinutesInDay < effectiveStart) {
                  hours = Math.floor(effectiveStart / 60);
                  minutes = effectiveStart % 60;
                  minutes = Math.ceil(minutes / 15) * 15;
                  if (minutes >= 60) {
                    hours += 1;
                    minutes = 0;
                  }
                } else if (totalMinutesInDay + taskDuration > categoryHours.end) {
                  const maxStartMinutes = categoryHours.end - taskDuration;
                  if (maxStartMinutes >= effectiveStart) {
                    hours = Math.floor(maxStartMinutes / 60);
                    minutes = maxStartMinutes % 60;
                    minutes = Math.floor(minutes / 15) * 15;
                  } else {
                    hours = Math.floor(effectiveStart / 60);
                    minutes = effectiveStart % 60;
                    minutes = Math.ceil(minutes / 15) * 15;
                    if (minutes >= 60) {
                      hours += 1;
                      minutes = 0;
                    }
                  }
                }
              } else {
                // Ensure not before current time
                if (hours * 60 + minutes < currentTotalMinutes) {
                  hours = Math.floor(currentTotalMinutes / 60);
                  minutes = currentTotalMinutes % 60;
                  minutes = Math.ceil(minutes / 15) * 15;
                  if (minutes >= 60) {
                    hours += 1;
                    minutes = 0;
                  }
                }
              }
              
              // Clamp to valid range
              if (hours >= 24) {
                hours = 23;
                minutes = 0;
              }
              
              requestedTime = new Date(today);
              requestedTime.setHours(hours, minutes, 0, 0);
            } else {
              // For future dates, use category hours or default start
              const startHour = categoryHours 
                ? Math.floor(categoryHours.start / 60)
                : TASK_CALCULATION_CONSTANTS.dragDrop.hourMin;
              const startMinute = categoryHours 
                ? categoryHours.start % 60
                : 0;
              
              // Convert pixels to minutes
              const pixelsPerMinute = 1.5;
              const minutesFromStart = Math.max(0, contentY / pixelsPerMinute);
              
              const totalMinutes = (startHour * 60) + startMinute + minutesFromStart;
              let hours = Math.floor(totalMinutes / 60);
              let minutes = totalMinutes % 60;
              
              // Round to nearest 15-minute slot
              minutes = Math.round(minutes / 15) * 15;
              if (minutes >= 60) {
                hours += 1;
                minutes = 0;
              }
              
              // Apply category hours constraints
              if (categoryHours) {
                const totalMinutesInDay = hours * 60 + minutes;
                if (totalMinutesInDay < categoryHours.start) {
                  hours = Math.floor(categoryHours.start / 60);
                  minutes = categoryHours.start % 60;
                } else if (totalMinutesInDay + taskDuration > categoryHours.end) {
                  const maxStartMinutes = categoryHours.end - taskDuration;
                  if (maxStartMinutes >= categoryHours.start) {
                    hours = Math.floor(maxStartMinutes / 60);
                    minutes = maxStartMinutes % 60;
                    minutes = Math.floor(minutes / 15) * 15;
                  } else {
                    hours = Math.floor(categoryHours.start / 60);
                    minutes = categoryHours.start % 60;
                  }
                }
              }
              
              // Clamp to valid range
              if (hours >= 24) {
                hours = 23;
                minutes = 0;
              }
              
              requestedTime = new Date(today);
              requestedTime.setHours(hours, minutes, 0, 0);
            }
          }
        }
        
        // If still no time, use current time (for today) or category hours
        if (!requestedTime) {
          if (isToday) {
            // For today, always start from current time (rounded up)
            requestedTime = getCurrentTimeRounded();
            
            // Apply category hours if available - ensure we're within category hours
            if (categoryHours) {
              const requestedTotalMinutes = requestedTime.getHours() * 60 + requestedTime.getMinutes();
              // If current time is before category start, use category start
              if (requestedTotalMinutes < categoryHours.start) {
                requestedTime.setHours(Math.floor(categoryHours.start / 60), categoryHours.start % 60, 0, 0);
                // Round up to next 15-minute slot
                const categoryStartMinutes = categoryHours.start % 60;
                const roundedMinutes = Math.ceil(categoryStartMinutes / 15) * 15;
                if (roundedMinutes >= 60) {
                  requestedTime.setHours(requestedTime.getHours() + 1);
                  requestedTime.setMinutes(0);
                } else {
                  requestedTime.setMinutes(roundedMinutes);
                }
              }
            }
          } else {
            // For future dates, use category hours start or earliest allowed time
            requestedTime = new Date(today);
            if (categoryHours) {
              requestedTime.setHours(Math.floor(categoryHours.start / 60), categoryHours.start % 60, 0, 0);
            } else {
              requestedTime.setHours(TASK_CALCULATION_CONSTANTS.dragDrop.hourMin, 0, 0, 0);
            }
          }
        }
      }
      
      // Always use findNextAvailableSlot to find the best available slot
      // This ensures we find slots between existing tasks and respect current time
      const finalTime = findNextAvailableSlot(
        taskId,
        requestedTime,
        taskDuration,
        tasks,
        {
          ensureAfterCurrentTime: isToday,
          categoryHours: categoryHours,
        }
      );
      
      // Check if a valid slot was found
      if (finalTime.getHours() >= 24) {
        toast.error('No available time slots', {
          description: 'No available slots after current time within category hours and 5-hour limit.',
        });
        return;
      }
      
      // Check if the found time is different from requested (and we should show dialog)
      const timeDifference = Math.abs(finalTime.getTime() - requestedTime.getTime());
      const shouldShowDialog = timeDifference > 15 * 60 * 1000; // More than 15 minutes difference
      
      if (shouldShowDialog && isToday) {
        // Show dialog if time was adjusted significantly
        setPendingTaskUpdate({
          taskId,
          requestedTime: requestedTime,
          alternativeTime: finalTime,
        });
        setConflictDialogOpen(true);
        return;
      }

      // Check 5-hour daily limit before scheduling
      const limitCheck = checkDailyLimit(finalTime, task, tasks);
      const warningLevel = getDailyHoursWarningLevel(limitCheck.currentHours, limitCheck.newTotalHours - limitCheck.currentHours);
      
      if (limitCheck.wouldExceed) {
        // Would exceed limit - try to find a slot that fits
        const alternativeTime = findNextAvailableSlot(
          taskId,
          finalTime,
          taskDuration,
          tasks,
          {
            ensureAfterCurrentTime: isToday,
            categoryHours: categoryHours,
          }
        );
        
        // Check if alternative time would also exceed limit
        const altLimitCheck = checkDailyLimit(alternativeTime, task, tasks);
        if (altLimitCheck.wouldExceed) {
          toast.error('Daily limit exceeded', {
            description: `This task would exceed the ${MAX_HOURS_PER_DAY}-hour daily limit. Current: ${limitCheck.currentHours.toFixed(1)}h, Adding: ${(limitCheck.newTotalHours - limitCheck.currentHours).toFixed(1)}h, Total: ${limitCheck.newTotalHours.toFixed(1)}h`,
            duration: 5000,
          });
          return;
        }
        
        // Use alternative time that fits within limit
        updateTask(taskId, {
          scheduledDate: alternativeTime.toISOString(),
        });
        return;
      }
      
      if (warningLevel === 'warning') {
        // Close to limit - show warning but allow
        toast.warning('Approaching daily limit', {
          description: `Today already has ${limitCheck.currentHours.toFixed(1)}h scheduled. Adding this task will bring it to ${limitCheck.newTotalHours.toFixed(1)}h (limit: ${MAX_HOURS_PER_DAY}h)`,
          duration: 4000,
        });
      }

      // Double-check for conflicts before scheduling (safety check)
      const conflictCheck = checkTimeConflict(taskId, finalTime, taskDuration, tasks);
      if (conflictCheck) {
        // If there's still a conflict, find the next available slot
        const safeTime = findNextAvailableSlot(
          taskId,
          finalTime,
          taskDuration,
          tasks,
          {
            ensureAfterCurrentTime: isToday,
            categoryHours: categoryHours,
          }
        );
        
        // Verify the safe time doesn't conflict
        const safeConflictCheck = checkTimeConflict(taskId, safeTime, taskDuration, tasks);
        if (safeConflictCheck) {
          toast.error('Unable to schedule task', {
            description: 'No available time slots without conflicts. Please try a different time.',
          });
          return;
        }
        
        updateTask(taskId, {
          scheduledDate: safeTime.toISOString(),
        });
        return;
      }

      // No conflict and within limit, proceed with update
      updateTask(taskId, {
        scheduledDate: finalTime.toISOString(),
      });
      return;
    }

    // Check if dropped on a folder
    if (typeof over.id === 'string' && over.id.startsWith('folder_')) {
      const folderId = over.id.replace('folder_', '');
      const folder = folders.find(f => f.id === folderId);
      
      if (!folder) {
        console.error('Folder not found:', folderId);
        return;
      }

      // Add folder name as a tag to the task
      const currentTags = task.tags || [];
      if (!currentTags.includes(folder.name)) {
        const updatedTags = [...currentTags, folder.name];
        updateTask(taskId, {
          tags: updatedTags,
        });
        toast.success(`Task added to "${folder.name}" folder`);
      } else {
        toast.info(`Task is already in "${folder.name}" folder`);
      }
      return;
    }

    // Otherwise, handle as a date column drop (existing Kanban behavior)
    let targetDateString = over.id as string;

    // Check if we dropped on another task (over.id is a task ID)
    const overTask = tasks.find(t => t.id === targetDateString);
    if (overTask && overTask.scheduledDate) {
      try {
        const date = new Date(overTask.scheduledDate);
        if (!isNaN(date.getTime())) {
          targetDateString = date.toISOString().split('T')[0];
        }
      } catch (error) {
        // Silently handle date extraction errors
        return;
      }
    }

    // Validate it's a date string (YYYY-MM-DD format)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateString)) {
      // Silently handle invalid date format
      return;
    }
    
    // Silently handle drop - no logging needed

    // Parse the new date
    const [year, month, day] = targetDateString.split('-').map(Number);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      console.error('Invalid date string:', targetDateString);
      return;
    }

    // For date column drops, find the earliest available slot for that date
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);
    
    // Get category hours if applicable
    const categoryHours = getCategoryHoursForTask(task, targetDate, hoursSettings);
    const taskDuration = task.estimatedTime || 30;
    
    // Find existing tasks for this date
    const existingTasksForDate = tasks.filter((t) => {
      if (t.id === taskId || t.status === 'done') return false;
      if (!t.scheduledDate) return false;
      const taskDate = new Date(t.scheduledDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() === targetDate.getTime();
    });
    
    // Determine start time
    let startTime: Date;
    if (existingTasksForDate.length > 0) {
      // Find earliest gap or start after last task
      const sortedTasks = existingTasksForDate
        .map((t) => ({
          task: t,
          start: new Date(t.scheduledDate!).getTime(),
          end: new Date(t.scheduledDate!).getTime() + ((t.estimatedTime || 30) * 60 * 1000),
        }))
        .sort((a, b) => a.start - b.start);
      
      const earliestAllowed = new Date(targetDate);
      if (categoryHours) {
        earliestAllowed.setHours(Math.floor(categoryHours.start / 60), categoryHours.start % 60, 0, 0);
      } else {
        earliestAllowed.setHours(TASK_CALCULATION_CONSTANTS.dragDrop.hourMin, 0, 0, 0);
      }
      
      const firstTask = sortedTasks[0];
      if (firstTask.start > earliestAllowed.getTime() + (taskDuration * 60 * 1000)) {
        startTime = earliestAllowed;
      } else {
        const lastTask = sortedTasks[sortedTasks.length - 1];
        startTime = new Date(lastTask.end);
        const minutes = startTime.getMinutes();
        const roundedMinutes = Math.ceil(minutes / 15) * 15;
        if (roundedMinutes >= 60) {
          startTime.setHours(startTime.getHours() + 1);
          startTime.setMinutes(0);
        } else {
          startTime.setMinutes(roundedMinutes);
        }
        startTime.setSeconds(0);
        startTime.setMilliseconds(0);
      }
    } else {
      // No existing tasks - start from category start or earliest allowed
      startTime = new Date(targetDate);
      if (categoryHours) {
        startTime.setHours(Math.floor(categoryHours.start / 60), categoryHours.start % 60, 0, 0);
      } else {
        startTime.setHours(TASK_CALCULATION_CONSTANTS.dragDrop.hourMin, 0, 0, 0);
      }
    }
    
    // Use findNextAvailableSlot to find the best slot
    const newDate = findNextAvailableSlot(
      taskId,
      startTime,
      taskDuration,
      tasks,
      {
        ensureAfterCurrentTime: false,
        categoryHours: categoryHours,
      }
    );
    
    if (isNaN(newDate.getTime())) {
      console.error('Invalid date created from:', { year, month, day, hours, minutes });
      return;
    }

    // Update task with new scheduled date
    console.log('[DragDrop] Updating task:', taskId, 'to', newDate.toISOString());
    updateTask(taskId, {
      scheduledDate: newDate.toISOString(),
    });
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  const handleConflictConfirm = () => {
    if (pendingTaskUpdate) {
      updateTask(pendingTaskUpdate.taskId, {
        scheduledDate: pendingTaskUpdate.alternativeTime.toISOString(),
      });
      toast.success(`Task scheduled for ${formatTime(pendingTaskUpdate.alternativeTime)}`);
    }
    setConflictDialogOpen(false);
    setPendingTaskUpdate(null);
  };

  const handleConflictCancel = () => {
    setConflictDialogOpen(false);
    setPendingTaskUpdate(null);
  };

  return (
    <DragDropContext.Provider value={{ activeId }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {children}
        
        <DragOverlay
          dropAnimation={{
            duration: 400,
            easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
          style={{
            cursor: 'grabbing',
            zIndex: 9999,
          }}
        >
          {activeTask && (() => {
            // Check if dragging from month calendar view or kanban view by checking if the active element is within those containers
            // Use a try-catch to safely check the DOM
            let isFromMonthCalendar = false;
            let isFromKanban = false;
            try {
              const activeElement = document.querySelector(`[data-sortable-id="${activeId}"]`) || 
                                   document.querySelector(`[id="${activeId}"]`) ||
                                   document.querySelector(`[data-task-id="${activeId}"]`);
              isFromMonthCalendar = activeElement?.closest('[data-month-calendar]') !== null;
              isFromKanban = activeElement?.closest('[data-kanban-view]') !== null;
            } catch (e) {
              // If check fails, default to false (use full card)
              isFromMonthCalendar = false;
              isFromKanban = false;
            }
            
            // Use compact preview for month calendar, larger preview for kanban, full card for other views
            if (isFromMonthCalendar) {
              const priorityColors = {
                urgent: "border-l-red-400 bg-red-50 dark:bg-red-950/20",
                high: "border-l-orange-400 bg-orange-50 dark:bg-orange-950/20",
                medium: "border-l-blue-400 bg-blue-50 dark:bg-blue-950/20",
                low: "border-l-gray-400 bg-gray-50 dark:bg-muted/20",
              };
              
              return (
                <div 
                  className={cn(
                    "opacity-90 pointer-events-none text-xs p-1 rounded border-l-2",
                    priorityColors[activeTask.priority],
                    activeTask.status === "done" && "opacity-60",
                  )}
                  style={{
                    maxWidth: '120px',
                    width: '120px',
                    transform: 'rotate(2deg) scale(0.9)',
                    transition: 'transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    fontSize: '11px',
                  }}
                >
                  <div className="flex items-start gap-1">
                    <div className="flex items-start gap-0.5 flex-1 min-w-0">
                      <p className={cn(
                        "truncate font-medium leading-tight text-[11px]",
                        activeTask.status === "done"
                          ? "line-through text-muted-foreground"
                          : "text-foreground/90",
                      )}>
                        {activeTask.title}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Larger preview for kanban view (week view)
            if (isFromKanban) {
              return (
                <div 
                  className="opacity-90 pointer-events-none"
                  style={{
                    maxWidth: '320px',
                    width: '320px',
                    transform: 'rotate(2deg) scale(1.1)',
                    transition: 'transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  }}
                >
                  <DraggableTaskCard task={activeTask} onClick={() => {}} droppableId="" isDragging />
                </div>
              );
            }
            
            // Full card preview for other views (including timeline)
            return (
              <div 
                className="opacity-90 pointer-events-none"
                style={{
                  maxWidth: '280px',
                  width: '280px',
                  transform: 'rotate(3deg) scale(1.05)',
                  transition: 'transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
                }}
              >
                <DraggableTaskCard task={activeTask} onClick={() => {}} droppableId="" isDragging />
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>

      {/* Conflict Resolution Dialog */}
      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Time Slot Already Taken</AlertDialogTitle>
            <AlertDialogDescription>
              The time slot {pendingTaskUpdate && formatTime(pendingTaskUpdate.requestedTime)} is already occupied by another task.
              Would you like to schedule this task at {pendingTaskUpdate && formatTime(pendingTaskUpdate.alternativeTime)} instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConflictCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConflictConfirm}>
              Use {pendingTaskUpdate && formatTime(pendingTaskUpdate.alternativeTime)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DragDropContext.Provider>
  );
}

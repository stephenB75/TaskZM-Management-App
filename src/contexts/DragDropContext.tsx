import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DndContext, DragStartEvent, DragEndEvent, DragOverEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useTasks } from './TaskContext';
import { DraggableTaskCard } from '../components/DraggableTaskCard';
import { isTaskBlocked, getIncompleteDependencies, cn } from '../lib/utils';
import { checkTimeConflict, findNextAvailableSlot, formatTime } from '../lib/time-conflict';
import { checkDailyLimit, getDailyHoursWarningLevel, MAX_HOURS_PER_DAY } from '../lib/daily-hours-utils';
import { getCategoryHoursForTask } from '../lib/category-hours-utils';
import { TASK_CALCULATION_CONSTANTS } from '../lib/task-calculation-constants';
import { TASK_CARD_LAYOUT_METRICS, TASK_CARD_HEIGHT_CONFIG, TASK_CARD_CALCULATIONS } from '../lib/task-card-constants';
import { TIMELINE_PADDING, VIEWPORT_BREAKPOINTS } from '../lib/layout-constants';
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

export function useDragDrop(optional?: boolean) {
  const context = useContext(DragDropContext);
  if (!context) {
    if (optional) {
      return { activeId: null };
    }
    if (process.env.NODE_ENV !== 'production') {
      console.warn('useDragDrop called outside DragDropProvider. Returning fallback context.');
    }
    return { activeId: null };
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

  const pixelsPerMinute = TASK_CARD_LAYOUT_METRICS.pixelsPerMinute;

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    setActiveId(taskId);
    document.body.classList.add('dragging');
    // Add smooth cursor transition
    document.body.style.cursor = 'grabbing';
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Store drop position for time calculation
    // This will be used in handleDragEnd to calculate time slot
    // Add visual feedback for invalid drops if needed
    const taskId = event.active.id as string;
    const task = tasks.find(t => t.id === taskId);
    
    if (task && event.over) {
      // Check if task is blocked - provide visual feedback
      if (isTaskBlocked(task, tasks)) {
        // Visual feedback is handled via cursor and overlay styling
        document.body.style.cursor = 'not-allowed';
        // Add visual indicator to the overlay
        const overlay = document.querySelector('[role="dialog"]') as HTMLElement;
        if (overlay && overlay.classList.contains('opacity-90')) {
          overlay.style.opacity = '0.5';
          overlay.style.filter = 'grayscale(50%)';
        }
      } else {
        document.body.style.cursor = 'grabbing';
        // Reset overlay styling
        const overlay = document.querySelector('[role="dialog"]') as HTMLElement;
        if (overlay) {
          overlay.style.opacity = '';
          overlay.style.filter = '';
        }
      }
    }
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    document.body.classList.remove('dragging');
    // Reset cursor
    document.body.style.cursor = '';

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
        duration: 4000,
      });
      // Add visual shake animation to indicate invalid drop
      const activeElement = document.querySelector(`[data-task-id="${taskId}"]`) || 
                           document.querySelector(`[id="${taskId}"]`);
      if (activeElement) {
        activeElement.classList.add('animate-shake');
        setTimeout(() => {
          activeElement.classList.remove('animate-shake');
        }, 500);
      }
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
          // Use constants for timeline padding
          const paddingTop = window.innerWidth < VIEWPORT_BREAKPOINTS.tablet ? TIMELINE_PADDING.mobile : TIMELINE_PADDING.desktop;
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
            
            // Calculate task heights using single standard base height + auto-adjust for components (matching DraggableTaskCard)
            // Standard base height: 80px for all tasks, regardless of duration
            const calculateTaskHeight = (task: Task): number => {
              // Use single standard base height for all tasks
              let baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.base; // 80px standard base
              
              // Auto-adjust: Check for content components
              const hasDescription = !!task.description;
              const hasAssignedUsers = task.assignedTo && task.assignedTo.length > 0;
              const hasSubtasks = task.subtasks && task.subtasks.length > 0;
              const hasTrackedTime = task.actualTime && task.actualTime > 0;
              
              // Auto-adjust: Add height for description
              if (hasDescription) {
                const estimatedLines = task.description ? Math.ceil(task.description.length / TASK_CARD_CALCULATIONS.description.charsPerLine) : 4;
                const lineHeight = TASK_CARD_CALCULATIONS.description.lineHeight;
                const descriptionBottomPadding = (hasAssignedUsers && !hasSubtasks) 
                  ? TASK_CARD_HEIGHT_CONFIG.componentHeights.description.bottomPadding.noGap
                  : TASK_CARD_HEIGHT_CONFIG.componentHeights.description.bottomPadding.standard;
                const descriptionHeight = Math.max(estimatedLines * lineHeight, TASK_CARD_CALCULATIONS.description.minHeight) + descriptionBottomPadding;
                baseHeight += descriptionHeight;
              }
              
              // Auto-adjust: Add height for assigned users
              if (hasAssignedUsers) {
                const assignedUsersBaseHeight = TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.base;
                const assignedUsersSpacing = (hasDescription && !hasSubtasks) 
                  ? TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.spacing.reduced
                  : TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.spacing.standard;
                baseHeight += assignedUsersBaseHeight + assignedUsersSpacing;
              }
              
              // Auto-adjust: Add height for tracked time
              if (hasTrackedTime) {
                baseHeight += TASK_CARD_HEIGHT_CONFIG.componentHeights.trackedTime;
              }
              
              // Auto-adjust: Add height for subtasks
              if (hasSubtasks) {
                const subtaskCount = Math.min(task.subtasks.length, 3);
                const subtaskItemHeight = TASK_CARD_HEIGHT_CONFIG.componentHeights.subtask.itemHeight;
                const subtaskSpacing = TASK_CARD_HEIGHT_CONFIG.componentHeights.subtask.spacing.desktop; // Use desktop spacing for consistency
                const subtaskHeight = subtaskCount * subtaskItemHeight + 
                  (subtaskCount > 1 ? (subtaskCount - 1) * subtaskSpacing : 0);
                const subtaskTopSpacing = hasDescription ? TASK_CARD_HEIGHT_CONFIG.componentHeights.subtask.topSpacing : 0;
                baseHeight += subtaskHeight + subtaskTopSpacing;
              }
              
              // Ensure height is within bounds (minimum 80px, maximum 550px)
              const minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.base; // 80px minimum
              const maxHeight = TASK_CARD_HEIGHT_CONFIG.maxHeight; // 550px maximum
              
              return Math.max(Math.min(baseHeight, maxHeight), minHeight);
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
          
          // For today, use drop time as preferred placement time
          // findNextAvailableSlot will ensure it's after current time when searching
          // This allows us to try placing at the drop position first, then search from current time if needed
          requestedTime = dropTime;
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
            
            // Timeline padding - use constants
            const paddingTop = window.innerWidth < VIEWPORT_BREAKPOINTS.tablet ? TIMELINE_PADDING.mobile : TIMELINE_PADDING.desktop;
            const contentY = Math.max(0, adjustedY - paddingTop);
            
            // For today, always start calculation from current time (not category start)
            // This ensures we respect the current time of day
            if (isToday) {
              const currentTimeRounded = getCurrentTimeRounded();
              const currentTotalMinutes = currentTimeRounded.getHours() * 60 + currentTimeRounded.getMinutes();
              
              // Convert pixels to minutes from current time
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
        
        // If still no time, use default time (for placement) - findNextAvailableSlot will ensure it's after current time
        if (!requestedTime) {
          // Use default time (9 AM or category start) as the preferred placement time
          // findNextAvailableSlot will start searching from current time but try to place at this default time
          requestedTime = new Date(today);
          if (categoryHours) {
            requestedTime.setHours(Math.floor(categoryHours.start / 60), categoryHours.start % 60, 0, 0);
          } else {
            // Use default hour (9 AM) as the preferred placement time
            requestedTime.setHours(TASK_CALCULATION_CONSTANTS.dragDrop.defaultHour, 0, 0, 0);
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
      
      // Note: Removed automatic reorganization to prevent infinite loops
      // Tasks are already sorted chronologically in TodayAgendaView
      // If reorganization is needed, it should be done manually or on a case-by-case basis
      
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
    
    // Check if task is being dragged from today agenda timeline
    // If so, try to calculate time from drop position
    let requestedTime: Date | null = null;
    const isFromTodayAgenda = task.scheduledDate && (() => {
      try {
        const taskDate = new Date(task.scheduledDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === today.getTime();
      } catch {
        return false;
      }
    })();
    
    // If dragging from today agenda to another day, try to calculate time from drop position
    if (isFromTodayAgenda && event.over && 'rect' in event.over) {
      try {
        const overRect = (event.over as any).rect;
        const droppableElement = document.querySelector(`[data-droppable-id="${targetDateString}"]`) || 
                                 document.querySelector(`[id="${targetDateString}"]`);
        
        if (droppableElement && overRect) {
          const droppableRect = droppableElement.getBoundingClientRect();
          const dropY = overRect.top + (overRect.height / 2);
          const relativeY = dropY - droppableRect.top;
          
          // Get scroll position
          const scrollViewport = droppableElement.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
          const scrollTop = scrollViewport?.scrollTop || 0;
          const adjustedY = relativeY + scrollTop;
          
          // Timeline padding (similar to today agenda) - use constants
          const paddingTop = window.innerWidth < VIEWPORT_BREAKPOINTS.tablet ? TIMELINE_PADDING.mobile : TIMELINE_PADDING.desktop;
          const contentY = Math.max(0, adjustedY - paddingTop);
          
          // Calculate time from pixel position
          const minutesFromStart = Math.max(0, contentY / pixelsPerMinute);
          
          // Determine start hour based on category hours or default
          const startHour = categoryHours 
            ? Math.floor(categoryHours.start / 60)
            : TASK_CALCULATION_CONSTANTS.dragDrop.hourMin;
          const startMinute = categoryHours 
            ? categoryHours.start % 60
            : 0;
          
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
          
          requestedTime = new Date(targetDate);
          requestedTime.setHours(hours, minutes, 0, 0);
        }
      } catch (error) {
        // If calculation fails, fall back to default behavior
        console.error('Error calculating time from drop position:', error);
      }
    }
    
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
    if (requestedTime) {
      // Use calculated time from drop position
      startTime = requestedTime;
    } else if (existingTasksForDate.length > 0) {
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
    
    // Use findNextAvailableSlot to find the best available slot
    // This validates against existing tasks and finds the next available time
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
      console.error('Invalid date created from:', { year, month, day, targetDateString });
      return;
    }
    
    // Check if the found time is different from requested (and we should show dialog)
    const timeDifference = requestedTime ? Math.abs(newDate.getTime() - requestedTime.getTime()) : 0;
    const shouldShowDialog = timeDifference > 15 * 60 * 1000; // More than 15 minutes difference
    
    if (shouldShowDialog && requestedTime) {
      // Show dialog if time was adjusted significantly
      setPendingTaskUpdate({
        taskId,
        requestedTime: requestedTime,
        alternativeTime: newDate,
      });
      setConflictDialogOpen(true);
      return;
    }

    // Update task with new scheduled date
    updateTask(taskId, {
      scheduledDate: newDate.toISOString(),
    });
    
    // Note: Removed automatic reorganization to prevent infinite loops
    // Tasks are already sorted chronologically in views
    // If reorganization is needed, it should be done manually or on a case-by-case basis
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
            zIndex: 99999,
            pointerEvents: 'none',
            position: 'fixed',
          }}
          className="cursor-grabbing"
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
                  className="opacity-95 pointer-events-none shadow-2xl"
                  style={{
                    maxWidth: '386px',
                    width: '386px',
                    transform: 'rotate(2deg) scale(1.05)',
                    transition: 'transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0, 0.3))',
                  }}
                >
                  <DraggableTaskCard task={activeTask} onClick={() => {}} droppableId="" isDragging />
                </div>
              );
            }
            
            // Full card preview for other views (including timeline)
            return (
              <div 
                className="opacity-95 pointer-events-none shadow-2xl"
                style={{
                  maxWidth: '386px',
                  width: '386px',
                  transform: 'rotate(3deg) scale(1.05)',
                  transition: 'transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0, 0.3))',
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

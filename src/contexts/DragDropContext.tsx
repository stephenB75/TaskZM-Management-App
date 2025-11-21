import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DndContext, DragStartEvent, DragEndEvent, DragOverEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useTasks } from './TaskContext';
import { DraggableTaskCard } from '../components/DraggableTaskCard';
import { isTaskBlocked, getIncompleteDependencies } from '../lib/utils';
import { checkTimeConflict, findNextAvailableSlot, formatTime } from '../lib/time-conflict';
import { checkDailyLimit, getDailyHoursWarningLevel, MAX_HOURS_PER_DAY } from '../lib/daily-hours-utils';
import { getCategoryHoursForTask } from '../lib/category-hours-utils';
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
        distance: 8, // 8px movement to activate drag
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
      
      // Calculate time from drop position
      // Get the droppable element (the timeline container)
      const droppableElement = document.querySelector('[data-droppable-id="today-agenda"]');
      let hours = 9;
      let minutes = 0;
      
      // Try to get drop coordinates from event
      // Use the over rect to get the drop position relative to the droppable
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
          
          // Convert pixels to minutes
          // Rough estimate: 1px ≈ 1 minute, starting from 8 AM (480 minutes from midnight)
          const minutesFrom8AM = contentY;
          const totalMinutes = 8 * 60 + minutesFrom8AM;
          
          hours = Math.floor(totalMinutes / 60);
          minutes = totalMinutes % 60;
          
          // Round to nearest 15-minute slot
          minutes = Math.round(minutes / 15) * 15;
          if (minutes >= 60) {
            hours += 1;
            minutes = 0;
          }
          
          // Clamp to valid hours (8 AM to 11 PM)
          hours = Math.max(8, Math.min(23, hours));
          if (hours === 23 && minutes > 0) {
            minutes = 0;
          }
        }
      } else {
        // Fallback: preserve time from old date if it exists, otherwise use 9:00 AM
        if (task.scheduledDate) {
          const oldDate = new Date(task.scheduledDate);
          if (!isNaN(oldDate.getTime())) {
            hours = oldDate.getHours();
            minutes = oldDate.getMinutes();
            // Round to nearest 15-minute slot
            minutes = Math.round(minutes / 15) * 15;
            if (minutes >= 60) {
              hours += 1;
              minutes = 0;
            }
          }
        }
      }
      
      today.setHours(hours, minutes, 0, 0);
      
      // Get category hours if applicable
      const categoryHours = getCategoryHoursForTask(task, today, hoursSettings);
      
      // Check for time conflicts and find next available slot after current time
      const taskDuration = task.estimatedTime || 30; // Default to 30 minutes if not specified
      const conflictingTask = checkTimeConflict(taskId, today, taskDuration, tasks);

      // Find next available slot (ensuring after current time for today)
      const now = new Date();
      const isToday = today.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() &&
                      today.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      
      let finalTime = today;
      
      if (conflictingTask || (isToday && today.getTime() < now.getTime())) {
        // Find next available slot after current time (if today) or requested time
        const alternativeTime = findNextAvailableSlot(
          taskId, 
          today, 
          taskDuration, 
          tasks,
          {
            ensureAfterCurrentTime: isToday,
            categoryHours: categoryHours,
          }
        );
        
        // Check if alternative time is valid and different
        if (alternativeTime.getTime() !== today.getTime() && alternativeTime.getHours() < 24) {
          // Check if alternative time is before current time (shouldn't happen, but safety check)
          if (isToday && alternativeTime.getTime() < now.getTime()) {
            toast.error('No available time slots', {
              description: 'No available slots after current time within category hours and 5-hour limit.',
            });
            return;
          }
          
          // Store the pending update and show dialog
          setPendingTaskUpdate({
            taskId,
            requestedTime: new Date(today), // Create a new Date object to avoid reference issues
            alternativeTime,
          });
          setConflictDialogOpen(true);
          return;
        } else {
          // No valid alternative found, show error
          const reason = isToday && today.getTime() < now.getTime() 
            ? 'Selected time is in the past. Please choose a time after the current time.'
            : 'Time slot is already taken or outside category hours. Please choose a different time slot.';
          toast.error('Time slot unavailable', {
            description: reason,
          });
          return;
        }
      } else if (isToday && today.getTime() < now.getTime()) {
        // Time is in the past, find next available slot
        const alternativeTime = findNextAvailableSlot(
          taskId,
          now,
          taskDuration,
          tasks,
          {
            ensureAfterCurrentTime: true,
            categoryHours: categoryHours,
          }
        );
        
        if (alternativeTime.getHours() < 24) {
          setPendingTaskUpdate({
            taskId,
            requestedTime: new Date(today),
            alternativeTime,
          });
          setConflictDialogOpen(true);
          return;
        } else {
          toast.error('No available time slots', {
            description: 'No available slots after current time within category hours and 5-hour limit.',
          });
          return;
        }
      }
      
      finalTime = today;

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
        finalTime = alternativeTime;
      }
      
      if (warningLevel === 'warning') {
        // Close to limit - show warning but allow
        toast.warning('Approaching daily limit', {
          description: `Today already has ${limitCheck.currentHours.toFixed(1)}h scheduled. Adding this task will bring it to ${limitCheck.newTotalHours.toFixed(1)}h (limit: ${MAX_HOURS_PER_DAY}h)`,
          duration: 4000,
        });
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

    // Preserve time from old date if it exists, otherwise use 9:00 AM as default
    let hours = 9;
    let minutes = 0;
    
    if (task.scheduledDate) {
      const oldDate = new Date(task.scheduledDate);
      if (!isNaN(oldDate.getTime())) {
        hours = oldDate.getHours();
        minutes = oldDate.getMinutes();
      }
    }
    
    const newDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
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
          {activeTask && (
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
          )}
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

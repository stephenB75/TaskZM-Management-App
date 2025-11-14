import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DndContext, DragStartEvent, DragEndEvent, DragOverEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useTasks } from './TaskContext';
import { DraggableTaskCard } from '../components/DraggableTaskCard';
import { isTaskBlocked, getIncompleteDependencies } from '../lib/utils';
import { isDateInRecurrence } from '../lib/recurrence';
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
  const { tasks, updateTask, folders } = useTasks();
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

  /**
   * Check if a time slot conflicts with existing tasks on the same day
   */
  const checkTimeConflict = (
    taskId: string,
    scheduledTime: Date,
    taskDuration: number
  ): Task | null => {
    const today = new Date(scheduledTime);
    today.setHours(0, 0, 0, 0);

    // Get all tasks scheduled for today (excluding the current task)
    const todayTasks = tasks.filter((task) => {
      if (task.id === taskId) return false; // Exclude the task being moved
      if (task.status === 'done') return false; // Exclude completed tasks
      return isDateInRecurrence(task, today);
    });

    const newTaskStart = scheduledTime.getTime();
    const newTaskEnd = newTaskStart + (taskDuration * 60 * 1000);

    // Check for overlaps with existing tasks
    for (const existingTask of todayTasks) {
      if (!existingTask.scheduledDate) continue;

      const existingTaskStart = new Date(existingTask.scheduledDate).getTime();
      const existingTaskDuration = (existingTask.estimatedTime || 30) * 60 * 1000;
      const existingTaskEnd = existingTaskStart + existingTaskDuration;

      // Check for overlap: new task overlaps if it starts before existing ends AND ends after existing starts
      if (newTaskStart < existingTaskEnd && newTaskEnd > existingTaskStart) {
        return existingTask;
      }
    }

    return null;
  };

  /**
   * Find the next available time slot after the requested time
   */
  const findNextAvailableSlot = (
    taskId: string,
    requestedTime: Date,
    taskDuration: number
  ): Date => {
    const today = new Date(requestedTime);
    today.setHours(0, 0, 0, 0);

    // Get all tasks scheduled for today (excluding the current task)
    const todayTasks = tasks.filter((task) => {
      if (task.id === taskId) return false;
      if (task.status === 'done') return false;
      return isDateInRecurrence(task, today);
    });

    // Sort tasks by scheduled time
    const sortedTasks = todayTasks
      .filter((task) => task.scheduledDate)
      .map((task) => ({
        task,
        start: new Date(task.scheduledDate!).getTime(),
        end: new Date(task.scheduledDate!).getTime() + ((task.estimatedTime || 30) * 60 * 1000),
      }))
      .sort((a, b) => a.start - b.start);

    // Start checking from the requested time
    let candidateTime = new Date(requestedTime);
    const maxHour = 23;
    const maxMinute = 0;

    // Try to find a slot after the requested time
    while (candidateTime.getHours() < maxHour || (candidateTime.getHours() === maxHour && candidateTime.getMinutes() <= maxMinute)) {
      const candidateStart = candidateTime.getTime();
      const candidateEnd = candidateStart + (taskDuration * 60 * 1000);

      // Check if this slot conflicts with any existing task
      let hasConflict = false;
      for (const existing of sortedTasks) {
        if (candidateStart < existing.end && candidateEnd > existing.start) {
          hasConflict = true;
          // Move candidate time to after this conflicting task
          candidateTime = new Date(existing.end);
          // Round to nearest 15-minute slot
          const minutes = candidateTime.getMinutes();
          const roundedMinutes = Math.ceil(minutes / 15) * 15;
          if (roundedMinutes >= 60) {
            candidateTime.setHours(candidateTime.getHours() + 1);
            candidateTime.setMinutes(0);
          } else {
            candidateTime.setMinutes(roundedMinutes);
          }
          break;
        }
      }

      if (!hasConflict) {
        return candidateTime;
      }
    }

    // If no slot found, return the requested time (user can decide)
    return requestedTime;
  };

  /**
   * Format time for display
   */
  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${period}`;
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
      
      // Check for time conflicts
      const taskDuration = task.estimatedTime || 30; // Default to 30 minutes if not specified
      const conflictingTask = checkTimeConflict(taskId, today, taskDuration);

      if (conflictingTask) {
        // Find next available slot
        const alternativeTime = findNextAvailableSlot(taskId, today, taskDuration);
        
        // Only show dialog if alternative time is different and valid
        if (alternativeTime.getTime() !== today.getTime() && alternativeTime.getHours() < 24) {
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
          toast.error('Time slot is already taken', {
            description: 'Please choose a different time slot on the timeline.',
          });
          return;
        }
      }

      // No conflict, proceed with update
      updateTask(taskId, {
        scheduledDate: today.toISOString(),
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

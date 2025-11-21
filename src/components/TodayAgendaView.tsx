import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { useDroppable } from "@dnd-kit/core";
import { Calendar, Plus, StickyNote } from "lucide-react";
import { useTasks } from "../contexts/TaskContext";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { TaskDialog } from "./TaskDialog";
import { DraggableTodayAgendaTask } from "./DraggableTodayAgendaTask";
import { Confetti } from "./Confetti";
import { cn, prepareTaskForDialog, hasHTMLTags, sanitizeHTML } from "../lib/utils";
import { isDateInRecurrence } from "../lib/recurrence";
import { toast } from "sonner";
import type { Task } from "../types";
import { UI_GRADIENT_COLORS, UI_TODAY_AGENDA_STATUS_COLORS } from "../lib/ui-colors";
import { TASK_CALCULATION_CONSTANTS } from "../lib/task-calculation-constants";
import { TODAY_AGENDA_TEXT } from "../lib/today-agenda-constants";

interface TodayAgendaViewProps {
  hideHeader?: boolean;
}

export function TodayAgendaView({
  hideHeader = false,
}: TodayAgendaViewProps = {}) {
  const { tasks, updateTask } = useTasks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    null,
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  // Make this view a droppable zone for tasks from Kanban
  const { setNodeRef, isOver } = useDroppable({
    id: "today-agenda",
  });

  // Get today's tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allTodayTasks = Array.isArray(tasks) ? tasks.filter((task) => {
    // Defensive check: ensure task is valid
    if (!task || typeof task !== 'object') {
      return false;
    }
    try {
      // Check if task matches today (either exact match or recurrence pattern)
      return isDateInRecurrence(task, today);
    } catch (error) {
      console.error('Error checking date in recurrence:', error, task);
      return false;
    }
  }) : [];

  // Filter out done tasks - they should not appear in Today Agenda
  // Done tasks automatically appear in Archive view
  const incompleteTasks = allTodayTasks.filter((task) => task.status !== "done");

  // Sort incomplete tasks by time
  const todayTasks = incompleteTasks.sort((a, b) => {
    try {
      const timeA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
      const timeB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
      if (isNaN(timeA)) return 1;
      if (isNaN(timeB)) return -1;
      return timeA - timeB;
    } catch (error) {
      console.error('Error sorting tasks:', error, a, b);
      return 0;
    }
  });

  // Auto-scroll to current time on mount and when tasks change
  useEffect(() => {
    if (todayTasks.length === 0) return;

    const scrollToCurrentTime = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      // Find the task closest to current time
      let closestTask = todayTasks[0];
      let minDiff = Infinity;

      todayTasks.forEach((task) => {
        if (!task.scheduledDate) return;
        const taskDate = new Date(task.scheduledDate);
        const taskTimeInMinutes = taskDate.getHours() * 60 + taskDate.getMinutes();
        const diff = Math.abs(taskTimeInMinutes - currentTimeInMinutes);
        
        if (diff < minDiff) {
          minDiff = diff;
          closestTask = task;
        }
      });

      // Scroll to the closest task or current time position
      if (closestTask) {
        const taskElement = timelineContainerRef.current?.querySelector(`[data-task-id="${closestTask.id}"]`);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // If no task found, find the scroll viewport within this component and scroll to approximate current time position
          // Find the scroll viewport by looking for the parent ScrollArea's viewport
          const scrollViewport = timelineContainerRef.current?.closest('[data-slot="scroll-area"]')?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
          if (scrollViewport) {
            // Estimate: each hour is roughly 60px, start from 8 AM
            const hoursFrom8AM = Math.max(0, currentHour - 8);
            const minutesOffset = (currentMinute / 60) * 60;
            const estimatedScrollTop = Math.max(0, (hoursFrom8AM * 60) + minutesOffset - 200); // 200px offset for header
            scrollViewport.scrollTop = estimatedScrollTop;
          }
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(scrollToCurrentTime, 100);
    return () => clearTimeout(timer);
  }, [todayTasks]);

  // Find the first uncompleted task (next up)
  const nextUpTaskId = todayTasks[0]?.id;

  const handleTaskClick = (task: Task) => {
    console.log('TodayAgendaView: handleTaskClick called with task:', task);
    try {
      if (!task || !task.id) {
        console.error('Invalid task passed to handleTaskClick:', task);
        toast.error('Invalid task data');
        return;
      }
      
      const safeTask = prepareTaskForDialog(task);
      if (!safeTask) {
        console.error('prepareTaskForDialog returned null for task:', task);
        toast.error('Invalid task data');
        return;
      }
      
      console.log('TodayAgendaView: Setting selected task and opening dialog:', safeTask);
      setSelectedTask(safeTask);
      setDialogOpen(true);
    } catch (error) {
      console.error('Error opening task:', error, task);
      toast.error('Failed to open task');
    }
  };

  const handleAddTask = () => {
    setSelectedTask(null);
    setDialogOpen(true);
  };

  const getTaskTime = (task: Task) => {
    if (!task.scheduledDate) return "";
    try {
      const date = new Date(task.scheduledDate);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      // Silently handle invalid scheduledDate
      return "";
    }
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-400"; // Red
      case "high":
        return "bg-orange-400"; // Orange
      case "medium":
        return "bg-blue-400"; // Blue
      case "low":
        return "bg-gray-400"; // Grey
      default:
        return "bg-gray-300";
    }
  };

  // Calculate height based on task duration
  // Auto-adjusts for: badge wrapping, assigned users, tracking, descriptions
  const getTaskHeight = (task: Task) => {
    const minutes = task.estimatedTime || TASK_CALCULATION_CONSTANTS.defaultDurationMinutes;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    
    // Count badges that will be displayed in the top row
    const hasTime = !!(task.scheduledDate || task.dueDate);
    const hasPriority = true; // Always shown
    const hasTag = task.tags && task.tags.length > 0;
    const hasDuration = !!task.estimatedTime;
    
    // Estimate if badges will wrap to second line
    const badgeCount = [hasTime, hasPriority, hasTag, hasDuration].filter(Boolean).length;
    const estimatedBadgeWidth = badgeCount * TASK_CALCULATION_CONSTANTS.badge.averageWidth;
    const availableWidth = isMobile ? TASK_CALCULATION_CONSTANTS.badge.availableWidth.mobile : TASK_CALCULATION_CONSTANTS.badge.availableWidth.desktop;
    const badgesWillWrap = estimatedBadgeWidth > availableWidth;
    const badgeWrapHeight = badgesWillWrap ? 24 : 0; // Extra height if badges wrap
    
    const hasAssignedUsers = task.assignedTo && task.assignedTo.length > 0;
    const hasDescription = task.description && task.estimatedTime && task.estimatedTime >= 60;
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    
    if (minutes < 45) {
      // Compact sizing for shorter tasks: base height + minimal scaling
      let baseHeight = isMobile ? TASK_CALCULATION_CONSTANTS.height.baseShort.mobile : TASK_CALCULATION_CONSTANTS.height.baseShort.desktop;
      
      // Add height for badge wrapping
      baseHeight += badgeWrapHeight;
      
      // Check if any additional components are active
      const hasActiveComponents = hasAssignedUsers || hasSubtasks;
      
      // Add extra height for assigned users (only if present)
      if (hasAssignedUsers) {
        baseHeight += 24;
      }
      
      // Add extra height for subtasks (only if present)
      if (hasSubtasks) {
        const subtaskHeight = Math.min(task.subtasks.length, 3) * TASK_CALCULATION_CONSTANTS.description.lineHeight;
        baseHeight += subtaskHeight;
      }
      
      // Duration-based scaling
      const scalingFactor = 0.8; // Reduced scaling for shorter tasks
      const durationBasedHeight = baseHeight + (minutes - 15) * scalingFactor;
      
      // If no active components, ensure minimum height accounts for time display and bottom padding
      const minRequiredHeight = hasActiveComponents 
        ? baseHeight 
        : baseHeight + 8; // Add bottom padding for time display if no components
      
      return Math.max(durationBasedHeight, minRequiredHeight);
    } else if (minutes >= 60) {
      // Enhanced sizing for tasks 1 hour or more: more space for descriptions
      let baseHeight = TASK_CALCULATION_CONSTANTS.height.baseLong;
      
      // Add height for badge wrapping
      baseHeight += badgeWrapHeight;
      
      // Add extra height for description (full height, no line clamp)
      // Description is always shown for tasks >= 60 minutes if it exists
      if (hasDescription) {
        // Estimate description height based on content length
        const estimatedLines = task.description ? Math.ceil(task.description.length / TASK_CALCULATION_CONSTANTS.description.charsPerLine) : 4;
        const lineHeight = TASK_CALCULATION_CONSTANTS.description.lineHeight;
        const descriptionHeight = Math.max(estimatedLines * lineHeight, TASK_CALCULATION_CONSTANTS.description.minHeight) + TASK_CALCULATION_CONSTANTS.description.padding;
        baseHeight += descriptionHeight;
      } else {
        // If no description, still need space for the time duration display
        // Add minimal padding for time display area
        baseHeight += 8;
      }
      
      // Add extra height for assigned users (only if present)
      if (hasAssignedUsers) {
        baseHeight += 24;
      }
      
      // Add extra height for subtasks (only if present)
      if (hasSubtasks) {
        const subtaskHeight = Math.min(task.subtasks.length, 3) * TASK_CALCULATION_CONSTANTS.description.lineHeight;
        baseHeight += subtaskHeight;
      }
      
      // Duration-based scaling
      const scalingFactor = 2.0; // More generous scaling for longer tasks
      const durationBasedHeight = baseHeight + (minutes - 60) * scalingFactor;
      
      // Ensure minimum height accounts for description bottom padding
      const minRequiredHeight = hasDescription 
        ? baseHeight 
        : baseHeight + 12; // Add bottom padding if no description
      
      return Math.max(durationBasedHeight, minRequiredHeight);
    } else {
      // Standard sizing for medium tasks (45-59 mins)
      // No description shown for these tasks, so height is based on duration + active components
      let minHeight = 80;
      
      // Add height for badge wrapping
      minHeight += badgeWrapHeight;
      
      // Add extra height for assigned users (only if present)
      if (hasAssignedUsers) {
        minHeight += 24;
      }
      
      // Add extra height for subtasks (only if present)
      if (hasSubtasks) {
        const subtaskHeight = Math.min(task.subtasks.length, 3) * 16;
        minHeight += subtaskHeight;
      }
      
      // Duration-based height calculation
      const durationBasedHeight = minutes * 1.5;
      
      // Ensure minimum height accounts for time display and bottom padding
      const minRequiredHeight = minHeight + 8; // Bottom padding for time display
      
      return Math.max(durationBasedHeight, minRequiredHeight);
    }
  };

  return (
    <>
      <Confetti 
        trigger={showConfetti} 
        onComplete={() => {
          // Use timeout to ensure state update happens after animation cleanup
          if (confettiTimeoutRef.current) {
            clearTimeout(confettiTimeoutRef.current);
          }
          confettiTimeoutRef.current = setTimeout(() => {
            setShowConfetti(false);
            confettiTimeoutRef.current = null;
          }, 100);
        }} 
      />
      <div
        ref={setNodeRef}
        data-droppable-id="today-agenda"
        className={cn(
          `h-full flex flex-col transition-all duration-200 ${UI_GRADIENT_COLORS.timeline.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`,
          isOver &&
            "bg-primary/10 border-2 border-primary/30 border-dashed",
        )}
        data-tour="today-panel"
      >
      {/* Header */}
      {!hideHeader && (
        <>
          <AppHeader
            title="Today Agenda"
            panelOpen={true}
            isSidePanelHeader={true}
            description={
              isOver
                ? "Drop to add to today"
                : today.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
            }
            hideDesktopLogo
          />
          {/* Spacer for fixed header on mobile */}
          <div className="md:hidden h-[64px]" />
        </>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-hidden w-full">
        <ScrollArea 
          className="h-full w-full" 
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' } as React.CSSProperties}
        >
          <div 
            ref={timelineContainerRef}
            className="px-5 pt-[27.6px] pb-24 sm:pb-safe md:pt-4 md:pb-4 w-full relative" 
            style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Calendar className="w-6 h-6 text-primary/40" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {TODAY_AGENDA_TEXT.emptyState.noTasks}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTask}
                  className="!rounded-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 w-full relative" style={{ overflow: 'visible' }}>
                  {todayTasks.map((task, index) => (
                    <DraggableTodayAgendaTask
                      key={task.id}
                      task={task}
                      index={index}
                      totalTasks={todayTasks.length}
                      onClick={handleTaskClick}
                      getTaskHeight={getTaskHeight}
                      getTaskTime={getTaskTime}
                      getPriorityColor={getPriorityColor}
                      isNextUp={task.id === nextUpTaskId}
                      onComplete={() => {
                        // Clear any existing timeout
                        if (confettiTimeoutRef.current) {
                          clearTimeout(confettiTimeoutRef.current);
                        }
                        // Only trigger confetti if it's not already showing
                        if (!showConfetti) {
                          setShowConfetti(true);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Next Up Task Details - Shows notes for the next uncompleted task */}
                {(() => {
                  const nextUpTask = todayTasks.find(
                    (task) => task.id === nextUpTaskId,
                  );

                  if (!nextUpTask || !nextUpTask.notes)
                    return null;

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6 pt-4 border-t border-primary/20"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <StickyNote className="w-4 h-4 text-primary" />
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                          Next Up Details
                        </h3>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-lg bg-gradient-to-r cursor-pointer transition-all"
                        style={{
                          background: `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`,
                          borderLeftColor: UI_GRADIENT_COLORS.status.success.from,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}20, ${UI_GRADIENT_COLORS.status.success.to}15, transparent)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`;
                        }}
                        onClick={() =>
                          handleTaskClick(nextUpTask)
                        }
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                              getPriorityColor(
                                nextUpTask.priority,
                              ),
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-xs line-clamp-1 flex-1 font-semibold">
                                {nextUpTask.title}
                              </h4>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {nextUpTask.scheduledDate && (
                                  <span className="text-[9px] text-muted-foreground">
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span 
                                  className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider dark:text-green-900"
                                  style={{
                                    backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                    color: '#065f46', // green-800
                                  }}
                                >
                                  {TODAY_AGENDA_TEXT.nextUp}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <StickyNote className="w-3 h-3 text-primary/60 mt-0.5 flex-shrink-0" />
                              <div 
                                className={cn(
                                  "text-xs text-muted-foreground leading-relaxed flex-1",
                                  // Rich text formatting styles - only apply if HTML is present
                                  hasHTMLTags(nextUpTask.notes) && "[&_strong]:font-bold [&_b]:font-bold",
                                  hasHTMLTags(nextUpTask.notes) && "[&_em]:italic [&_i]:italic",
                                  hasHTMLTags(nextUpTask.notes) && "[&_u]:underline",
                                  hasHTMLTags(nextUpTask.notes) && "[&_s]:line-through [&_strike]:line-through",
                                  hasHTMLTags(nextUpTask.notes) && "[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_mark]:rounded",
                                  hasHTMLTags(nextUpTask.notes) && "[&_ul]:list-disc [&_ul]:ml-3 [&_ul]:my-0.5 [&_ul]:space-y-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_ol]:list-decimal [&_ol]:ml-3 [&_ol]:my-0.5 [&_ol]:space-y-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_li]:ml-1 [&_li]:leading-relaxed",
                                  hasHTMLTags(nextUpTask.notes) && "[&_p]:my-1 [&_p]:leading-relaxed [&_p]:block [&_p:empty]:hidden",
                                  hasHTMLTags(nextUpTask.notes) && "[&_p+p]:mt-2",
                                  hasHTMLTags(nextUpTask.notes) && "[&_code]:bg-gray-100 [&_code]:dark:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:inline-block"
                                )}
                                {...(hasHTMLTags(nextUpTask.notes) 
                                  ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(nextUpTask.notes) } }
                                  : { children: nextUpTask.notes }
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })()}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        initialDate={today.toISOString()}
      />
      </div>
    </>
  );
}
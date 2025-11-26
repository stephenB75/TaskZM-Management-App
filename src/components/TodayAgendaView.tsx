import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { useDroppable } from "@dnd-kit/core";
import { Calendar, Plus, StickyNote } from "lucide-react";
import { useTasks } from "../contexts/TaskContext";
import { useTheme } from "../contexts/ThemeContext";
import { useIsMobile } from "./ui/use-mobile";
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
import { TASK_CARD_HEIGHT_CONFIG, TASK_CARD_CALCULATIONS } from "../lib/task-card-constants";
import { TODAY_AGENDA_TEXT } from "../lib/today-agenda-constants";
import { HEADER_HEIGHT } from "../lib/layout-constants";

interface TodayAgendaViewProps {
  hideHeader?: boolean;
}

export function TodayAgendaView({
  hideHeader = false,
}: TodayAgendaViewProps = {}) {
  const { tasks, updateTask } = useTasks();
  const { actualTheme } = useTheme();
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    null,
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  // Current time for display - updates every minute to show current time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  // Update current time every minute for display (position stays static)
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };
    
    // Update immediately
    updateTime();
    
    // Update every minute
    const interval = setInterval(updateTime, 60000);
    
    return () => clearInterval(interval);
  }, []);


  // Make this view a droppable zone for tasks from Kanban (disabled on mobile)
  const { setNodeRef, isOver } = useDroppable({
    id: "today-agenda",
    disabled: isMobile, // Disable drop on mobile - only allow vertical scroll
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

  // Sort incomplete tasks by time - use useMemo to prevent recreation on every render
  // This prevents infinite loops in useEffect dependencies
  const todayTasks = useMemo(() => {
    return [...incompleteTasks].sort((a, b) => {
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
  }, [incompleteTasks]);

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


  // Find the next uncompleted task after current time (next up)
  const nextUpTaskId = (() => {
    if (todayTasks.length === 0) return null;
    
    const now = new Date();
    const currentTimeMs = now.getTime();
    
    // Find the first task that starts at or after current time
    for (const task of todayTasks) {
      if (!task.scheduledDate) continue;
      const taskTime = new Date(task.scheduledDate).getTime();
      if (taskTime >= currentTimeMs) {
        return task.id;
      }
    }
    
    // If no task is after current time, return the first task
    return todayTasks[0]?.id || null;
  })();

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
  const getTaskHeight = useCallback((task: Task) => {
    const minutes = task.estimatedTime || TASK_CARD_HEIGHT_CONFIG.defaultDuration;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    
    // Determine task category
    const isShortTask = minutes < 45;
    const isMediumTask = minutes >= 45 && minutes < 60;
    const isLongTask = minutes >= 60;
    
    // Count badges that will be displayed in the top row
    const hasTime = !!(task.scheduledDate || task.dueDate);
    const hasPriority = true; // Always shown
    const hasTag = task.tags && task.tags.length > 0;
    const hasDuration = !!task.estimatedTime;
    
    // Estimate if badges will wrap to second line
    const badgeCount = [hasTime, hasPriority, hasTag, hasDuration].filter(Boolean).length;
    const estimatedBadgeWidth = badgeCount * TASK_CARD_CALCULATIONS.badgeWidths.average;
    const availableWidth = isMobile ? 240 : 432;
    const badgesWillWrap = estimatedBadgeWidth > availableWidth;
    const badgeWrapHeight = badgesWillWrap ? TASK_CARD_HEIGHT_CONFIG.componentHeights.badgeWrap : 0;
    
    const hasAssignedUsers = task.assignedTo && task.assignedTo.length > 0;
    const hasDescription = task.description && task.estimatedTime && task.estimatedTime >= 60;
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    
    // Use standard heights from config as base, then scale based on duration
    // This ensures visual time-blocking where height represents duration proportionally
    let baseHeight: number;
    
    if (isShortTask) {
      // Short tasks (< 45 mins): Scale from 80px to 100px
      const minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.base; // 80px
      const maxHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.transitionToMedium; // 100px
      // Linear scaling: minHeight + (minutes / 45) * (maxHeight - minHeight)
      baseHeight = minHeight + (minutes / TASK_CARD_HEIGHT_CONFIG.thresholds.short) * (maxHeight - minHeight);
    } else if (isMediumTask) {
      // Medium tasks (45-59 mins): Scale from 120px to 170px
      const minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.medium.transitionFromShort; // 120px
      const maxHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.medium.transitionToLong; // 170px
      // Linear scaling: minHeight + ((minutes - 45) / 15) * (maxHeight - minHeight)
      const durationRange = TASK_CARD_HEIGHT_CONFIG.thresholds.long - TASK_CARD_HEIGHT_CONFIG.thresholds.short;
      baseHeight = minHeight + ((minutes - TASK_CARD_HEIGHT_CONFIG.thresholds.short) / durationRange) * (maxHeight - minHeight);
    } else {
      // Long tasks (>= 60 mins): Scale from 200px to 500px, then auto-adjust for components
      const longHeights = TASK_CARD_HEIGHT_CONFIG.baseHeights.long;
      if (minutes <= TASK_CARD_HEIGHT_CONFIG.thresholds.long) {
        baseHeight = longHeights.at60mins; // 200px at 60 mins
      } else if (minutes <= 90) {
        // Interpolate between 60 mins (200px) and 90 mins (275px)
        baseHeight = longHeights.at60mins + ((minutes - TASK_CARD_HEIGHT_CONFIG.thresholds.long) / 30) * (longHeights.at90mins - longHeights.at60mins);
      } else if (minutes <= 120) {
        // Interpolate between 90 mins (275px) and 120 mins (350px)
        baseHeight = longHeights.at90mins + ((minutes - 90) / 30) * (longHeights.at120mins - longHeights.at90mins);
      } else if (minutes <= 150) {
        // Interpolate between 120 mins (350px) and 150 mins (425px)
        baseHeight = longHeights.at120mins + ((minutes - 120) / 30) * (longHeights.at150mins - longHeights.at120mins);
      } else if (minutes <= 180) {
        // Interpolate between 150 mins (425px) and 180 mins (500px)
        baseHeight = longHeights.at150mins + ((minutes - 150) / 30) * (longHeights.at180mins - longHeights.at150mins);
      } else {
        // Beyond 180 mins, cap at 500px base
        baseHeight = longHeights.beyond180mins;
      }
    }
    
    // Add height for badge wrapping
    baseHeight += badgeWrapHeight;
    
    // Add extra height for description (only for long tasks)
    if (hasDescription) {
      const estimatedLines = task.description ? Math.ceil(task.description.length / TASK_CARD_CALCULATIONS.description.charsPerLine) : 4;
      const lineHeight = TASK_CARD_CALCULATIONS.description.lineHeight;
      const descriptionBottomPadding = (hasAssignedUsers && !hasSubtasks) 
        ? TASK_CARD_HEIGHT_CONFIG.componentHeights.description.bottomPadding.noGap
        : TASK_CARD_HEIGHT_CONFIG.componentHeights.description.bottomPadding.standard;
      const descriptionHeight = Math.max(estimatedLines * lineHeight, TASK_CARD_CALCULATIONS.description.minHeight) + descriptionBottomPadding;
      baseHeight += descriptionHeight;
    }
    
    // Add extra height for assigned users (for medium and long tasks, short tasks use base)
    if (hasAssignedUsers && !isShortTask) {
      const assignedUsersBaseHeight = TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.base;
      const assignedUsersSpacing = (hasDescription && !hasSubtasks) 
        ? TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.spacing.reduced
        : TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.spacing.standard;
      baseHeight += assignedUsersBaseHeight + assignedUsersSpacing;
    }
    
    // Add extra height for subtasks
    if (hasSubtasks) {
      const subtaskCount = Math.min(task.subtasks.length, 3);
      const subtaskItemHeight = TASK_CARD_HEIGHT_CONFIG.componentHeights.subtask.itemHeight;
      const subtaskSpacing = isMobile 
        ? TASK_CARD_HEIGHT_CONFIG.componentHeights.subtask.spacing.mobile 
        : TASK_CARD_HEIGHT_CONFIG.componentHeights.subtask.spacing.desktop;
      const subtaskHeight = subtaskCount * subtaskItemHeight + 
        (subtaskCount > 1 ? (subtaskCount - 1) * subtaskSpacing : 0);
      const subtaskTopSpacing = hasDescription ? TASK_CARD_HEIGHT_CONFIG.componentHeights.subtask.topSpacing : 0;
      baseHeight += subtaskHeight + subtaskTopSpacing;
    }
    
    // Ensure height is within bounds
    const minHeight = isShortTask 
      ? TASK_CARD_HEIGHT_CONFIG.baseHeights.short.base // 80px
      : isMediumTask
      ? TASK_CARD_HEIGHT_CONFIG.baseHeights.medium.min // 120px
      : TASK_CARD_HEIGHT_CONFIG.baseHeights.long.minHeight; // 200px
    
    // Set max height based on task type
    // Short tasks: max 100px, Medium tasks: max 170px, Long tasks: max 550px (with auto-adjustment)
    const effectiveMaxHeight = isShortTask
      ? TASK_CARD_HEIGHT_CONFIG.baseHeights.short.transitionToMedium // 100px max for short
      : isMediumTask
      ? TASK_CARD_HEIGHT_CONFIG.baseHeights.medium.transitionToLong // 170px max for medium
      : TASK_CARD_HEIGHT_CONFIG.maxHeight; // 550px max for long (with auto-adjustment)
    
    return Math.max(Math.min(baseHeight, effectiveMaxHeight), minHeight);
  }, []); // Empty deps - function is pure, only depends on task parameter


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
          `h-full flex flex-col transition-all duration-300 ${UI_GRADIENT_COLORS.timeline.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`,
          isOver &&
            "bg-primary/20 border-4 border-primary/70 border-dashed shadow-xl shadow-primary/30 ring-4 ring-primary/40",
          !isMobile && "min-h-[400px]", // Ensure drop zone is always accessible
        )}
        style={{
          position: 'relative',
          zIndex: isOver ? 100 : 1, // Ensure drop zone is above other elements when dragging over
        }}
        data-tour="today-panel"
      >
      {/* Header */}
      {!hideHeader && (
        <>
          <div 
            className="relative"
            style={{ 
              minHeight: `${HEADER_HEIGHT}px`,
            }}
          >
          <AppHeader
            title="Today Agenda"
            panelOpen={true}
            isSidePanelHeader={true}
            description={
              isOver
                ? "✨ Drop task here to schedule for today"
                : today.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
            }
            hideDesktopLogo
          />
            {/* Current Time Indicator - Desktop only (bottom right corner of header) */}
            <div 
              className="hidden md:block absolute bottom-2 right-6 z-50 pointer-events-none"
            >
              <span className="text-xs font-medium text-primary bg-background/90 dark:bg-card/90 px-2 py-1 rounded shadow-sm border border-primary/20 backdrop-blur-sm">
                {currentTime.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
          </div>
          {/* Spacer for fixed header on mobile */}
        </>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-hidden w-full relative">
        
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
              <div className={cn(
                "flex flex-col items-center justify-center py-12 text-center min-h-[300px] pointer-events-none transition-all duration-300",
                isOver && "scale-105"
              )}>
                <motion.div 
                  className={cn(
                    "w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 pointer-events-none transition-all duration-300",
                    isOver && "bg-primary/20 scale-110 ring-4 ring-primary/30"
                  )}
                  animate={isOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Calendar className={cn(
                    "w-6 h-6 text-primary/40 transition-colors duration-300",
                    isOver && "text-primary/60"
                  )} />
                </motion.div>
                <p className={cn(
                  "text-sm text-muted-foreground mb-3 pointer-events-none transition-colors duration-300",
                  isOver && "text-primary/80 font-medium"
                )}>
                  {isOver ? "Drop task here to schedule for today" : TODAY_AGENDA_TEXT.emptyState.noTasks}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTask}
                  className={cn(
                    "!rounded-full pointer-events-auto transition-all duration-300",
                    isOver && "ring-2 ring-primary/50 scale-105"
                  )}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 w-full relative z-10" style={{ overflow: 'visible' }}>
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
                                  className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                                  style={{
                                    backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                    color: actualTheme === 'dark' ? '#10b981' : '#065f46', // green-500 for dark, green-800 for light
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
                                  hasHTMLTags(nextUpTask.notes) && "[&_code]:bg-muted [&_code]:dark:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:inline-block"
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
import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { Circle, Timer, Clock, Repeat } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn, getInitials, formatTimeAMPM, sanitizeHTML, hasHTMLTags } from "../lib/utils";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { usePomodoro } from "../contexts/PomodoroContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { PomodoroTimer } from "./PomodoroTimer";
import { useIsMobile } from "./ui/use-mobile";
import { useSubscription } from "../contexts/SubscriptionContext";
import type { Task } from "../types";
import {
  TASK_CARD_PRIORITY_COLORS,
  TASK_CARD_TAG_COLORS,
  TASK_CARD_THEME_COLORS,
  TASK_CARD_FONT_SIZES,
  TASK_CARD_ICON_SIZES,
  TASK_CARD_BADGE_SIZES,
  TASK_CARD_SPACING,
  TASK_CARD_TEXT,
  TASK_CARD_LINE_CLAMP,
} from "../lib/task-card-constants";
import { Z_INDEX } from "../lib/layout-constants";

interface DraggableTodayAgendaTaskProps {
  task: Task;
  index: number;
  totalTasks: number;
  onClick: (task: Task) => void;
  getTaskHeight: (task: Task) => number;
  getTaskTime: (task: Task) => string;
  getPriorityColor: (priority: Task["priority"]) => string;
  isNextUp?: boolean;
  onComplete?: () => void;
}

export function DraggableTodayAgendaTask({
  task,
  index,
  totalTasks,
  onClick,
  getTaskHeight,
  getTaskTime,
  getPriorityColor,
  isNextUp = false,
  onComplete,
}: DraggableTodayAgendaTaskProps) {
  const { updateTask } = useTasks();
  const { getTeamMember } = useTeam();
  const { hasFeature } = useSubscription();
  const { getTimerState } = usePomodoro();
  const { actualTheme } = useTheme();
  const isMobile = useIsMobile();
  const timerState = getTimerState(task.id);
  const isDark = actualTheme === 'dark';
  
  // Force re-render when task properties change to recalculate height
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  
  // Memoize key values that affect height to create stable dependencies
  const assignedToKey = React.useMemo(() => 
    task.assignedTo ? `${task.assignedTo.length}-${task.assignedTo.join(',')}` : 'none',
    [task.assignedTo]
  );
  const subtasksKey = React.useMemo(() => 
    task.subtasks ? `${task.subtasks.length}-${task.subtasks.map(s => s.id).join(',')}` : 'none',
    [task.subtasks]
  );
  
  React.useEffect(() => {
    // Force re-render when task properties that affect height change
    // Using stable keys to track array changes properly
    forceUpdate();
  }, [
    // Timer state changes (affects pomodoro display)
    timerState.isRunning,
    // Task properties that affect height - using stable keys
    assignedToKey,
    subtasksKey,
    task.actualTime,
    task.description,
    task.estimatedTime,
    // Properties that affect badge display
    task.scheduledDate,
    task.dueDate,
    task.tags?.length,
  ]);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
    disabled: isMobile, // Disable drag on mobile
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    touchAction: (isMobile ? "auto" : "none") as const, // Allow normal touch on mobile
  };

  const getPriorityLineColor = (priority: Task["priority"]) => {
    return TASK_CARD_PRIORITY_COLORS[priority]?.line || TASK_CARD_PRIORITY_COLORS.default.line;
  };

  const getPriorityBadgeColor = (priority: Task["priority"]) => {
    return TASK_CARD_PRIORITY_COLORS[priority]?.badge || TASK_CARD_PRIORITY_COLORS.default.badge;
  };

  // Format duration display
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  // Format timer display (actualTime tracked)
  const formatTimer = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}`;
    }
    return `${mins}m`;
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasDone = task.status === "done";
    const willBeDone = !wasDone;
    
    updateTask(task.id, {
      status: willBeDone ? "done" : "todo",
      completedAt: willBeDone ? new Date().toISOString() : null,
    });

    // Show confetti when marking as complete
    if (willBeDone && onComplete) {
      onComplete();
    }
  };

  const handlePomodoroTimeUpdate = async (minutes: number) => {
    try {
      await updateTask(task.id, {
        actualTime: minutes,
      });
    } catch (error) {
      console.error("Failed to update task time:", error);
    }
  };

  // Calculate positions for Next Up line to align with headline
  // Structure: Badge row (20px badge + 4px margin) -> Headline row -> Timeline Marker
  //   -> Time label (~16px) -> Time label margin (4px mb-1) -> Dot aligned with headline
  // Headline position from top: badge (20px) + badge margin (4px) + row gap (6px space-y-1.5) = 30px
  // Dot should align with headline center, which is approximately at 30px + headline line-height/2
  const badgeHeight = 20; // Badge: text-[10px] with py-0.5
  const badgeMargin = 4; // mb-1 = 4px
  const rowGap = isMobile ? 2 : 6; // gap between badge row and headline row (reduced on mobile: -mt-0.5 = -2px from space-y-1 = 2px total)
  const headlineStartPosition = badgeHeight + badgeMargin + rowGap; // ~26px on mobile, ~30px on desktop
  const headlineLineHeight = isMobile ? 20 : 24; // text-sm/text-base line-height
  const headlineCenterPosition = headlineStartPosition + (headlineLineHeight / 2); // Center of headline (~40-42px)
  const timeLabelTextHeight = 16; // text-xs height
  const timeLabelMargin = 4; // mb-1 = 4px
  const dotCenterOffset = headlineCenterPosition - timeLabelTextHeight - timeLabelMargin; // Position dot to align with headline center
  const taskCardHeight = getTaskHeight(task) * 1.247;
  const taskCardBottom = badgeHeight + badgeMargin + taskCardHeight; // Bottom of task card
  const lineHeight = taskCardBottom - headlineCenterPosition; // Line from headline center to bottom of task card

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 relative" style={{ overflow: 'visible' }}>
      {/* Next Up Badge - Above the task card */}
      {isNextUp && (
        <div className="flex gap-3 w-full min-w-0 relative mb-1">
          <div className="w-16 flex-shrink-0" />
          <span 
            className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-primary text-primary-foreground self-start relative"
            style={{ zIndex: Z_INDEX.BADGE }}
          >
            NEXT UP
          </span>
        </div>
      )}

      {/* Task Row */}
      <motion.div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...(isMobile ? {} : listeners)} // Only apply drag listeners on desktop
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: isDragging ? 0.5 : 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2, delay: index * 0.05 }}
        className={cn(
          "flex gap-3 group w-full min-w-0 relative transition-all duration-200",
          !isMobile && isDragging ? "cursor-grabbing opacity-40 scale-95" : "",
          !isMobile && !isDragging ? "cursor-grab hover:scale-[1.01]" : "",
        )}
        data-task-id={task.id}
      >
        {/* Timeline Marker */}
        <div
          className="flex flex-col items-center flex-shrink-0 w-16 relative"
          style={{ 
            height: `${getTaskHeight(task) * 1.247}px`, // Match task card height
            overflow: 'visible' 
          }}
        >
          <span className="text-xs text-muted-foreground dark:text-gray-300 mb-1 text-center relative z-10">
            {getTaskTime(task)}
          </span>
          {/* Dot - positioned at headline center, aligned with the line */}
          <div
            className={cn(
              "w-2 h-2 rounded-full flex-shrink-0 absolute left-1/2 -translate-x-1/2 z-10",
              getPriorityColor(task.priority),
            )}
            style={{
              // Position dot at headline center (same position as line start)
              top: `${headlineCenterPosition}px`,
              // Center the dot on the line (accounting for dot's own height)
              transform: 'translate(-50%, -50%)',
            }}
          />
          {/* Vertical line - starts at headline center (aligned with dot center) and extends to bottom of task card, colored by priority */}
          {index < totalTasks - 1 && (
            <div 
              className="absolute left-1/2 -translate-x-1/2 w-[2px]"
              style={{ 
                zIndex: Z_INDEX.TIMELINE_LINE,
                // Line starts at headline center position (same as dot center)
                top: `${headlineCenterPosition}px`, // Headline center position (dot center)
                height: `${(getTaskHeight(task) * 1.247) - headlineCenterPosition}px`, // From headline center to bottom
                minHeight: '8px', // Minimum visible line
                backgroundColor: isNextUp 
                  ? `${getPriorityLineColor(task.priority)}CC` // 80% opacity for Next Up
                  : getPriorityLineColor(task.priority), // Full color for regular tasks
              }}
            />
          )}
        </div>

        {/* Task Content - Match Kanban Week View */}
        <div className={cn("flex gap-2 flex-1 min-w-0", isDragging && "max-w-[336px]")}>
          {/* Compact Card - Match Kanban styling (priority line removed for timeline view) */}
          <div
            className={cn(
              "rounded-lg relative flex-1 overflow-hidden box-border",
              isDragging && "scale-90 origin-left",
              // Responsive padding: smaller on mobile, comfortable on desktop
              "px-2 py-1.5 space-y-1 md:px-3 md:py-2.5 md:space-y-1.5",
              // Background: solid on mobile, semi-transparent on desktop - match task card backgrounds
              isMobile ? "bg-white dark:bg-[#3E3E52]" : "bg-white/60 dark:bg-[#3E3E52]/80 backdrop-blur-sm",
              // Responsive borders: thinner on mobile, standard on desktop - dark mode variants
              "border-b border-r border-gray-300/80 dark:border-gray-600/50 md:border-gray-300/90 dark:md:border-gray-600/60",
              // Shadows: better blending on mobile
              isMobile 
                ? "shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.12)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.4)]" 
                : "shadow-lg dark:shadow-xl",
              "hover:bg-white/80 dark:hover:bg-[#4A4A5E] hover:shadow-xl dark:hover:shadow-2xl hover:border-gray-400/90 dark:hover:border-gray-500/70 transition-all duration-200",
              task.status === "done" && "opacity-60",
              isNextUp && "ring-2 ring-primary/20",
              // Bottom padding: auto-adjusts based on content (pomodoro timer, assigned users)
              // Base bottom padding for all tasks
              !isMobile && "md:pb-8",
              isMobile && !((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && "pb-6",
              // Extra bottom padding on mobile when pomodoro/assigned users present to fit components
              isMobile && ((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && "pb-8",
              // Compact padding for shorter tasks (< 45 mins) - auto-adjusts when pomodoro/assigned users are present
              // Only applies to tasks < 45 mins, but considers pomodoro timer and assigned users for better fit
              (task.estimatedTime && task.estimatedTime < 45) && !isMobile && "md:py-2 md:space-y-1",
              // On mobile: adjust padding based on components to ensure all elements fit
              (task.estimatedTime && task.estimatedTime < 45) && isMobile && 
                ((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0))
                ? "py-1 space-y-1" // More space when components present
                : "py-1.5 space-y-1", // Standard compact with adequate spacing
              // Enhanced padding for tasks 1 hour or more to accommodate descriptions
              task.estimatedTime && task.estimatedTime >= 60 && !isMobile && "md:py-3.5 md:pb-12 md:space-y-2.5",
              task.estimatedTime && task.estimatedTime >= 60 && isMobile && "py-2.5 pb-10 space-y-2",
            )}
            style={{
              height: `${getTaskHeight(task) * 1.247}px`,
              boxSizing: 'border-box', // Include padding in height calculation
            }}
            onClick={(e) => {
              if (!isDragging) {
                e.stopPropagation();
                onClick(task);
              }
            }}
          >
            {/* Row 1: Priority Badge + Tag + Duration + Tracking Badge (mobile) (left) + Checkbox (right) */}
            <div className={cn("flex items-center justify-between", isMobile ? "gap-1" : "gap-2")}>
              <div className={cn("flex items-center flex-1 min-w-0", isMobile ? "gap-1" : "gap-1.5")}>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md border capitalize flex-shrink-0",
                    getPriorityBadgeColor(task.priority),
                    isMobile ? TASK_CARD_BADGE_SIZES.priority.mobile : TASK_CARD_BADGE_SIZES.priority.desktop,
                  )}
                >
                  {task.priority}
                </Badge>

                {task.tags && task.tags.length > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "border-0 flex-shrink-0",
                    isMobile ? TASK_CARD_BADGE_SIZES.tag.mobile : TASK_CARD_BADGE_SIZES.tag.desktop,
                  )}
                  style={{
                    backgroundColor: isDark ? TASK_CARD_TAG_COLORS.background.dark : TASK_CARD_TAG_COLORS.background.light,
                    color: isDark ? TASK_CARD_TAG_COLORS.text.dark : TASK_CARD_TAG_COLORS.text.light,
                  }}
                >
                  {task.tags[0]}
                </Badge>
                )}

                {task.estimatedTime && (
                  <span className={cn("text-gray-500 dark:text-gray-300 font-medium flex-shrink-0", isMobile ? "text-[10px]" : "text-[11px]")}>
                    {formatDuration(task.estimatedTime)}
                  </span>
                )}

                {/* Tracking Badge - Shown at top with other badges (mobile and desktop for tasks < 45 mins) */}
                {task.estimatedTime && task.estimatedTime < 45 && hasFeature("pomodoroTimer") && timerState.isRunning && (
                  <div className="flex items-center animate-pulse flex-shrink-0">
                    <div 
                      className={cn(
                        "flex items-center rounded-full text-white",
                        isMobile ? TASK_CARD_BADGE_SIZES.tracking.mobile : TASK_CARD_BADGE_SIZES.tracking.desktop
                      )}
                      style={{
                        background: `linear-gradient(to right, ${TASK_CARD_THEME_COLORS.gradient.from}, ${TASK_CARD_THEME_COLORS.gradient.to})`,
                      }}
                    >
                      <Timer className={cn("animate-spin", isMobile ? TASK_CARD_ICON_SIZES.timer.mobile : TASK_CARD_ICON_SIZES.timer.desktop)} />
                      <span className="font-semibold">{TASK_CARD_TEXT.tracking}</span>
                    </div>
                  </div>
                )}

                {/* Tracked Time (if exists and not running) - shown at top (mobile and desktop for tasks < 45 mins) */}
                {task.estimatedTime && task.estimatedTime < 45 && task.actualTime && task.actualTime > 0 && !timerState.isRunning && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Timer 
                      className={cn(isMobile ? TASK_CARD_ICON_SIZES.timer.mobile : TASK_CARD_ICON_SIZES.timer.desktop)} 
                      style={{ color: TASK_CARD_THEME_COLORS.primary }}
                    />
                    <span 
                      className={cn("font-medium", isMobile ? TASK_CARD_FONT_SIZES.trackedTime.mobile : TASK_CARD_FONT_SIZES.trackedTime.desktop)}
                      style={{ color: TASK_CARD_THEME_COLORS.primary }}
                    >
                      {formatTimer(task.actualTime)}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={handleToggleComplete}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn("flex-shrink-0 hover:opacity-80 transition-opacity", isMobile ? "w-3.5 h-3.5" : "w-4 h-4")}
              >
                <Circle
                  className={cn(
                    "transition-colors",
                    isMobile ? "w-3.5 h-3.5" : "w-4 h-4",
                    task.status === "done"
                      ? "text-primary fill-primary"
                      : "text-gray-300 dark:text-gray-400 hover:text-gray-400 dark:hover:text-gray-300",
                  )}
                />
              </button>
            </div>

            {/* Row 2: H3 Title (Bold) */}
            <div className={cn("flex items-start mt-1", isMobile ? "gap-1 px-1 mb-1" : "gap-1.5 px-1 mb-1")}>
              {task.recurrence && task.recurrence.type !== "none" && (
                <Repeat className={cn("text-primary flex-shrink-0 mt-0.5", isMobile ? "w-3 h-3" : "w-3.5 h-3.5")} />
              )}
              <h3
                className={cn(
                  "text-foreground dark:text-gray-100 leading-tight line-clamp-2 flex-1",
                  task.status === "done" && "line-through text-gray-400 dark:text-gray-500",
                  isMobile ? "text-sm" : "text-base",
                )}
              >
                {task.title}
              </h3>
            </div>

            {/* Row 3: Subhead (Description) - Only show if task is 1 hour or more */}
            {task.description && task.estimatedTime && task.estimatedTime >= 60 && (
              <div 
                className={cn(
                  `text-gray-500 dark:text-gray-300 leading-snug break-words ${TASK_CARD_FONT_SIZES.description} ${TASK_CARD_SPACING.description}`,
                  // Rich text formatting styles - only apply if HTML is present
                  // Note: Rich text editor font size changes will override this base size via inline styles
                  hasHTMLTags(task.description) && "[&_strong]:font-bold [&_b]:font-bold",
                  hasHTMLTags(task.description) && "[&_em]:italic [&_i]:italic",
                  hasHTMLTags(task.description) && "[&_u]:underline",
                  hasHTMLTags(task.description) && "[&_s]:line-through [&_strike]:line-through",
                  hasHTMLTags(task.description) && "[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_mark]:rounded",
                  hasHTMLTags(task.description) && "[&_ul]:list-disc [&_ul]:ml-3 [&_ul]:my-0.5",
                  hasHTMLTags(task.description) && "[&_ol]:list-decimal [&_ol]:ml-3 [&_ol]:my-0.5",
                  hasHTMLTags(task.description) && "[&_li]:ml-1",
                  hasHTMLTags(task.description) && "[&_p]:my-0.5 [&_p]:break-words",
                  hasHTMLTags(task.description) && "[&_code]:bg-muted [&_code]:dark:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono"
                )}
                {...(hasHTMLTags(task.description) 
                  ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(task.description) } }
                  : { children: task.description }
                )}
              />
            )}

            {/* Subtasks Display */}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className={cn("pt-1", isMobile ? "space-y-0.5" : "space-y-1")}>
                {task.subtasks.slice(0, 3).map((subtask) => {
                  const handleSubtaskToggle = async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    const updatedSubtasks = task.subtasks.map((st) =>
                      st.id === subtask.id
                        ? { ...st, completed: !st.completed }
                        : st
                    );
                    await updateTask(task.id, { subtasks: updatedSubtasks });
                  };

                  return (
                    <div
                      key={subtask.id}
                      className={cn(
                        "flex items-center cursor-pointer hover:opacity-80 transition-opacity",
                        isMobile ? "gap-1" : "gap-1.5"
                      )}
                      onClick={handleSubtaskToggle}
                    >
                      <div
                        className={cn(
                          "rounded-sm border flex-shrink-0 transition-colors",
                          isMobile ? "w-2 h-2" : "w-2.5 h-2.5",
                          subtask.completed
                            ? "bg-primary border-primary"
                            : "border-gray-300 dark:border-border hover:border-primary/50",
                        )}
                      />
                      <span
                        className={cn(
                          "leading-tight",
                          isMobile ? "text-[9px]" : "text-[10px]",
                          subtask.completed
                            ? "text-gray-400 dark:text-gray-500 line-through"
                            : "text-gray-600 dark:text-gray-200",
                        )}
                      >
                        {subtask.title}
                      </span>
                    </div>
                  );
                })}
                {task.subtasks.length > 3 && (
                  <div className={cn("text-gray-400 dark:text-gray-500", isMobile ? "text-[9px] pl-3" : "text-[10px] pl-4")}>
                    +{task.subtasks.length - 3} more
                  </div>
                )}
              </div>
            )}

            {/* Assignee Display - Positioned in lower left corner */}
            {task.assignedTo && task.assignedTo.length > 0 && (
              <div
                className={cn(
                  "absolute flex items-center flex-wrap",
                  isMobile ? "bottom-1 left-1 gap-1 max-w-[calc(100%-60px)]" : "bottom-2 left-2 gap-2 max-w-[calc(100%-80px)]",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {task.assignedTo.slice(0, 3).map((userId) => {
                  const member = getTeamMember(userId);
                  if (!member) return null;

                  const initials = getInitials(member.name);

                  return (
                    <TooltipProvider key={userId}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn("flex items-center", isMobile ? "gap-0.5" : "gap-1")}>
                            <div className={cn(
                              "rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700 flex items-center justify-center font-semibold",
                              isMobile ? "w-3 h-3 text-[7px]" : "w-4 h-4 text-[8px]",
                            )}>
                              {initials}
                            </div>
                            <span className={cn(
                              "text-gray-600 dark:text-gray-200 font-semibold",
                              isMobile ? "text-[9px]" : "text-[10px]",
                            )}>
                              {member.name}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{member.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-300">
                            {member.email}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
                {task.assignedTo.length > 3 && (
                  <span className={cn("text-gray-500 dark:text-gray-300", isMobile ? "text-[9px]" : "text-[10px]")}>
                    +{task.assignedTo.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Tracking Status - Show when timer is running (only for tasks >= 45 mins, tasks < 45 mins show at top) */}
            {task.estimatedTime && task.estimatedTime >= 45 && hasFeature("pomodoroTimer") && timerState.isRunning && (
              <div className={cn(
                "flex items-center pt-0.5 animate-pulse",
                isMobile ? "gap-0.5" : "gap-1"
              )}>
                <div 
                  className={cn(
                    "flex items-center rounded-full px-1.5 py-0.5 text-white",
                    isMobile ? "gap-0.5 text-[8px]" : "gap-1 text-[10px]"
                  )}
                  style={{
                    background: `linear-gradient(to right, ${TASK_CARD_THEME_COLORS.gradient.from}, ${TASK_CARD_THEME_COLORS.gradient.to})`,
                  }}
                >
                  <Timer className={cn("animate-spin", isMobile ? TASK_CARD_ICON_SIZES.timer.mobile : TASK_CARD_ICON_SIZES.timer.desktop)} />
                  <span className="font-semibold">{TASK_CARD_TEXT.tracking}</span>
                </div>
              </div>
            )}

            {/* Tracked Time (if exists) - only for tasks >= 45 mins, tasks < 45 mins show at top */}
            {task.estimatedTime && task.estimatedTime >= 45 && task.actualTime && task.actualTime > 0 && (
              <div className={cn("flex items-center pt-0.5", "gap-1")}>
                <Timer 
                  className={cn("w-3 h-3")} 
                  style={{ color: TASK_CARD_THEME_COLORS.primary }}
                />
                <span 
                  className={cn("font-medium", TASK_CARD_FONT_SIZES.duration.desktop)}
                  style={{ color: TASK_CARD_THEME_COLORS.primary }}
                >
                  {formatTimer(task.actualTime)} {TASK_CARD_TEXT.tracked}
                </span>
              </div>
            )}

            {/* Pomodoro Timer - Positioned in lower right corner (PRO feature) - only for tasks >= 45 mins, tasks < 45 mins show in inline bottom row */}
            {task.estimatedTime && task.estimatedTime >= 45 && hasFeature("pomodoroTimer") && (
              <div
                className={cn("absolute", isMobile ? "bottom-0 right-1" : "bottom-2 right-2")}
                onClick={(e) => e.stopPropagation()}
              >
                <PomodoroTimer
                  taskId={task.id}
                  taskTitle={task.title}
                  onTimeUpdate={handlePomodoroTimeUpdate}
                  compact={true}
                  initialTime={task.actualTime || 0}
                  estimatedTime={task.estimatedTime || undefined}
                  isMobile={isMobile}
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
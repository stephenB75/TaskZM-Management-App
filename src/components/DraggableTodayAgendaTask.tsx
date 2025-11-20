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
  const isMobile = useIsMobile();
  const timerState = getTimerState(task.id);
  
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
    switch (priority) {
      case "urgent":
        return "#EF4444"; // Red
      case "high":
        return "#F97316"; // Orange
      case "medium":
        return "#3B82F6"; // Blue
      case "low":
        return "#9CA3AF"; // Grey
      default:
        return "#E5E7EB";
    }
  };

  const getPriorityBadgeColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-50 text-red-700 border-red-200";
      case "high":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "medium":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "low":
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
    }
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
          <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-primary text-primary-foreground self-start relative z-[3]">
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
          "flex gap-3 group w-full min-w-0 relative",
          !isMobile && isDragging ? "cursor-grabbing" : "",
          !isMobile && !isDragging ? "cursor-grab" : "",
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
          <span className="text-xs text-muted-foreground mb-1 text-center relative z-10">
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
              className="absolute left-1/2 -translate-x-1/2 w-[2px] z-[1]"
              style={{ 
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
        <div className="flex gap-2 flex-1 min-w-0">
          {/* Compact Card - Match Kanban styling (priority line removed for timeline view) */}
          <div
            className={cn(
              "rounded-lg relative flex-1 overflow-hidden",
              // Responsive padding: smaller on mobile, comfortable on desktop
              "px-2 py-1.5 space-y-1 md:px-3 md:py-2.5 md:space-y-1.5",
              // Background: solid on mobile, semi-transparent on desktop
              isMobile ? "bg-white" : "bg-white/60 backdrop-blur-sm",
              // Responsive borders: thinner on mobile, standard on desktop
              "border-b border-r border-gray-300/80 md:border-gray-300/90",
              // Shadows: better blending on mobile
              isMobile 
                ? "shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.12)]" 
                : "shadow-lg",
              "hover:bg-white/80 hover:shadow-xl hover:border-gray-400/90 transition-all duration-200",
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
              minHeight: `${getTaskHeight(task) * 1.247}px`,
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
                    isMobile ? "text-[9px] px-1 py-0 h-[16px]" : "text-[10px] px-1.5 py-0 h-[18px]",
                  )}
                >
                  {task.priority}
                </Badge>

                {task.tags && task.tags.length > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "bg-[#EBF5FB] text-[#1565C0] border-0 flex-shrink-0",
                      isMobile ? "text-[9px] px-1 py-0 h-[16px]" : "text-[10px] px-1.5 py-0 h-[18px]",
                    )}
                  >
                    {task.tags[0]}
                  </Badge>
                )}

                {task.estimatedTime && (
                  <span className={cn("text-gray-500 font-medium flex-shrink-0", isMobile ? "text-[10px]" : "text-[11px]")}>
                    {formatDuration(task.estimatedTime)}
                  </span>
                )}

                {/* Tracking Badge - Shown at top with other badges (mobile and desktop for tasks < 45 mins) */}
                {task.estimatedTime && task.estimatedTime < 45 && hasFeature("pomodoroTimer") && timerState.isRunning && (
                  <div className="flex items-center animate-pulse flex-shrink-0">
                    <div className={cn(
                      "flex items-center rounded-full bg-gradient-to-r from-[#7B68EE] to-[#9B87E8] text-white",
                      isMobile ? "px-1 py-0.5 gap-0.5 text-[7px]" : "px-1.5 py-0.5 gap-1 text-[8px]"
                    )}>
                      <Timer className={cn("animate-spin", isMobile ? "w-2 h-2" : "w-2.5 h-2.5")} />
                      <span className="font-semibold">Tracking...</span>
                    </div>
                  </div>
                )}

                {/* Tracked Time (if exists and not running) - shown at top (mobile and desktop for tasks < 45 mins) */}
                {task.estimatedTime && task.estimatedTime < 45 && task.actualTime && task.actualTime > 0 && !timerState.isRunning && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Timer className={cn("text-[#7B68EE]", isMobile ? "w-2 h-2" : "w-2.5 h-2.5")} />
                    <span className={cn("text-[#7B68EE] font-medium", isMobile ? "text-[8px]" : "text-[9px]")}>
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
                      : "text-gray-300 hover:text-gray-400",
                  )}
                />
              </button>
            </div>

            {/* Row 2: H3 Title (Bold) */}
            <div className={cn("flex items-start", isMobile ? "gap-1 -mt-0.5" : "gap-1.5")}>
              {task.recurrence && task.recurrence.type !== "none" && (
                <Repeat className={cn("text-primary flex-shrink-0 mt-0.5", isMobile ? "w-3 h-3" : "w-3.5 h-3.5")} />
              )}
              <h3
                className={cn(
                  "text-gray-900 leading-tight line-clamp-2 flex-1",
                  task.status === "done" && "line-through text-gray-400",
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
                  "text-gray-500 leading-snug break-words text-[10px]",
                  (task.estimatedTime && task.estimatedTime <= 30) ? "line-clamp-2" : "line-clamp-4",
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
                  hasHTMLTags(task.description) && "[&_p]:my-0.5",
                  hasHTMLTags(task.description) && "[&_code]:bg-gray-100 [&_code]:dark:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono"
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
                {task.subtasks.slice(0, 3).map((subtask) => (
                  <div
                    key={subtask.id}
                    className={cn("flex items-center", isMobile ? "gap-1" : "gap-1.5")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={cn(
                        "rounded-sm border flex-shrink-0",
                        isMobile ? "w-2 h-2" : "w-2.5 h-2.5",
                        subtask.completed
                          ? "bg-primary border-primary"
                          : "border-gray-300",
                      )}
                    />
                    <span
                      className={cn(
                        "leading-tight",
                        isMobile ? "text-[9px]" : "text-[10px]",
                        subtask.completed
                          ? "text-gray-400 line-through"
                          : "text-gray-600",
                      )}
                    >
                      {subtask.title}
                    </span>
                  </div>
                ))}
                {task.subtasks.length > 3 && (
                  <div className={cn("text-gray-400", isMobile ? "text-[9px] pl-3" : "text-[10px] pl-4")}>
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
                              "text-gray-600 font-semibold",
                              isMobile ? "text-[9px]" : "text-[10px]",
                            )}>
                              {member.name}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{member.name}</p>
                          <p className="text-xs text-gray-400">
                            {member.email}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
                {task.assignedTo.length > 3 && (
                  <span className={cn("text-gray-500", isMobile ? "text-[9px]" : "text-[10px]")}>
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
                <div className={cn(
                  "flex items-center rounded-full px-1.5 py-0.5",
                  "bg-gradient-to-r from-[#7B68EE] to-[#9B87E8] text-white",
                  isMobile ? "gap-0.5 text-[8px]" : "gap-1 text-[10px]"
                )}>
                  <Timer className={cn("animate-spin", isMobile ? "w-2 h-2" : "w-2.5 h-2.5")} />
                  <span className="font-semibold">Tracking...</span>
                </div>
              </div>
            )}

            {/* Tracked Time (if exists) - only for tasks >= 45 mins, tasks < 45 mins show at top */}
            {task.estimatedTime && task.estimatedTime >= 45 && task.actualTime && task.actualTime > 0 && (
              <div className={cn("flex items-center pt-0.5", "gap-1")}>
                <Timer className={cn("text-[#7B68EE]", "w-3 h-3")} />
                <span className={cn("text-[#7B68EE] font-medium", "text-[11px]")}>
                  {formatTimer(task.actualTime)} tracked
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
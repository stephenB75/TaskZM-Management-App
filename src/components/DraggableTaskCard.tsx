import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, Timer, Clock, Repeat } from "lucide-react";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { cn, formatTimeAMPM, getInitials, sanitizeHTML, hasHTMLTags } from "../lib/utils";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { usePomodoro } from "../contexts/PomodoroContext";
import { PomodoroTimer } from "./PomodoroTimer";
import { useIsMobile } from "./ui/use-mobile";
import type { Task } from "../types";

interface DraggableTaskCardProps {
  task: Task;
  onClick: () => void;
  droppableId: string;
  isDragging?: boolean;
}

export const DraggableTaskCard = React.forwardRef<
  HTMLDivElement,
  DraggableTaskCardProps
>(
  (
    { task, onClick, droppableId, isDragging = false },
    forwardedRef,
  ) => {
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
      transition,
      isDragging: isSortableDragging,
    } = useSortable({
      id: task.id,
      disabled: isMobile, // Disable drag on mobile
    });

    // Debug logging removed for production

    const style = {
      transform: CSS.Transform.toString(transform),
      transition:
        transition ||
        "transform 250ms cubic-bezier(0.25, 0.8, 0.25, 1)",
    };

    const handleToggleComplete = (e: React.MouseEvent) => {
      e.stopPropagation();
      updateTask(task.id, {
        status: task.status === "done" ? "todo" : "done",
        completedAt:
          task.status === "done"
            ? null
            : new Date().toISOString(),
      });
    };

    const handlePomodoroTimeUpdate = async (
      minutes: number,
    ) => {
      try {
        await updateTask(task.id, {
          actualTime: minutes,
        });
      } catch (error) {
        console.error("Failed to update task time:", error);
      }
    };

    const getPriorityLineColor = (
      priority: Task["priority"],
    ) => {
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

    const getPriorityBadgeColor = (
      priority: Task["priority"],
    ) => {
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

    // Calculate card height based on duration (visual time-blocking)
    // For tasks < 45 mins: more compact sizing to fit all elements comfortably
    // For tasks 45-59 mins: standard sizing
    // For tasks >= 60 mins: enhanced sizing to accommodate descriptions and all elements
    const getCardHeight = () => {
      const duration = task.estimatedTime || 30; // Default 30 min
      const maxHeight = 600; // Increased max height for longer tasks
      
      if (duration < 45) {
        // Compact sizing for shorter tasks: base height + minimal scaling
        // Ensures all elements (title, badges, pomodoro, assigned users, etc.) fit comfortably
        // Auto-adjusts base height when pomodoro timer is running or users are assigned
        let baseHeight = 80; // Base height for essential elements
        const hasPomodoro = hasFeature("pomodoroTimer") && timerState.isRunning;
        const hasAssignedUsers = task.assignedTo && task.assignedTo.length > 0;
        const hasTrackedTime = task.actualTime && task.actualTime > 0;
        const hasPomodoroTimer = hasFeature("pomodoroTimer");
        
        // Auto-adjust base height based on components present
        // Mobile only: increase border height by 20% to fit all components
        // Additional 10% increase when ALL components are active (tracking + assigned users + subtasks)
        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        if (isMobile) {
          // Mobile: tracking badge at top, bottom row has assigned users + pomodoro timer
          // Increase border height by 20% to accommodate all components comfortably
          // Additional 10% when all components are active
          let calculatedBaseHeight = 0;
          if (hasPomodoro || hasTrackedTime) {
            // Tracking badge in top row + bottom row with assigned users and/or pomodoro timer
            calculatedBaseHeight = hasAssignedUsers || hasPomodoroTimer ? 126 : 114; // Extra space for all components (+20% border height)
          } else if (hasAssignedUsers && hasPomodoroTimer) {
            // Both assigned users and pomodoro timer in bottom row
            calculatedBaseHeight = 120; // Space for both bottom row components (+20% border height)
          } else if (hasAssignedUsers || hasPomodoroTimer) {
            // One of assigned users or pomodoro timer in bottom row
            calculatedBaseHeight = 114; // Space for one bottom row component (+20% border height)
          } else {
            calculatedBaseHeight = 108; // Base space for essential elements only (+20% border height)
          }
          
          // Add 10% increase when ALL components are active (tracking + assigned users + subtasks)
          if ((hasPomodoro || hasTrackedTime) && hasAssignedUsers && hasSubtasks) {
            baseHeight = Math.round(calculatedBaseHeight * 1.1);
          } else {
            baseHeight = calculatedBaseHeight;
          }
        } else {
          // Desktop: apply same rules as mobile for tasks < 45 mins
          // Tracking badge at top, bottom row has assigned users + pomodoro timer
          // Increase border height by 20% to accommodate all components comfortably
          // Additional 10% when all components are active
          let calculatedBaseHeight = 0;
          if (hasPomodoro || hasTrackedTime) {
            // Tracking badge in top row + bottom row with assigned users and/or pomodoro timer
            calculatedBaseHeight = hasAssignedUsers || hasPomodoroTimer ? 126 : 114; // Extra space for all components (+20% border height)
          } else if (hasAssignedUsers && hasPomodoroTimer) {
            // Both assigned users and pomodoro timer in bottom row
            calculatedBaseHeight = 120; // Space for both bottom row components (+20% border height)
          } else if (hasAssignedUsers || hasPomodoroTimer) {
            // One of assigned users or pomodoro timer in bottom row
            calculatedBaseHeight = 114; // Space for one bottom row component (+20% border height)
          } else {
            calculatedBaseHeight = 108; // Base space for essential elements only (+20% border height)
          }
          
          // Add 10% increase when ALL components are active (tracking + assigned users + subtasks)
          if ((hasPomodoro || hasTrackedTime) && hasAssignedUsers && hasSubtasks) {
            baseHeight = Math.round(calculatedBaseHeight * 1.1);
          } else {
            baseHeight = calculatedBaseHeight;
          }
        }
        
        const scalingFactor = 0.9; // Reduced scaling for shorter tasks
        const calculatedHeight = baseHeight + (duration - 15) * scalingFactor;
        return Math.min(Math.max(calculatedHeight, baseHeight), maxHeight);
      } else if (duration >= 60) {
        // Enhanced sizing for tasks 1 hour or more: more space for descriptions
        const baseHeight = 160; // Increased base height for descriptions and all elements
        const pixelsPerMinute = 2.0; // More generous scaling for longer tasks
        const calculatedHeight = baseHeight + (duration - 60) * pixelsPerMinute;
        return Math.min(
          Math.max(calculatedHeight, baseHeight),
          maxHeight,
        );
      } else {
        // Standard sizing for medium tasks (45-59 mins)
        const minHeight = 100; // Minimum height for readability
        const pixelsPerMinute = 1.2; // Scaling factor
        const calculatedHeight = minHeight + duration * pixelsPerMinute;
        return Math.min(
          Math.max(calculatedHeight, minHeight),
          maxHeight,
        );
      }
    };

    const cardHeight = getCardHeight();

    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          touchAction: isMobile ? "auto" : "none", // Allow normal touch on mobile
        }}
        {...attributes}
        {...(isMobile ? {} : listeners)} // Only apply drag listeners on desktop
        className={cn(
          "flex gap-2 mb-2",
          isDragging ? "w-[280px] flex-shrink-0" : "w-full", // Constrain width in overlay
          !isMobile && (isDragging || isSortableDragging)
            ? "opacity-50 cursor-grabbing"
            : "",
          !isMobile && !(isDragging || isSortableDragging)
            ? "cursor-grab"
            : "",
        )}
        data-dnd-kit-dragging={isDragging || isSortableDragging}
        data-task-card="true"
        data-tour="task-card"
      >
        {/* Vertical colored priority line */}
        <div
          className="w-1 h-1/2 rounded-full flex-shrink-0 self-center min-h-[40px]"
          style={{
            backgroundColor: getPriorityLineColor(
              task.priority,
            ),
          }}
        />

        {/* Compact Card - Partial borders, clean background, height represents duration */}
          <div
            className={cn(
              "rounded-lg relative overflow-hidden",
              // Responsive padding: smaller on mobile, comfortable on desktop
              "px-2 py-1.5 space-y-1 md:px-3 md:py-2.5 md:space-y-1.5",
              // Background: solid on mobile, semi-transparent on desktop
              isMobile ? "bg-white" : "bg-white/60 backdrop-blur-sm",
              // Responsive borders: thinner on mobile, standard on desktop
              "border-l border-b border-r border-gray-300/80 md:border-gray-300/90",
              // Shadows: better blending on mobile
              isMobile 
                ? "shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.12)]" 
                : "shadow-lg",
              "hover:bg-white/80 hover:shadow-xl hover:border-gray-400/90 transition-all duration-200",
              task.status === "done" && "opacity-60",
              isDragging ? "w-[280px] flex-shrink-0" : "flex-1",
              // Bottom padding: auto-adjusts based on content (pomodoro timer, assigned users)
              // For tasks < 45 mins on mobile: inline bottom row needs less padding
              // Base bottom padding for all tasks
              !isMobile && "md:pb-8",
              // Tasks < 45 mins with inline bottom row (mobile and desktop): reduced padding (bottom row handles spacing)
              // Increase padding to ensure bottom row components fit comfortably
              task.estimatedTime && task.estimatedTime < 45 && (isMobile ? "pb-2" : "md:pb-2.5"),
              // Mobile tasks >= 45 mins: standard padding
              isMobile && (!task.estimatedTime || task.estimatedTime >= 45) && !((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && "pb-6",
              // Extra bottom padding on mobile for tasks >= 45 mins when pomodoro/assigned users present
              isMobile && (!task.estimatedTime || task.estimatedTime >= 45) && ((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && "pb-8",
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
            height: `${cardHeight}px`,
            minHeight: `${cardHeight}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            // Only trigger onClick if not dragging
            if (!isDragging && !isSortableDragging) {
              onClick();
            }
          }}
        >
          {/* Row 1: Time + Priority Badge + Tag + Duration + Tracking Badge (mobile) (left) + Checkbox (right) */}
          <div className={cn("flex items-center justify-between", isMobile ? "gap-1" : "gap-2")}>
            <div
              className={cn(
                "flex items-center flex-1 min-w-0 flex-wrap",
                isMobile ? "gap-1" : "gap-1.5",
                // Ensure badges don't collide with the completion button
                isMobile ? "pr-2" : "pr-4"
              )}
            >
              {/* Scheduled Time with AM/PM */}
              {formatTimeAMPM(
                task.scheduledDate || task.dueDate,
              ) && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Clock className={cn("text-gray-400", isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                  <span className={cn("text-gray-600 font-bold", isMobile ? "text-[9px]" : "text-[10px]")}>
                    {formatTimeAMPM(
                      task.scheduledDate || task.dueDate,
                    )}
                  </span>
                </div>
              )}

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
          <div className={cn("flex items-start mt-1", isMobile ? "gap-1 px-1 mb-1" : "gap-1.5 px-1 mb-1")}>
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
                "text-gray-500 leading-snug break-words text-[10px] px-1.5 py-1 mt-0.5 mb-1",
                // For exactly 1 hour (60 minutes), show 2 lines; for longer tasks, show 4 lines
                task.estimatedTime === 60 ? "line-clamp-2" : "line-clamp-4",
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

          {/* Bottom Row: For tasks < 45 mins (mobile and desktop), show inline layout; otherwise absolute positioning */}
          {task.estimatedTime && task.estimatedTime < 45 ? (
            // Inline layout for tasks < 45 mins (mobile and desktop): assigned users and pomodoro timer in one row (tracking badge moved to top)
            <div className={cn("flex items-center justify-between border-t border-gray-200/50", isMobile ? "gap-1.5 mt-2 pt-2" : "gap-2 mt-2.5 pt-2.5")}>
              {/* Left: Assigned Users */}
              <div className="flex items-center flex-wrap gap-1 flex-1 min-w-0">
                {task.assignedTo && task.assignedTo.length > 0 && (
                  <>
                    {task.assignedTo.slice(0, 2).map((userId) => {
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
                                  isMobile ? "w-3 h-3 text-[7px]" : "w-4 h-4 text-[8px]"
                                )}>
                                  {initials}
                                </div>
                                <span className={cn(
                                  "text-gray-600 font-semibold truncate",
                                  isMobile ? "text-[8px] max-w-[40px]" : "text-[9px] max-w-[60px]"
                                )}>
                                  {member.name}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{member.name}</p>
                              <p className="text-xs text-gray-400">{member.email}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                    {task.assignedTo.length > 2 && (
                      <span className={cn("text-gray-500", isMobile ? "text-[8px]" : "text-[9px]")}>+{task.assignedTo.length - 2}</span>
                    )}
                  </>
                )}
              </div>

              {/* Center/Right: Pomodoro Timer only (tracking badge moved to top on mobile) */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Pomodoro Timer */}
                {hasFeature("pomodoroTimer") && (
                  <div onClick={(e) => e.stopPropagation()}>
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
          ) : (
            // Absolute positioning for desktop or tasks >= 45 mins
            <>
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
                <div className={cn("flex items-center pt-0.5", isMobile ? "gap-0.5" : "gap-1")}>
                  <Timer className={cn("text-[#7B68EE]", isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                  <span className={cn("text-[#7B68EE] font-medium", isMobile ? "text-[10px]" : "text-[11px]")}>
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
            </>
          )}
        </div>
      </div>
    );
  },
);

DraggableTaskCard.displayName = "DraggableTaskCard";
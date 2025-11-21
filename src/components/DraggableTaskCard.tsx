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
import {
  TASK_CARD_PRIORITY_COLORS,
  TASK_CARD_TAG_COLORS,
  TASK_CARD_THEME_COLORS,
  TASK_CARD_FONT_SIZES,
  TASK_CARD_ICON_SIZES,
  TASK_CARD_BADGE_SIZES,
  TASK_CARD_HEIGHT_CONFIG,
  TASK_CARD_SPACING,
  TASK_CARD_TEXT,
  TASK_CARD_SHADOWS,
  TASK_CARD_BORDERS,
  TASK_CARD_BACKGROUNDS,
  TASK_CARD_WIDTHS,
  TASK_CARD_LINE_CLAMP,
} from "../lib/task-card-constants";

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
      return TASK_CARD_PRIORITY_COLORS[priority]?.line || TASK_CARD_PRIORITY_COLORS.default.line;
    };

    const getPriorityBadgeColor = (
      priority: Task["priority"],
    ) => {
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

    // Calculate card height based on duration (visual time-blocking)
    // Auto-adjusts for: badge wrapping, assigned users, tracking, descriptions
    const getCardHeight = () => {
      const duration = task.estimatedTime || TASK_CARD_HEIGHT_CONFIG.defaultDuration;
      const maxHeight = TASK_CARD_HEIGHT_CONFIG.maxHeight;
      
      // Count badges that will be displayed in the top row
      const hasTime = !!(task.scheduledDate || task.dueDate);
      const hasPriority = true; // Always shown
      const hasTag = task.tags && task.tags.length > 0;
      const hasDuration = !!task.estimatedTime;
      const hasTracking = task.estimatedTime && task.estimatedTime < 45 && hasFeature("pomodoroTimer") && timerState.isRunning;
      const hasTrackedTime = task.estimatedTime && task.estimatedTime < 45 && task.actualTime && task.actualTime > 0 && !timerState.isRunning;
      
      // Estimate if badges will wrap to second line
      // Approximate badge widths: time (60px), priority (50px), tag (60px), duration (40px), tracking (80px)
      // Available width: ~280px on mobile, ~400px on desktop (accounting for checkbox and padding)
      const badgeCount = [hasTime, hasPriority, hasTag, hasDuration, hasTracking || hasTrackedTime].filter(Boolean).length;
      const estimatedBadgeWidth = badgeCount * 60; // Average badge width
      const availableWidth = isMobile ? 240 : 360; // Account for padding and checkbox
      const badgesWillWrap = estimatedBadgeWidth > availableWidth;
      const badgeWrapHeight = badgesWillWrap ? 24 : 0; // Extra height if badges wrap (one line height)
      
      const hasPomodoro = hasFeature("pomodoroTimer") && timerState.isRunning;
      const hasAssignedUsers = task.assignedTo && task.assignedTo.length > 0;
      const hasTrackedTimeFull = task.actualTime && task.actualTime > 0;
      const hasPomodoroTimer = hasFeature("pomodoroTimer");
      const hasDescription = task.description && task.estimatedTime && task.estimatedTime >= 60;
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      
      if (duration < TASK_CARD_HEIGHT_CONFIG.thresholds.short) {
        // Compact sizing for shorter tasks: base height + minimal scaling
        // Auto-adjusts for badge wrapping, assigned users, tracking, and subtasks
        let baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.base;
        
        // Add height for badge wrapping
        baseHeight += badgeWrapHeight;
        
        // Add height for components
        if (isMobile) {
          let calculatedBaseHeight = baseHeight;
          if (hasPomodoro || hasTrackedTimeFull) {
            // Tracking badge in top row + bottom row with assigned users and/or pomodoro timer
            calculatedBaseHeight = hasAssignedUsers || hasPomodoroTimer 
              ? TASK_CARD_HEIGHT_CONFIG.baseHeights.short.withBoth 
              : TASK_CARD_HEIGHT_CONFIG.baseHeights.short.withTracking;
          } else if (hasAssignedUsers && hasPomodoroTimer) {
            // Both assigned users and pomodoro timer in bottom row
            calculatedBaseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.withBoth;
          } else if (hasAssignedUsers || hasPomodoroTimer) {
            // One of assigned users or pomodoro timer in bottom row
            calculatedBaseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.withAssigned;
          } else {
            calculatedBaseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.mobileBase;
          }
          
          // Add extra height for subtasks
          if (hasSubtasks) {
            const subtaskHeight = Math.min(task.subtasks.length, 3) * 16; // ~16px per subtask, max 3 visible
            calculatedBaseHeight += subtaskHeight;
          }
          
          baseHeight = calculatedBaseHeight;
        } else {
          // Desktop: apply same rules as mobile
          let calculatedBaseHeight = baseHeight;
          if (hasPomodoro || hasTrackedTimeFull) {
            calculatedBaseHeight = hasAssignedUsers || hasPomodoroTimer 
              ? TASK_CARD_HEIGHT_CONFIG.baseHeights.short.withBoth 
              : TASK_CARD_HEIGHT_CONFIG.baseHeights.short.withTracking;
          } else if (hasAssignedUsers && hasPomodoroTimer) {
            calculatedBaseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.withBoth;
          } else if (hasAssignedUsers || hasPomodoroTimer) {
            calculatedBaseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.withAssigned;
          } else {
            calculatedBaseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.mobileBase;
          }
          
          // Add extra height for subtasks
          if (hasSubtasks) {
            const subtaskHeight = Math.min(task.subtasks.length, 3) * 16; // ~16px per subtask, max 3 visible
            calculatedBaseHeight += subtaskHeight;
          }
          
          baseHeight = calculatedBaseHeight;
        }
        
        const scalingFactor = TASK_CARD_HEIGHT_CONFIG.scalingFactors.short;
        const calculatedHeight = baseHeight + (duration - 15) * scalingFactor;
        return Math.min(Math.max(calculatedHeight, baseHeight), maxHeight);
      } else if (duration >= TASK_CARD_HEIGHT_CONFIG.thresholds.long) {
        // Enhanced sizing for tasks 1 hour or more: more space for descriptions
        let baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.base;
        
        // Add height for badge wrapping
        baseHeight += badgeWrapHeight;
        
        // Add extra height for description (full height, no line clamp)
        if (hasDescription) {
          // Estimate description height based on content length
          // Average ~50 characters per line, ~16px line height for 12px font
          const estimatedLines = task.description ? Math.ceil(task.description.length / 50) : 4;
          const lineHeight = 16; // Approximate line height for 12px font
          const descriptionHeight = Math.max(estimatedLines * lineHeight, 64) + 12; // Minimum 4 lines, add padding (mb-3 = 12px)
          baseHeight += descriptionHeight;
        }
        
        // Add extra height for assigned users
        if (hasAssignedUsers) {
          baseHeight += 24; // Height for assigned users row
        }
        
        // Add extra height for subtasks
        if (hasSubtasks) {
          const subtaskHeight = Math.min(task.subtasks.length, 3) * 16;
          baseHeight += subtaskHeight;
        }
        
        const pixelsPerMinute = TASK_CARD_HEIGHT_CONFIG.scalingFactors.long;
        const calculatedHeight = baseHeight + (duration - TASK_CARD_HEIGHT_CONFIG.thresholds.long) * pixelsPerMinute;
        return Math.min(
          Math.max(calculatedHeight, baseHeight),
          maxHeight,
        );
      } else {
        // Standard sizing for medium tasks (45-59 mins)
        let minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.medium.min;
        
        // Add height for badge wrapping
        minHeight += badgeWrapHeight;
        
        // Add extra height for assigned users
        if (hasAssignedUsers) {
          minHeight += 24;
        }
        
        // Add extra height for subtasks
        if (hasSubtasks) {
          const subtaskHeight = Math.min(task.subtasks.length, 3) * 16;
          minHeight += subtaskHeight;
        }
        
        const pixelsPerMinute = TASK_CARD_HEIGHT_CONFIG.scalingFactors.medium;
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
          isDragging ? TASK_CARD_WIDTHS.dragging : TASK_CARD_WIDTHS.normal,
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
              TASK_CARD_SPACING.padding.mobile,
              TASK_CARD_SPACING.padding.desktop,
              TASK_CARD_SPACING.spaceY.mobile,
              TASK_CARD_SPACING.spaceY.desktop,
              // Background: solid on mobile, semi-transparent on desktop
              isMobile ? TASK_CARD_BACKGROUNDS.mobile : TASK_CARD_BACKGROUNDS.desktop,
              // Responsive borders: thinner on mobile, standard on desktop
              `border-l border-b border-r ${TASK_CARD_BORDERS.mobile} ${TASK_CARD_BORDERS.desktop}`,
              // Shadows: better blending on mobile
              isMobile ? TASK_CARD_SHADOWS.mobile : TASK_CARD_SHADOWS.desktop,
              `${TASK_CARD_BACKGROUNDS.hover} ${TASK_CARD_SHADOWS.hover} ${TASK_CARD_BORDERS.hover} transition-all duration-200`,
              task.status === "done" && "opacity-60",
              isDragging ? TASK_CARD_WIDTHS.dragging : "flex-1",
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
                  <Clock className={cn("text-gray-400", isMobile ? TASK_CARD_ICON_SIZES.clock.mobile : TASK_CARD_ICON_SIZES.clock.desktop)} />
                  <span className={cn("text-gray-600 font-bold", isMobile ? TASK_CARD_FONT_SIZES.time.mobile : TASK_CARD_FONT_SIZES.time.desktop)}>
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
                    backgroundColor: TASK_CARD_TAG_COLORS.background,
                    color: TASK_CARD_TAG_COLORS.text,
                  }}
                >
                  {task.tags[0]}
                </Badge>
              )}

              {task.estimatedTime && (
                <span className={cn("text-gray-500 font-medium flex-shrink-0", isMobile ? TASK_CARD_FONT_SIZES.duration.mobile : TASK_CARD_FONT_SIZES.duration.desktop)}>
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
              className={cn("flex-shrink-0 hover:opacity-80 transition-opacity", isMobile ? TASK_CARD_ICON_SIZES.checkbox.mobile : TASK_CARD_ICON_SIZES.checkbox.desktop)}
            >
              <Circle
                className={cn(
                  "transition-colors",
                  isMobile ? TASK_CARD_ICON_SIZES.checkbox.mobile : TASK_CARD_ICON_SIZES.checkbox.desktop,
                  task.status === "done"
                    ? "text-primary fill-primary"
                    : "text-gray-300 hover:text-gray-400",
                )}
              />
            </button>
          </div>

          {/* Row 2: H3 Title (Bold) */}
          <div className={cn("flex items-start mt-1", isMobile ? TASK_CARD_SPACING.title.mobile : TASK_CARD_SPACING.title.desktop)}>
            {task.recurrence && task.recurrence.type !== "none" && (
              <Repeat className={cn("text-primary flex-shrink-0 mt-0.5", isMobile ? TASK_CARD_ICON_SIZES.repeat.mobile : TASK_CARD_ICON_SIZES.repeat.desktop)} />
            )}
            <h3
              className={cn(
                "text-gray-900 leading-tight flex-1",
                TASK_CARD_LINE_CLAMP.title,
                task.status === "done" && "line-through text-gray-400",
                isMobile ? TASK_CARD_FONT_SIZES.title.mobile : TASK_CARD_FONT_SIZES.title.desktop,
              )}
            >
              {task.title}
            </h3>
          </div>

          {/* Row 3: Subhead (Description) - Only show if task is 1 hour or more */}
          {task.description && task.estimatedTime && task.estimatedTime >= 60 && (
            <div 
              className={cn(
                `text-gray-500 leading-snug break-words ${TASK_CARD_FONT_SIZES.description} ${TASK_CARD_SPACING.description}`,
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
                        isMobile ? TASK_CARD_FONT_SIZES.subtask.mobile : TASK_CARD_FONT_SIZES.subtask.desktop,
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
                  <div className={cn("text-gray-400", isMobile ? `${TASK_CARD_FONT_SIZES.subtask.mobile} pl-3` : `${TASK_CARD_FONT_SIZES.subtask.desktop} pl-4`)}>
                    {TASK_CARD_TEXT.moreSubtasks(task.subtasks.length - 3)}
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
                    <span className={cn("text-gray-500", isMobile ? TASK_CARD_FONT_SIZES.assignedUserName.mobile : TASK_CARD_FONT_SIZES.assignedUserName.desktop)}>
                      {TASK_CARD_TEXT.moreAssigned(task.assignedTo.length - 3)}
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
                <div className={cn("flex items-center pt-0.5", isMobile ? "gap-0.5" : "gap-1")}>
                  <Timer 
                    className={cn(isMobile ? TASK_CARD_ICON_SIZES.timerLarge.mobile : TASK_CARD_ICON_SIZES.timerLarge.desktop)} 
                    style={{ color: TASK_CARD_THEME_COLORS.primary }}
                  />
                  <span 
                    className={cn("font-medium", isMobile ? TASK_CARD_FONT_SIZES.duration.mobile : TASK_CARD_FONT_SIZES.duration.desktop)}
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
            </>
          )}
        </div>
      </div>
    );
  },
);

DraggableTaskCard.displayName = "DraggableTaskCard";
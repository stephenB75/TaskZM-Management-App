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
import { useTheme } from "../contexts/ThemeContext";
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
  TASK_CARD_CALCULATIONS,
  TASK_CARD_RICH_TEXT_COLORS,
  TASK_CARD_ASSIGNED_USER_COLORS,
  TASK_CARD_TEXT_COLORS,
  TASK_CARD_POSITIONING,
  TASK_CARD_ADDITIONAL_FONT_SIZES,
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
    const { actualTheme } = useTheme();
    const isDark = actualTheme === 'dark';
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

    const scheduledTimeLabel = formatTimeAMPM(
      task.scheduledDate || task.dueDate,
    );
    const estimatedTimeValue = typeof task.estimatedTime === "number" ? task.estimatedTime : null;
    const hasEstimatedTime = estimatedTimeValue !== null;
    const isShortTask = typeof estimatedTimeValue === "number" && estimatedTimeValue < 45;
    const isLongTask = typeof estimatedTimeValue === "number" && estimatedTimeValue >= 60;
    const canUsePomodoro = hasFeature("pomodoroTimer");
    const pomodoroIsRunning = canUsePomodoro && timerState.isRunning;
    const showTrackingBadgeTopRow =
      hasEstimatedTime &&
      estimatedTimeValue < 45 &&
      canUsePomodoro &&
      timerState.isRunning;
    const showTrackedTimeTopRow =
      hasEstimatedTime &&
      estimatedTimeValue < 45 &&
      Boolean(task.actualTime && task.actualTime > 0) &&
      !timerState.isRunning;
    const showInlinePomodoroTimer = Boolean(isShortTask && canUsePomodoro);
    const showAbsolutePomodoroTimer = Boolean(!isShortTask && hasEstimatedTime && canUsePomodoro);
    const shouldRenderInlineBottomRow =
      Boolean(task.estimatedTime && task.estimatedTime < 45) &&
      (showInlinePomodoroTimer || Boolean(task.assignedTo && task.assignedTo.length > 0));

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
      
      // Get base height based on duration (standard starting height before components)
      const getBaseHeightForDuration = (mins: number): number => {
        if (mins >= 20 && mins <= 25) return 100;
        if (mins >= 30 && mins <= 35) return 200;
        if (mins >= 40 && mins <= 45) return 250;
        if (mins >= 50 && mins <= 60) return 320;
        if (mins >= 100 && mins <= 120) return 400;
        if (mins >= 200 && mins <= 220) return 480;
        
        // Interpolate for values between ranges
        if (mins < 20) {
          // Linear interpolation from 0-20 mins
          return 60 + (mins / 20) * (100 - 60);
        }
        if (mins > 25 && mins < 30) {
          // Linear interpolation from 25-30 mins
          return 100 + ((mins - 25) / 5) * (200 - 100);
        }
        if (mins > 35 && mins < 40) {
          // Linear interpolation from 35-40 mins
          return 200 + ((mins - 35) / 5) * (250 - 200);
        }
        if (mins > 45 && mins < 50) {
          // Linear interpolation from 45-50 mins
          return 250 + ((mins - 45) / 5) * (320 - 250);
        }
        if (mins > 60 && mins < 100) {
          // Linear interpolation from 60-100 mins
          return 320 + ((mins - 60) / 40) * (400 - 320);
        }
        if (mins > 120 && mins < 200) {
          // Linear interpolation from 120-200 mins
          return 400 + ((mins - 120) / 80) * (480 - 400);
        }
        if (mins > 220) {
          // Scale beyond 220 mins: add 80px per additional 120 mins
          const additionalHours = (mins - 220) / 120;
          return 480 + additionalHours * 80;
        }
        
        return 100; // Default fallback
      };
      
      // Count badges that will be displayed in the top row
      const hasTime = !!(task.scheduledDate || task.dueDate);
      const hasPriority = true; // Always shown
      const hasTag = task.tags && task.tags.length > 0;
      const hasDuration = !!task.estimatedTime;
      const hasTracking = showTrackingBadgeTopRow;
      const hasTrackedTime = showTrackedTimeTopRow;
      
      // Estimate if badges will wrap to second line
      const badgeCount = [hasTime, hasPriority, hasTag, hasDuration, hasTracking || hasTrackedTime].filter(Boolean).length;
      const estimatedBadgeWidth = badgeCount * TASK_CARD_CALCULATIONS.badgeWidths.average;
      // Increased available width for desktop by 20% to match increased column width (336px columns)
      // Mobile remains unchanged at 240px
      const availableWidth = isMobile ? 240 : 432; // Desktop increased from 360 to 432 to match 20% wider columns
      const badgesWillWrap = estimatedBadgeWidth > availableWidth;
      const badgeWrapHeight = badgesWillWrap ? 24 : 0; // Extra height if badges wrap (one line height)
      
      const hasPomodoro = pomodoroIsRunning;
      const hasAssignedUsers = task.assignedTo && task.assignedTo.length > 0;
      const hasTrackedTimeFull = task.actualTime && task.actualTime > 0;
      const inlinePomodoroPresent = showInlinePomodoroTimer;
      const hasDescription = task.description && task.estimatedTime && task.estimatedTime >= 60;
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      
      // Check if task has any components (used across all duration branches)
      const hasAnyComponents = hasAssignedUsers || inlinePomodoroPresent || hasSubtasks || hasPomodoro || hasTrackedTimeFull;
      
      // Get base height for this duration (standard starting height before components)
      let baseHeight = getBaseHeightForDuration(duration);
      
      // Add height for badge wrapping
      baseHeight += badgeWrapHeight;
      
      // Add extra height for description (full height, no line clamp)
      // Description is always shown for tasks >= 60 minutes if it exists
      if (hasDescription) {
        // Estimate description height based on content length
        const estimatedLines = task.description ? Math.ceil(task.description.length / TASK_CARD_CALCULATIONS.description.charsPerLine) : 4;
        const lineHeight = TASK_CARD_CALCULATIONS.description.lineHeight;
        // Match CSS margin: mb-0 (0px) when assigned users present and no subtasks, mb-1.5 (6px) otherwise
        const descriptionBottomPadding = (hasAssignedUsers && !hasSubtasks) 
          ? 0 // mb-0 when assigned users follow directly (matches CSS)
          : 6; // mb-1.5 = 6px when subtasks present or no assigned users (matches CSS)
        const descriptionHeight = Math.max(estimatedLines * lineHeight, TASK_CARD_CALCULATIONS.description.minHeight) + descriptionBottomPadding;
        baseHeight += descriptionHeight;
      }
      
      // Add extra height for assigned users (only if present)
      if (hasAssignedUsers) {
        // If description exists and no subtasks, reduce spacing since description has mb-0
        // Account for avatar + name height (~20px) plus spacing
        const assignedUsersBaseHeight = 20; // Avatar + name height
        const assignedUsersSpacing = (hasDescription && !hasSubtasks) 
          ? 16 // Reduced spacing when description has mb-0
          : 20; // Standard spacing
        baseHeight += assignedUsersBaseHeight + assignedUsersSpacing;
      }
      
      // Add extra height for pomodoro timer if present (only for long tasks, shown absolutely)
      if (hasPomodoro && !inlinePomodoroPresent) {
        // Pomodoro timer in absolute position adds ~40px height
        baseHeight += 40;
      }
      
      // Add extra height for tracked time display if present
      if (hasTrackedTimeFull) {
        // Tracked time display adds ~24px height
        baseHeight += 24;
      }
      
      // Add extra height for subtasks (only if present)
      if (hasSubtasks) {
        const subtaskCount = Math.min(task.subtasks.length, 3);
        // Subtask height: ~14px per item, spacing: 2px between items on mobile (space-y-0.5), 4px on desktop (space-y-1)
        const subtaskItemHeight = 14; // Approximate height per subtask item
        const subtaskSpacing = isMobile ? 2 : 4; // space-y-0.5 (2px) on mobile, space-y-1 (4px) on desktop
        const subtaskHeight = subtaskCount * subtaskItemHeight + 
          (subtaskCount > 1 ? (subtaskCount - 1) * subtaskSpacing : 0);
        
        // Add extra spacing if description is present (description has mb-1.5 = 6px)
        const subtaskTopSpacing = hasDescription ? 6 : 0;
        baseHeight += subtaskHeight + subtaskTopSpacing;
      }
      
      // Standard heights are TOTAL heights (including padding applied via CSS classes)
      // Do NOT add padding here - CSS classes handle padding, and standard heights already account for it
      // Return base height directly - this is the total card height matching the standard requirements
      return Math.min(baseHeight, maxHeight);
    };

    const cardHeight = getCardHeight();
    const topRowItemCount = [
      Boolean(scheduledTimeLabel),
      true,
      Boolean(task.tags && task.tags.length > 0),
      hasEstimatedTime,
      showTrackingBadgeTopRow,
      showTrackedTimeTopRow,
    ].filter(Boolean).length;
    const isTopRowCompact = topRowItemCount <= 2;
    const topRowGapClass = isMobile
      ? isTopRowCompact
        ? "gap-0.5"
        : "gap-1"
      : isTopRowCompact
        ? "gap-1"
        : "gap-1.5";
    const topRowPaddingClass = isMobile
      ? isTopRowCompact
        ? "pr-1.5"
        : "pr-2"
      : isTopRowCompact
        ? "pr-3"
        : "pr-4";

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
            width: `${TASK_CARD_CALCULATIONS.priorityLine.width}px`,
            minHeight: `${TASK_CARD_CALCULATIONS.priorityLine.minHeight}px`,
            backgroundColor: getPriorityLineColor(task.priority),
          }}
        />

        {/* Compact Card - Partial borders, clean background, height represents duration */}
          <div
            className={cn(
              "rounded-lg relative overflow-hidden box-border",
              // Responsive spacing between children
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
              isDragging ? TASK_CARD_WIDTHS.dragging : "flex-1 flex-shrink-0",
              // Padding: synchronized with height calculation to prevent conflicts with duration-based borders
              // Short tasks (< 45 mins): minimal padding to reduce white space
              (task.estimatedTime && task.estimatedTime < 45) && (isMobile ? "px-2 py-1 pb-1" : "md:px-3 md:py-1.5 md:pb-1.5"),
              // Medium tasks (45-59 mins): standard padding
              (task.estimatedTime && task.estimatedTime >= 45 && task.estimatedTime < 60) && 
                !((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && 
                (isMobile ? "px-2 py-1.5 pb-2" : "md:px-3 md:py-2.5 md:pb-2"),
              (task.estimatedTime && task.estimatedTime >= 45 && task.estimatedTime < 60) && 
                ((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && 
                (isMobile ? "px-2 py-1.5 pb-3" : "md:px-3 md:py-2.5 md:pb-4"),
              // Long tasks (>= 60 mins): more padding for descriptions
              (task.estimatedTime && task.estimatedTime >= 60) && 
                !(pomodoroIsRunning || (task.assignedTo && task.assignedTo.length > 0)) && 
                (isMobile ? "px-2 py-2 pb-2" : "md:px-3 md:py-2 md:pb-2"),
              (task.estimatedTime && task.estimatedTime >= 60) && 
                (pomodoroIsRunning || (task.assignedTo && task.assignedTo.length > 0)) && 
                (isMobile ? "px-2 py-2 pb-3" : "md:px-3 md:py-2 md:pb-4"),
              // Fallback for tasks without estimatedTime
              !task.estimatedTime && (isMobile ? "px-2 py-1.5 pb-2" : "md:px-3 md:py-2.5 md:pb-2"),
            )}
          style={{
            height: `${cardHeight}px`,
            boxSizing: 'border-box', // Include padding in height calculation
          }}
          onMouseDown={(e) => {
            // Prevent click if user is starting a drag
            // The drag handler will take precedence
            if (isDragging || isSortableDragging) {
              e.preventDefault();
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            // Only trigger onClick if not dragging and not in the middle of a drag operation
            if (!isDragging && !isSortableDragging && !document.body.classList.contains('dragging')) {
              onClick();
            }
          }}
        >
          {/* Row 1: Time + Priority Badge + Tag + Duration + Tracking Badge (mobile) (left) + Checkbox (right) */}
      <div className={cn("flex items-center justify-between", isMobile ? "gap-1" : "gap-2")}>
        <div
          className={cn(
            "flex items-center flex-1 min-w-0 flex-wrap",
            topRowGapClass,
            // Ensure badges don't collide with the completion button
            topRowPaddingClass,
          )}
        >
              {/* Scheduled Time with AM/PM */}
          {scheduledTimeLabel && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Clock className={cn("text-gray-400 dark:text-gray-300", isMobile ? TASK_CARD_ICON_SIZES.clock.mobile : TASK_CARD_ICON_SIZES.clock.desktop)} />
                  <span className={cn("text-gray-600 dark:text-gray-200 font-bold", isMobile ? TASK_CARD_FONT_SIZES.time.mobile : TASK_CARD_FONT_SIZES.time.desktop)}>
                {scheduledTimeLabel}
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
                    backgroundColor: isDark ? TASK_CARD_TAG_COLORS.background.dark : TASK_CARD_TAG_COLORS.background.light,
                    color: isDark ? TASK_CARD_TAG_COLORS.text.dark : TASK_CARD_TAG_COLORS.text.light,
                  }}
                >
                  {task.tags[0]}
                </Badge>
              )}

              {task.estimatedTime && (
                <span className={cn("text-gray-500 dark:text-gray-300 font-medium flex-shrink-0", isMobile ? TASK_CARD_FONT_SIZES.duration.mobile : TASK_CARD_FONT_SIZES.duration.desktop)}>
                  {formatDuration(task.estimatedTime)}
                </span>
              )}

              {/* Tracking Badge - Shown at top with other badges (mobile and desktop for tasks < 45 mins) */}
              {showTrackingBadgeTopRow && (
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
              {showTrackedTimeTopRow && (
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
                    : "text-gray-300 dark:text-gray-400 hover:text-gray-400 dark:hover:text-gray-300",
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
                "text-foreground dark:text-gray-100 leading-tight flex-1",
                TASK_CARD_LINE_CLAMP.title,
                task.status === "done" && "line-through text-gray-400 dark:text-gray-500",
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
                `${TASK_CARD_TEXT_COLORS.description} leading-snug break-words ${TASK_CARD_FONT_SIZES.description} px-1.5 py-1 mt-0.5`,
                // Reduce bottom margin when assigned users are present and no subtasks to eliminate white space
                (task.assignedTo && task.assignedTo.length > 0 && (!task.subtasks || task.subtasks.length === 0))
                  ? "mb-0" // No bottom margin when assigned users follow directly
                  : "mb-1.5", // Standard bottom margin when subtasks are present
                // Rich text formatting styles - only apply if HTML is present
                // Note: Rich text editor font size changes will override this base size via inline styles
                hasHTMLTags(task.description) && "[&_strong]:font-bold [&_b]:font-bold",
                hasHTMLTags(task.description) && "[&_em]:italic [&_i]:italic",
                hasHTMLTags(task.description) && "[&_u]:underline",
                hasHTMLTags(task.description) && "[&_s]:line-through [&_strike]:line-through",
                hasHTMLTags(task.description) && `[&_mark]:${TASK_CARD_RICH_TEXT_COLORS.mark.light} [&_mark]:${TASK_CARD_RICH_TEXT_COLORS.mark.dark} [&_mark]:px-0.5 [&_mark]:rounded`,
                hasHTMLTags(task.description) && "[&_ul]:list-disc [&_ul]:ml-3 [&_ul]:my-0.5",
                hasHTMLTags(task.description) && "[&_ol]:list-decimal [&_ol]:ml-3 [&_ol]:my-0.5",
                hasHTMLTags(task.description) && "[&_li]:ml-1",
                hasHTMLTags(task.description) && "[&_p]:my-0.5 [&_p]:break-words",
                hasHTMLTags(task.description) && `[&_code]:${TASK_CARD_RICH_TEXT_COLORS.code.light} [&_code]:${TASK_CARD_RICH_TEXT_COLORS.code.dark} [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono`
              )}
              {...(hasHTMLTags(task.description) 
                ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(task.description) } }
                : { children: task.description }
              )}
            />
          )}

          {/* Subtasks Display */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className={cn(
              // Subtasks follow description directly (description has mb-1.5 = 6px bottom margin)
              // No additional top padding needed as description margin provides spacing
              "pt-0",
              isMobile ? "space-y-0.5" : "space-y-1"
            )}>
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
                        isMobile ? TASK_CARD_FONT_SIZES.subtask.mobile : TASK_CARD_FONT_SIZES.subtask.desktop,
                        subtask.completed
                          ? `${TASK_CARD_TEXT_COLORS.subtaskCompleted} line-through`
                          : "text-gray-600 dark:text-gray-200",
                      )}
                    >
                      {subtask.title}
                    </span>
                  </div>
                );
              })}
                {task.subtasks.length > 3 && (
                  <div className={cn(TASK_CARD_TEXT_COLORS.subtaskCompleted, isMobile ? `${TASK_CARD_FONT_SIZES.subtask.mobile} pl-3` : `${TASK_CARD_FONT_SIZES.subtask.desktop} pl-4`)}>
                    {TASK_CARD_TEXT.moreSubtasks(task.subtasks.length - 3)}
                  </div>
                )}
            </div>
          )}

          {/* Bottom Row: For tasks < 45 mins (mobile and desktop), show inline layout; otherwise absolute positioning */}
          {shouldRenderInlineBottomRow ? (
            // Inline layout for tasks < 45 mins (mobile and desktop): assigned users and pomodoro timer in one row (tracking badge moved to top)
            // Reduced spacing when all components are active
            <div className={cn(
              "flex items-center justify-between border-t border-gray-200/50 dark:border-border/50",
              // Check if subtasks are present to reduce spacing
              task.subtasks && task.subtasks.length > 0
                ? isMobile ? "gap-1.5 mt-1 pt-1" : "gap-2 mt-1.5 pt-1.5"
                : isMobile ? "gap-1.5 mt-2 pt-2" : "gap-2 mt-2.5 pt-2.5"
            )}>
              {/* Left: Assigned Users */}
              {task.assignedTo && task.assignedTo.length > 0 && (
                <div className="flex items-center flex-wrap gap-1 flex-1 min-w-0">
                    {task.assignedTo.slice(0, 2).map((userId) => {
                      const member = getTeamMember(userId);
                      if (!member) return null;
                      const initials = getInitials(member.name);
                      return (
                        <TooltipProvider key={userId}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn("flex items-center", isMobile ? "gap-0.5" : "gap-1")}>
                                <div 
                                  className={cn(
                                    `rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.text} flex items-center justify-center font-semibold`,
                                    isMobile ? TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile : TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.desktop
                                  )}
                                  style={{
                                    width: `${isMobile ? TASK_CARD_CALCULATIONS.assignedUser.avatarSize.mobile.width : TASK_CARD_CALCULATIONS.assignedUser.avatarSize.desktop.width}px`,
                                    height: `${isMobile ? TASK_CARD_CALCULATIONS.assignedUser.avatarSize.mobile.height : TASK_CARD_CALCULATIONS.assignedUser.avatarSize.desktop.height}px`,
                                  }}
                                >
                                  {initials}
                                </div>
                                <span 
                                  className={cn(
                                    `${TASK_CARD_TEXT_COLORS.assignedUserName} font-semibold truncate`,
                                    isMobile ? TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserNameInline.mobile : TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserNameInline.desktop
                                  )}
                                  style={{
                                    maxWidth: `${isMobile ? TASK_CARD_CALCULATIONS.assignedUser.nameMaxWidth.mobile : TASK_CARD_CALCULATIONS.assignedUser.nameMaxWidth.desktop}px`,
                                  }}
                                >
                                  {member.name}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{member.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-300">{member.email}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                    {task.assignedTo.length > 2 && (
                      <span className={cn(TASK_CARD_TEXT_COLORS.assignedUserCount, isMobile ? TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserCount.mobile : TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserCount.desktop)}>+{task.assignedTo.length - 2}</span>
                    )}
                </div>
              )}

              {/* Center/Right: Pomodoro Timer only (tracking badge moved to top on mobile) */}
              {showInlinePomodoroTimer && (
                <div className="flex items-center gap-1 flex-shrink-0">
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
                </div>
              )}
            </div>
          ) : (
            // Absolute positioning for desktop or tasks >= 45 mins
            <>
              {/* Assignee Display - Positioned in lower left corner */}
              {task.assignedTo && task.assignedTo.length > 0 && (
                <div
                  className={cn(
                    "absolute flex items-center flex-wrap",
                    isMobile ? "gap-1" : "gap-2",
                  )}
                  style={{
                    bottom: `${isMobile ? TASK_CARD_POSITIONING.assignedUsers.bottom.mobile : TASK_CARD_POSITIONING.assignedUsers.bottom.desktop}px`,
                    left: `${isMobile ? TASK_CARD_POSITIONING.assignedUsers.left.mobile : TASK_CARD_POSITIONING.assignedUsers.left.desktop}px`,
                    maxWidth: `calc(100% - ${isMobile ? TASK_CARD_CALCULATIONS.assignedUser.containerOffset.mobile : TASK_CARD_CALCULATIONS.assignedUser.containerOffset.desktop}px)`,
                  }}
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
                              <div 
                                className={cn(
                                  `rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.text} flex items-center justify-center font-semibold`,
                                  isMobile ? TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile : TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.desktop,
                                )}
                                style={{
                                  width: `${isMobile ? TASK_CARD_CALCULATIONS.assignedUser.avatarSize.mobile.width : TASK_CARD_CALCULATIONS.assignedUser.avatarSize.desktop.width}px`,
                                  height: `${isMobile ? TASK_CARD_CALCULATIONS.assignedUser.avatarSize.mobile.height : TASK_CARD_CALCULATIONS.assignedUser.avatarSize.desktop.height}px`,
                                }}
                              >
                                {initials}
                              </div>
                              <span className={cn(
                                `${TASK_CARD_TEXT_COLORS.assignedUserName} font-semibold`,
                                isMobile ? TASK_CARD_FONT_SIZES.assignedUserName.mobile : TASK_CARD_FONT_SIZES.assignedUserName.desktop,
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
                    <span className={cn("text-gray-500 dark:text-gray-300", isMobile ? TASK_CARD_FONT_SIZES.assignedUserName.mobile : TASK_CARD_FONT_SIZES.assignedUserName.desktop)}>
                      {TASK_CARD_TEXT.moreAssigned(task.assignedTo.length - 3)}
                    </span>
                  )}
                </div>
              )}

              {/* Tracking Status - Show when timer is running (only for tasks >= 45 mins, tasks < 45 mins show at top) */}
              {task.estimatedTime && task.estimatedTime >= 45 && pomodoroIsRunning && (
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
              {showAbsolutePomodoroTimer && (
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
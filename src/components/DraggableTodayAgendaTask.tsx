import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_XS, ICON_SIZE_SM, ICON_SIZE_MD } from "../lib/layout-constants";
import { Badge } from "./ui/badge";
import { cn, getInitials, formatTimeAMPM, sanitizeHTML, hasHTMLTags, getDateString } from "../lib/utils";
import { toast } from "sonner";
import { useTasks } from "../contexts/TaskContext";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../lib/api";
import { getDateString } from "../lib/utils";
import { useTeam } from "../contexts/TeamContext";
import { usePermissions } from "../hooks/usePermissions";
import { usePomodoro } from "../contexts/PomodoroContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { PomodoroTimer } from "./PomodoroTimer";
import { useMobileLayout } from "../hooks/useMobileLayout";
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
  TASK_CARD_HEIGHT_CONFIG,
  TASK_CARD_STANDARD_HEIGHTS,
  TASK_CARD_CALCULATIONS,
  TASK_CARD_LINE_CLAMP,
  TASK_CARD_BACKGROUNDS,
  TASK_CARD_BORDERS,
  TASK_CARD_SHADOWS,
  TASK_CARD_RICH_TEXT_COLORS,
  TASK_CARD_ASSIGNED_USER_COLORS,
  TASK_CARD_POSITIONING,
  TASK_CARD_OPACITY,
  TASK_CARD_TIMELINE,
  TASK_CARD_ADDITIONAL_FONT_SIZES,
  TASK_CARD_WIDTHS,
  TASK_CARD_TEXT_COLORS,
  TASK_CARD_ICON_COLORS,
  TASK_CARD_ARIA_AND_LABELS,
} from "../lib/task-card-constants";
import { Z_INDEX } from "../lib/layout-constants";
import { TODAY_AGENDA_TEXT } from "../lib/today-agenda-constants";
import { COLOR_TEXT_WHITE } from "../lib/color-theme";
import { getTaskMinutes } from "../lib/daily-hours-utils";

interface DraggableTodayAgendaTaskProps {
  task: Task;
  index: number;
  totalTasks: number;
  onClick: (task: Task) => void;
  getTaskHeight: (task: Task) => number;
  getTaskTime: (task: Task) => string;
  getPriorityColor: (priority: Task["priority"]) => string;
  isNextUp?: boolean;
  /** Called when task is marked complete; pass card element for confetti origin. */
  onComplete?: (originElement?: HTMLElement | null) => void;
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
  const { updateTask, addTask, tasks } = useTasks();
  const { getTeamMember } = useTeam();
  const { hasFeature } = useSubscription();
  const permissionsResult = usePermissions();
  const permissions = permissionsResult || {
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: true,
    canAssignTask: true,
    canManageTeam: true,
    canViewAnalytics: true,
    role: 'admin' as const,
  };
  const { getTimerState, timers: pomodoroTimers } = usePomodoro();
  const { actualTheme } = useTheme();
  const shouldUseMobileLayout = useMobileLayout(); // Covers mobile, iPad, tablet, and landscape on smaller screens
  const isMobile = shouldUseMobileLayout; // Keep isMobile for backward compatibility with existing code
  // For recurring tasks, use occurrence-specific ID for pomodoro timer to ensure each occurrence has its own timer state
  // This prevents the timer from being shared across all occurrences in the series
  const isRecurringTask = task.recurrence && task.recurrence.type !== 'none';
  const pomodoroTimerId = isRecurringTask && task.scheduledDate
    ? `${task.id}__${getDateString(new Date(task.scheduledDate))}`
    : task.id;
  const timerState = getTimerState(pomodoroTimerId);
  const isDark = actualTheme === 'dark';
  const canUsePomodoro = hasFeature("pomodoroTimer");
  
  // Subscribe to timer state changes to ensure re-render when timer is activated in other components
  React.useEffect(() => {
    // Accessing pomodoroTimers[pomodoroTimerId] ensures re-render when that timer changes
    // Use occurrence-specific ID for recurring tasks to track the correct timer
  }, [pomodoroTimers[pomodoroTimerId], pomodoroTimerId]);
  
  // Memoize key values that affect height to create stable dependencies
  const assignedToKey = React.useMemo(() => 
    task.assignedTo ? `${task.assignedTo.length}-${task.assignedTo.join(',')}` : 'none',
    [task.assignedTo]
  );
  const subtasksKey = React.useMemo(() => 
    task.subtasks ? `${task.subtasks.length}-${task.subtasks.map(s => s.id).join(',')}` : 'none',
    [task.subtasks]
  );
  
  // Calculate task duration categories for use in both height calculation and JSX render
  const estimatedTimeValue = typeof task.estimatedTime === "number" ? task.estimatedTime : null;
  const isShortTask = typeof estimatedTimeValue === "number" && estimatedTimeValue < TASK_CARD_HEIGHT_CONFIG.thresholds.short;
  const isMediumTask = typeof estimatedTimeValue === "number" && estimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && estimatedTimeValue < TASK_CARD_HEIGHT_CONFIG.thresholds.long;
  const isLongTask = typeof estimatedTimeValue === "number" && estimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.long;
  
  // Calculate dynamic height using standard heights with auto-adjustment
  // This matches the logic in DraggableTaskCard for consistency
  // IMPORTANT: Use AI Duration Estimator instead of hardcoded fallback
  const taskCardHeight = React.useMemo(() => {
    // Use AI estimator to get accurate duration (handles null/0/undefined cases)
    const duration = getTaskMinutes(task);
    const maxHeight = TASK_CARD_HEIGHT_CONFIG.maxHeight;
    const currentEstimatedTimeValue = typeof task.estimatedTime === "number" ? task.estimatedTime : null;
    const hasEstimatedTime = currentEstimatedTimeValue !== null;
    const currentCanUsePomodoro = canUsePomodoro;
    const currentPomodoroIsRunning = currentCanUsePomodoro && timerState.isRunning;
    const currentShowTrackingBadgeTopRow =
      hasEstimatedTime &&
      currentEstimatedTimeValue < TASK_CARD_HEIGHT_CONFIG.thresholds.short &&
      currentCanUsePomodoro &&
      timerState.isRunning;
    const currentShowTrackedTimeTopRow =
      hasEstimatedTime &&
      currentEstimatedTimeValue < TASK_CARD_HEIGHT_CONFIG.thresholds.short &&
      Boolean(task.actualTime && task.actualTime > 0) &&
      !timerState.isRunning;
    const currentShowInlinePomodoroTimer = Boolean(isShortTask && currentCanUsePomodoro);
    
    // Count badges that will be displayed in the top row
    const hasTime = !!(task.scheduledDate || task.dueDate);
    const hasPriority = true;
    const hasTag = task.tags && task.tags.length > 0;
    const hasDuration = !!task.estimatedTime;
    const hasTracking = currentShowTrackingBadgeTopRow;
    const hasTrackedTime = currentShowTrackedTimeTopRow;
    
    // Estimate if badges will wrap to second line
    const badgeCount = [hasTime, hasPriority, hasTag, hasDuration, hasTracking || hasTrackedTime].filter(Boolean).length;
    const estimatedBadgeWidth = badgeCount * TASK_CARD_CALCULATIONS.badgeWidths.average;
    const availableWidth = isMobile ? TASK_CARD_CALCULATIONS.availableWidth.mobile : TASK_CARD_CALCULATIONS.availableWidth.desktop;
    const badgesWillWrap = estimatedBadgeWidth > availableWidth;
    const badgeWrapHeight = badgesWillWrap ? TASK_CARD_HEIGHT_CONFIG.componentHeights.badgeWrap : 0;
    
    const hasPomodoro = currentPomodoroIsRunning;
    const hasAssignedUsers = task.assignedTo && task.assignedTo.length > 0;
    const hasTrackedTimeFull = task.actualTime && task.actualTime > 0;
    const hasDescription = !!task.description; // Always show description if present, regardless of duration
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    
    // STANDARD HEIGHT CALCULATION: Use standard heights first, then auto-adjust for components
    // Step 1: Get standard height for this duration using TASK_CARD_STANDARD_HEIGHTS
    const effectiveEstimatedTime = hasEstimatedTime ? currentEstimatedTimeValue! : getTaskMinutes(task);
    
    let baseHeight: number;
    // Use standard heights from TASK_CARD_STANDARD_HEIGHTS constants
    if (effectiveEstimatedTime <= 15) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at15mins;
    } else if (effectiveEstimatedTime <= 20) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at20mins;
    } else if (effectiveEstimatedTime <= 25) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at25mins;
    } else if (effectiveEstimatedTime <= 30) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at30mins;
    } else if (effectiveEstimatedTime <= 35) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at35mins;
    } else if (effectiveEstimatedTime <= 40) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at40mins;
    } else if (effectiveEstimatedTime <= 45) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at45mins;
    } else if (effectiveEstimatedTime <= 50) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at50mins;
    } else if (effectiveEstimatedTime <= 60) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at60mins;
    } else if (effectiveEstimatedTime <= 70) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at70mins;
    } else if (effectiveEstimatedTime <= 80) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at80mins;
    } else if (effectiveEstimatedTime <= 90) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at90mins;
    } else if (effectiveEstimatedTime <= 120) {
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at120mins;
    } else {
      // For tasks > 120 mins, use same height as 120 mins
      baseHeight = TASK_CARD_STANDARD_HEIGHTS.at120mins;
    }
    
    // Step 2: Now add component heights on top of the standard base height
    
    // Auto-adjust: Add height for badge wrapping
    baseHeight += badgeWrapHeight;
    
    // Auto-adjust: Add height for description (if description exists)
    // Calculate actual description height based on content, with minimal padding
    if (hasDescription) {
      const estimatedLines = task.description ? Math.ceil(task.description.length / TASK_CARD_CALCULATIONS.description.charsPerLine) : 1;
      const lineHeight = TASK_CARD_CALCULATIONS.description.lineHeight;
      // Use actual line count, but ensure minimum of 1 line (16px) for very short descriptions
      // For tasks under 45 minutes, cap at 1 line
      // For tasks 45-60 minutes, cap at 2 lines
      let actualLines: number;
      if (isShortTask) {
        actualLines = Math.min(Math.max(estimatedLines, 1), 1); // Cap at 1 line for tasks < 45 mins
      } else if (isMediumTask) {
        actualLines = Math.min(Math.max(estimatedLines, 1), 2); // Cap at 2 lines for tasks 45-60 mins
      } else {
        actualLines = Math.max(estimatedLines, 1); // Full calculation for tasks >= 60 mins
      }
      const descriptionContentHeight = actualLines * lineHeight;
      // Add minimal bottom padding only when needed (0px if assigned users follow, 6px otherwise)
      const descriptionBottomPadding = (hasAssignedUsers && !hasSubtasks) 
        ? TASK_CARD_HEIGHT_CONFIG.componentHeights.description.bottomPadding.noGap
        : TASK_CARD_HEIGHT_CONFIG.componentHeights.description.bottomPadding.standard;
      const descriptionHeight = descriptionContentHeight + descriptionBottomPadding;
      baseHeight += descriptionHeight;
    }
    
    // Auto-adjust: Add height for assigned users (if present)
    if (hasAssignedUsers) {
      const assignedUsersBaseHeight = TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.base;
      const assignedUsersSpacing = (hasDescription && !hasSubtasks) 
        ? TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.spacing.reduced
        : TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.spacing.standard;
      baseHeight += assignedUsersBaseHeight + assignedUsersSpacing;
    }
    
    // Auto-adjust: Pomodoro timer is absolutely positioned, so it doesn't add to height
    // It overlays on top of the content at the bottom right corner
    
    // Auto-adjust: Add height for tracking badge if shown at bottom (for tasks >= 45 mins)
    // Rendered when: task.estimatedTime >= 45 mins && pomodoroIsRunning
    const trackingBadgeAtBottom = hasEstimatedTime && 
      currentEstimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && 
      hasPomodoro;
    if (trackingBadgeAtBottom) {
      // Tracking badge at bottom needs height (similar to tracked time)
      baseHeight += TASK_CARD_HEIGHT_CONFIG.componentHeights.trackedTime; // Use same height as tracked time
    }
    
    // Auto-adjust: Add height for tracked time display if present
    // Rendered when: task.estimatedTime >= 45 mins && task.actualTime > 0
    const trackedTimeAtBottom = hasEstimatedTime && 
      currentEstimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && 
      hasTrackedTimeFull;
    if (trackedTimeAtBottom) {
      // Only add height if tracked time is shown at bottom (not at top where it's part of badge row)
      baseHeight += TASK_CARD_HEIGHT_CONFIG.componentHeights.trackedTime;
    }
    
    // Auto-adjust: Add height for subtasks (if present)
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
    
    // Step 3: Apply timeline multiplier (1.247) for timeline view
    baseHeight *= TASK_CARD_HEIGHT_CONFIG.heightMultiplier;
    
    // Step 4: Enforce bounds - minimum based on task category, maximum 550px (both with multiplier)
    let minHeight: number;
    if (isShortTask) {
      minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.base * TASK_CARD_HEIGHT_CONFIG.heightMultiplier; // 80px minimum
    } else if (isMediumTask) {
      minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.medium.min * TASK_CARD_HEIGHT_CONFIG.heightMultiplier; // 120px minimum
    } else {
      minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.minHeight * TASK_CARD_HEIGHT_CONFIG.heightMultiplier; // 200px minimum
    }
    const effectiveMaxHeight = TASK_CARD_HEIGHT_CONFIG.maxHeight * TASK_CARD_HEIGHT_CONFIG.heightMultiplier; // 550px maximum
    
    return Math.max(Math.min(baseHeight, effectiveMaxHeight), minHeight);
  }, [
    // Base dependencies that affect height calculation
    task.estimatedTime, // CRITICAL: Must include estimatedTime so height recalculates when duration changes
    timerState.isRunning,
    assignedToKey,
    subtasksKey,
    task.actualTime,
    task.description,
    task.scheduledDate,
    task.dueDate,
    task.tags?.length,
    task.tags,
    canUsePomodoro,
    isMobile,
  ]);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
    disabled: shouldUseMobileLayout, // Disable drag on mobile, iPad, tablet, and landscape on smaller screens
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    // Allow normal touch scrolling on mobile/tablet, prevent on desktop for drag
    touchAction: (shouldUseMobileLayout ? "auto" : "none") as const,
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
    
    // Check permissions
    if (!permissions.canEditTask) {
      toast.error('Permission Denied', {
        description: 'Viewer role does not have permission to edit tasks. Please contact an admin.',
      });
      return;
    }
    
    const wasDone = task.status === "done";
    const willBeDone = !wasDone;
    
    updateTask(task.id, {
      status: willBeDone ? "done" : "todo",
      completedAt: willBeDone ? new Date().toISOString() : null,
    });

    // Show confetti when marking as complete
    if (willBeDone && onComplete) {
      onComplete(cardContentRef.current ?? undefined);
    }
  };

  const handlePomodoroTimeUpdate = async (minutes: number) => {
    try {
      // For recurring tasks, update the specific occurrence (completed occurrence if exists, otherwise current task)
      // This ensures time is tracked per occurrence, not shared across the series
      if (isRecurringTask && task.scheduledDate) {
        const scheduledDate = new Date(task.scheduledDate);
        scheduledDate.setHours(0, 0, 0, 0);
        const scheduledDateKey = getDateString(new Date(task.scheduledDate));
        const completedOccurrenceId = `${task.id}_completed_${scheduledDateKey}`;
        
        // Check if completed occurrence exists (task was already marked done)
        const completedOccurrence = tasks.find(t => t.id === completedOccurrenceId);
        if (completedOccurrence) {
          // Update the completed occurrence with tracked time
          await updateTask(completedOccurrenceId, {
            actualTime: minutes,
          });
        } else {
          // For active occurrences, ensure we're updating the occurrence-specific task
          // Check if occurrence-specific task exists (using same ID pattern as pomodoro timer)
          const activeOccurrenceId = `${task.id}__${scheduledDateKey}`;
          const activeOccurrence = tasks.find(t => t.id === activeOccurrenceId);
          
          if (activeOccurrence) {
            // Update the occurrence-specific task
            await updateTask(activeOccurrenceId, {
              actualTime: minutes,
            });
            } else {
              // No occurrence-specific task exists - create one to track time per occurrence
              // This ensures time is always stored per occurrence, not on the base task
              const baseTask = tasks.find(t => t.id === task.id);
              if (baseTask && baseTask.recurrence && baseTask.recurrence.type !== 'none' && workspaceId && accessToken) {
                // Create occurrence-specific task for time tracking (similar to completed occurrences)
                // Mark as non-recurring to prevent it from creating additional occurrences
                const occurrenceTask: Task = {
                  ...baseTask,
                  id: activeOccurrenceId,
                  actualTime: minutes,
                  recurrence: { type: 'none', interval: 1 }, // Mark as non-recurring (this is a specific occurrence)
                  // Keep the same scheduledDate so it appears on the correct date
                  scheduledDate: baseTask.scheduledDate,
                  // Preserve all other properties from base task
                  updatedAt: new Date().toISOString(),
                };
                // Save directly to API (similar to how completed occurrences are created)
                await api.saveTask(workspaceId, occurrenceTask);
                // Reload tasks to get the new occurrence-specific task
                await syncWithServer(workspaceId, true);
              } else {
                // Fallback: update current task if we can't create occurrence-specific task
                await updateTask(task.id, {
                  actualTime: minutes,
                });
              }
            }
        }
      } else {
        // Non-recurring task - update normally
        await updateTask(task.id, {
          actualTime: minutes,
        });
      }
    } catch (error) {
      console.error("Failed to update task time:", error);
    }
  };

  // Calculate positions for Next Up line to align with headline
  // Structure: Badge row (20px badge + 4px margin) -> Headline row -> Timeline Marker
  //   -> Time label (~18px) -> Time label margin (4px mb-1) -> Dot aligned with headline
  // Headline position from top: badge (20px) + badge margin (4px) + row gap (6px space-y-1.5) = 30px
  // Dot should align with headline center, which is approximately at 30px + headline line-height/2
  const badgeHeight = TASK_CARD_TIMELINE.badge.height;
  const badgeMargin = TASK_CARD_TIMELINE.badge.margin;
  const rowGap = isMobile ? TASK_CARD_TIMELINE.rowGap.mobile : TASK_CARD_TIMELINE.rowGap.desktop;
  const headlineStartPosition = badgeHeight + badgeMargin + rowGap; // ~26px on mobile, ~30px on desktop
  const headlineLineHeight = isMobile ? TASK_CARD_TIMELINE.headline.lineHeight.mobile : TASK_CARD_TIMELINE.headline.lineHeight.desktop;
  const headlineCenterPosition = headlineStartPosition + (headlineLineHeight / 2); // Center of headline (~40-42px)
  const timeLabelTextHeight = TASK_CARD_TIMELINE.timeLabel.height;
  const timeLabelMargin = TASK_CARD_TIMELINE.timeLabel.margin;
  const dotCenterOffset = headlineCenterPosition - timeLabelTextHeight - timeLabelMargin; // Position dot to align with headline center
  // taskCardHeight is now calculated above with useMemo
  const taskCardBottom = badgeHeight + badgeMargin + taskCardHeight; // Bottom of task card
  const lineHeight = taskCardBottom - headlineCenterPosition; // Line from headline center to bottom of task card

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 relative" style={{ overflow: 'visible' }}>
      {/* Next Up Badge - Above the task card */}
      {isNextUp && (
        <div className="flex gap-3 w-full min-w-0 relative mb-3">
          <div className="w-16 flex-shrink-0" />
          <span 
            className={cn(
              TASK_CARD_FONT_SIZES.duration.desktop,
              "font-bold tracking-wide px-1.5 py-0.5 rounded bg-primary text-primary-foreground self-start relative"
            )}
            style={{ zIndex: Z_INDEX.BADGE }}
          >
            {TODAY_AGENDA_TEXT.nextUp.toUpperCase()}
          </span>
        </div>
      )}

      {/* Task Row */}
      <motion.div
        ref={setNodeRef}
        style={{
          ...style,
          ...(!shouldUseMobileLayout && isDragging ? { opacity: TASK_CARD_OPACITY.dragging / 100 } : {})
        }}
        {...attributes}
        {...(shouldUseMobileLayout ? {} : listeners)} // Only apply drag listeners on desktop (not mobile/tablet)
        initial={{ opacity: 0, x: -20 }}
        animate={{ 
          opacity: isDragging ? 0.7 : (task.status === "done" ? 0.6 : 1), 
          x: 0 
        }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2, delay: index * 0.05 }}
          className={cn(
          "flex gap-3 group w-full min-w-0 relative transition-all duration-200",
          !shouldUseMobileLayout && isDragging ? `cursor-grabbing ${TASK_CARD_TIMELINE.scale.dragging}` : "",
          !shouldUseMobileLayout && !isDragging ? `cursor-grab ${TASK_CARD_TIMELINE.scale.hover}` : "",
        )}
        data-task-id={task.id}
      >
        {/* Timeline Marker */}
        <div
          className="flex flex-col items-center flex-shrink-0 w-16 relative"
          style={{ 
            height: `${taskCardHeight}px`, // Match task card height
            overflow: 'visible' 
          }}
        >
          <span className={cn(TASK_CARD_ADDITIONAL_FONT_SIZES.tooltipEmail, "text-muted-foreground dark:text-gray-300 mb-1 text-center relative z-10")}>
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
          {/* Show line for all tasks - extends to next task or bottom of card */}
          <div 
            className="absolute left-1/2 -translate-x-1/2"
            style={{ 
              zIndex: Z_INDEX.TIMELINE_LINE,
              width: `${TASK_CARD_POSITIONING.timelineLine.width}px`,
              // Line starts at headline center position (same as dot center)
              top: `${headlineCenterPosition}px`, // Headline center position (dot center)
              // For last task, line extends to bottom of card. For others, it extends to connect with next task
              height: index < totalTasks - 1 
                ? `${taskCardHeight - headlineCenterPosition}px` // Full height to connect with next task
                : `${taskCardHeight - headlineCenterPosition}px`, // Also full height for last task
              minHeight: `${TASK_CARD_POSITIONING.timelineLine.minHeight}px`, // Minimum visible line
              backgroundColor: isNextUp 
                ? `${getPriorityLineColor(task.priority)}${TASK_CARD_OPACITY.timelineLine.nextUp}` // 80% opacity for Next Up
                : getPriorityLineColor(task.priority), // Full color for regular tasks
            }}
          />
        </div>

        {/* Task Content - Match Kanban Week View */}
        <div className={cn("flex", TASK_CARD_SPACING.gap.card, "flex-1 min-w-0", isDragging && TASK_CARD_WIDTHS.dragging)}>
          {/* Compact Card - Match Kanban styling (priority line removed for timeline view) */}
          <div
            ref={cardContentRef}
            className={cn(
              "rounded-lg relative flex-1 overflow-hidden box-border",
              isDragging && TASK_CARD_TIMELINE.scale.dragging,
              // Responsive spacing between children - match Kanban styling
              TASK_CARD_SPACING.spaceY.mobile,
              TASK_CARD_SPACING.spaceY.desktop,
              // Background: solid on mobile, semi-transparent on desktop - match Kanban task card backgrounds
              isMobile ? TASK_CARD_BACKGROUNDS.mobile : TASK_CARD_BACKGROUNDS.desktop,
              // Responsive borders: thinner on mobile, standard on desktop - match Kanban styling
              `border-l border-b border-r ${TASK_CARD_BORDERS.mobile} ${TASK_CARD_BORDERS.desktop}`,
              // Shadows: better blending on mobile - match Kanban styling
              isMobile ? TASK_CARD_SHADOWS.mobile : TASK_CARD_SHADOWS.desktop,
              `${TASK_CARD_BACKGROUNDS.hover} ${TASK_CARD_SHADOWS.hover} ${TASK_CARD_BORDERS.hover} transition-all duration-200`,
              task.status === "done" && "opacity-60",
              isNextUp && TASK_CARD_TIMELINE.nextUp.ring,
              "flex-shrink-0 w-full",
              // Padding: based on components, not description (description is in dropdown) - match Kanban styling
              // Tasks with components: standard padding
              ((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && 
                (isMobile ? TASK_CARD_SPACING.medium.mobile.withComponents : TASK_CARD_SPACING.medium.desktop.withComponents),
              // Tasks without components: minimal padding
              !((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && 
                (isMobile ? TASK_CARD_SPACING.short.mobile : TASK_CARD_SPACING.short.desktop),
            )}
            style={{
              height: `${taskCardHeight}px`,
              minHeight: `${taskCardHeight}px`,
              maxHeight: `${taskCardHeight}px`,
              boxSizing: 'border-box', // Include padding in height calculation
            }}
            onClick={(e) => {
              if (!isDragging) {
                e.stopPropagation();
                onClick(task);
              }
            }}
          >
            {/* Row 1: Tag + Priority Badge + Duration + Tracking Badge (no checkbox - moved to headline) */}
            <div className={cn("flex items-center justify-between", isMobile ? "gap-1" : "gap-2")}>
              <div className={cn("flex items-center flex-1 min-w-0", isMobile ? "gap-1" : "gap-1.5")}>
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

                {task.estimatedTime && (
                  <span className={cn("text-gray-500 dark:text-gray-300 font-medium flex-shrink-0", isMobile ? "text-[11px]" : "text-[12px]")}>
                    {formatDuration(task.estimatedTime)}
                  </span>
                )}

                {/* Row 1 Col 4: Recurring icon (when task repeats) */}
                {task.recurrence && task.recurrence.type !== "none" && (
                  <Icon name="repeat" size={isMobile ? ICON_SIZE_MD : ICON_SIZE_LG} className={cn("flex-shrink-0", TASK_CARD_ICON_COLORS.body)} weight="duotone" />
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
                      <Icon name="timer" size={isMobile ? TASK_CARD_ICON_SIZES.timer.mobile : TASK_CARD_ICON_SIZES.timer.desktop} className="animate-spin" />
                      <span className="font-semibold">{TASK_CARD_TEXT.tracking}</span>
                    </div>
                  </div>
                )}

                {/* Tracked Time (if exists and not running) - shown at top (mobile and desktop for tasks < 45 mins) */}
                {task.estimatedTime && task.estimatedTime < 45 && (() => {
                  // UPDATED: For recurring tasks, time is tracked on the base task to maintain series progress
                  let displayTime = task.actualTime || 0;
                  if (isRecurringTask) {
                    // Extract base task ID (remove any existing occurrence suffix)
                    const baseTaskId = task.id.includes('__') 
                      ? task.id.split('__')[0] 
                      : task.id.includes('_completed_')
                        ? task.id.split('_completed_')[0]
                        : task.id;
                    
                    // Use base task time - time tracking is on the base task for series progress
                    const baseTask = tasks.find(t => t.id === baseTaskId);
                    if (baseTask && baseTask.actualTime) {
                      displayTime = baseTask.actualTime;
                    }
                  }
                  
                  return displayTime > 0 && !timerState.isRunning ? (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Icon 
                        name="timer"
                        size={isMobile ? TASK_CARD_ICON_SIZES.timer.mobile : TASK_CARD_ICON_SIZES.timer.desktop}
                        style={{ color: TASK_CARD_THEME_COLORS.primary }}
                      />
                      <span 
                        className={cn("font-medium", isMobile ? TASK_CARD_FONT_SIZES.trackedTime.mobile : TASK_CARD_FONT_SIZES.trackedTime.desktop)}
                        style={{ color: TASK_CARD_THEME_COLORS.primary }}
                      >
                        {formatTimer(displayTime)}
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Row 2: Mark complete + H3 Title */}
            <div className={cn("flex items-start mt-1", isMobile ? "gap-1 px-1 mb-0" : "gap-1.5 px-1 mb-0")}>
              <button
                onClick={handleToggleComplete}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn("flex-shrink-0 hover:opacity-80 transition-opacity mt-0.5", isMobile ? "w-3.5 h-3.5" : "w-4 h-4")}
                aria-label={task.status === "done" ? TASK_CARD_ARIA_AND_LABELS.markIncomplete : TASK_CARD_ARIA_AND_LABELS.markComplete}
              >
                <Icon
                  name="circle"
                  size={isMobile ? ICON_SIZE_SM : ICON_SIZE_MD}
                  className={cn(
                    "transition-colors",
                    task.status === "done"
                      ? isDark ? TASK_CARD_ICON_COLORS.tab.dark + " " + TASK_CARD_ICON_COLORS.tabCheckboxFill.dark : TASK_CARD_ICON_COLORS.tab.light + " " + TASK_CARD_ICON_COLORS.tabCheckboxFill.light
                      : "text-gray-300 dark:text-gray-400 hover:text-gray-400 dark:hover:text-gray-300",
                  )}
                  weight={task.status === "done" ? "fill" : "regular"}
                />
              </button>
              <h3
                className={cn(
                  "text-foreground dark:text-gray-100 leading-tight line-clamp-2 flex-1 font-semibold min-w-0",
                  task.status === "done" && "line-through text-gray-400 dark:text-gray-500",
                  isMobile ? "text-[15px]" : "text-[18px]",
                )}
              >
                {task.title}
              </h3>
            </div>

            {/* Row 3: Subhead (Description) - Show if description exists */}
            {task.description && (
              <div 
                className={cn(
                  `text-gray-500 dark:text-gray-300 leading-snug break-words ${TASK_CARD_FONT_SIZES.description} ${TASK_CARD_SPACING.description}`,
                  // For tasks under 45 minutes, limit to 1 line
                  isShortTask && TASK_CARD_LINE_CLAMP.description.under45mins,
                  // For tasks 45-60 minutes, limit to 2 lines
                  isMediumTask && TASK_CARD_LINE_CLAMP.description.oneHour,
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
                  hasHTMLTags(task.description) && `[&_code]:bg-muted [&_code]:dark:bg-muted [&_code]:${TASK_CARD_RICH_TEXT_COLORS.code.padding} [&_code]:${TASK_CARD_RICH_TEXT_COLORS.code.rounded} [&_code]:${TASK_CARD_RICH_TEXT_COLORS.code.fontSize} [&_code]:${TASK_CARD_RICH_TEXT_COLORS.code.fontFamily}`
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
                // Add padding when subtasks are shown to prevent overlapping on shorter tasks
                isMobile ? "pt-1.5 pb-1" : "pt-2 pb-1.5",
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
                          isMobile ? "text-[10px]" : "text-[11px]",
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
                  <div className={cn("text-gray-400 dark:text-gray-500", isMobile ? "text-[10px] pl-3" : "text-[11px] pl-4")}>
                    +{task.subtasks.length - 3} more
                  </div>
                )}
              </div>
            )}

            {/* Assignee Display and Time Tracker - Inline Layout at bottom left */}
            {(task.assignedTo && task.assignedTo.length > 0) || 
             (task.estimatedTime && task.estimatedTime >= 45 && (() => {
               // UPDATED: For recurring tasks, check base task time
               let hasTime = task.actualTime && task.actualTime > 0;
               if (isRecurringTask && !hasTime) {
                 const baseTaskId = task.id.includes('__') 
                   ? task.id.split('__')[0] 
                   : task.id.includes('_completed_')
                     ? task.id.split('_completed_')[0]
                     : task.id;
                 const baseTask = tasks.find(t => t.id === baseTaskId);
                 hasTime = baseTask && baseTask.actualTime && baseTask.actualTime > 0;
               }
               return (hasFeature("pomodoroTimer") && timerState.isRunning) || hasTime;
             })()) ||
             (isMobile && task.estimatedTime && task.estimatedTime >= 45 && hasFeature("pomodoroTimer")) ? (
              <div
                className={cn(
                  "absolute flex items-center",
                  isMobile ? "bottom-2 left-2 right-2 gap-1.5" : "bottom-2.5 left-2.5 gap-2 max-w-[calc(100%-80px)]",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Assignee Display */}
                {task.assignedTo && task.assignedTo.length > 0 && (
                  <div className={cn("flex items-center flex-shrink-0", isMobile ? "gap-1" : "gap-2")}>
                    {task.assignedTo.slice(0, 3).map((userId) => {
                      const member = getTeamMember(userId);
                      if (!member) return null;

                      const initials = getInitials(member.name);
                      const avatarSize = isMobile ? TASK_CARD_ASSIGNED_USER_COLORS.avatar.mobile : TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop;

                      return (
                        <TooltipProvider key={userId}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn("flex items-center flex-shrink-0", isMobile ? "gap-0.5" : "gap-1")}>
                                {member.avatar ? (
                                  <div 
                                    className="rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0"
                                    style={{
                                      width: `${avatarSize.width}px`,
                                      height: `${avatarSize.height}px`,
                                    }}
                                  >
                                    <img
                                      src={member.avatar}
                                      alt={member.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent) {
                                          const fallback = document.createElement('div');
                                          fallback.className = cn(
                                            `rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.gradientDark} ${TASK_CARD_ASSIGNED_USER_COLORS.text} ${TASK_CARD_ASSIGNED_USER_COLORS.textDark} flex items-center justify-center font-semibold`,
                                            isMobile ? TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile : TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.desktop
                                          );
                                          fallback.style.width = `${avatarSize.width}px`;
                                          fallback.style.height = `${avatarSize.height}px`;
                                          fallback.textContent = initials;
                                          parent.appendChild(fallback);
                                        }
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div 
                                    className={cn(
                                      `rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.gradientDark} ${TASK_CARD_ASSIGNED_USER_COLORS.text} ${TASK_CARD_ASSIGNED_USER_COLORS.textDark} flex items-center justify-center font-semibold`,
                                      isMobile ? TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile : TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.desktop
                                    )}
                                    style={{
                                      width: `${avatarSize.width}px`,
                                      height: `${avatarSize.height}px`,
                                    }}
                                  >
                                    {initials}
                                  </div>
                                )}
                                <span className={cn(
                                  `${TASK_CARD_TEXT_COLORS.assignedUserName} font-semibold whitespace-nowrap flex-shrink-0`,
                                  isMobile ? TASK_CARD_FONT_SIZES.assignedUserName.mobile : TASK_CARD_FONT_SIZES.assignedUserName.desktop,
                                )}>
                                  {member.name}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{member.name}</p>
                              <p className={`${TASK_CARD_TEXT_COLORS.tooltipEmail} ${TASK_CARD_FONT_SIZES.description}`}>
                                {member.email}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                    {task.assignedTo.length > 3 && (
                      <span className={cn("text-gray-500 dark:text-gray-300 flex-shrink-0", isMobile ? "text-[10px]" : "text-[11px]")}>
                        +{task.assignedTo.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Tracking Status - Show when timer is running (only for tasks >= 45 mins, tasks < 45 mins show at top) */}
                {task.estimatedTime && task.estimatedTime >= 45 && hasFeature("pomodoroTimer") && timerState.isRunning && (
                  <div className={cn(
                    "flex items-center animate-pulse flex-shrink-0",
                    isMobile ? "gap-0.5" : "gap-1"
                  )}>
                    <div 
                      className={cn(
                        "flex items-center rounded-full px-1.5 py-0.5 whitespace-nowrap",
                        isMobile ? "gap-0.5 text-[9px]" : "gap-1 text-[11px]"
                      )}
                      style={{
                        background: `linear-gradient(to right, ${TASK_CARD_THEME_COLORS.gradient.from}, ${TASK_CARD_THEME_COLORS.gradient.to})`,
                        color: COLOR_TEXT_WHITE,
                      }}
                    >
                      <Icon name="timer" size={isMobile ? TASK_CARD_ICON_SIZES.timer.mobile : TASK_CARD_ICON_SIZES.timer.desktop} className="animate-spin flex-shrink-0" />
                      <span className="font-semibold">{TASK_CARD_TEXT.tracking}</span>
                    </div>
                  </div>
                )}

                {/* Tracked Time (if exists) - only for tasks >= 45 mins, tasks < 45 mins show at top) */}
                {task.estimatedTime && task.estimatedTime >= 45 && (() => {
                  // UPDATED: For recurring tasks, time is tracked on the base task to maintain series progress
                  let displayTime = task.actualTime || 0;
                  if (isRecurringTask) {
                    // Extract base task ID (remove any existing occurrence suffix)
                    const baseTaskId = task.id.includes('__') 
                      ? task.id.split('__')[0] 
                      : task.id.includes('_completed_')
                        ? task.id.split('_completed_')[0]
                        : task.id;
                    
                    // Use base task time - time tracking is on the base task for series progress
                    const baseTask = tasks.find(t => t.id === baseTaskId);
                    if (baseTask && baseTask.actualTime) {
                      displayTime = baseTask.actualTime;
                    }
                  }
                  
                  return displayTime > 0 && !(hasFeature("pomodoroTimer") && timerState.isRunning) ? (
                    <div className={cn("flex items-center flex-shrink-0", isMobile ? "gap-0.5" : "gap-1")}>
                      <Icon 
                        name="timer"
                        size={isMobile ? TASK_CARD_ICON_SIZES.timerLarge.mobile : TASK_CARD_ICON_SIZES.timerLarge.desktop}
                        className="flex-shrink-0"
                        style={{ color: TASK_CARD_THEME_COLORS.primary }}
                      />
                      <span 
                        className={cn("font-medium whitespace-nowrap", isMobile ? TASK_CARD_FONT_SIZES.duration.mobile : TASK_CARD_FONT_SIZES.duration.desktop)}
                        style={{ color: TASK_CARD_THEME_COLORS.primary }}
                      >
                        {formatTimer(displayTime)} {TASK_CARD_TEXT.tracked}
                      </span>
                    </div>
                  ) : null;
                })()}

                {/* Pomodoro Timer - Inline on mobile, separate on desktop */}
                {isMobile && task.estimatedTime && task.estimatedTime >= 45 && hasFeature("pomodoroTimer") && (() => {
                  // UPDATED: For recurring tasks, time is tracked on the base task to maintain series progress
                  let occurrenceTime = task.actualTime || 0;
                  if (isRecurringTask) {
                    // Extract base task ID (remove any existing occurrence suffix)
                    const baseTaskId = task.id.includes('__') 
                      ? task.id.split('__')[0] 
                      : task.id.includes('_completed_')
                        ? task.id.split('_completed_')[0]
                        : task.id;
                    
                    // Use base task time - time tracking is on the base task for series progress
                    const baseTask = tasks.find(t => t.id === baseTaskId);
                    if (baseTask && baseTask.actualTime) {
                      occurrenceTime = baseTask.actualTime;
                    }
                  }
                  
                  return (
                    <div
                      className="flex items-center flex-shrink-0 ml-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PomodoroTimer
                        taskId={pomodoroTimerId}
                        taskTitle={task.title}
                        onTimeUpdate={handlePomodoroTimeUpdate}
                        compact={true}
                        initialTime={occurrenceTime}
                        estimatedTime={task.estimatedTime || undefined}
                        isMobile={isMobile}
                      />
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {/* Pomodoro Timer - Bottom right on desktop only (mobile is inline with assignee/tracker above) */}
            {task.estimatedTime && task.estimatedTime >= 45 && hasFeature("pomodoroTimer") && !isMobile && (() => {
              // UPDATED: For recurring tasks, time is tracked on the base task to maintain series progress
              let occurrenceTime = task.actualTime || 0;
              if (isRecurringTask) {
                // Extract base task ID (remove any existing occurrence suffix)
                const baseTaskId = task.id.includes('__') 
                  ? task.id.split('__')[0] 
                  : task.id.includes('_completed_')
                    ? task.id.split('_completed_')[0]
                    : task.id;
                
                // Use base task time - time tracking is on the base task for series progress
                const baseTask = tasks.find(t => t.id === baseTaskId);
                if (baseTask && baseTask.actualTime) {
                  occurrenceTime = baseTask.actualTime;
                }
              }
              
              return (
                <div
                  className={cn("absolute flex items-center", "bottom-2.5 right-2.5")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <PomodoroTimer
                    taskId={pomodoroTimerId}
                    taskTitle={task.title}
                    onTimeUpdate={handlePomodoroTimeUpdate}
                    compact={true}
                    initialTime={occurrenceTime}
                    estimatedTime={task.estimatedTime || undefined}
                    isMobile={isMobile}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
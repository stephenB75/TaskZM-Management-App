import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_XS, ICON_SIZE_SM, ICON_SIZE_MD, getCheckboxSizePxForWidth, getCheckboxVisualSizePxForWidth, VIEWPORT_BREAKPOINTS } from "../lib/layout-constants";
import { Badge } from "./ui/badge";
import { cn, getDateString } from "../lib/utils";
import { MINUTES_PER_HOUR, RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED, RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS } from "../lib/business-constants";
import { toast } from "sonner";
import { useTasks } from "../contexts/TaskContext";
import { useAuth } from "../contexts/AuthContext";
import { useTeam } from "../contexts/TeamContext";
import { usePermissions } from "../hooks/usePermissions";
import { usePomodoro } from "../contexts/PomodoroContext";
import { useTheme } from "../contexts/ThemeContext";
import { TaskCardInlinePomodoro } from "./TaskCardInlinePomodoro";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
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
import { Z_INDEX, TODAY_AGENDA_TIMELINE } from "../lib/layout-constants";
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
  const [checkboxSizePx, setCheckboxSizePx] = React.useState(() => getCheckboxSizePxForWidth(typeof window !== "undefined" ? window.innerWidth : VIEWPORT_BREAKPOINTS.desktop));
  const [visualSizePx, setVisualSizePx] = React.useState(() => getCheckboxVisualSizePxForWidth(typeof window !== "undefined" ? window.innerWidth : VIEWPORT_BREAKPOINTS.desktop));
  React.useEffect(() => {
    const onResize = () => {
      setCheckboxSizePx(getCheckboxSizePxForWidth(window.innerWidth));
      setVisualSizePx(getCheckboxVisualSizePxForWidth(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Use canonical occurrence id (_subtasks_) for recurring so timer state and stored time match the same record
  const isRecurringTask = task.recurrence && task.recurrence.type !== 'none';
  const baseId = isRecurringTask && task.id
    ? (task.id.includes(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS)
        ? task.id.split(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS)[0]
        : task.id.includes(RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED)
          ? task.id.split(RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED)[0]
          : task.id)
    : '';
  const pomodoroTimerId = isRecurringTask && task.scheduledDate && baseId
    ? `${baseId}${RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS}${getDateString(new Date(task.scheduledDate))}`
    : task.id;
  const timerState = getTimerState(pomodoroTimerId);
  const isDark = actualTheme === 'dark';
  const canUsePomodoro = hasFeature("pomodoroTimer");
  
  // Subscribe to timer state changes to ensure re-render when timer is activated in other components
  React.useEffect(() => {
    // Accessing pomodoroTimers[pomodoroTimerId] ensures re-render when that timer changes
    // Use occurrence-specific ID for recurring tasks to track the correct timer
  }, [pomodoroTimers[pomodoroTimerId], pomodoroTimerId]);
  
  // Today Agenda uses compact layout: tab + headline only; height from parent (TODAY_AGENDA_TIMELINE.taskRowHeightPx)
  const taskCardHeight = getTaskHeight(task);
  
  const cardContentRef = React.useRef<HTMLDivElement>(null);
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

  const getPriorityTabBackground = (priority: Task["priority"]) => {
    const colors = TASK_CARD_PRIORITY_COLORS[priority] ?? TASK_CARD_PRIORITY_COLORS.default;
    return isDark ? colors.tab.dark : colors.tab.light;
  };

  // Format duration display
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes >= MINUTES_PER_HOUR) {
      const hours = Math.floor(minutes / MINUTES_PER_HOUR);
      const mins = minutes % MINUTES_PER_HOUR;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  // Format timer display (actualTime tracked)
  const formatTimer = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const mins = minutes % MINUTES_PER_HOUR;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}`;
    }
    return `${mins}m`;
  };

  // Compact layout: tab row + headline only. Dot aligns with headline center.
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
      // Recurring: store time on canonical occurrence record (_subtasks_); updateTask creates it if missing
      if (isRecurringTask && task.scheduledDate) {
        const baseId = task.id.includes(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS)
          ? task.id.split(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS)[0]
          : task.id.includes(RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED)
            ? task.id.split(RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED)[0]
            : task.id;
        const scheduledDateKey = getDateString(new Date(task.scheduledDate));
        const completedOccurrenceId = `${baseId}${RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED}${scheduledDateKey}`;
        const completedOccurrence = tasks.find(t => t.id === completedOccurrenceId);
        if (completedOccurrence) {
          await updateTask(completedOccurrenceId, { actualTime: minutes });
        } else {
          const occurrenceSubtaskId = `${baseId}${RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS}${scheduledDateKey}`;
          await updateTask(occurrenceSubtaskId, { actualTime: minutes });
        }
      } else {
        await updateTask(task.id, { actualTime: minutes });
      }
    } catch (error) {
      console.error("Failed to update task time:", error);
    }
  };

  // Compact layout: tab row + headline only. Dot aligns with headline center.
  const tabHeightPx = TODAY_AGENDA_TIMELINE.tabHeightPx;
  const headlineLineHeight = isMobile ? TASK_CARD_TIMELINE.headline.lineHeight.mobile : TASK_CARD_TIMELINE.headline.lineHeight.desktop;
  const headlineCenterPosition = tabHeightPx + (headlineLineHeight / 2);
  const taskCardBottom = taskCardHeight;
  const lineHeight = taskCardBottom - headlineCenterPosition;

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 relative" style={{ overflow: 'visible' }}>
      {/* Next Up Badge - Above the task card */}
      {isNextUp && (
        <div className={cn("flex gap-3 w-full min-w-0 relative", TASK_CARD_TIMELINE.nextUp.badgeMarginBottom)}>
          <div className="w-16 flex-shrink-0" />
          <span 
            className="text-xs font-bold tracking-wide px-1 py-0.5 rounded bg-primary text-primary-foreground self-start relative"
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
              "rounded-lg relative flex-1 overflow-hidden box-border flex flex-col",
              isDragging && TASK_CARD_TIMELINE.scale.dragging,
              TASK_CARD_SPACING.spaceY.mobile,
              TASK_CARD_SPACING.spaceY.desktop,
              isMobile ? TASK_CARD_BACKGROUNDS.mobile : TASK_CARD_BACKGROUNDS.desktop,
              `border-l border-b border-r ${TASK_CARD_BORDERS.mobile} ${TASK_CARD_BORDERS.desktop}`,
              isMobile ? TASK_CARD_SHADOWS.mobile : TASK_CARD_SHADOWS.desktop,
              `${TASK_CARD_BACKGROUNDS.hover} ${TASK_CARD_SHADOWS.hover} ${TASK_CARD_BORDERS.hover} transition-all duration-200`,
              task.status === "done" && "opacity-60",
              isNextUp && TASK_CARD_TIMELINE.nextUp.ring,
              "flex-shrink-0 w-full",
              isMobile ? TASK_CARD_SPACING.short.mobile : TASK_CARD_SPACING.short.desktop,
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
            {/* Tab: one inline row (time, priority, tag, duration, [countdown when running], status circle) */}
            <div
              className="flex items-center rounded-lg px-3 gap-2 flex-1 min-w-0 text-white"
              style={{ height: TODAY_AGENDA_TIMELINE.tabHeightPx, backgroundColor: getPriorityTabBackground(task.priority) }}
            >
              <Icon name="clock" size={ICON_SIZE_SM} className="flex-shrink-0" />
              <span className="text-xs font-medium truncate">{getTaskTime(task)}</span>
              <span className="text-xs font-medium capitalize truncate">{task.priority}</span>
              <span className="text-xs truncate">{task.tags?.[0] ?? "Work"}</span>
              {task.estimatedTime ? (
                <span className="text-xs truncate">{formatDuration(task.estimatedTime)}</span>
              ) : null}
              {canUsePomodoro && task.status !== "done" && (
                <TaskCardInlinePomodoro
                  timerId={pomodoroTimerId}
                  durationMinutes={task.estimatedTime}
                  variant="tab"
                  isMobile={isMobile}
                  className={cn((timerState.isRunning || timerState.isPaused) && "ml-auto")}
                />
              )}
              <button
                type="button"
                onClick={handleToggleComplete}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  "flex-shrink-0 rounded-full hover:opacity-80 transition-opacity flex items-center justify-center",
                  !(timerState.isRunning || timerState.isPaused) && "ml-auto",
                )}
                style={{ minWidth: checkboxSizePx, minHeight: checkboxSizePx }}
                aria-label={task.status === "done" ? TASK_CARD_ARIA_AND_LABELS.markIncomplete : TASK_CARD_ARIA_AND_LABELS.markComplete}
              >
                <Icon
                  name="circle"
                  size={visualSizePx}
                  className="text-white/90"
                  weight={task.status === "done" ? "fill" : "regular"}
                />
              </button>
            </div>
            {/* Headline */}
            <h3
              className={cn(
                "text-foreground dark:text-gray-100 leading-tight line-clamp-2 font-semibold min-w-0 mt-1",
                task.status === "done" && "line-through text-gray-400 dark:text-gray-500",
                isMobile ? "text-[15px]" : "text-[18px]",
              )}
            >
              {task.title}
            </h3>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { cn, formatTimeAMPM, getInitials, sanitizeHTML, hasHTMLTags, calculateProgress, getDateString, calculateRecurringTaskSeriesTotalTime } from "../lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { useTasks } from "../contexts/TaskContext";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../lib/api";
import { useTeam } from "../contexts/TeamContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { usePermissions } from "../hooks/usePermissions";
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
  TASK_CARD_OPACITY,
  TASK_CARD_TAB_HEIGHT,
  TASK_CARD_TAB_SPACING,
  TASK_CARD_DROPDOWN_COLORS,
  TASK_CARD_DROPDOWN_DOMAIN_COLORS,
  TASK_CARD_DROPDOWN_BADGE_COLORS,
  getRandomDropdownColor,
  TASK_CARD_DROPDOWN,
  TASK_CARD_STANDARD_HEIGHTS,
  TASK_CARD_TIMELINE,
  TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE,
  TASK_CARD_EXPANDABLE,
} from "../lib/task-card-constants";
import { COLOR_PASTEL_LAVENDER, COLOR_BACKGROUND_WHITE, getColorWithOpacity } from "../lib/color-theme";
import { getTaskMinutes } from "../lib/daily-hours-utils";
import { MINUTES_PER_HOUR } from "../lib/business-constants";
import { COLOR_PRIMARY, COLOR_BACKGROUND_TRANSPARENT, COLOR_TEXT_WHITE } from "../lib/color-theme";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { useTaskBreakdown } from "../hooks/useTaskBreakdown";
import { TODAY_AGENDA_TEXT } from "../lib/today-agenda-constants";
import { ACTION_PLAN_CONFIG } from "../lib/ai-config";
import { INBOX_CHECKBOX_SIZE_MOBILE, INBOX_CHECKBOX_SIZE_DESKTOP } from "../lib/layout-constants";

interface DraggableTaskCardProps {
  task: Task;
  onClick: () => void;
  droppableId: string;
  isDragging?: boolean;
  isNextUp?: boolean;
  onComplete?: () => void;
}

export const DraggableTaskCard = React.forwardRef<
  HTMLDivElement,
  DraggableTaskCardProps
>(
  (
    { task, onClick, droppableId, isDragging = false, isNextUp = false, onComplete },
    forwardedRef,
  ) => {
    const { updateTask, tasks, workspaceId, syncWithServer } = useTasks();
    const { accessToken } = useAuth();
    const { getTeamMember, teams } = useTeam();
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
    const { getTimerState, timers: pomodoroTimers, startTimer, pauseTimer, stopTimer } = usePomodoro();
    const { actualTheme } = useTheme();
    const isDark = actualTheme === 'dark';
    const isMobile = useIsMobile();
    // Cards always start in closed (collapsed) state
    // Chevron-right (>) = closed state (default)
    // Chevron-down (v) = open state
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [zoomScale, setZoomScale] = React.useState(1);
    const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
    const cardRef = React.useRef<HTMLDivElement>(null);
    const taskInstanceKey = `${task.id}-${droppableId}`;
    const previousTaskInstanceKeyRef = React.useRef<string | null>(null);

    // Ensure cards always start collapsed (closed state with chevron-right)
    // Reset expanded state on mount and whenever task instance changes
    React.useEffect(() => {
      setIsExpanded(false);
      previousTaskInstanceKeyRef.current = taskInstanceKey;
    }, [taskInstanceKey]);

    // Detect zoom scale from parent container
    React.useEffect(() => {
      if (!cardRef.current) return;
      
      const checkZoom = () => {
        const element = cardRef.current;
        if (!element) return;
        
        // Use requestAnimationFrame to batch layout reads and avoid forced reflows
        requestAnimationFrame(() => {
          let parent = element.parentElement;
          while (parent) {
            // Batch getComputedStyle reads
            const style = window.getComputedStyle(parent);
            const transform = style.transform;
            if (transform && transform !== 'none') {
              const matrix = transform.match(/matrix\(([^)]+)\)/);
              if (matrix) {
                const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
                if (values.length >= 4) {
                  // Extract scale from matrix (first value is scaleX)
                  const scale = values[0];
                  if (scale !== 1 && scale > 0) {
                    setZoomScale(scale);
                    return;
                  }
                }
              }
            }
            parent = parent.parentElement;
          }
          setZoomScale(1);
        });
      };
      
      checkZoom();
      const observer = new MutationObserver(checkZoom);
      if (cardRef.current.parentElement) {
        observer.observe(cardRef.current.parentElement, { attributes: true, attributeFilter: ['style'] });
      }
      
      return () => observer.disconnect();
    }, []);
    
    // Calculate font size based on zoom: base size from constants, +2px when zoomed out (scale < 1)
    const dropdownFontSize = zoomScale < 1 ? TASK_CARD_DROPDOWN.fontSizes.zoomed : TASK_CARD_DROPDOWN.fontSizes.base;
    
    // AI Task Breakdown
    const { breakdown } = useTaskBreakdown(task.title || '', task.description || '', { enabled: true });

    // Removed auto-sync effect - user subtasks and AI suggestions are now separate
    // AI Suggestions will show user subtasks if they exist, otherwise show AI suggestions
    
    // Use task.id for all tasks to ensure timer sync across all components
    // (TaskDialog, TaskCard, TodayAgenda) - when timer is activated in one location,
    // it activates in all locations
    // For recurring tasks, use unique sortable ID per date occurrence to maintain chronological order
    const isRecurringTask = task.recurrence && task.recurrence.type !== 'none';
    const sortableId = isRecurringTask ? `${task.id}__${droppableId}` : task.id;
    
    // For recurring tasks, use occurrence-specific ID for pomodoro timer to ensure each occurrence has its own timer state
    // This prevents the timer from being shared across all occurrences in the series
    // Use task.scheduledDate to get the actual occurrence date (not droppableId which is the column date)
    const pomodoroTimerId = isRecurringTask && task.scheduledDate
      ? `${task.id}__${getDateString(new Date(task.scheduledDate))}`
      : task.id;
    const timerState = getTimerState(pomodoroTimerId);
    
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging: isSortableDragging,
    } = useSortable({
      id: sortableId,
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

      // Trigger confetti when marking as complete
      if (willBeDone && onComplete) {
        onComplete();
      }
    };

    const handlePomodoroTimeUpdate = async (
      minutes: number,
    ) => {
      try {
        // UPDATED: For recurring tasks, track time on the base task to maintain series progress
        // Time tracking is on the initial/base task, not per-occurrence
        if (isRecurringTask && task.scheduledDate) {
          // Extract base task ID (remove any existing occurrence suffix)
          const baseTaskId = task.id.includes('__') 
            ? task.id.split('__')[0] 
            : task.id.includes('_completed_')
              ? task.id.split('_completed_')[0]
              : task.id;
          
          // Update the base task with tracked time - this maintains progress across the series
          await updateTask(baseTaskId, {
            actualTime: minutes,
          });
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

    // Get priority-based tab background color - using constants (NO HARDCODE)
    const getPriorityTabBackgroundColor = (
      priority: Task["priority"],
    ): string => {
      const priorityKey = priority || 'default';
      const priorityColors = TASK_CARD_PRIORITY_COLORS[priorityKey] || TASK_CARD_PRIORITY_COLORS.default;
      return isDark ? priorityColors.tab.dark : priorityColors.tab.light;
    };

    // Get priority-based background gradient color (much lighter version of tab color)
    // Creates a subtle gradient that matches the priority tab but with low opacity for contrast
    const getPriorityBackgroundGradient = (
      priority: Task["priority"],
    ): string => {
      const priorityKey = priority || 'default';
      const priorityColors = TASK_CARD_PRIORITY_COLORS[priorityKey] || TASK_CARD_PRIORITY_COLORS.default;
      const tabColor = isDark ? priorityColors.tab.dark : priorityColors.tab.light;
      
      // Parse the tab color - handle both hex and rgba formats
      let baseColor: string;
      let existingOpacity: number = 1;
      
      if (tabColor.startsWith('rgba')) {
        // Extract rgba values
        const rgbaMatch = tabColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaMatch) {
          const r = parseInt(rgbaMatch[1]);
          const g = parseInt(rgbaMatch[2]);
          const b = parseInt(rgbaMatch[3]);
          existingOpacity = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
          // Convert to hex for base color
          baseColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        } else {
          baseColor = tabColor;
        }
      } else {
        baseColor = tabColor;
      }
      
      // Use increased opacity (30-40%) for the gradient to create more prominent priority color
      // This makes the background match the tab color with increased visibility
      // Multiply by existing opacity if it was already in rgba format
      const gradientOpacity = (isDark ? 0.30 : 0.40) * existingOpacity;
      const gradientColor = getColorWithOpacity(baseColor, gradientOpacity);
      
      // Gradient from priority color (light) at top to white/background at bottom
      const endColor = isDark 
        ? getColorWithOpacity(COLOR_BACKGROUND_WHITE, TASK_CARD_BACKGROUNDS.gradient.darkModeWhiteOpacity)
        : COLOR_BACKGROUND_WHITE;
      
      return `linear-gradient(to bottom, ${gradientColor}, ${endColor})`;
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

    const scheduledTimeLabel = formatTimeAMPM(
      task.scheduledDate || task.dueDate,
    );
    const estimatedTimeValue = typeof task.estimatedTime === "number" ? task.estimatedTime : null;
    const hasEstimatedTime = estimatedTimeValue !== null;
    // Calculate task duration categories for use in both height calculation and JSX render
    const isShortTask = typeof estimatedTimeValue === "number" && estimatedTimeValue < TASK_CARD_HEIGHT_CONFIG.thresholds.short;
    const isMediumTask = typeof estimatedTimeValue === "number" && estimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && estimatedTimeValue < TASK_CARD_HEIGHT_CONFIG.thresholds.long;
    const isLongTask = typeof estimatedTimeValue === "number" && estimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.long;
    // Tasks 35 mins or less need extra compact handling for auto-adjust
    const isVeryShortTask = typeof estimatedTimeValue === "number" && estimatedTimeValue <= 35;
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
      const hours = Math.floor(minutes / MINUTES_PER_HOUR);
      const mins = minutes % MINUTES_PER_HOUR;
      if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, "0")}`;
      }
      return `${mins}m`;
    };


    // Memoize key values that affect height to create stable dependencies
    const assignedToKey = React.useMemo(() => 
      task.assignedTo ? `${task.assignedTo.length}-${task.assignedTo.join(',')}` : 'none',
      [task.assignedTo]
    );
    const subtasksKey = React.useMemo(() => 
      task.subtasks ? `${task.subtasks.length}-${task.subtasks.map(s => s.id).join(',')}` : 'none',
      [task.subtasks]
    );
    const tagsKey = React.useMemo(() => 
      task.tags ? `${task.tags.length}-${task.tags.join(',')}` : 'none',
      [task.tags]
    );
    
    // Memoize card height calculation to ensure it recalculates when dependencies change
    // Calculate height directly in useMemo using standard heights from config
    // IMPORTANT: Use AI Duration Estimator instead of hardcoded fallback
    const cardHeight = React.useMemo(() => {
      // Recalculate all computed values inside useMemo based on current dependencies
      // Use AI estimator to get accurate duration (handles null/0/undefined cases)
      const duration = getTaskMinutes(task);
      const maxHeight = TASK_CARD_HEIGHT_CONFIG.maxHeight;
      const currentEstimatedTimeValue = typeof task.estimatedTime === "number" ? task.estimatedTime : null;
      const hasEstimatedTime = currentEstimatedTimeValue !== null;
      const isShortTask = typeof currentEstimatedTimeValue === "number" && currentEstimatedTimeValue < TASK_CARD_HEIGHT_CONFIG.thresholds.short;
      const isMediumTask = typeof currentEstimatedTimeValue === "number" && currentEstimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && currentEstimatedTimeValue < TASK_CARD_HEIGHT_CONFIG.thresholds.long;
      const isLongTask = typeof currentEstimatedTimeValue === "number" && currentEstimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.long;
      const currentCanUsePomodoro = hasFeature("pomodoroTimer");
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
      const inlinePomodoroPresent = currentShowInlinePomodoroTimer;
      // Description is now in dropdown tab, not in main card
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      
      // STANDARD HEIGHT CALCULATION: Use standard heights first, then auto-adjust for components
      // Calculate the standard height for this duration using TASK_CARD_STANDARD_HEIGHTS
      // Use AI Duration Estimator instead of hardcoded fallback
      const effectiveEstimatedTime = hasEstimatedTime ? currentEstimatedTimeValue! : getTaskMinutes(task);
      
      // Use standard heights from TASK_CARD_STANDARD_HEIGHTS constants
      let standardHeightForThisDuration: number;
      
      // For tasks under 30 minutes, add height for inline play button and chevron
      // Always add height if pomodoro is available or if there's any expandable content
      const hasExpandableContent = Boolean(
        task.description || 
        (task.subtasks && task.subtasks.length > 0) || 
        (task.dependencies && task.dependencies.length > 0) || 
        (task.assignedTo && task.assignedTo.length > 0)
      );
      const needsInlineControlsHeight = effectiveEstimatedTime <= 30 && (
        currentCanUsePomodoro || hasExpandableContent
      );
      const inlineControlsHeight = needsInlineControlsHeight 
        ? (isMobile ? TASK_CARD_HEIGHT_CONFIG.componentHeights.inlineControls.mobile : TASK_CARD_HEIGHT_CONFIG.componentHeights.inlineControls.desktop)
        : 0;
      
      if (effectiveEstimatedTime <= 15) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at15mins + inlineControlsHeight;
      } else if (effectiveEstimatedTime <= 20) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at20mins + inlineControlsHeight;
      } else if (effectiveEstimatedTime <= 25) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at25mins + inlineControlsHeight;
      } else if (effectiveEstimatedTime <= 30) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at30mins + inlineControlsHeight;
      } else if (effectiveEstimatedTime <= 35) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at35mins;
      } else if (effectiveEstimatedTime <= 40) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at40mins;
      } else if (effectiveEstimatedTime <= 45) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at45mins;
      } else if (effectiveEstimatedTime <= 50) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at50mins;
      } else if (effectiveEstimatedTime <= 60) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at60mins;
      } else if (effectiveEstimatedTime <= 70) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at70mins;
      } else if (effectiveEstimatedTime <= 80) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at80mins;
      } else if (effectiveEstimatedTime <= 90) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at90mins;
      } else if (effectiveEstimatedTime <= 120) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at120mins;
      } else {
        // For tasks > 120 mins, use same height as 120 mins
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at120mins;
      }
      
      // No auto-adjust - return the standard height directly
      return standardHeightForThisDuration;
    }, [
      // Base dependencies that affect height calculation
      task.estimatedTime, // CRITICAL: Must include estimatedTime so height recalculates when duration changes
      timerState.isRunning,
      assignedToKey,
      subtasksKey,
      tagsKey,
      task.actualTime,
      task.description,
      task.scheduledDate,
      task.dueDate,
      task.assignedTo,
      task.subtasks,
      task.dependencies,
      hasFeature, // Include hasFeature function to ensure recalculation when feature availability changes
      isMobile,
    ]);
    
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
        ref={cardRef}
        className={cn(
          "relative flex flex-col",
          isDragging ? TASK_CARD_WIDTHS.dragging : TASK_CARD_WIDTHS.normal
        )}
      >
        {/* Next Up Badge - Above the task card */}
        {isNextUp && (
          <div className="w-full mb-1">
            <span 
              className={cn(
                TASK_CARD_FONT_SIZES.duration.desktop,
                "font-bold tracking-wide px-1.5 py-0.5 rounded bg-primary text-primary-foreground inline-block"
              )}
            >
              {TODAY_AGENDA_TEXT.nextUp.toUpperCase()}
            </span>
          </div>
        )}
        {/* Main Card Layer */}
        <div
          ref={setNodeRef}
          style={{
            ...style,
            touchAction: isMobile ? "auto" : "none", // Allow normal touch on mobile
            zIndex: 2,
            position: 'relative',
            ...(!isMobile && (isDragging || isSortableDragging) ? { opacity: TASK_CARD_OPACITY.draggingKanban / 100 } : {}),
          }}
          {...attributes}
          {...(isMobile ? {} : listeners)} // Only apply drag listeners on desktop
          className={cn(
            "w-full flex gap-2 transition-all duration-200",
            !isMobile && (isDragging || isSortableDragging)
              ? `cursor-grabbing ${TASK_CARD_TIMELINE.scale.draggingKanban} ring-2 ring-primary/50 ring-offset-2`
              : "",
            !isMobile && !(isDragging || isSortableDragging)
              ? `cursor-grab ${TASK_CARD_TIMELINE.scale.hoverKanban}`
              : "",
          )}
          data-dnd-kit-dragging={isDragging || isSortableDragging}
          data-task-card="true"
          data-task-id={task.id}
          data-sortable-id={sortableId}
          id={`task-${sortableId}`}
          data-tour="task-card"
        >
        {/* Compact Card - Partial borders, lavender gradient background, height represents duration */}
          <div
            className={cn(
              "rounded-lg relative box-border flex flex-col",
              isExpanded ? "overflow-visible" : "overflow-hidden", // Strictly hide overflow when collapsed to enforce size guide
              isExpanded && "rounded-b-none", // Remove bottom radius when expanded
              // Responsive spacing between children
              TASK_CARD_SPACING.spaceY.mobile,
              TASK_CARD_SPACING.spaceY.desktop,
              // Responsive borders: thinner on mobile, standard on desktop
              `border-l border-b border-r ${TASK_CARD_BORDERS.mobile} ${TASK_CARD_BORDERS.desktop}`,
              // Shadows: better blending on mobile
              isMobile ? TASK_CARD_SHADOWS.mobile : TASK_CARD_SHADOWS.desktop,
              `${TASK_CARD_SHADOWS.hover} ${TASK_CARD_BORDERS.hover} transition-all duration-200`,
              task.status === "done" && "opacity-60",
              "flex-shrink-0 w-full",
              // Padding: minimal padding for collapsed cards
              isMobile ? TASK_CARD_SPACING.short.mobile : TASK_CARD_SPACING.short.desktop,
            )}
          style={{
            // Strictly enforce size guide: exact height when collapsed, auto when expanded
            height: isExpanded ? 'auto' : `${cardHeight}px`,
            minHeight: isExpanded ? 'auto' : `${cardHeight}px`,
            maxHeight: isExpanded ? 'none' : `${cardHeight}px`,
            boxSizing: 'border-box', // Include padding in height calculation
            flexShrink: 0, // Prevent flex from shrinking the card
            // Priority-based gradient: lighter version of tab color at top fading to white at bottom
            background: getPriorityBackgroundGradient(task.priority),
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
              // Defer onClick to next frame to avoid blocking click handler and prevent forced reflows
              requestAnimationFrame(() => {
                onClick();
              });
            }
          }}
        >
          {/* Top Tab Section - Pill-shaped tab (rounded square with moderate rounded corners) centered with space from top */}
          <div className="flex justify-center" style={{ marginTop: isMobile ? TASK_CARD_TAB_SPACING.marginTop.mobile : TASK_CARD_TAB_SPACING.marginTop.desktop }}>
            {/* Pill-shaped tab with priority color - centered, containing all content, auto width to fit contents, less rounded corners */}
            <div 
              className="rounded-lg flex items-center justify-between"
              style={{ 
                backgroundColor: getPriorityTabBackgroundColor(task.priority),
                height: isMobile ? `${TASK_CARD_TAB_HEIGHT.mobile}px` : `${TASK_CARD_TAB_HEIGHT.desktop}px`,
                minHeight: isMobile ? `${TASK_CARD_TAB_HEIGHT.mobile}px` : `${TASK_CARD_TAB_HEIGHT.desktop}px`,
                gap: isMobile ? TASK_CARD_TAB_SPACING.gap.mobile : TASK_CARD_TAB_SPACING.gap.desktop,
                width: 'auto',
                minWidth: isMobile ? `${TASK_CARD_TAB_HEIGHT.mobile}px` : `${TASK_CARD_TAB_HEIGHT.desktop}px`,
                maxWidth: '95%', // Allow tab to expand but keep some margin from card edges
                paddingLeft: isMobile ? '0.5rem' : '0.75rem', // px-2 or px-3
                paddingRight: isMobile ? '0.5rem' : '0.75rem',
              }}
            >
              <div className="flex items-center flex-1 min-w-0 justify-center whitespace-nowrap" style={{ gap: isMobile ? TASK_CARD_TAB_SPACING.gap.mobile : TASK_CARD_TAB_SPACING.gap.desktop }}>
                {/* Scheduled Time with Clock Icon */}
                {scheduledTimeLabel && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Icon name="clock" size={isMobile ? TASK_CARD_ICON_SIZES.clock.mobile : TASK_CARD_ICON_SIZES.clock.desktop} className={isDark ? "text-white" : "text-gray-800"} />
                    <span className={cn(isDark ? "text-white" : "text-gray-800", "font-normal", isMobile ? TASK_CARD_FONT_SIZES.time.mobile : TASK_CARD_FONT_SIZES.time.desktop)}>
                      {scheduledTimeLabel}
                    </span>
                  </div>
                )}

                {/* Priority Badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md border capitalize flex-shrink-0 font-bold bg-transparent",
                    isDark 
                      ? "border-white text-white" 
                      : "border-gray-800 text-gray-800",
                    isMobile ? TASK_CARD_BADGE_SIZES.priority.mobile : TASK_CARD_BADGE_SIZES.priority.desktop,
                  )}
                >
                  {task.priority}
                </Badge>

                {/* Tag Badge */}
                {task.tags && task.tags.length > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "border-0 flex-shrink-0 bg-transparent",
                      isDark ? "text-white" : "text-gray-800",
                      isMobile ? TASK_CARD_BADGE_SIZES.tag.mobile : TASK_CARD_BADGE_SIZES.tag.desktop,
                    )}
                  >
                    {task.tags[0]}
                  </Badge>
                )}

                {/* Duration */}
                {task.estimatedTime && (
                  <span className={cn(isDark ? "text-white" : "text-gray-800", "font-semibold flex-shrink-0", isMobile ? TASK_CARD_FONT_SIZES.duration.mobile : TASK_CARD_FONT_SIZES.duration.desktop)}>
                    {formatDuration(task.estimatedTime)}
                  </span>
                )}
              </div>

              {/* Complete Checkbox */}
              <button
                onClick={handleToggleComplete}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                <Icon 
                  name="circle"
                  size={isMobile ? TASK_CARD_ICON_SIZES.checkbox.mobile : TASK_CARD_ICON_SIZES.checkbox.desktop}
                  className={cn(
                    "transition-colors flex-shrink-0",
                    isDark ? "text-white" : "text-gray-800",
                    task.status === "done" && (isDark ? "fill-white" : "fill-gray-800"),
                  )}
                  weight={task.status === "done" ? "fill" : "regular"}
                />
              </button>
            </div>
          </div>

          {/* Headline (Title) - Underneath the tab */}
          <div className={cn("flex items-start px-2 pt-2", isMobile ? "pb-1" : "pb-1.5")}>
            {task.recurrence && task.recurrence.type !== "none" && (
              <Icon name="repeat" size={isMobile ? TASK_CARD_ICON_SIZES.repeat.mobile : TASK_CARD_ICON_SIZES.repeat.desktop} className={cn(isDark ? "text-purple-300" : "text-purple-700", "flex-shrink-0 mt-0.5 mr-1")} weight="duotone" />
            )}
            <h3
              className={cn(
                "text-foreground dark:text-gray-100 leading-tight flex-1 font-normal",
                TASK_CARD_LINE_CLAMP.title,
                task.status === "done" && "line-through text-gray-400 dark:text-gray-500",
                isMobile ? TASK_CARD_FONT_SIZES.title.mobile : TASK_CARD_FONT_SIZES.title.desktop,
              )}
            >
              {task.title}
            </h3>
          </div>

          {/* AI Suggestions - Directly underneath headline (always visible) */}
          {/* Show user subtasks if they exist, otherwise show AI suggestions */}
          {(() => {
            // Check if user has custom subtasks (not from AI)
            const hasUserSubtasks = task.subtasks && task.subtasks.length > 0 && 
              task.subtasks.some(st => !st.id.startsWith(`ai-step-${task.id}-`));
            
            // Determine what to show: user subtasks or AI suggestions
            const itemsToShow = hasUserSubtasks 
              ? task.subtasks.filter(st => !st.id.startsWith(`ai-step-${task.id}-`)) // Show only user-created subtasks
              : (breakdown?.actionPlan?.steps && Array.isArray(breakdown.actionPlan.steps) && breakdown.actionPlan.steps.length > 0 
                  ? breakdown.actionPlan.steps 
                  : null);
            
            if (!itemsToShow || itemsToShow.length === 0) return null;
            
            // Get domain-specific colors
            const domainColors = breakdown?.domain === 'business' 
              ? { bg: isDark ? 'bg-blue-950/20 border-blue-800/30' : 'bg-blue-50/50 border-blue-200', text: isDark ? 'text-blue-300' : 'text-blue-700', textMuted: isDark ? 'text-blue-400' : 'text-blue-600', textLight: isDark ? 'text-blue-200' : 'text-blue-800', border: isDark ? 'border-blue-800/30' : 'border-blue-200' }
              : breakdown?.domain === 'home'
              ? { bg: isDark ? 'bg-green-950/20 border-green-800/30' : 'bg-green-50/50 border-green-200', text: isDark ? 'text-green-300' : 'text-green-700', textMuted: isDark ? 'text-green-400' : 'text-green-600', textLight: isDark ? 'text-green-200' : 'text-green-800', border: isDark ? 'border-green-800/30' : 'border-green-200' }
              : breakdown?.domain === 'personal'
              ? { bg: isDark ? 'bg-purple-950/20 border-purple-800/30' : 'bg-purple-50/50 border-purple-200', text: isDark ? 'text-purple-300' : 'text-purple-700', textMuted: isDark ? 'text-purple-400' : 'text-purple-600', textLight: isDark ? 'text-purple-200' : 'text-purple-800', border: isDark ? 'border-purple-800/30' : 'border-purple-200' }
              : breakdown?.domain === 'world'
              ? { bg: isDark ? 'bg-orange-950/20 border-orange-800/30' : 'bg-orange-50/50 border-orange-200', text: isDark ? 'text-orange-300' : 'text-orange-700', textMuted: isDark ? 'text-orange-400' : 'text-orange-600', textLight: isDark ? 'text-orange-200' : 'text-orange-800', border: isDark ? 'border-orange-800/30' : 'border-orange-200' }
              : { bg: isDark ? 'bg-gray-950/20 border-gray-800/30' : 'bg-gray-50/50 border-gray-200', text: isDark ? 'text-gray-300' : 'text-gray-700', textMuted: isDark ? 'text-gray-400' : 'text-gray-600', textLight: isDark ? 'text-gray-200' : 'text-gray-800', border: isDark ? 'border-gray-800/30' : 'border-gray-200' };
            
            // For short tasks, show only the first step (consistent with desktop view)
            const isShortTask = estimatedTimeValue !== null && estimatedTimeValue <= ACTION_PLAN_CONFIG.SHORT_TASK_THRESHOLD_MINUTES;
            const maxStepsToShow = isShortTask 
              ? ACTION_PLAN_CONFIG.MAX_STEPS_DISPLAY.SHORT_TASK 
              : ACTION_PLAN_CONFIG.MAX_STEPS_DISPLAY.NORMAL_TASK;
            
            // Calculate total estimated minutes for AI suggestions
            const totalEstimatedMinutes = hasUserSubtasks 
              ? 0 // User subtasks don't have estimated time
              : (breakdown?.actionPlan?.totalEstimatedMinutes || 0);
            
            return (
              <div className={cn("px-2 py-1.5 mb-1.5 rounded border", domainColors.bg)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE, marginLeft: `${isMobile ? TASK_CARD_EXPANDABLE.spacing.aiSuggestionsMargin.mobile : TASK_CARD_EXPANDABLE.spacing.aiSuggestionsMargin.desktop}px`, marginRight: `${isMobile ? TASK_CARD_EXPANDABLE.spacing.aiSuggestionsMargin.mobile : TASK_CARD_EXPANDABLE.spacing.aiSuggestionsMargin.desktop}px` }}>
                <div className="flex items-center gap-1 mb-1">
                  <Icon name="sparkles" size={isMobile ? TASK_CARD_ICON_SIZES.sparkles.mobile : TASK_CARD_ICON_SIZES.sparkles.desktop} className={isDark ? domainColors.text : domainColors.textMuted} weight="duotone" />
                  <span className={cn("font-semibold", domainColors.text)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                    AI Suggestions
                  </span>
                </div>
                <div className="space-y-0.5">
                  {(hasUserSubtasks 
                    ? itemsToShow.slice(0, maxStepsToShow)
                    : (itemsToShow as Array<{ action: string; estimatedMinutes: number; order?: number }>).slice(0, maxStepsToShow)
                  ).map((item: any, idx: number) => {
                    // Handle both user subtasks and AI steps
                    const isUserSubtask = hasUserSubtasks;
                    const itemTitle = isUserSubtask ? item.title : item.action;
                    const itemId = isUserSubtask ? item.id : `ai-step-${task.id}-${item.order || idx + 1}`;
                    const estimatedMinutes = isUserSubtask ? 0 : (item.estimatedMinutes || 0);
                    const isCompleted = isUserSubtask ? item.completed : (task.subtasks?.find(st => 
                      st.title.toLowerCase().trim() === itemTitle.toLowerCase().trim() ||
                      st.id === itemId
                    )?.completed || false);

                    const handleToggle = async (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!permissions.canEditTask) {
                        toast.error('Permission Denied', {
                          description: 'Viewer role does not have permission to edit tasks.',
                        });
                        return;
                      }

                      if (isUserSubtask) {
                        // Update user subtask
                        const updatedSubtasks = task.subtasks.map(st =>
                          st.id === itemId
                            ? { ...st, completed: !st.completed }
                            : st
                        );
                        await updateTask(task.id, { subtasks: updatedSubtasks });
                      } else {
                        // Handle AI step
                        const stepSubtask = task.subtasks?.find(st => 
                          st.title.toLowerCase().trim() === itemTitle.toLowerCase().trim() ||
                          st.id === itemId
                        );
                        if (stepSubtask) {
                          // Update existing subtask
                          const updatedSubtasks = task.subtasks.map(st =>
                            st.id === stepSubtask.id
                              ? { ...st, completed: !st.completed }
                              : st
                          );
                          await updateTask(task.id, { subtasks: updatedSubtasks });
                        } else {
                          // Create new subtask from AI step
                          const newSubtask = {
                            id: itemId,
                            title: itemTitle,
                            completed: true,
                            createdAt: new Date().toISOString(),
                          };
                          const updatedSubtasks = [...(task.subtasks || []), newSubtask];
                          await updateTask(task.id, { subtasks: updatedSubtasks });
                        }
                      }
                    };

                    return (
                      <div key={isUserSubtask ? itemId : idx} className="flex items-start gap-1.5">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={(checked) => {
                            const syntheticEvent = { stopPropagation: () => {} } as React.MouseEvent;
                            handleToggle(syntheticEvent);
                          }}
                          onClick={handleToggle}
                          className="mt-0.5 flex-shrink-0"
                          style={{
                            width: isMobile ? INBOX_CHECKBOX_SIZE_MOBILE : INBOX_CHECKBOX_SIZE_DESKTOP,
                            height: isMobile ? INBOX_CHECKBOX_SIZE_MOBILE : INBOX_CHECKBOX_SIZE_DESKTOP,
                            minWidth: isMobile ? INBOX_CHECKBOX_SIZE_MOBILE : INBOX_CHECKBOX_SIZE_DESKTOP,
                            minHeight: isMobile ? INBOX_CHECKBOX_SIZE_MOBILE : INBOX_CHECKBOX_SIZE_DESKTOP,
                          }}
                        />
                        <span className={cn("leading-tight flex-1", domainColors.textLight, isCompleted && "line-through opacity-60")} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                          {itemTitle}
                        </span>
                        {!isUserSubtask && estimatedMinutes > 0 && (
                          <span className={cn("flex-shrink-0", domainColors.textMuted)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                            {estimatedMinutes}m
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {!hasUserSubtasks && (itemsToShow as Array<{ action: string; estimatedMinutes: number; order?: number }>).length > maxStepsToShow && (
                    <div className={cn("mt-0.5", domainColors.textMuted)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                      +{(itemsToShow as Array<{ action: string; estimatedMinutes: number; order?: number }>).length - maxStepsToShow} more steps
                    </div>
                  )}
                  {!hasUserSubtasks && totalEstimatedMinutes > 0 && (
                    <div className={cn("mt-0.5 pt-0.5 border-t", domainColors.border)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                      Total: {Math.floor(totalEstimatedMinutes / 60)}h {totalEstimatedMinutes % 60}m
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

            {/* Pomodoro Controls + Tracked Info + Chevron - Inline underneath AI Suggestions */}
          <div className={cn("flex items-center justify-between px-2", isMobile ? "py-1" : "py-1.5")}>
            <div className="flex items-center gap-1.5 flex-1">
              {/* Pomodoro Play/Pause/Stop Controls */}
              {canUsePomodoro && (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                  {pomodoroIsRunning ? (
                    <>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await pauseTimer(pomodoroTimerId);
                        }}
                        className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Icon name="pause" size={16} className="text-gray-700 dark:text-gray-300" weight="fill" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await stopTimer(pomodoroTimerId);
                        }}
                        className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Icon name="stop" size={isMobile ? TASK_CARD_ICON_SIZES.playPauseStop.mobile : TASK_CARD_ICON_SIZES.playPauseStop.desktop} className="text-gray-700 dark:text-gray-300" weight="fill" />
                      </button>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">Tracking ....</span>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startTimer(pomodoroTimerId);
                      }}
                      className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Icon name="play" size={16} className="text-gray-700 dark:text-gray-300" weight="fill" />
                    </button>
                  )}
                </div>
              )}
              {/* Tracked Time - Inline with play button */}
              {!pomodoroIsRunning && (() => {
                // For recurring tasks, get the correct occurrence's time (completed occurrence if exists, otherwise current task)
                let occurrenceTime = task.actualTime || 0;
                // UPDATED: For recurring tasks, time is tracked on the base task to maintain series progress
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
                
                if (occurrenceTime > 0) {
                  return (
                    <div className="flex items-center gap-1">
                      <Icon 
                        name="timer" 
                        size={isMobile ? TASK_CARD_ICON_SIZES.timerInline.mobile : TASK_CARD_ICON_SIZES.timerInline.desktop}
                        className="flex-shrink-0" 
                        style={{ color: TASK_CARD_THEME_COLORS.primary }}
                      />
                      <span 
                        className="text-sm font-medium whitespace-nowrap"
                        style={{ color: TASK_CARD_THEME_COLORS.primary }}
                      >
                        {formatTimer(occurrenceTime)} {TASK_CARD_TEXT.tracked}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Chevron to Expand/Collapse - Always show if there's any expandable content */}
            {(task.description || (breakdown?.actionPlan?.steps && breakdown.actionPlan.steps.length > 0) || (task.subtasks && task.subtasks.length > 0) || (task.dependencies && task.dependencies.length > 0) || (task.assignedTo && task.assignedTo.length > 0)) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex-shrink-0 hover:opacity-80 transition-opacity p-1"
                aria-label={isExpanded ? "Collapse task details" : "Expand task details"}
              >
                <Icon 
                  name={isExpanded ? "chevron-down" : "chevron-right"}
                  size={isMobile ? TASK_CARD_ICON_SIZES.chevron.mobile : TASK_CARD_ICON_SIZES.chevron.desktop}
                  className="text-gray-600 dark:text-gray-400"
                  weight="bold"
                />
              </button>
            )}
          </div>

          {/* Bottom Row: Removed - avatar and play button now only appear in expanded section */}

          {/* Expandable Section - Description, Progress, Assignee - Appears below play button/tracked/chevron */}
          {isExpanded && (
            <div
              className="rounded-b-lg transition-all duration-300 ease-in-out overflow-hidden border-t border-gray-200/50 dark:border-border/50"
              style={{
                padding: isMobile ? TASK_CARD_BACKGROUNDS.expandable.padding.mobile : TASK_CARD_BACKGROUNDS.expandable.padding.desktop,
                backgroundColor: isDark ? TASK_CARD_BACKGROUNDS.expandable.dark : TASK_CARD_BACKGROUNDS.expandable.light,
                marginTop: 0,
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* AI Suggestions removed from expanded section - now always visible under headline */}

            {/* Description Section */}
            {task.description && (
              <div style={{ marginBottom: `${TASK_CARD_EXPANDABLE.spacing.marginBottom}px` }}>
                <div className="flex items-center" style={{ gap: `${TASK_CARD_EXPANDABLE.spacing.gapDescription}px`, marginBottom: `${TASK_CARD_EXPANDABLE.spacing.marginBottomHeader}px` }}>
                  <Icon name="file-text" size={isMobile ? TASK_CARD_ICON_SIZES.fileText.mobile : TASK_CARD_ICON_SIZES.fileText.desktop} className="text-gray-500 dark:text-gray-400" />
                  <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">Description</span>
                </div>
                <div
                  className="break-normal leading-relaxed text-sm text-gray-600 dark:text-gray-400"
                  {...(hasHTMLTags(task.description) 
                    ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(task.description) } }
                    : { children: task.description }
                  )}
                />
              </div>
            )}

            {/* Dependencies Warning */}
            {task.dependencies && task.dependencies.length > 0 && (
              <div className="flex items-center text-red-600 dark:text-red-400" style={{ marginBottom: `${TASK_CARD_EXPANDABLE.spacing.marginBottom}px`, gap: `${TASK_CARD_EXPANDABLE.spacing.gapDescription}px` }}>
                <Icon name="link-2" size={isMobile ? TASK_CARD_ICON_SIZES.link.mobile : TASK_CARD_ICON_SIZES.link.desktop} />
                <span className="font-semibold text-sm">ATTENTION: This task has a dependency.</span>
              </div>
            )}

            {/* Add New Subtask Input - Subtasks list removed, only input field remains */}
            <div className="space-y-1.5" style={{ marginBottom: `${TASK_CARD_EXPANDABLE.spacing.marginBottom}px` }}>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="text"
                  placeholder="Add a subtask..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                      e.stopPropagation();
                      if (!permissions.canEditTask) {
                        toast.error('Permission Denied', {
                          description: 'Viewer role does not have permission to edit tasks.',
                        });
                        return;
                      }
                      const newSubtask = {
                        id: `subtask-${task.id}-${Date.now()}`,
                        title: newSubtaskTitle.trim(),
                        completed: false,
                        createdAt: new Date().toISOString(),
                      };
                      const updatedSubtasks = [...(task.subtasks || []), newSubtask];
                      await updateTask(task.id, { subtasks: updatedSubtasks });
                      setNewSubtaskTitle('');
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-sm"
                />
              </div>
            </div>

            {/* Progress Circle and Assignee with Tracked Info */}
            <div className="flex items-center justify-between" style={{ gap: `${TASK_CARD_EXPANDABLE.spacing.gapBetween}px` }}>
              {/* Progress Circle */}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="flex items-center">
                  <div className="relative flex-shrink-0" style={{ width: `${TASK_CARD_EXPANDABLE.progressCircle.size}px`, height: `${TASK_CARD_EXPANDABLE.progressCircle.size}px` }}>
                    <svg className="transform -rotate-90" style={{ width: `${TASK_CARD_EXPANDABLE.progressCircle.size}px`, height: `${TASK_CARD_EXPANDABLE.progressCircle.size}px` }} viewBox={`0 0 ${TASK_CARD_EXPANDABLE.progressCircle.size} ${TASK_CARD_EXPANDABLE.progressCircle.size}`}>
                      <circle
                        cx={TASK_CARD_EXPANDABLE.progressCircle.center}
                        cy={TASK_CARD_EXPANDABLE.progressCircle.center}
                        r={TASK_CARD_EXPANDABLE.progressCircle.radius}
                        fill="none"
                        stroke={isDark ? TASK_CARD_EXPANDABLE.progressCircle.colors.background.dark : TASK_CARD_EXPANDABLE.progressCircle.colors.background.light}
                        strokeWidth={TASK_CARD_EXPANDABLE.progressCircle.strokeWidth}
                      />
                      <circle
                        cx={TASK_CARD_EXPANDABLE.progressCircle.center}
                        cy={TASK_CARD_EXPANDABLE.progressCircle.center}
                        r={TASK_CARD_EXPANDABLE.progressCircle.radius}
                        fill="none"
                        stroke={COLOR_PRIMARY}
                        strokeWidth={TASK_CARD_EXPANDABLE.progressCircle.strokeWidth}
                        strokeDasharray={`${2 * Math.PI * TASK_CARD_EXPANDABLE.progressCircle.radius}`}
                        strokeDashoffset={`${2 * Math.PI * TASK_CARD_EXPANDABLE.progressCircle.radius * (1 - calculateProgress(task) / 100)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={cn("font-bold text-sm", isDark ? "text-gray-200" : "text-gray-700")}>{calculateProgress(task)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Assignee Info with Tracked Time */}
              {task.assignedTo && task.assignedTo.length > 0 && (
                <div className="flex items-center flex-1 min-w-0" style={{ gap: `${TASK_CARD_EXPANDABLE.spacing.gapAssignee}px` }}>
                  {task.assignedTo.slice(0, 1).map((userId) => {
                    const member = getTeamMember(userId);
                    if (!member) return null;
                    const initials = getInitials(member.name);
                    const avatarSize = TASK_CARD_EXPANDABLE.avatarSize;
                    return (
                      <TooltipProvider key={userId}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {member.avatar ? (
                                <div 
                                  className="rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0"
                                  style={{
                                    width: `${avatarSize}px`,
                                    height: `${avatarSize}px`,
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
                                          `rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.gradientDark} ${TASK_CARD_ASSIGNED_USER_COLORS.text} ${TASK_CARD_ASSIGNED_USER_COLORS.textDark} flex items-center justify-center font-semibold text-sm`
                                        );
                                        fallback.style.width = `${avatarSize}px`;
                                        fallback.style.height = `${avatarSize}px`;
                                        fallback.textContent = initials;
                                        parent.appendChild(fallback);
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <div 
                                  className={cn(
                                    `rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.gradientDark} ${TASK_CARD_ASSIGNED_USER_COLORS.text} ${TASK_CARD_ASSIGNED_USER_COLORS.textDark} flex items-center justify-center font-semibold text-sm flex-shrink-0`
                                  )}
                                  style={{
                                    width: `${avatarSize}px`,
                                    height: `${avatarSize}px`,
                                  }}
                                >
                                  {initials}
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 truncate">{member.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.role || 'Team Member'}</span>
                                {member.teamId && (() => {
                                  const team = teams.find(t => t.id === member.teamId);
                                  return team ? (
                                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{team.name}</span>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{member.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-300">{member.email}</p>
                            {member.teamId && (() => {
                              const team = teams.find(t => t.id === member.teamId);
                              return team ? (
                                <p className="text-xs text-gray-400 dark:text-gray-300">Team: {team.name}</p>
                              ) : null;
                            })()}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                  {/* Tracked Time removed from expanded section - already shown at top */}
                </div>
              )}
            </div>
          </div>
          )}

          </div>
        </div>
      </div>
    );
  },
);

DraggableTaskCard.displayName = "DraggableTaskCard";
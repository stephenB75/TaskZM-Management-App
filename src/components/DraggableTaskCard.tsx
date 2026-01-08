import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, Timer, Clock, Repeat, ChevronDown, ChevronUp, FileText, ListChecks, Link2, Sparkles } from "lucide-react";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { cn, formatTimeAMPM, getInitials, sanitizeHTML, hasHTMLTags } from "../lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { toast } from "sonner";
import { useTasks } from "../contexts/TaskContext";
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
  TASK_CARD_DROPDOWN_COLORS,
  TASK_CARD_DROPDOWN_DOMAIN_COLORS,
  TASK_CARD_DROPDOWN_BADGE_COLORS,
  TASK_CARD_DROPDOWN,
  TASK_CARD_STANDARD_HEIGHTS,
  TASK_CARD_OPACITY,
  TASK_CARD_TIMELINE,
  TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE,
} from "../lib/task-card-constants";
import { getTaskMinutes } from "../lib/daily-hours-utils";
import { MINUTES_PER_HOUR } from "../lib/business-constants";
import { COLOR_PRIMARY } from "../lib/color-theme";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { useTaskBreakdown } from "../hooks/useTaskBreakdown";
import { TODAY_AGENDA_TEXT } from "../lib/today-agenda-constants";

interface DraggableTaskCardProps {
  task: Task;
  onClick: () => void;
  droppableId: string;
  isDragging?: boolean;
  isNextUp?: boolean;
}

export const DraggableTaskCard = React.forwardRef<
  HTMLDivElement,
  DraggableTaskCardProps
>(
  (
    { task, onClick, droppableId, isDragging = false, isNextUp = false },
    forwardedRef,
  ) => {
    const { updateTask, tasks } = useTasks();
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
    const isDark = actualTheme === 'dark';
    const isMobile = useIsMobile();
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const [zoomScale, setZoomScale] = React.useState(1);
    const cardRef = React.useRef<HTMLDivElement>(null);

    // Detect zoom scale from parent container
    React.useEffect(() => {
      if (!cardRef.current) return;
      
      const checkZoom = () => {
        const element = cardRef.current;
        if (!element) return;
        
        let parent = element.parentElement;
        while (parent) {
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
    
    // Use task.id for all tasks to ensure timer sync across all components
    // (TaskDialog, TaskCard, TodayAgenda) - when timer is activated in one location,
    // it activates in all locations
    const pomodoroTimerId = task.id;
    const timerState = getTimerState(pomodoroTimerId);
    
    // For recurring tasks, use unique sortable ID per date occurrence to maintain chronological order
    const isRecurringTask = task.recurrence && task.recurrence.type !== 'none';
    const sortableId = isRecurringTask ? `${task.id}__${droppableId}` : task.id;
    
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
      // Step 1: Calculate the standard height for this duration using TASK_CARD_STANDARD_HEIGHTS
      // Use AI Duration Estimator instead of hardcoded fallback
      const effectiveEstimatedTime = hasEstimatedTime ? currentEstimatedTimeValue! : getTaskMinutes(task);
      
      // Calculate standard height using TASK_CARD_STANDARD_HEIGHTS mapping
      let standardHeightForThisDuration: number;
      // Use effectiveEstimatedTime for consistency (handles null/undefined cases)
      const isVeryShortTaskInCalc = effectiveEstimatedTime <= 35; // Tasks 35 mins or less need extra compact handling
      
      // Use standard heights: 15=100px, 25=160px, 30=220px, 45=300px, 60=380px, 80=430px, 120=500px
      if (effectiveEstimatedTime <= 15) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at15mins; // 100px
      } else if (effectiveEstimatedTime <= 25) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at25mins; // 160px
      } else if (effectiveEstimatedTime <= 30) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at30mins; // 220px
      } else if (effectiveEstimatedTime <= 45) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at45mins; // 300px
      } else if (effectiveEstimatedTime <= 60) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at60mins; // 380px
      } else if (effectiveEstimatedTime <= 80) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at80mins; // 430px
      } else if (effectiveEstimatedTime <= 120) {
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at120mins; // 500px
      } else {
        // For tasks > 120 mins, use 500px as base (same as 120 mins)
        standardHeightForThisDuration = TASK_CARD_STANDARD_HEIGHTS.at120mins; // 500px
      }
      
      // Step 2: Start with the standard height as the base
      // Components will ADD to this, never reduce it
      let baseHeight = standardHeightForThisDuration;
        
      // Step 2: Now add component heights on top of the standard base height
      
      // AUTO-ADJUST: Badge wrapping (if badges wrap to second line)
      if (badgeWrapHeight > 0) {
        baseHeight += badgeWrapHeight;
      }
        
      // Description is now in dropdown tab, not in main card - no height calculation needed
        
      // AUTO-ADJUST: Inline bottom row components (for tasks < 45 mins)
      // The bottom row can contain: assigned users, pomodoro timer, or both
      // We need to add height for the bottom row container when any component is present
      const hasInlineBottomRow = isShortTask && (hasAssignedUsers || inlinePomodoroPresent);
      if (hasInlineBottomRow) {
        // Calculate spacing based on component combination
        let bottomRowSpacing: number;
        let bottomRowComponentHeight: number = 0;
        
        // Add height for assigned users if present
        if (hasAssignedUsers) {
          bottomRowComponentHeight += TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.base; // 20px for avatar + name
        }
        
        // Add height for inline pomodoro timer if present (approximately 24px for compact timer)
        if (inlinePomodoroPresent) {
          bottomRowComponentHeight += 24; // Approximate height for compact inline pomodoro timer
        }
        
        // Calculate spacing based on component combination
        // For tasks 35 mins or less: use optimized spacing
        if (isVeryShortTaskInCalc) {
          bottomRowSpacing = 14; // Reduced spacing
        } else {
          bottomRowSpacing = TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.spacing.standard; // 20px
        }
        
        // Add bottom padding for the bottom row container to prevent tracker from being cut off
        // pb-1.5 = 6px mobile, pb-2 = 8px desktop for tasks 35 mins or less
        // pb-2 = 8px mobile, pb-2.5 = 10px desktop for other short tasks
        const bottomRowPadding = isVeryShortTaskInCalc
          ? (isMobile ? 6 : 8) // pb-1.5 mobile, pb-2 desktop
          : (isMobile ? 8 : 10); // pb-2 mobile, pb-2.5 desktop
        
        baseHeight += bottomRowComponentHeight + bottomRowSpacing + bottomRowPadding;
      }
      // For medium/long tasks (>= 45 mins), assigned users are absolutely positioned at bottom
      // We need to reserve space at the bottom to prevent overlap with content
      // Reserve: assigned user height (20px) + bottom position (8px mobile, 10px desktop) + small buffer (4px) = ~32-34px
      if (hasAssignedUsers && !isShortTask) {
        const assignedUsersBottomPosition = isMobile 
          ? TASK_CARD_POSITIONING.assignedUsers.bottom.mobile // 8px
          : TASK_CARD_POSITIONING.assignedUsers.bottom.desktop; // 10px
        const assignedUsersBaseHeight = TASK_CARD_HEIGHT_CONFIG.componentHeights.assignedUsers.base; // 20px
        const bottomBuffer = 4; // Small buffer to prevent overlap
        baseHeight += assignedUsersBaseHeight + assignedUsersBottomPosition + bottomBuffer; // ~32-34px
      }
      
      // AUTO-ADJUST: Pomodoro timer is absolutely positioned, so it doesn't add to height
      // It overlays on top of the content at the bottom right corner
      
      // AUTO-ADJUST: Tracking badge (if shown at bottom for tasks >= 45 mins)
      // Rendered when: task.estimatedTime >= 45 mins && pomodoroIsRunning
      const trackingBadgeAtBottom = hasEstimatedTime && 
        currentEstimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && 
        hasPomodoro;
      if (trackingBadgeAtBottom) {
        baseHeight += TASK_CARD_HEIGHT_CONFIG.componentHeights.trackedTime;
      }
      
      // AUTO-ADJUST: Tracked time (if shown at bottom, not at top)
      // Rendered when: task.estimatedTime >= 45 mins && task.actualTime > 0
      const trackedTimeAtBottom = hasEstimatedTime && 
        currentEstimatedTimeValue >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && 
        hasTrackedTimeFull;
      if (trackedTimeAtBottom) {
        baseHeight += TASK_CARD_HEIGHT_CONFIG.componentHeights.trackedTime;
        }
        
      // Subtasks are now in dropdown tab, not in main card - no height calculation needed
        
      // Step 3: Enforce bounds - the standard height IS the absolute minimum
      // Since we started with standardHeight and only added to it, baseHeight should always be >= standardHeight
      // But we enforce it anyway to be safe
      baseHeight = Math.max(baseHeight, standardHeightForThisDuration);
      
      // Enforce maximum
      const effectiveMaxHeight = TASK_CARD_HEIGHT_CONFIG.maxHeight; // 550px maximum
      
      return Math.min(baseHeight, effectiveMaxHeight);
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
        {/* Vertical colored priority line */}
        <div
          className={TASK_CARD_BORDERS.priorityLine.className}
          style={{
            width: `${TASK_CARD_CALCULATIONS.priorityLine.width}px`,
            minHeight: `${TASK_CARD_CALCULATIONS.priorityLine.minHeight}px`,
            backgroundColor: getPriorityLineColor(task.priority),
          }}
        />

        {/* Compact Card - Partial borders, clean background, height represents duration */}
          <div
            className={cn(
              "rounded-lg relative overflow-hidden box-border flex flex-col",
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
              "flex-shrink-0 w-full",
              // Padding: based on components, not description (description is in dropdown)
              // Tasks with components: standard padding
              ((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && 
                (isMobile ? TASK_CARD_SPACING.medium.mobile.withComponents : TASK_CARD_SPACING.medium.desktop.withComponents),
              // Tasks without components: minimal padding
              !((hasFeature("pomodoroTimer") && timerState.isRunning) || (task.assignedTo && task.assignedTo.length > 0)) && 
                (isMobile ? TASK_CARD_SPACING.short.mobile : TASK_CARD_SPACING.short.desktop),
            )}
          style={{
            height: `${cardHeight}px`,
            minHeight: `${cardHeight}px`,
            maxHeight: `${cardHeight}px`,
            boxSizing: 'border-box', // Include padding in height calculation
            flexShrink: 0, // Prevent flex from shrinking the card
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

          {/* AI Action Plan Breakdown - Show if available */}
          {breakdown?.actionPlan && breakdown.actionPlan.steps.length > 0 && (() => {
            // Get domain-specific colors
            const domainColors = breakdown.domain === 'business' 
              ? { bg: isDark ? 'bg-blue-950/20 border-blue-800/30' : 'bg-blue-50/50 border-blue-200', text: isDark ? 'text-blue-300' : 'text-blue-700', textMuted: isDark ? 'text-blue-400' : 'text-blue-600', textLight: isDark ? 'text-blue-200' : 'text-blue-800' }
              : breakdown.domain === 'home'
              ? { bg: isDark ? 'bg-green-950/20 border-green-800/30' : 'bg-green-50/50 border-green-200', text: isDark ? 'text-green-300' : 'text-green-700', textMuted: isDark ? 'text-green-400' : 'text-green-600', textLight: isDark ? 'text-green-200' : 'text-green-800' }
              : breakdown.domain === 'personal'
              ? { bg: isDark ? 'bg-purple-950/20 border-purple-800/30' : 'bg-purple-50/50 border-purple-200', text: isDark ? 'text-purple-300' : 'text-purple-700', textMuted: isDark ? 'text-purple-400' : 'text-purple-600', textLight: isDark ? 'text-purple-200' : 'text-purple-800' }
              : breakdown.domain === 'world'
              ? { bg: isDark ? 'bg-orange-950/20 border-orange-800/30' : 'bg-orange-50/50 border-orange-200', text: isDark ? 'text-orange-300' : 'text-orange-700', textMuted: isDark ? 'text-orange-400' : 'text-orange-600', textLight: isDark ? 'text-orange-200' : 'text-orange-800' }
              : { bg: isDark ? 'bg-gray-950/20 border-gray-800/30' : 'bg-gray-50/50 border-gray-200', text: isDark ? 'text-gray-300' : 'text-gray-700', textMuted: isDark ? 'text-gray-400' : 'text-gray-600', textLight: isDark ? 'text-gray-200' : 'text-gray-800' };
            
            return (
              <div className={cn("px-1.5 py-1 mt-0.5 mb-1 rounded border", domainColors.bg)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                <div className="flex items-center gap-1 mb-1">
                  <Sparkles className={cn("w-3 h-3", domainColors.text)} />
                  <span className={cn("font-medium", domainColors.text)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                    AI Action Plan
                  </span>
                </div>
                <div className="space-y-0.5">
                  {breakdown.actionPlan.steps.slice(0, 3).map((step: { action: string; estimatedMinutes: number; order?: number }, idx: number) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className={cn("mt-0.5 flex-shrink-0", domainColors.textMuted)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                        {step.order || (idx + 1)}.
                      </span>
                      <span className={cn("leading-tight flex-1", domainColors.textLight)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                        {step.action}
                      </span>
                      {step.estimatedMinutes > 0 && (
                        <span className={cn("flex-shrink-0", domainColors.textMuted)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                          {step.estimatedMinutes}m
                        </span>
                      )}
                    </div>
                  ))}
                  {breakdown.actionPlan.steps.length > 3 && (
                    <div className={cn("mt-0.5", domainColors.textMuted)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                      +{breakdown.actionPlan.steps.length - 3} more steps
                    </div>
                  )}
                  {breakdown.actionPlan.totalEstimatedMinutes > 0 && (
                    <div className={cn("mt-0.5 pt-0.5 border-t", domainColors.border)} style={{ fontSize: TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE }}>
                      Total: {Math.floor(breakdown.actionPlan.totalEstimatedMinutes / 60)}h {breakdown.actionPlan.totalEstimatedMinutes % 60}m
                    </div>
                  )}
                </div>
              </div>
            );
          })()}



          {/* Bottom Row: For tasks < 45 mins (mobile and desktop), show inline layout; otherwise absolute positioning */}
          {shouldRenderInlineBottomRow ? (
            // Inline layout for tasks < 45 mins (mobile and desktop): assigned users and pomodoro timer in one row (tracking badge moved to top)
            // For tasks under 35 mins: use extra compact spacing optimized for component combinations
            // For other short tasks: use reduced spacing when all components are active
            // CRITICAL: Use justify-between to ensure assignee stays left and tracker stays right
            <div className={cn(
              "flex items-center justify-between border-t border-gray-200/50 dark:border-border/50",
              // For tasks under 35 mins: extra compact spacing
              // Bottom padding: pb-1.5 (6px) mobile, pb-2 (8px) desktop for tasks under 35 mins
              // Bottom padding: pb-2 (8px) mobile, pb-2.5 (10px) desktop for other short tasks
              isVeryShortTask
                ? (isMobile ? "gap-1 mt-1.5 pt-1.5 pb-1.5" : "gap-1.5 mt-2 pt-2 pb-2") // pb-1.5 (6px) mobile, pb-2 (8px) desktop
                : (isMobile ? "gap-1.5 mt-2 pt-2 pb-2" : "gap-2 mt-2.5 pt-2.5 pb-2.5") // pb-2 (8px) mobile, pb-2.5 (10px) desktop
            )}>
              {/* Left: Assigned Users - Always render container to maintain layout, even if empty */}
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {task.assignedTo && task.assignedTo.length > 0 ? (
                  <>
                    {task.assignedTo.slice(0, 2).map((userId) => {
                      const member = getTeamMember(userId);
                      if (!member) return null;
                      const initials = getInitials(member.name);
                      return (
                        <TooltipProvider key={userId}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn("flex items-center flex-shrink-0", isMobile ? "gap-0.5" : "gap-1")}>
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
                                    `${TASK_CARD_TEXT_COLORS.assignedUserName} font-semibold whitespace-nowrap flex-shrink-0`,
                                    isMobile ? TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserNameInline.mobile : TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserNameInline.desktop
                                  )}
                                >
                                  {member.name}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{member.name}</p>
                              <p className={TASK_CARD_ADDITIONAL_FONT_SIZES.tooltipEmail + " text-gray-400 dark:text-gray-300"}>{member.email}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                    {task.assignedTo.length > 2 && (
                      <span className={cn(TASK_CARD_TEXT_COLORS.assignedUserCount, isMobile ? TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserCount.mobile : TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserCount.desktop)}>+{task.assignedTo.length - 2}</span>
                    )}
                  </>
                ) : (
                  // Empty spacer to maintain layout when no assignee
                  <div className="flex-1 min-w-0" />
                )}
              </div>

              {/* Right: Pomodoro Timer - Always positioned on the right, flex-shrink-0 ensures it stays in corner */}
              {showInlinePomodoroTimer && (
                <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                  <div onClick={(e) => e.stopPropagation()}>
                    <PomodoroTimer
                      taskId={pomodoroTimerId}
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
              {/* Assignee Display and Time Tracker - Inline Layout at bottom left */}
              {(task.assignedTo && task.assignedTo.length > 0) || 
               (task.estimatedTime && task.estimatedTime >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && (pomodoroIsRunning || (task.actualTime && task.actualTime > 0))) ||
               (isMobile && showAbsolutePomodoroTimer) ? (
                <div
                  className={cn(
                    "absolute flex items-center",
                    isMobile ? "gap-1.5" : "gap-2",
                  )}
                  style={{
                    bottom: `${isMobile ? TASK_CARD_POSITIONING.assignedUsers.bottom.mobile : TASK_CARD_POSITIONING.assignedUsers.bottom.desktop}px`,
                    left: `${isMobile ? TASK_CARD_POSITIONING.assignedUsers.left.mobile : TASK_CARD_POSITIONING.assignedUsers.left.desktop}px`,
                    right: isMobile && showAbsolutePomodoroTimer ? `${TASK_CARD_POSITIONING.assignedUsers.left.mobile}px` : undefined,
                    maxWidth: isMobile && showAbsolutePomodoroTimer 
                      ? 'none'
                      : `calc(100% - ${isMobile ? TASK_CARD_CALCULATIONS.assignedUser.containerOffset.mobile : TASK_CARD_CALCULATIONS.assignedUser.containerOffset.desktop}px)`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Assignee Display */}
                  {task.assignedTo && task.assignedTo.length > 0 && (
                    <div className={cn("flex items-center flex-shrink-0", isMobile ? "gap-1" : "gap-2")}>
                      {task.assignedTo.slice(0, 3).map((userId) => {
                        const member = getTeamMember(userId);
                        if (!member) return null;

                        const initials = getInitials(member.name);

                        return (
                          <TooltipProvider key={userId}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn("flex items-center flex-shrink-0", isMobile ? "gap-0.5" : "gap-1")}>
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
                                    `${TASK_CARD_TEXT_COLORS.assignedUserName} font-semibold whitespace-nowrap flex-shrink-0`,
                                    isMobile ? TASK_CARD_FONT_SIZES.assignedUserName.mobile : TASK_CARD_FONT_SIZES.assignedUserName.desktop,
                                  )}>
                                    {member.name}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{member.name}</p>
                                <p className={TASK_CARD_ADDITIONAL_FONT_SIZES.tooltipEmail + " text-gray-400 dark:text-gray-300"}>
                                  {member.email}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                      {task.assignedTo.length > 3 && (
                        <span className={cn("text-gray-500 dark:text-gray-300 flex-shrink-0", isMobile ? TASK_CARD_FONT_SIZES.assignedUserName.mobile : TASK_CARD_FONT_SIZES.assignedUserName.desktop)}>
                          {TASK_CARD_TEXT.moreAssigned(task.assignedTo.length - 3)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tracking Status - Show when timer is running (only for tasks >= 45 mins, tasks < 45 mins show at top) */}
                  {task.estimatedTime && task.estimatedTime >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && pomodoroIsRunning && (
                    <div className={cn(
                      "flex items-center animate-pulse flex-shrink-0",
                      isMobile ? "gap-0.5" : "gap-1"
                    )}>
                      <div 
                        className={cn(
                          "flex items-center rounded-full px-1.5 py-0.5 text-white whitespace-nowrap",
                          isMobile ? `gap-0.5 ${TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile}` : `gap-1 ${TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.desktop}`
                        )}
                        style={{
                          background: `linear-gradient(to right, ${TASK_CARD_THEME_COLORS.gradient.from}, ${TASK_CARD_THEME_COLORS.gradient.to})`,
                        }}
                      >
                        <Timer className={cn("animate-spin flex-shrink-0", isMobile ? TASK_CARD_ICON_SIZES.timer.mobile : TASK_CARD_ICON_SIZES.timer.desktop)} />
                        <span className="font-semibold">{TASK_CARD_TEXT.tracking}</span>
                      </div>
                    </div>
                  )}

                  {/* Tracked Time (if exists) - only for tasks >= 45 mins, tasks < 45 mins show at top) */}
                  {task.estimatedTime && task.estimatedTime >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && task.actualTime && task.actualTime > 0 && !pomodoroIsRunning && (
                    <div className={cn("flex items-center flex-shrink-0", isMobile ? "gap-0.5" : "gap-1")}>
                      <Timer 
                        className={cn("flex-shrink-0", isMobile ? TASK_CARD_ICON_SIZES.timerLarge.mobile : TASK_CARD_ICON_SIZES.timerLarge.desktop)} 
                        style={{ color: TASK_CARD_THEME_COLORS.primary }}
                      />
                      <span 
                        className={cn("font-medium whitespace-nowrap", isMobile ? TASK_CARD_FONT_SIZES.duration.mobile : TASK_CARD_FONT_SIZES.duration.desktop)}
                        style={{ color: TASK_CARD_THEME_COLORS.primary }}
                      >
                        {formatTimer(task.actualTime)} {TASK_CARD_TEXT.tracked}
                      </span>
                    </div>
                  )}

                  {/* Pomodoro Timer - Inline on mobile, separate on desktop */}
                  {isMobile && showAbsolutePomodoroTimer && (
                    <div
                      className="flex items-center flex-shrink-0 ml-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PomodoroTimer
                        taskId={pomodoroTimerId}
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
              ) : null}

              {/* Pomodoro Timer - Bottom right on desktop only (mobile is inline with assignee/tracker above) */}
              {showAbsolutePomodoroTimer && !isMobile && (
                <div
                  className={cn("absolute flex items-center", "bottom-2.5 right-2.5")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <PomodoroTimer
                    taskId={pomodoroTimerId}
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

        {/* Dropdown Tab - Accordion attached directly to the card, aligned with compact card (excluding priority line) */}
        {(task.description || (task.subtasks && task.subtasks.length > 0) || (task.dependencies && task.dependencies.length > 0)) && (() => {
          // Get domain-based colors for dropdown background
          const taskDomain = breakdown?.domain || 'default';
          const domainColors = TASK_CARD_DROPDOWN_DOMAIN_COLORS[taskDomain] || TASK_CARD_DROPDOWN_DOMAIN_COLORS.default;
          
          return (
            <div 
              className="rounded-b-lg transition-all duration-300 ease-in-out overflow-hidden"
              style={{
                marginTop: `${TASK_CARD_DROPDOWN.spacing.attachmentGap}px`,
                marginLeft: `${TASK_CARD_DROPDOWN.spacing.cardOffset.left + TASK_CARD_DROPDOWN.spacing.cornerInset.horizontal}px`,
                marginRight: `${TASK_CARD_DROPDOWN.spacing.cornerInset.horizontal}px`,
                width: `calc(100% - ${TASK_CARD_DROPDOWN.spacing.cardOffset.left + (TASK_CARD_DROPDOWN.spacing.cornerInset.horizontal * 2)}px)`,
                backgroundColor: isDark ? domainColors.dark : domainColors.light,
                borderTop: `1px solid ${isDark ? TASK_CARD_DROPDOWN_COLORS.border.dark : TASK_CARD_DROPDOWN_COLORS.border.light}`,
                maxHeight: isDropdownOpen ? 'none' : 'auto',
                transition: 'max-height 0.3s ease-in-out',
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Accordion Tab Header with Badges */}
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={cn(
                "w-full flex items-center justify-between font-medium transition-colors rounded-b-lg"
              )}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = `${1 - TASK_CARD_DROPDOWN_COLORS.hover.opacity}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              style={{
                paddingLeft: `${TASK_CARD_DROPDOWN.dimensions.header.paddingX}px`,
                paddingRight: `${TASK_CARD_DROPDOWN.dimensions.header.paddingX}px`,
                paddingTop: `${TASK_CARD_DROPDOWN.dimensions.header.paddingY}px`,
                paddingBottom: `${TASK_CARD_DROPDOWN.dimensions.header.paddingY}px`,
                transitionDuration: `${TIMING_CONSTANTS.animations.default}ms`,
                color: isDark ? TASK_CARD_DROPDOWN_COLORS.content.text.dark : TASK_CARD_DROPDOWN_COLORS.content.text.light,
                backgroundColor: isDark ? domainColors.dark : domainColors.light,
                fontSize: `${dropdownFontSize}px`,
              }}
            >
              {!isDropdownOpen && (
                <div 
                  className="flex items-center"
                  style={{ gap: `${TASK_CARD_DROPDOWN.spacing.badgeGap}px` }}
                >
                  {task.description && (
                    <Badge
                      variant="secondary"
                      style={{
                        height: `${TASK_CARD_DROPDOWN.dimensions.badge.height}px`,
                        paddingLeft: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingX}px`,
                        paddingRight: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingX}px`,
                        paddingTop: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingY}px`,
                        paddingBottom: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingY}px`,
                        fontSize: `${TASK_CARD_DROPDOWN.fontSizes.badge}px`,
                        backgroundColor: TASK_CARD_DROPDOWN_BADGE_COLORS.description.background,
                        color: TASK_CARD_DROPDOWN_BADGE_COLORS.description.text,
                      }}
                    >
                      <FileText 
                        className="flex-shrink-0" 
                        style={{ 
                          width: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`, 
                          height: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`,
                          marginRight: `${TASK_CARD_DROPDOWN.spacing.iconMargin}px`,
                        }} 
                      />
                      {TASK_CARD_DROPDOWN.text.description}
                    </Badge>
                  )}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <Badge
                      variant="secondary"
                      style={{
                        height: `${TASK_CARD_DROPDOWN.dimensions.badge.height}px`,
                        paddingLeft: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingX}px`,
                        paddingRight: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingX}px`,
                        paddingTop: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingY}px`,
                        paddingBottom: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingY}px`,
                        fontSize: `${TASK_CARD_DROPDOWN.fontSizes.badge}px`,
                        backgroundColor: TASK_CARD_DROPDOWN_BADGE_COLORS.subtasks.background,
                        color: TASK_CARD_DROPDOWN_BADGE_COLORS.subtasks.text,
                      }}
                    >
                      <ListChecks 
                        className="flex-shrink-0" 
                        style={{ 
                          width: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`, 
                          height: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`,
                          marginRight: `${TASK_CARD_DROPDOWN.spacing.iconMargin}px`,
                        }} 
                      />
                      {TASK_CARD_DROPDOWN.text.subtasks} ({task.subtasks.length})
                    </Badge>
                  )}
                  {task.dependencies && task.dependencies.length > 0 && (
                    <Badge
                      variant="secondary"
                      style={{
                        height: `${TASK_CARD_DROPDOWN.dimensions.badge.height}px`,
                        paddingLeft: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingX}px`,
                        paddingRight: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingX}px`,
                        paddingTop: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingY}px`,
                        paddingBottom: `${TASK_CARD_DROPDOWN.dimensions.badge.paddingY}px`,
                        fontSize: `${TASK_CARD_DROPDOWN.fontSizes.badge}px`,
                        backgroundColor: TASK_CARD_DROPDOWN_BADGE_COLORS.dependencies.background,
                        color: TASK_CARD_DROPDOWN_BADGE_COLORS.dependencies.text,
                      }}
                    >
                      <Link2 
                        className="flex-shrink-0" 
                        style={{ 
                          width: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`, 
                          height: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`,
                          marginRight: `${TASK_CARD_DROPDOWN.spacing.iconMargin}px`,
                        }} 
                      />
                      {TASK_CARD_DROPDOWN.text.dependencies} ({task.dependencies.length})
                    </Badge>
                  )}
                </div>
              )}
              {isDropdownOpen ? (
                <ChevronUp 
                  style={{ 
                    width: `${TASK_CARD_DROPDOWN.dimensions.icon.medium}px`, 
                    height: `${TASK_CARD_DROPDOWN.dimensions.icon.medium}px`,
                  }} 
                />
              ) : (
                <ChevronDown 
                  style={{ 
                    width: `${TASK_CARD_DROPDOWN.dimensions.icon.medium}px`, 
                    height: `${TASK_CARD_DROPDOWN.dimensions.icon.medium}px`,
                  }} 
                />
              )}
            </button>

            {/* Accordion Content - Slides down smoothly, no scrolling */}
            {isDropdownOpen && (
              <div
                className="rounded-b-lg transition-all duration-300 ease-in-out"
                style={{
                  paddingLeft: `${TASK_CARD_DROPDOWN.dimensions.content.paddingX}px`,
                  paddingRight: `${TASK_CARD_DROPDOWN.dimensions.content.paddingX}px`,
                  paddingBottom: `${TASK_CARD_DROPDOWN.dimensions.content.paddingBottom}px`,
                  backgroundColor: isDark ? domainColors.dark : domainColors.light,
                }}
              >
                <Tabs defaultValue={task.description ? "description" : (task.subtasks && task.subtasks.length > 0 ? "subtasks" : "dependencies")} className="w-full">
                  <TabsList 
                    className="w-full justify-start bg-transparent p-0"
                    style={{
                      height: `${TASK_CARD_DROPDOWN.dimensions.tabsList.height}px`,
                      gap: `${TASK_CARD_DROPDOWN.spacing.tabsGap}px`,
                      color: isDark ? TASK_CARD_DROPDOWN_COLORS.tab.inactive.darkText : TASK_CARD_DROPDOWN_COLORS.tab.inactive.text,
                    }}
                  >
                    {task.description && (
                      <TabsTrigger
                        value="description"
                        className=""
                        style={{
                          height: `${TASK_CARD_DROPDOWN.dimensions.tabsTrigger.height}px`,
                          paddingLeft: `${TASK_CARD_DROPDOWN.dimensions.tabsTrigger.paddingX}px`,
                          paddingRight: `${TASK_CARD_DROPDOWN.dimensions.tabsTrigger.paddingX}px`,
                          fontSize: `${dropdownFontSize}px`,
                          '--tab-active-bg': TASK_CARD_DROPDOWN_COLORS.tab.active.background,
                          '--tab-active-text': TASK_CARD_DROPDOWN_COLORS.tab.active.text,
                          '--tab-inactive-text': isDark ? TASK_CARD_DROPDOWN_COLORS.tab.inactive.darkText : TASK_CARD_DROPDOWN_COLORS.tab.inactive.text,
                        } as React.CSSProperties}
                      >
                        <FileText 
                          style={{ 
                            width: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`, 
                            height: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`,
                            marginRight: `${TASK_CARD_DROPDOWN.spacing.iconMargin}px`,
                          }} 
                        />
                        {TASK_CARD_DROPDOWN.text.description}
                      </TabsTrigger>
                    )}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <TabsTrigger
                        value="subtasks"
                        className=""
                        style={{
                          height: `${TASK_CARD_DROPDOWN.dimensions.tabsTrigger.height}px`,
                          paddingLeft: `${TASK_CARD_DROPDOWN.dimensions.tabsTrigger.paddingX}px`,
                          paddingRight: `${TASK_CARD_DROPDOWN.dimensions.tabsTrigger.paddingX}px`,
                          fontSize: `${dropdownFontSize}px`,
                          '--tab-active-bg': TASK_CARD_DROPDOWN_COLORS.tab.active.background,
                          '--tab-active-text': TASK_CARD_DROPDOWN_COLORS.tab.active.text,
                          '--tab-inactive-text': isDark ? TASK_CARD_DROPDOWN_COLORS.tab.inactive.darkText : TASK_CARD_DROPDOWN_COLORS.tab.inactive.text,
                        } as React.CSSProperties}
                      >
                        <ListChecks 
                          style={{ 
                            width: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`, 
                            height: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`,
                            marginRight: `${TASK_CARD_DROPDOWN.spacing.iconMargin}px`,
                          }} 
                        />
                        {TASK_CARD_DROPDOWN.text.subtasks} ({task.subtasks.length})
                      </TabsTrigger>
                    )}
                    {task.dependencies && task.dependencies.length > 0 && (
                      <TabsTrigger
                        value="dependencies"
                        className=""
                        style={{
                          height: `${TASK_CARD_DROPDOWN.dimensions.tabsTrigger.height}px`,
                          paddingLeft: `${TASK_CARD_DROPDOWN.dimensions.tabsTrigger.paddingX}px`,
                          paddingRight: `${TASK_CARD_DROPDOWN.dimensions.tabsTrigger.paddingX}px`,
                          fontSize: `${dropdownFontSize}px`,
                          '--tab-active-bg': TASK_CARD_DROPDOWN_COLORS.tab.active.background,
                          '--tab-active-text': TASK_CARD_DROPDOWN_COLORS.tab.active.text,
                          '--tab-inactive-text': isDark ? TASK_CARD_DROPDOWN_COLORS.tab.inactive.darkText : TASK_CARD_DROPDOWN_COLORS.tab.inactive.text,
                        } as React.CSSProperties}
                      >
                        <Link2 
                          style={{ 
                            width: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`, 
                            height: `${TASK_CARD_DROPDOWN.dimensions.icon.small}px`,
                            marginRight: `${TASK_CARD_DROPDOWN.spacing.iconMargin}px`,
                          }} 
                        />
                        {TASK_CARD_DROPDOWN.text.dependencies} ({task.dependencies.length})
                      </TabsTrigger>
                    )}
                  </TabsList>

                  {task.description && (
                    <TabsContent 
                      value="description" 
                      className="rounded"
                      style={{
                        marginTop: `${TASK_CARD_DROPDOWN.dimensions.content.marginTop}px`,
                        padding: `${TASK_CARD_DROPDOWN.dimensions.content.padding}px`,
                      }}
                    >
                      <div
                        className="break-words"
                        style={{
                          fontSize: `${dropdownFontSize}px`,
                          color: isDark ? TASK_CARD_DROPDOWN_COLORS.content.text.dark : TASK_CARD_DROPDOWN_COLORS.content.text.light,
                        }}
                        {...(hasHTMLTags(task.description) 
                          ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(task.description) } }
                          : { children: task.description }
                        )}
                      />
                    </TabsContent>
                  )}

                  {task.subtasks && task.subtasks.length > 0 && (
                    <TabsContent 
                      value="subtasks"
                      style={{
                        marginTop: `${TASK_CARD_DROPDOWN.dimensions.content.marginTop}px`,
                        gap: `${TASK_CARD_DROPDOWN.dimensions.subtask.gap / 2}px`,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {task.subtasks.map((subtask) => {
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
                            className="flex items-center rounded cursor-pointer transition-opacity"
                            style={{
                              fontSize: `${dropdownFontSize}px`,
                              gap: `${TASK_CARD_DROPDOWN.dimensions.subtask.gap}px`,
                              padding: `${TASK_CARD_DROPDOWN.dimensions.subtask.padding}px`,
                              opacity: subtask.completed ? TASK_CARD_DROPDOWN_COLORS.subtask.completed.opacity : 1,
                            }}
                            onClick={handleSubtaskToggle}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = isDark 
                                ? TASK_CARD_DROPDOWN_COLORS.subtask.hover.background.dark 
                                : TASK_CARD_DROPDOWN_COLORS.subtask.hover.background.light;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div
                              className="rounded-sm border flex-shrink-0 transition-colors"
                              style={{
                                width: `${TASK_CARD_DROPDOWN.dimensions.subtask.checkbox.size}px`,
                                height: `${TASK_CARD_DROPDOWN.dimensions.subtask.checkbox.size}px`,
                                backgroundColor: subtask.completed ? COLOR_PRIMARY : 'transparent',
                                borderColor: subtask.completed 
                                  ? COLOR_PRIMARY 
                                  : (isDark 
                                      ? TASK_CARD_DROPDOWN_COLORS.subtask.border.dark 
                                      : TASK_CARD_DROPDOWN_COLORS.subtask.border.light),
                              }}
                            />
                            <span
                              className={cn(
                                "flex-1",
                                subtask.completed && "line-through"
                              )}
                              style={{
                                fontSize: `${dropdownFontSize}px`,
                                color: isDark 
                                  ? TASK_CARD_DROPDOWN_COLORS.subtask.text.dark 
                                  : TASK_CARD_DROPDOWN_COLORS.subtask.text.light,
                              }}
                            >
                              {subtask.title}
                            </span>
                          </div>
                        );
                      })}
                    </TabsContent>
                  )}

                  {task.dependencies && task.dependencies.length > 0 && (
                    <TabsContent 
                      value="dependencies"
                      style={{
                        marginTop: `${TASK_CARD_DROPDOWN.dimensions.content.marginTop}px`,
                        gap: `${TASK_CARD_DROPDOWN.dimensions.dependency.gap / 2}px`,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {task.dependencies.map((depId) => {
                        const depTask = tasks.find((t) => t?.id === depId);
                        if (!depTask) return null;
                        const isComplete = depTask.status === "done";
                        const depColors = isComplete 
                          ? TASK_CARD_DROPDOWN_COLORS.dependency.complete
                          : TASK_CARD_DROPDOWN_COLORS.dependency.incomplete;
                        
                        return (
                          <div
                            key={depId}
                            className="flex items-center rounded"
                            style={{
                              fontSize: `${dropdownFontSize}px`,
                              gap: `${TASK_CARD_DROPDOWN.dimensions.dependency.gap}px`,
                              padding: `${TASK_CARD_DROPDOWN.dimensions.dependency.padding}px`,
                              backgroundColor: isDark ? depColors.background.dark : depColors.background.light,
                              border: `1px solid ${isDark ? depColors.border.dark : depColors.border.light}`,
                            }}
                          >
                            <div
                              className="rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                width: `${TASK_CARD_DROPDOWN.dimensions.dependency.indicator.size}px`,
                                height: `${TASK_CARD_DROPDOWN.dimensions.dependency.indicator.size}px`,
                                backgroundColor: depColors.indicator,
                              }}
                            >
                              {isComplete && (
                                <span 
                                  style={{ 
                                    fontSize: `${TASK_CARD_DROPDOWN.fontSizes.tiny}px`,
                                    color: COLOR_TEXT_WHITE,
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </div>
                            <span
                              className="flex-1 truncate"
                              style={{
                                fontSize: `${dropdownFontSize}px`,
                                color: isDark 
                                  ? TASK_CARD_DROPDOWN_COLORS.dependency.text.dark 
                                  : TASK_CARD_DROPDOWN_COLORS.dependency.text.light,
                              }}
                            >
                              {depTask.title}
                            </span>
                          </div>
                        );
                      })}
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            )}
          </div>
          );
        })()}
      </div>
    );
  },
);

DraggableTaskCard.displayName = "DraggableTaskCard";
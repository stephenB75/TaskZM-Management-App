import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { useDroppable } from "@dnd-kit/core";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { useTasks } from "../contexts/TaskContext";
import { useTheme } from "../contexts/ThemeContext";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { useCalendar } from "../contexts/CalendarContext";
import { useAuth } from "../contexts/AuthContext";
import { CalendarEventCard } from "./CalendarEventCard";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { TaskDialog } from "./TaskDialog";
import { DraggableTaskCard } from "./DraggableTaskCard";
import { Confetti } from "./Confetti";
import { cn, prepareTaskForDialog, hasHTMLTags, sanitizeHTML, getDateString } from "../lib/utils";
import { isDateInRecurrence } from "../lib/recurrence";
import { toast } from "sonner";
import type { Task } from "../types";
import { UI_GRADIENT_COLORS, UI_TODAY_AGENDA_STATUS_COLORS } from "../lib/ui-colors";
import { TASK_CALCULATION_CONSTANTS } from "../lib/task-calculation-constants";
import { TASK_CARD_HEIGHT_CONFIG, TASK_CARD_CALCULATIONS, TASK_CARD_LAYOUT_METRICS, TASK_CARD_TIMELINE } from "../lib/task-card-constants";
import { TODAY_AGENDA_TEXT } from "../lib/today-agenda-constants";
import { HEADER_HEIGHT, TIMELINE_PADDING, VIEWPORT_BREAKPOINTS, MOBILE_SPACING, Z_INDEX, COMPONENT_DIMENSIONS, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE, NAV_BAR_HEIGHT, NAV_BAR_SCROLL_BUFFER_REM, HEADER_DESCRIPTION_SIZE, HEADER_DESCRIPTION_MARGIN_TOP, HEADER_DATE_SIZE, HEADER_DATE_SIZE_MOBILE, HEADER_DATE_NUMBER_SIZE, HEADER_DATE_NUMBER_SIZE_MOBILE, HEADER_DATE_MARGIN_TOP, MOBILE_PADDING_BOTTOM, DESKTOP_PADDING_TOP, TODAY_AGENDA_MIN_HEIGHT, HEADER_GAP_SMALL, HEADER_GAP_LARGE, PANEL_EMPTY_STATE_PADDING_Y, EMPTY_STATE_ICON_SIZE_SMALL, EMPTY_STATE_ICON_INNER_SIZE, EMPTY_STATE_MARGIN_BOTTOM_SMALL, EMPTY_STATE_PADDING_X, ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_XS } from "../lib/layout-constants";
import { TEXT_SIZES } from "../lib/text-size-constants";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { KANBAN_MOBILE } from "../lib/kanban-constants";
import { buildTaskLayouts } from "../lib/task-layout";
import { getTaskMinutes } from "../lib/daily-hours-utils";
import { projectId } from "../utils/supabase/info";
import { logger } from "../lib/logger";
import { useCalendarEvents } from "../hooks/useCalendarEvents";

interface TodayAgendaViewProps {
  hideHeader?: boolean;
}

export function TodayAgendaView({
  hideHeader = false,
}: TodayAgendaViewProps = {}) {
  const { tasks, updateTask } = useTasks();
  const { actualTheme } = useTheme();
  const shouldUseMobileLayout = useMobileLayout();
  const { calendarStatus } = useCalendar();
  const { accessToken } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    null,
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number } | null>(null);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  // ScrollArea ref for programmatic scrolling (Layer 3 - optional)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  // Current time for display - updates every minute to show current time
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayCalendarEvents, setTodayCalendarEvents] = useState<Array<{ id: string; title: string; start: string; end: string; location?: string; provider: 'google' | 'apple'; calendarColor?: string; isRecurring?: boolean }>>([]);

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
    const interval = setInterval(updateTime, TIMING_CONSTANTS.intervals.timeUpdate);
    
    return () => clearInterval(interval);
  }, []);


  // Make this view a droppable zone for tasks from Kanban (disabled on mobile)
  const { setNodeRef, isOver } = useDroppable({
    id: "today-agenda",
    disabled: shouldUseMobileLayout, // Disable drop on mobile/tablet - only allow vertical scroll
  });

  // Get today's tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Layer 1: Basic structure - no scroll tracking needed for now
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

  // Show all tasks including completed ones (they will be grayed out)
  // Completed tasks remain visible but grayed out like recurring tasks
  const incompleteTasks = allTodayTasks;

  // Sort tasks by time in chronological order - use useMemo to prevent recreation on every render
  // This prevents infinite loops in useEffect dependencies
  // Completed tasks stay in chronological order (not moved to bottom)
  const todayTasks = useMemo(() => {
    return [...incompleteTasks].sort((a, b) => {
      try {
        // Sort by full timestamp to ensure proper chronological order
        // This ensures tasks are sorted by actual scheduled time, not just time of day
        // This is important for recurring tasks and tasks scheduled at different times
        const dateA = a.scheduledDate ? new Date(a.scheduledDate) : null;
        const dateB = b.scheduledDate ? new Date(b.scheduledDate) : null;
        
        // Tasks without scheduled dates go to the end
        if (!dateA || isNaN(dateA.getTime())) return 1;
        if (!dateB || isNaN(dateB.getTime())) return -1;
        
        // Sort by full timestamp (chronological order: earliest first)
        const timeA = dateA.getTime();
        const timeB = dateB.getTime();
        
        // If times are equal, maintain stable sort order by task ID
        if (timeA === timeB) {
          return a.id.localeCompare(b.id);
        }
        
        return timeA - timeB;
      } catch (error) {
        console.error('Error sorting tasks:', error, a, b);
        return 0;
      }
    });
  }, [incompleteTasks]);

  // Fetch calendar events for today using optimized hook
  const todayStart = useMemo(() => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [today]);

  const todayEnd = useMemo(() => {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [today]);

  const { events: todayCalendarEventsData } = useCalendarEvents(todayStart, todayEnd, {
    enabled: !!accessToken,
    debounceMs: TIMING_CONSTANTS.delays.calendarEventsDebounce, // Slightly faster for today view
  });

  // Filter calendar events to only include those on today's date (using local timezone)
  // This prevents timezone conversion issues where events appear on wrong dates
  const todayString = useMemo(() => getDateString(today), [today]);

  // Update state when events change, filtering by local date
  useEffect(() => {
    const filteredEvents = todayCalendarEventsData.filter((event) => {
      if (!event?.start) return false;
      try {
        const eventDate = new Date(event.start);
        if (isNaN(eventDate.getTime())) return false;
        // Compare using local date string to avoid timezone issues
        const eventDateString = getDateString(eventDate);
        return eventDateString === todayString;
      } catch (error) {
        logger.warn('Error filtering calendar event by date:', error, event);
        return false;
      }
    });
    setTodayCalendarEvents(filteredEvents);
  }, [todayCalendarEventsData, todayString]);

  // Combine tasks and events, sort chronologically
  interface CombinedItem {
    type: 'task' | 'event';
    task?: Task;
    event?: { id: string; title: string; start: string; end: string; location?: string; provider: 'google' | 'apple'; calendarColor?: string; isRecurring?: boolean };
    sortTime: number;
  }

  const combinedItems = useMemo(() => {
    const items: CombinedItem[] = [];
    
    // Add tasks with their sort time
    for (const task of todayTasks) {
      const taskTime = task.scheduledDate ? new Date(task.scheduledDate).getTime() : Number.MAX_SAFE_INTEGER;
      items.push({
        type: 'task',
        task,
        sortTime: taskTime,
      });
    }
    
    // Add calendar events (always have a specific time)
    for (const event of todayCalendarEvents) {
      const sortTime = new Date(event.start).getTime();
      items.push({
        type: 'event',
        event,
        sortTime,
      });
    }
    
    // Sort by time (earliest first, items without time go to end)
    // Completed tasks stay in chronological order (not moved to bottom)
    items.sort((a, b) => {
      return a.sortTime - b.sortTime;
    });
    
    return items;
  }, [todayTasks, todayCalendarEvents]);

  // Use fixed spacing between items (no time-based spacing)
  const minGap = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing; // Fixed spacing from constants
  // Build layouts only for tasks (events will be inserted at their positions)
  const timelineTaskLayouts = useMemo(() => buildTaskLayouts(todayTasks, minGap, false), [todayTasks, minGap]); // Disable time-based spacing

  // Find the next uncompleted task after current time (next up)
  const nextUpTaskId = useMemo(() => {
    if (todayTasks.length === 0) return null;
    
    // Filter out completed tasks
    const uncompletedTasks = todayTasks.filter(task => task.status !== 'done');
    if (uncompletedTasks.length === 0) return null;
    
    const now = new Date();
    const currentTimeMs = now.getTime();
    
    // Find the first uncompleted task that starts at or after current time
    for (const task of uncompletedTasks) {
      if (!task.scheduledDate) continue;
      const taskTime = new Date(task.scheduledDate).getTime();
      if (taskTime >= currentTimeMs) {
        return task.id;
      }
    }
    
    // If no uncompleted task is after current time, return the first uncompleted task
    return uncompletedTasks[0]?.id || null;
  }, [todayTasks]);

  // LAYER 1: Basic vertical scroll - ScrollArea handles scrolling automatically
  // LAYER 2: Next up badge is implemented via nextUpTaskId and isNextUp prop (see below)
  // LAYER 3: Optional auto-scroll can be added later if needed

  const handleTaskClick = (task: Task) => {
    if (!task?.id) {
      toast.error('Invalid task data');
      return;
    }
    
    const safeTask = prepareTaskForDialog(task);
    if (!safeTask) {
      toast.error('Invalid task data');
      return;
    }
    
    // Defer state updates to next frame to avoid blocking click handler
    requestAnimationFrame(() => {
      setSelectedTask(safeTask);
      setDialogOpen(true);
    });
  };

  // Handle task completion - trigger confetti animation
  const handleTaskComplete = useCallback(() => {
    setShowConfetti(true);
  }, []);

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
  // IMPORTANT: Use AI Duration Estimator instead of hardcoded fallback
  const getTaskHeight = useCallback((task: Task) => {
    // Use AI estimator to get accurate duration (handles null/0/undefined cases)
    const minutes = getTaskMinutes(task);
    const isMobile = shouldUseMobileLayout;
    
    // Determine task category using constants
    const isShortTask = minutes < TASK_CARD_HEIGHT_CONFIG.thresholds.short;
    const isMediumTask = minutes >= TASK_CARD_HEIGHT_CONFIG.thresholds.short && minutes < TASK_CARD_HEIGHT_CONFIG.thresholds.long;
    const isLongTask = minutes >= TASK_CARD_HEIGHT_CONFIG.thresholds.long;
    
    // Count badges that will be displayed in the top row
    const hasTime = !!(task.scheduledDate || task.dueDate);
    const hasPriority = true; // Always shown
    const hasTag = task.tags && task.tags.length > 0;
    const hasDuration = !!task.estimatedTime;
    
    // Estimate if badges will wrap to second line
    const badgeCount = [hasTime, hasPriority, hasTag, hasDuration].filter(Boolean).length;
    const estimatedBadgeWidth = badgeCount * TASK_CARD_CALCULATIONS.badgeWidths.average;
    const availableWidth = isMobile ? TASK_CARD_CALCULATIONS.availableWidth.mobile : TASK_CARD_CALCULATIONS.availableWidth.desktop;
    const badgesWillWrap = estimatedBadgeWidth > availableWidth;
    const badgeWrapHeight = badgesWillWrap ? TASK_CARD_HEIGHT_CONFIG.componentHeights.badgeWrap : 0;
    
    const hasAssignedUsers = task.assignedTo && task.assignedTo.length > 0;
    const hasDescription = !!task.description; // Always show description if present, regardless of duration
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    
    // STANDARD HEIGHT CALCULATION: Use standard heights first, then auto-adjust for components
    // Step 1: Get standard height for this duration category (this is the BASE)
    let baseHeight: number;
    if (isShortTask) {
      // Short tasks (< 45 mins): Use standard base height
      baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.base; // 80px standard
    } else if (isMediumTask) {
      // Medium tasks (45-60 mins): Use standard minimum height
      baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.medium.min; // 120px standard
    } else {
      // Long tasks (>= 60 mins): Use standard heights at defined points
      // Use duration threshold constants instead of hardcoded values
      const durationThresholds = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.durationThresholds;
      if (minutes >= durationThresholds.at180mins) {
        // >= 180 mins: Use beyond180mins height
        baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.beyond180mins;
      } else if (minutes >= durationThresholds.at150mins) {
        // >= 150 mins: Use at150mins height
        baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.at150mins;
      } else if (minutes >= durationThresholds.at120mins) {
        // >= 120 mins: Use at120mins height
        baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.at120mins;
      } else if (minutes >= durationThresholds.at90mins) {
        // >= 90 mins: Use at90mins height
        baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.at90mins;
      } else {
        // 60-89 mins: Use standard base height (at60mins)
        baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.at60mins;
      }
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
      
    // Step 3: Enforce bounds - minimum based on task category, maximum 550px
    let minHeight: number;
    if (isShortTask) {
      minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.base; // 80px minimum for short tasks
    } else if (isMediumTask) {
      minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.medium.min; // 120px minimum for medium tasks
    } else {
      minHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.minHeight; // 200px minimum for long tasks
    }
    const effectiveMaxHeight = TASK_CARD_HEIGHT_CONFIG.maxHeight; // 550px maximum
    
    return Math.max(Math.min(baseHeight, effectiveMaxHeight), minHeight);
  }, []); // Empty deps - function is pure, only depends on task parameter


  return (
    <>
      <Confetti 
        trigger={showConfetti}
        origin={confettiOrigin}
        onComplete={() => {
          // Use timeout to ensure state update happens after animation cleanup
          if (confettiTimeoutRef.current) {
            clearTimeout(confettiTimeoutRef.current);
          }
          confettiTimeoutRef.current = setTimeout(() => {
            setShowConfetti(false);
            setConfettiOrigin(null);
            confettiTimeoutRef.current = null;
          }, 100);
        }} 
      />
      <div
        ref={setNodeRef}
        data-droppable-id="today-agenda"
        data-today-agenda="true"
        className={cn(
          `flex flex-col transition-all duration-300`,
          isOver &&
            "bg-primary/20 border-4 border-primary/70 border-dashed shadow-xl shadow-primary/30 ring-4 ring-primary/40",
          shouldUseMobileLayout ? "w-full" : "h-full min-h-0", // h-full ensures proper height chain for ScrollArea (matches InboxView pattern)
          // On desktop, apply gradient background to root container (like Folders Panel)
          !shouldUseMobileLayout && `${UI_GRADIENT_COLORS.timeline.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`,
        )}
        style={{
          position: 'relative',
          zIndex: isOver ? Z_INDEX.DROP_ZONE : Z_INDEX.TIMELINE_LINE, // Ensure drop zone is above other elements when dragging over
          // On mobile, ensure transparent background to show parent gradient
          // On desktop, background gradient is applied via className above
          ...(shouldUseMobileLayout ? {
            backgroundColor: 'transparent',
            background: 'transparent',
          } : {
            // Remove minHeight on desktop - it conflicts with ScrollArea height constraints
            // Drop zone accessibility is handled by ScrollArea viewport
          }),
        } as React.CSSProperties}
        data-tour="today-panel"
      >
      {/* Header */}
      {!hideHeader && (
        <>
          {/* Header wrapper - fixed height to prevent shifting */}
          <div 
            className="relative flex-shrink-0"
            style={{ 
              // Use fixed height on both mobile and desktop to prevent shifting
              // On mobile, header is fixed at top, so height should be consistent
              height: `${HEADER_HEIGHT}px`,
            }}
          >
          <AppHeader
            title="Today Agenda"
            panelOpen={true}
            isSidePanelHeader={true}
            description={
              isOver
                ? "✨ Drop task here to schedule for today"
                : undefined
            }
            hideDesktopLogo
            actions={
              <div className={cn(
                "flex flex-col items-end text-right",
                shouldUseMobileLayout && "justify-center self-center" // Vertically center on mobile/tablet within header
              )}>
                <span 
                  className="font-bold text-foreground uppercase tracking-wide"
                  style={{ fontSize: shouldUseMobileLayout ? HEADER_DATE_SIZE_MOBILE : HEADER_DATE_SIZE }}
                >
                  {today.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span 
                  className="font-bold text-foreground"
                  style={{ 
                    fontSize: shouldUseMobileLayout ? HEADER_DATE_NUMBER_SIZE_MOBILE : HEADER_DATE_NUMBER_SIZE,
                    marginTop: HEADER_DATE_MARGIN_TOP,
                  }}
                >
                  {today.getDate()}
                </span>
              </div>
            }
          />
            {/* Current Time Indicator - Desktop only (bottom right corner of header) */}
            <div 
              className={cn(
                "hidden md:block absolute pointer-events-none",
                `z-[${Z_INDEX.TIME_INDICATOR}]`
              )}
              style={{
                bottom: HEADER_GAP_SMALL, // 0.5rem (8px) - matches bottom-2
                right: HEADER_GAP_LARGE, // 0.75rem (12px) - close to right-6 (1.5rem), using available constant
              }}
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
        </>
      )}

      {/* Timeline */}
      {/* On mobile (when hideHeader is false), rely on parent scroll container in App.tsx */}
      {/* On desktop (when hideHeader is true), use ScrollArea for standalone scrolling */}
      {hideHeader ? (
        shouldUseMobileLayout ? (
          <div className="w-full relative flex-1 min-h-0">
            <div 
              ref={timelineContainerRef}
              className="px-5 w-full relative"
              style={{
                paddingTop: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.desktop 
                  ? 0 // No top padding on mobile - header spacer in App.tsx handles spacing
                  : DESKTOP_PADDING_TOP,
                paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.desktop
                  ? `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})` // Full nav bar height + safe area + extra buffer
                  : undefined,
                // Ensure transparent background to show parent gradient
                backgroundColor: 'transparent',
                background: 'transparent',
              } as React.CSSProperties}
            >
            {combinedItems.length === 0 ? (
              <div 
                className={cn(
                  `flex flex-col items-center justify-center text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none transition-all duration-300`,
                  isOver && "scale-105"
                )}
                style={{
                  paddingTop: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingBottom: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingLeft: EMPTY_STATE_PADDING_X,
                  paddingRight: EMPTY_STATE_PADDING_X,
                }}
              >
                <motion.div 
                  className={cn(
                    "rounded-full bg-primary/10 flex items-center justify-center pointer-events-none transition-all duration-300",
                    isOver && "bg-primary/20 scale-110 ring-4 ring-primary/30"
                  )}
                  style={{
                    width: EMPTY_STATE_ICON_SIZE_SMALL,
                    height: EMPTY_STATE_ICON_SIZE_SMALL,
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                  animate={isOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon name="calendar" 
                    className={cn(
                      "text-primary/40 transition-colors duration-300",
                      isOver && "text-primary/60"
                    )}
                    style={{
                      width: EMPTY_STATE_ICON_INNER_SIZE,
                      height: EMPTY_STATE_ICON_INNER_SIZE,
                    }}
                  />
                </motion.div>
                <p 
                  className={cn(
                    "text-sm text-muted-foreground pointer-events-none transition-colors duration-300",
                    isOver && "text-primary/80 font-medium"
                  )}
                  style={{
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                >
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
                  <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                {/* LAYER 1: Content container - extends naturally based on content */}
                <div className="flex flex-col w-full relative z-10">
                  {combinedItems.map((item, index) => {
                    if (item.type === 'task' && item.task) {
                      // Find the layout for this task
                      const taskLayout = timelineTaskLayouts.find(l => l.task.id === item.task!.id);
                      const marginTop = index === 0 ? 0 : (taskLayout?.marginTop || TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing);
                      
                      return (
                    <div
                            key={`task-${item.task.id}`}
                            data-task-id={item.task.id}
                      style={{
                              marginTop: index === 0 ? 0 : `${Math.max(marginTop, TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing)}px`,
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${TASK_CARD_TIMELINE.scale.todayAgenda})`,
                          transformOrigin: 'top center',
                        }}
                      >
                        <DraggableTaskCard
                          task={item.task}
                          onClick={() => item.task && handleTaskClick(item.task)}
                          droppableId="today-agenda"
                          isNextUp={item.task.id === nextUpTaskId}
                          onComplete={handleTaskComplete}
                        />
                      </div>
                    </div>
                        );
                      } else if (item.type === 'event' && item.event) {
                        // Calculate margin for events based on previous item
                        const prevItem = index > 0 ? combinedItems[index - 1] : null;
                        let marginTop: number = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                        
                        if (index === 0) {
                          marginTop = 0;
                        } else if (prevItem) {
                          // Use fixed spacing between items
                          marginTop = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                        }
                        
                        return (
                          <div
                            key={`event-${item.event.id}`}
                            data-event-id={item.event.id}
                            style={{
                              marginTop: `${marginTop}px`,
                            }}
                          >
                            <CalendarEventCard
                              title={item.event.title}
                              start={item.event.start}
                              end={item.event.end}
                              location={item.event.location}
                              provider={item.event.provider}
                              calendarColor={item.event.calendarColor}
                              isRecurring={item.event.isRecurring}
                            />
                          </div>
                        );
                      }
                      return null;
                    })}
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
                        <Icon name="sticky-note" size={ICON_SIZE_MD} weight="duotone" className="text-primary" />
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
                                  <span className={cn(TEXT_SIZES.xs9, "text-muted-foreground")}>
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span 
                                  className={cn(TEXT_SIZES.xs9, "px-1.5 py-0.5 rounded-full uppercase tracking-wider")}
                                  style={{
                                    backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                    color: actualTheme === 'dark' ? UI_TODAY_AGENDA_STATUS_COLORS.success.text.light : UI_TODAY_AGENDA_STATUS_COLORS.success.text.dark,
                                  }}
                                >
                                  {TODAY_AGENDA_TEXT.nextUp}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <Icon name="sticky-note" size={ICON_SIZE_SM} weight="duotone" className="text-primary/60 mt-0.5 flex-shrink-0" />
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
          </div>
        ) : (
          // LAYER 1: Desktop view with header - basic vertical scroll structure
          // Wrapper: flex-1 to take remaining space after header (matches InboxView pattern exactly)
          // When hideHeader is true, this is the only child, so flex-1 should take all space
          <div className={cn("flex-1 min-h-0", !hideHeader && "w-full relative")}>
            {/* ScrollArea: handles vertical scrolling when content exceeds viewport */}
            {/* CRITICAL: h-full ensures ScrollArea viewport gets proper height from parent */}
            <ScrollArea className="h-full w-full">
              <div 
                ref={timelineContainerRef}
                className={cn("px-5 sm:pb-safe md:pt-12 md:pb-4 w-full relative")}
                style={{
                  paddingTop: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.desktop 
                    ? `${Math.max(TIMELINE_PADDING.mobile, TIMELINE_PADDING.minMobilePadding)}px` 
                    : DESKTOP_PADDING_TOP,
                  paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.desktop
                    ? KANBAN_MOBILE.bottomPaddingCalc
                    : `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`,
                }}
              >
              {combinedItems.length === 0 ? (
              <div 
                className={cn(
                  `flex flex-col items-center justify-center text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none transition-all duration-300`,
                  isOver && "scale-105"
                )}
                style={{
                  paddingTop: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingBottom: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingLeft: EMPTY_STATE_PADDING_X,
                  paddingRight: EMPTY_STATE_PADDING_X,
                }}
              >
                <motion.div 
                  className={cn(
                    "rounded-full bg-primary/10 flex items-center justify-center pointer-events-none transition-all duration-300",
                    isOver && "bg-primary/20 scale-110 ring-4 ring-primary/30"
                  )}
                  style={{
                    width: EMPTY_STATE_ICON_SIZE_SMALL,
                    height: EMPTY_STATE_ICON_SIZE_SMALL,
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                  animate={isOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon name="calendar" 
                    className={cn(
                      "text-primary/40 transition-colors duration-300",
                      isOver && "text-primary/60"
                    )}
                    style={{
                      width: EMPTY_STATE_ICON_INNER_SIZE,
                      height: EMPTY_STATE_ICON_INNER_SIZE,
                    }}
                  />
                </motion.div>
                <p 
                  className={cn(
                    "text-sm text-muted-foreground pointer-events-none transition-colors duration-300",
                    isOver && "text-primary/80 font-medium"
                  )}
                  style={{
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                >
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
                  <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                {/* LAYER 1: Content container - extends naturally based on content */}
                <div className="flex flex-col w-full relative z-10">
                    {combinedItems.map((item, index) => {
                      if (item.type === 'task' && item.task) {
                        // Find the layout for this task
                        const taskLayout = timelineTaskLayouts.find(l => l.task.id === item.task!.id);
                        const marginTop = index === 0 ? 0 : (taskLayout?.marginTop || TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing);
                        
                        return (
                    <div
                            key={`task-${item.task.id}`}
                            data-task-id={item.task.id}
                      style={{
                              marginTop: index === 0 ? 0 : `${Math.max(marginTop, TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing)}px`,
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${TASK_CARD_TIMELINE.scale.todayAgenda})`,
                          transformOrigin: 'top center',
                        }}
                      >
                        <DraggableTaskCard
                          task={item.task}
                          onClick={() => item.task && handleTaskClick(item.task)}
                          droppableId="today-agenda"
                          isNextUp={item.task.id === nextUpTaskId}
                          onComplete={handleTaskComplete}
                        />
                      </div>
                    </div>
                        );
                      } else if (item.type === 'event' && item.event) {
                        // Calculate margin for events based on previous item
                        const prevItem = index > 0 ? combinedItems[index - 1] : null;
                        let marginTop: number = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                        
                        if (index === 0) {
                          marginTop = 0;
                        } else if (prevItem) {
                          // Use fixed spacing between items
                          marginTop = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                        }
                        
                        return (
                          <div
                            key={`event-${item.event.id}`}
                            data-event-id={item.event.id}
                            style={{
                              marginTop: `${marginTop}px`,
                            }}
                          >
                            <CalendarEventCard
                              title={item.event.title}
                              start={item.event.start}
                              end={item.event.end}
                              location={item.event.location}
                              provider={item.event.provider}
                              calendarColor={item.event.calendarColor}
                              isRecurring={item.event.isRecurring}
                            />
                          </div>
                        );
                      }
                      return null;
                    })}
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
                        <Icon name="sticky-note" size={ICON_SIZE_MD} weight="duotone" className="text-primary" />
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
                                  <span className={cn(TEXT_SIZES.xs9, "text-muted-foreground")}>
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span 
                                  className={cn(TEXT_SIZES.xs9, "px-1.5 py-0.5 rounded-full uppercase tracking-wider")}
                                  style={{
                                    backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                    color: actualTheme === 'dark' ? UI_TODAY_AGENDA_STATUS_COLORS.success.text.light : UI_TODAY_AGENDA_STATUS_COLORS.success.text.dark,
                                  }}
                                >
                                  {TODAY_AGENDA_TEXT.nextUp}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <Icon name="sticky-note" size={ICON_SIZE_SM} weight="duotone" className="text-primary/60 mt-0.5 flex-shrink-0" />
                              <div 
                                className={cn(
                                  "text-xs text-muted-foreground leading-relaxed flex-1",
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
        )
      ) : (
        // LAYER 1: When hideHeader=false (header IS visible)
        typeof window !== 'undefined' && window.innerWidth >= VIEWPORT_BREAKPOINTS.desktop ? (
          // Desktop: Use ScrollArea when header is visible (matches the pattern from line 767)
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full w-full">
              <div 
                ref={timelineContainerRef}
                className={cn("px-5 sm:pb-safe md:pt-12 md:pb-4 w-full relative")}
                style={{
                  paddingTop: DESKTOP_PADDING_TOP,
                  paddingBottom: `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`,
                  backgroundColor: 'transparent',
                  background: 'transparent',
                } as React.CSSProperties}
              >
          {combinedItems.length === 0 ? (
            <div className={cn(
              `flex flex-col items-center justify-center py-12 text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none transition-all duration-300`,
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
                <Icon name="calendar" size={ICON_SIZE_MD} weight="duotone" className={cn(
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
                <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                {TODAY_AGENDA_TEXT.emptyState.addTask}
              </Button>
            </div>
          ) : (
            <>
              {/* LAYER 1: Content container - extends naturally based on content */}
              <div className="flex flex-col w-full relative z-10">
                {combinedItems.map((item, index) => {
                  if (item.type === 'task' && item.task) {
                    // Find the layout for this task
                    const taskLayout = timelineTaskLayouts.find(l => l.task.id === item.task!.id);
                    const marginTop = index === 0 ? 0 : (taskLayout?.marginTop || TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing);
                    
                    return (
                  <div
                        key={`task-${item.task.id}`}
                        data-task-id={item.task.id}
                    style={{
                      marginTop: index === 0 ? 0 : `${Math.max(marginTop, TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing)}px`,
                    }}
                  >
                    <div
                      style={{
                        transform: `scale(${TASK_CARD_TIMELINE.scale.todayAgenda})`,
                        transformOrigin: 'top center',
                      }}
                    >
                      <DraggableTaskCard
                        task={item.task}
                        onClick={() => item.task && handleTaskClick(item.task)}
                        droppableId="today-agenda"
                        isNextUp={item.task.id === nextUpTaskId}
                        onComplete={handleTaskComplete}
                      />
                    </div>
                  </div>
                    );
                  } else if (item.type === 'event' && item.event) {
                    // Calculate margin for events based on previous item (same as tasks)
                    const prevItem = index > 0 ? combinedItems[index - 1] : null;
                    let marginTop: number = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                    
                    if (index === 0) {
                      marginTop = 0;
                    } else if (prevItem) {
                      // Use fixed spacing between items (same as tasks)
                      marginTop = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                    }
                    
                    return (
                      <div
                        key={`event-${item.event.id}`}
                        data-event-id={item.event.id}
                        style={{
                          marginTop: `${marginTop}px`,
                        }}
                      >
                        {/* Apply same scale transform as tasks for vertical alignment */}
                        <div
                          style={{
                            transform: `scale(${TASK_CARD_TIMELINE.scale.todayAgenda})`,
                            transformOrigin: 'top center',
                          }}
                        >
                          <CalendarEventCard
                            title={item.event.title}
                            start={item.event.start}
                            end={item.event.end}
                            location={item.event.location}
                            provider={item.event.provider}
                            calendarColor={item.event.calendarColor}
                          />
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Next Up Task Details */}
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
                      <Icon name="sticky-note" size={ICON_SIZE_MD} weight="duotone" className="text-primary" />
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
                                <span className={cn(TEXT_SIZES.xs9, "text-muted-foreground")}>
                                  {getTaskTime(nextUpTask)}
                                </span>
                              )}
                              <span 
                                className={cn(TEXT_SIZES.xs9, "px-1.5 py-0.5 rounded-full uppercase tracking-wider")}
                                style={{
                                  backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                  color: actualTheme === 'dark' ? UI_TODAY_AGENDA_STATUS_COLORS.success.text.light : UI_TODAY_AGENDA_STATUS_COLORS.success.text.dark,
                                }}
                              >
                                {TODAY_AGENDA_TEXT.nextUp}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-start gap-1.5 mt-1.5">
                            <Icon name="sticky-note" size={ICON_SIZE_XS} weight="duotone" className="text-primary/60 mt-0.5 flex-shrink-0" />
                            <div 
                              className={cn(
                                "text-xs text-muted-foreground leading-relaxed flex-1",
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
        ) : (
          // Mobile: No ScrollArea, rely on parent scroll
          <div 
            ref={timelineContainerRef}
            className="px-5 w-full relative"
            style={{
              paddingTop: `${Math.max(TIMELINE_PADDING.mobile, TIMELINE_PADDING.minMobilePadding)}px`,
              paddingBottom: `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`,
              backgroundColor: 'transparent',
              background: 'transparent',
            } as React.CSSProperties}
          >
            {combinedItems.length === 0 ? (
              <div 
                className={cn(
                  `flex flex-col items-center justify-center text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none transition-all duration-300`,
                  isOver && "scale-105"
                )}
                style={{
                  paddingTop: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingBottom: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingLeft: EMPTY_STATE_PADDING_X,
                  paddingRight: EMPTY_STATE_PADDING_X,
                }}
              >
                <motion.div 
                  className={cn(
                    "rounded-full bg-primary/10 flex items-center justify-center pointer-events-none transition-all duration-300",
                    isOver && "bg-primary/20 scale-110 ring-4 ring-primary/30"
                  )}
                  style={{
                    width: EMPTY_STATE_ICON_SIZE_SMALL,
                    height: EMPTY_STATE_ICON_SIZE_SMALL,
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                  animate={isOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon name="calendar" 
                    className={cn(
                      "text-primary/40 transition-colors duration-300",
                      isOver && "text-primary/60"
                    )}
                    style={{
                      width: EMPTY_STATE_ICON_INNER_SIZE,
                      height: EMPTY_STATE_ICON_INNER_SIZE,
                    }}
                  />
                </motion.div>
                <p 
                  className={cn(
                    "text-sm text-muted-foreground pointer-events-none transition-colors duration-300",
                    isOver && "text-primary/80 font-medium"
                  )}
                  style={{
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                >
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
                  <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col w-full relative z-10">
                  {combinedItems.map((item, index) => {
                    if (item.type === 'task' && item.task) {
                      const taskLayout = timelineTaskLayouts.find(l => l.task.id === item.task!.id);
                      const marginTop = index === 0 ? 0 : (taskLayout?.marginTop || TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing);
                      return (
                        <div
                          key={`task-${item.task.id}`}
                          data-task-id={item.task.id}
                          style={{
                            marginTop: index === 0 ? 0 : `${Math.max(marginTop, TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing)}px`,
                          }}
                        >
                          <div
                            style={{
                              transform: `scale(${TASK_CARD_TIMELINE.scale.todayAgenda})`,
                              transformOrigin: 'top center',
                            }}
                          >
                            <DraggableTaskCard
                              task={item.task}
                              onClick={() => item.task && handleTaskClick(item.task)}
                              droppableId="today-agenda"
                              isNextUp={item.task.id === nextUpTaskId}
                              onComplete={handleTaskComplete}
                            />
                          </div>
                        </div>
                      );
                    } else if (item.type === 'event' && item.event) {
                      const prevItem = index > 0 ? combinedItems[index - 1] : null;
                      let marginTop: number = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                      if (index === 0) {
                        marginTop = 0;
                      } else if (prevItem) {
                        marginTop = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                      }
                      return (
                        <div
                          key={`event-${item.event.id}`}
                          data-event-id={item.event.id}
                          style={{
                            marginTop: `${marginTop}px`,
                          }}
                        >
                          <CalendarEventCard
                            title={item.event.title}
                            start={item.event.start}
                            end={item.event.end}
                            location={item.event.location}
                            provider={item.event.provider}
                            calendarColor={item.event.calendarColor}
                          />
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                {(() => {
                  const nextUpTask = todayTasks.find((task) => task.id === nextUpTaskId);
                  if (!nextUpTask || !nextUpTask.notes) return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6 pt-4 border-t border-primary/20"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="sticky-note" size={ICON_SIZE_MD} weight="duotone" className="text-primary" />
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
                        onClick={() => handleTaskClick(nextUpTask)}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                              getPriorityColor(nextUpTask.priority),
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-xs line-clamp-1 flex-1 font-semibold">
                                {nextUpTask.title}
                              </h4>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {nextUpTask.scheduledDate && (
                                  <span className={cn(TEXT_SIZES.xs9, "text-muted-foreground")}>
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span 
                                  className={cn(TEXT_SIZES.xs9, "px-1.5 py-0.5 rounded-full uppercase tracking-wider")}
                                  style={{
                                    backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                    color: actualTheme === 'dark' ? UI_TODAY_AGENDA_STATUS_COLORS.success.text.light : UI_TODAY_AGENDA_STATUS_COLORS.success.text.dark,
                                  }}
                                >
                                  {TODAY_AGENDA_TEXT.nextUp}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <Icon name="sticky-note" size={ICON_SIZE_SM} weight="duotone" className="text-primary/60 mt-0.5 flex-shrink-0" />
                              <div 
                                className={cn(
                                  "text-xs text-muted-foreground leading-relaxed flex-1",
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
        )
      )}

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        initialDate={getDateString(today)}
      />
      </div>
    </>
  );
}
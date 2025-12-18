import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { useDroppable } from "@dnd-kit/core";
import { Calendar, Plus, StickyNote } from "lucide-react";
import { useTasks } from "../contexts/TaskContext";
import { useTheme } from "../contexts/ThemeContext";
import { useIsMobile } from "./ui/use-mobile";
import { useCalendar } from "../contexts/CalendarContext";
import { useAuth } from "../contexts/AuthContext";
import { CalendarEventCard } from "./CalendarEventCard";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { TaskDialog } from "./TaskDialog";
import { DraggableTodayAgendaTask } from "./DraggableTodayAgendaTask";
import { Confetti } from "./Confetti";
import { cn, prepareTaskForDialog, hasHTMLTags, sanitizeHTML } from "../lib/utils";
import { isDateInRecurrence } from "../lib/recurrence";
import { toast } from "sonner";
import type { Task } from "../types";
import { UI_GRADIENT_COLORS, UI_TODAY_AGENDA_STATUS_COLORS } from "../lib/ui-colors";
import { TASK_CALCULATION_CONSTANTS } from "../lib/task-calculation-constants";
import { TASK_CARD_HEIGHT_CONFIG, TASK_CARD_CALCULATIONS, TASK_CARD_LAYOUT_METRICS } from "../lib/task-card-constants";
import { TODAY_AGENDA_TEXT } from "../lib/today-agenda-constants";
import { HEADER_HEIGHT, TIMELINE_PADDING, VIEWPORT_BREAKPOINTS, MOBILE_SPACING, Z_INDEX, COMPONENT_DIMENSIONS, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE } from "../lib/layout-constants";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { KANBAN_MOBILE } from "../lib/kanban-constants";
import { buildTaskLayouts } from "../lib/task-layout";
import { getTaskMinutes } from "../lib/daily-hours-utils";
import { projectId } from "../utils/supabase/info";
import { logger } from "../lib/logger";

interface TodayAgendaViewProps {
  hideHeader?: boolean;
}

export function TodayAgendaView({
  hideHeader = false,
}: TodayAgendaViewProps = {}) {
  const { tasks, updateTask } = useTasks();
  const { actualTheme } = useTheme();
  const isMobile = useIsMobile();
  const { calendarStatus } = useCalendar();
  const { accessToken } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    null,
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  // Current time for display - updates every minute to show current time
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayCalendarEvents, setTodayCalendarEvents] = useState<Array<{ id: string; title: string; start: string; end: string; location?: string; provider: 'google' | 'apple'; calendarColor?: string }>>([]);

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
    disabled: isMobile, // Disable drop on mobile - only allow vertical scroll
  });

  // Get today's tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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

  // Sort tasks by time - use useMemo to prevent recreation on every render
  // This prevents infinite loops in useEffect dependencies
  // Completed tasks are sorted to the end
  const todayTasks = useMemo(() => {
    return [...incompleteTasks].sort((a, b) => {
      // Sort completed tasks to the end
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      
      try {
        // Sort by TIME OF DAY only (hours and minutes), not full timestamp
        // This is important for recurring tasks where scheduledDate is the base date
        const dateA = a.scheduledDate ? new Date(a.scheduledDate) : null;
        const dateB = b.scheduledDate ? new Date(b.scheduledDate) : null;
        
        if (!dateA || isNaN(dateA.getTime())) return 1;
        if (!dateB || isNaN(dateB.getTime())) return -1;
        
        // Extract time of day in minutes (hours * 60 + minutes)
        const timeOfDayA = dateA.getHours() * 60 + dateA.getMinutes();
        const timeOfDayB = dateB.getHours() * 60 + dateB.getMinutes();
        
        return timeOfDayA - timeOfDayB;
      } catch (error) {
        console.error('Error sorting tasks:', error, a, b);
        return 0;
      }
    });
  }, [incompleteTasks]);

  // Fetch calendar events for today
  useEffect(() => {
    const fetchTodayCalendarEvents = async () => {
      try {
        if (!accessToken) {
          logger.debug('TodayAgenda: No access token, skipping calendar events fetch');
          setTodayCalendarEvents([]);
          return;
        }
        const providers: Array<'google' | 'apple'> = [];
        if (calendarStatus.google) providers.push('google');
        if (calendarStatus.apple) providers.push('apple');
        if (providers.length === 0) {
          logger.debug('TodayAgenda: No calendar providers enabled, skipping calendar events fetch');
          setTodayCalendarEvents([]);
          return;
        }
        
        logger.debug(`TodayAgenda: Fetching calendar events for providers: ${providers.join(', ')}`);

        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const BASE_URL = `https://${projectId}.supabase.co/functions/v1/taskzm-database-function`;
        const allEvents: Array<{ id: string; title: string; start: string; end: string; location?: string; provider: 'google' | 'apple'; calendarColor?: string }> = [];

        for (const provider of providers) {
          const resp = await fetch(
            `${BASE_URL}/calendar/events/${provider}?startDate=${todayStart.toISOString()}&endDate=${todayEnd.toISOString()}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          if (!resp.ok) continue;
          const data = await resp.json();
          if (!Array.isArray(data.events)) continue;
          for (const event of data.events) {
            if (!event?.start || !event?.end) continue;
            const eventStart = new Date(event.start);
            if (isNaN(eventStart.getTime())) continue;
            allEvents.push({
              id: event.id || `${provider}-${event.providerEventId || event.start}-${allEvents.length}`,
              title: event.title || 'Calendar Event',
              start: event.start,
              end: event.end,
              location: event.location,
              provider,
              calendarColor: event.calendarColor,
            });
          }
        }

        logger.debug(`TodayAgenda: Fetched ${allEvents.length} calendar events for today`);
        setTodayCalendarEvents(allEvents);
      } catch (error) {
        logger.warn('Failed to fetch calendar events for today agenda:', error);
        setTodayCalendarEvents([]);
      }
    };

    fetchTodayCalendarEvents();
  }, [accessToken, calendarStatus.apple, calendarStatus.google, today]);

  // Combine tasks and events, sort chronologically
  interface CombinedItem {
    type: 'task' | 'event';
    task?: Task;
    event?: { id: string; title: string; start: string; end: string; location?: string; provider: 'google' | 'apple'; calendarColor?: string };
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
    items.sort((a, b) => {
      // Completed tasks go to end
      if (a.type === 'task' && a.task?.status === 'done' && b.type === 'task' && b.task?.status !== 'done') return 1;
      if (a.type === 'task' && a.task?.status !== 'done' && b.type === 'task' && b.task?.status === 'done') return -1;
      return a.sortTime - b.sortTime;
    });
    
    return items;
  }, [todayTasks, todayCalendarEvents]);

  // Use fixed spacing between items (no time-based spacing)
  const minGap = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing; // Fixed spacing from constants
  // Build layouts only for tasks (events will be inserted at their positions)
  const timelineTaskLayouts = useMemo(() => buildTaskLayouts(todayTasks, minGap, false), [todayTasks, minGap]); // Disable time-based spacing

  // Auto-scroll to current time on mount and when items change
  // On mobile (hideHeader=false), scroll the parent container in App.tsx
  // On desktop (hideHeader=true), scroll the ScrollArea viewport
  useEffect(() => {
    if (combinedItems.length === 0) return;

    const scrollToCurrentTime = () => {
      const now = new Date();
      const currentTimeMs = now.getTime();

      // Find the item (task or event) closest to current time
      let closestItem = combinedItems[0];
      let minDiff = Infinity;

      combinedItems.forEach((item) => {
        let itemTimeMs: number;
        if (item.type === 'task' && item.task?.scheduledDate) {
          itemTimeMs = new Date(item.task.scheduledDate).getTime();
        } else if (item.type === 'event' && item.event) {
          itemTimeMs = new Date(item.event.start).getTime();
        } else {
          return;
        }
        
        const diff = Math.abs(itemTimeMs - currentTimeMs);
        if (diff < minDiff) {
          minDiff = diff;
          closestItem = item;
        }
      });

      // Scroll to the closest item
      if (closestItem) {
        let element: HTMLElement | null = null;
        if (closestItem.type === 'task' && closestItem.task) {
          element = timelineContainerRef.current?.querySelector(`[data-task-id="${closestItem.task.id}"]`) || null;
        } else if (closestItem.type === 'event' && closestItem.event) {
          element = timelineContainerRef.current?.querySelector(`[data-event-id="${closestItem.event.id}"]`) || null;
        }
        
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // On mobile (hideHeader=false), scroll the parent scroll container in App.tsx
          // On desktop (hideHeader=true), scroll the ScrollArea viewport
          if (hideHeader) {
            // Desktop: Find the scroll viewport within this component's ScrollArea
            const scrollViewport = timelineContainerRef.current?.closest('[data-slot="scroll-area"]')?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
            if (scrollViewport) {
              const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
              const baselineMinutes = TASK_CALCULATION_CONSTANTS.dragDrop.hourMin * 60;
              const offsetMinutes = Math.max(0, currentTimeInMinutes - baselineMinutes);
              const estimatedScrollTop = Math.max(
                0,
                offsetMinutes * TASK_CARD_LAYOUT_METRICS.pixelsPerMinute - TASK_CARD_LAYOUT_METRICS.timelineScrollOffset
              );
              scrollViewport.scrollTop = estimatedScrollTop;
            }
          }
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(scrollToCurrentTime, TIMING_CONSTANTS.delays.scroll);
    return () => clearTimeout(timer);
  }, [combinedItems, hideHeader]);


  // Find the next uncompleted task after current time (next up)
  const nextUpTaskId = (() => {
    if (todayTasks.length === 0) return null;
    
    const now = new Date();
    const currentTimeMs = now.getTime();
    
    // Find the first task that starts at or after current time
    for (const task of todayTasks) {
      if (!task.scheduledDate) continue;
      const taskTime = new Date(task.scheduledDate).getTime();
      if (taskTime >= currentTimeMs) {
        return task.id;
      }
    }
    
    // If no task is after current time, return the first task
    return todayTasks[0]?.id || null;
  })();

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
    const isMobile = typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet;
    
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
        onComplete={() => {
          // Use timeout to ensure state update happens after animation cleanup
          if (confettiTimeoutRef.current) {
            clearTimeout(confettiTimeoutRef.current);
          }
          confettiTimeoutRef.current = setTimeout(() => {
            setShowConfetti(false);
            confettiTimeoutRef.current = null;
          }, 100);
        }} 
      />
      <div
        ref={setNodeRef}
        data-droppable-id="today-agenda"
        data-today-agenda="true"
        className={cn(
          `flex flex-col transition-all duration-300 ${UI_GRADIENT_COLORS.timeline.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`,
          isOver &&
            "bg-primary/20 border-4 border-primary/70 border-dashed shadow-xl shadow-primary/30 ring-4 ring-primary/40",
          isMobile ? "w-full" : "h-full",
          !isMobile && "min-h-[400px]", // Ensure drop zone is always accessible
        )}
        style={{
          position: 'relative',
          zIndex: isOver ? Z_INDEX.DROP_ZONE : Z_INDEX.TIMELINE_LINE, // Ensure drop zone is above other elements when dragging over
        } as React.CSSProperties}
        data-tour="today-panel"
      >
      {/* Header */}
      {!hideHeader && (
        <>
          {/* Header wrapper - no minHeight on mobile since AppHeader is fixed and spacer in App.tsx handles spacing */}
          <div 
            className="relative"
            style={{ 
              minHeight: isMobile ? 0 : `${HEADER_HEIGHT}px`, // No minHeight on mobile since header is fixed
            }}
          >
          <AppHeader
            title="Today Agenda"
            panelOpen={true}
            isSidePanelHeader={true}
            description={
              isOver
                ? "✨ Drop task here to schedule for today"
                : today.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
            }
            hideDesktopLogo
          />
            {/* Current Time Indicator - Desktop only (bottom right corner of header) */}
            <div 
              className={`hidden md:block absolute bottom-2 right-6 z-[${Z_INDEX.TIME_INDICATOR}] pointer-events-none`}
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
        isMobile ? (
          <div className="w-full relative">
            <div 
              ref={timelineContainerRef}
              className="px-5 w-full relative"
              style={{
                paddingTop: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet 
                  ? 0 // No top padding on mobile - header spacer in App.tsx handles spacing
                  : '3rem',
                paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet
                  ? `calc(${NAV_BAR_BOTTOM_PADDING_MOBILE} + 2rem)`
                  : undefined,
              }}
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
                  <Calendar className={cn(
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
                  <Plus className="w-4 h-4 mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                <div 
                  className="flex flex-col w-full relative z-10"
                  style={{ overflow: 'visible' }}
                >
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
                          <DraggableTodayAgendaTask
                            task={item.task}
                            index={todayTasks.findIndex(t => t.id === item.task!.id)}
                            totalTasks={todayTasks.length}
                            onClick={handleTaskClick}
                            getTaskHeight={getTaskHeight}
                            getTaskTime={getTaskTime}
                            getPriorityColor={getPriorityColor}
                            isNextUp={item.task.id === nextUpTaskId}
                            onComplete={() => {
                              if (confettiTimeoutRef.current) {
                                clearTimeout(confettiTimeoutRef.current);
                              }
                              if (!showConfetti) {
                                setShowConfetti(true);
                              }
                            }}
                          />
                        </div>
                      );
                    } else if (item.type === 'event' && item.event) {
                      // Calculate margin for events based on previous item
                      const prevItem = index > 0 ? combinedItems[index - 1] : null;
                      let marginTop = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                      
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
                        <StickyNote className="w-4 h-4 text-primary" />
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
                                  <span className="text-[9px] text-muted-foreground">
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span 
                                  className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider"
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
                              <StickyNote className="w-3 h-3 text-primary/60 mt-0.5 flex-shrink-0" />
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
          <div className={cn("flex-1 w-full relative", "overflow-hidden")}>
          <ScrollArea 
            className="h-full w-full" 
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' } as React.CSSProperties}
          >
            <div 
              ref={timelineContainerRef}
                className="px-5 sm:pb-safe md:pt-12 md:pb-4 w-full relative"
              style={{
                paddingTop: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet 
                  ? `${Math.max(TIMELINE_PADDING.mobile, 8)}px` 
                    : '3rem', // 48px on desktop for better spacing from header
                paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet
                  ? KANBAN_MOBILE.bottomPaddingCalc
                  : undefined,
              }}
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
                  <Calendar className={cn(
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
                  <Plus className="w-4 h-4 mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                <div 
                  className="flex flex-col w-full relative z-10"
                  style={{ overflow: 'visible' }}
                >
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
                      <DraggableTodayAgendaTask
                              task={item.task}
                              index={todayTasks.findIndex(t => t.id === item.task!.id)}
                      totalTasks={todayTasks.length}
                      onClick={handleTaskClick}
                      getTaskHeight={getTaskHeight}
                      getTaskTime={getTaskTime}
                      getPriorityColor={getPriorityColor}
                              isNextUp={item.task.id === nextUpTaskId}
                      onComplete={() => {
                        if (confettiTimeoutRef.current) {
                          clearTimeout(confettiTimeoutRef.current);
                        }
                        if (!showConfetti) {
                          setShowConfetti(true);
                        }
                      }}
                    />
                    </div>
                        );
                      } else if (item.type === 'event' && item.event) {
                        // Calculate margin for events based on previous item
                        const prevItem = index > 0 ? combinedItems[index - 1] : null;
                        let marginTop = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                        
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
                        <StickyNote className="w-4 h-4 text-primary" />
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
                                  <span className="text-[9px] text-muted-foreground">
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span 
                                  className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider"
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
                              <StickyNote className="w-3 h-3 text-primary/60 mt-0.5 flex-shrink-0" />
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
        <div 
          ref={timelineContainerRef}
          className="px-5 w-full relative"
          style={{
            paddingTop: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet 
              ? 0 // No top padding on mobile - header spacer in App.tsx handles spacing
              : '3rem', // 48px on desktop for proper spacing from header in sidebar panel
            paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet
              ? `calc(${NAV_BAR_BOTTOM_PADDING_MOBILE} + 3rem)`
              : undefined,
          }}
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
                <Calendar className={cn(
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
                <Plus className="w-4 h-4 mr-2" />
                {TODAY_AGENDA_TEXT.emptyState.addTask}
              </Button>
            </div>
          ) : (
            <>
              <div 
                className="flex flex-col w-full relative z-10"
                style={{ overflow: 'visible' }}
              >
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
                    <DraggableTodayAgendaTask
                          task={item.task}
                          index={todayTasks.findIndex(t => t.id === item.task!.id)}
                      totalTasks={todayTasks.length}
                      onClick={handleTaskClick}
                      getTaskHeight={getTaskHeight}
                      getTaskTime={getTaskTime}
                      getPriorityColor={getPriorityColor}
                          isNextUp={item.task.id === nextUpTaskId}
                      onComplete={() => {
                        if (confettiTimeoutRef.current) {
                          clearTimeout(confettiTimeoutRef.current);
                        }
                        if (!showConfetti) {
                          setShowConfetti(true);
                        }
                      }}
                    />
                  </div>
                    );
                  } else if (item.type === 'event' && item.event) {
                    // Calculate margin for events based on previous item
                    const prevItem = index > 0 ? combinedItems[index - 1] : null;
                    let marginTop = TASK_CARD_LAYOUT_METRICS.timelineTaskSpacing;
                    
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
                        />
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
                      <StickyNote className="w-4 h-4 text-primary" />
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
                                <span className="text-[9px] text-muted-foreground">
                                  {getTaskTime(nextUpTask)}
                                </span>
                              )}
                              <span 
                                className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider"
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
                            <StickyNote className="w-3 h-3 text-primary/60 mt-0.5 flex-shrink-0" />
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
      )}

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        initialDate={today.toISOString()}
      />
      </div>
    </>
  );
}
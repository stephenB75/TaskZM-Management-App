import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// Icons migrated to Icon component
import { Icon } from './Icon';
import { useTasks } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { useDragDrop } from '../contexts/DragDropContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { TaskDialog } from './TaskDialog';
import { DraggableTaskCard } from './DraggableTaskCard';
import { CalendarEventCard } from './CalendarEventCard';
import { DroppableColumn } from './DroppableColumn';
import { cn, prepareTaskForDialog, getWeekStart, getDateString, getTaskWithOccurrenceSubtasks, getTasksForDayView, dateStringToLocalDate, buildSortedKanbanDayItems } from '../lib/utils';
import { toast } from '../lib/toast-wrapper';
import { logger } from '../lib/logger';
import { useCalendarEventsByDate } from '../hooks/useCalendarEvents';
import {
  KANBAN_DAY_COLORS,
  KANBAN_BACKGROUND_GRADIENTS,
  KANBAN_COLUMN_DIMENSIONS,
  KANBAN_ANIMATION,
  KANBAN_ZOOM,
  KANBAN_SCROLL,
  KANBAN_TIME,
  KANBAN_MOBILE,
  KANBAN_DESKTOP,
  KANBAN_TEXT_SIZES,
  KANBAN_SPACING,
  KANBAN_WEEK_GROUP_HEADER,
  KANBAN_WEEK_GROUP_LABELS,
  KANBAN_COLUMN_HEIGHT,
  KANBAN_VIEWPORT_WEEK,
  getKanbanWeekPanelWidthPx,
  formatKanbanWeekGroupDateRange,
} from '../lib/kanban-constants';
import { COLOR_BACKGROUND_WHITE } from '../lib/color-theme';
import { TASK_CARD_TIMELINE } from '../lib/task-card-constants';
import { NAV_BAR_BOTTOM_PADDING_MOBILE, NAV_BAR_SCROLL_PADDING_MOBILE, getMobileViewportContentMinHeight, ICON_SIZE_SM } from '../lib/layout-constants';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { useTaskDeepLinkOpener } from '../hooks/useTaskDeepLinkOpener';
import type { Task } from '../types';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** Horizontal gutter between kanban week panels (plain inset or optional divider). */
function KanbanWeekPanelGutter({
  widthPx,
  showDivider = false,
}: {
  widthPx: number;
  showDivider?: boolean;
}) {
  if (!showDivider) {
    return (
      <div
        className="flex-shrink-0 self-stretch"
        style={{ width: widthPx, minWidth: widthPx }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className="flex flex-col items-center self-stretch flex-shrink-0"
      style={{
        width: widthPx,
        minWidth: widthPx,
        paddingTop: KANBAN_WEEK_GROUP_HEADER.transition.verticalPaddingPx,
        paddingBottom: KANBAN_WEEK_GROUP_HEADER.transition.verticalPaddingPx,
      }}
      aria-hidden
    >
      <div
        className="w-px flex-1 bg-border dark:bg-border/60"
        style={{
          minHeight: KANBAN_WEEK_GROUP_HEADER.transition.minLineHeightPx,
          opacity: KANBAN_WEEK_GROUP_HEADER.transition.lineOpacity,
        }}
      />
      <div
        className="rounded-full bg-primary/35 dark:bg-primary/45 flex-shrink-0 my-1"
        style={{
          width: KANBAN_WEEK_GROUP_HEADER.transition.dotSizePx,
          height: KANBAN_WEEK_GROUP_HEADER.transition.dotSizePx,
        }}
      />
      <div
        className="w-px flex-1 bg-border dark:bg-border/60"
        style={{
          minHeight: KANBAN_WEEK_GROUP_HEADER.transition.minLineHeightPx,
          opacity: KANBAN_WEEK_GROUP_HEADER.transition.lineOpacity,
        }}
      />
    </div>
  );
}

function getKanbanSortableTaskId(task: Task, dateString: string): string | null {
  if (!task?.id) return null;
  const isRecurring = task.recurrence && task.recurrence.type !== 'none';
  return isRecurring ? `${task.id}__${dateString}` : task.id;
}

function getKanbanEventSortableId(eventId: string): string {
  return `event-${eventId}`;
}

function getKanbanColumnSortableIds(
  combinedItems: ReturnType<typeof buildSortedKanbanDayItems>,
  dateString: string,
): string[] {
  return combinedItems.map((item) =>
    item.type === 'event'
      ? getKanbanEventSortableId(item.event.id)
      : getKanbanSortableTaskId(item.task, dateString),
  ).filter((id): id is string => id != null);
}

/** Registers calendar events in SortableContext at the correct DOM index (disabled drag). */
function KanbanCalendarEventSlot({
  id,
  className,
  children,
}: {
  id: string;
  className: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, transform, transition } = useSortable({ id, disabled: true });
  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        minWidth: '100%',
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children}
    </div>
  );
}

function KanbanColumnItems({
  combinedItems,
  dateString,
  allTasks,
  kanbanCardItemClassName,
  onTaskClick,
  onTaskComplete,
}: {
  combinedItems: ReturnType<typeof buildSortedKanbanDayItems>;
  dateString: string;
  allTasks: Task[];
  kanbanCardItemClassName: string;
  onTaskClick: (task: Task, dateString: string) => void;
  onTaskComplete?: (element?: HTMLElement) => void;
}) {
  const cardScaleStyle: React.CSSProperties = {
    transform: `scale(${TASK_CARD_TIMELINE.scale.kanban})`,
    transformOrigin: 'top center',
    width: '100%',
  };

  return (
    <>
      {combinedItems.map((item) => {
        if (item.type === 'event') {
          return (
            <KanbanCalendarEventSlot
              key={getKanbanEventSortableId(item.event.id)}
              id={getKanbanEventSortableId(item.event.id)}
              className={kanbanCardItemClassName}
            >
              <div style={cardScaleStyle}>
                <CalendarEventCard
                  title={item.event.title}
                  start={item.event.start}
                  end={item.event.end}
                  location={item.event.location}
                  provider={item.event.provider}
                  calendarColor={item.event.calendarColor}
                  isRecurring={item.event.isRecurring}
                  variant="kanban"
                />
              </div>
            </KanbanCalendarEventSlot>
          );
        }

        return (
          <div
            key={item.task.id}
            className={kanbanCardItemClassName}
            style={{
              display: 'block',
              width: '100%',
              minWidth: '100%',
              transform: `scale(${TASK_CARD_TIMELINE.scale.kanban})`,
              transformOrigin: 'top center',
            }}
          >
            <DraggableTaskCard
              task={getTaskWithOccurrenceSubtasks(item.task, dateString, allTasks)}
              onClick={() => onTaskClick(item.task, dateString)}
              droppableId={dateString}
              occurrenceDate={dateString}
              onComplete={onTaskComplete}
            />
          </div>
        );
      })}
    </>
  );
}

// Helper function to get day colors
const getDayColors = (dayName: string) => {
  const dayKey = dayName.toLowerCase() as keyof typeof KANBAN_DAY_COLORS;
  return KANBAN_DAY_COLORS[dayKey] || KANBAN_DAY_COLORS.monday;
};

// Type guard to check if day colors have header property
const hasHeader = (colors: ReturnType<typeof getDayColors>): colors is typeof KANBAN_DAY_COLORS.monday => {
  return 'header' in colors && 'background' in colors;
};

interface DayColumn {
  date: Date;
  dayName: string;
  dateString: string;
  isToday: boolean;
  isWeekend: boolean;
  weekNumber: number;
  dayIndex: number;
}

interface SevenDayKanbanProps {
  mobileMode?: boolean;
  viewMode?: 'week' | 'month';
  mobileDayIndex?: number;
  mobileWeekOffset?: number;
  onMobileWeekChange?: (offset: number) => void;
  /** Extra fixed chrome above the kanban on mobile (e.g. week calendar carousel). */
  mobileAboveChromeOffsetPx?: number;
  /** Called when a task is marked complete (for confetti). */
  onTaskComplete?: (originElement?: HTMLElement | null) => void;
}

export function SevenDayKanban({ 
  mobileMode = false, 
  viewMode = 'week', 
  mobileDayIndex = 0,
  mobileWeekOffset = 0,
  onMobileWeekChange,
  mobileAboveChromeOffsetPx = 0,
  onTaskComplete,
}: SevenDayKanbanProps) {
  const { tasks } = useTasks();
  const { activeId } = useDragDrop();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const { accessToken } = useAuth();
  const { calendarStatus } = useCalendar();
  const shouldUseMobileLayout = useMobileLayout(); // Use mobile layout for tablets in portrait/landscape
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Current calendar day key so column "today" indicator updates after midnight or when returning to app
  const [todayDateKey, setTodayDateKey] = useState(() => getDateString(new Date()));
  React.useEffect(() => {
    const intervalMs = TIMING_CONSTANTS.delays.todayIndicatorCheckIntervalMs;
    const interval = setInterval(() => {
      const next = getDateString(new Date());
      setTodayDateKey((prev) => (next !== prev ? next : prev));
    }, intervalMs);
    return () => clearInterval(interval);
  }, []);
  // Calendar events by date: use hook data directly so week view always shows latest (no stale local state)
  
  // Drag-to-scroll state
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollAnimationRef = React.useRef<number | null>(null);
  
  // Auto-zoom state for desktop view
  const columnsContainerRef = React.useRef<HTMLDivElement>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [columnRowHeightPx, setColumnRowHeightPx] = useState(
    KANBAN_COLUMN_HEIGHT.minRowHeightPx,
  );
  const desktopWeekPanelWidthPx = React.useMemo(
    () => getKanbanWeekPanelWidthPx(KANBAN_VIEWPORT_WEEK.visibleDays),
    [],
  );
  
  // Helpers for subtle gradients to avoid blending into backgrounds
  const toAlphaHex = (hex: string, percent: number) => {
    const clean = hex.replace('#', '');
    const val = Math.round(Math.min(100, Math.max(0, percent)) * 2.55)
      .toString(16)
      .padStart(2, '0');
    return `#${clean}${val}`;
  };

  const getColumnBgGradient = (dayName: string, isDarkMode: boolean = false, isToday: boolean = false) => {
    const dayColors = getDayColors(dayName);
    const grad = KANBAN_DAY_COLORS.columnGradient;
    const startPct = isToday ? grad.startOpacity : grad.nonTodayStartOpacity;
    const darkStartPct = isToday ? grad.darkModeStartOpacity : grad.nonTodayDarkModeStartOpacity;
    // Use header color (tab color) fading to transparent/background
    if (hasHeader(dayColors)) {
      const headerColor = dayColors.header.from;
      if (isDarkMode) {
        const start = toAlphaHex(headerColor, darkStartPct);
        const end = toAlphaHex(headerColor, grad.darkModeEndOpacity);
        return `linear-gradient(180deg, ${start} 0%, ${end} 100%)`;
      } else {
        const start = toAlphaHex(headerColor, startPct);
        const end = COLOR_BACKGROUND_WHITE;
        return `linear-gradient(180deg, ${start} 0%, ${end} 100%)`;
      }
    }
    const whiteWithOpacity = (opacity: number) => `rgba(255, 255, 255, ${opacity / 100})`;
    if (isDarkMode) {
      return `linear-gradient(180deg, ${whiteWithOpacity(darkStartPct)} 0%, ${whiteWithOpacity(grad.darkModeEndOpacity)} 100%)`;
    }
    return `linear-gradient(180deg, ${whiteWithOpacity(0)} 0%, ${COLOR_BACKGROUND_WHITE} 100%)`;
  };

  const getColumnHeaderGradient = (
    dayName: string,
    isToday: boolean,
    isDarkMode: boolean,
  ): string | undefined => {
    const dayColors = getDayColors(dayName);
    if (!hasHeader(dayColors)) return undefined;

    const { from, via, to } = dayColors.header;
    const { viaOpacityScale, toOpacityScale } = KANBAN_WEEK_GROUP_HEADER.columnHeader.headerGradient;

    const baseOpacity = isToday
      ? isDarkMode
        ? Math.round(KANBAN_DAY_COLORS.today.darkModeBackgroundOpacity * 100)
        : KANBAN_DAY_COLORS.today.headerOpacity
      : isDarkMode
        ? KANBAN_DAY_COLORS.standard.nonTodayHeaderOpacity
        : dayColors.header.opacity;

    const fromHex = toAlphaHex(from, baseOpacity);
    const viaHex = toAlphaHex(via, Math.round(baseOpacity * viaOpacityScale));
    const toHex = toAlphaHex(to, Math.round(baseOpacity * toOpacityScale));
    return `linear-gradient(to bottom, ${fromHex} 0%, ${viaHex} 50%, ${toHex} 100%)`;
  };

  // Get week start setting
  const weekStart = getWeekStart();
  
  // Generate week columns starting from tomorrow
  const getWeekColumns = (): DayColumn[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use mobileWeekOffset in mobile mode, weekOffset in desktop mode
    const currentWeekOffset = mobileMode ? mobileWeekOffset : weekOffset;

    const buildColumnForDate = (date: Date, dayIndex: number, weekNumber: number): DayColumn => {
      const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();
      const dayOfWeek = date.getDay();
      const dayName = DAYS_OF_WEEK[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateString = getDateString(normalizedDate);
      return {
        date,
        dayName,
        dateString,
        isToday,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        weekNumber,
        dayIndex,
      };
    };
    
    // Calculate start date based on weekStart setting
    let startDate: Date;
    if (mobileMode) {
      // Mobile: Start from the first day of the week based on weekStart setting
      startDate = new Date(today);
      const currentDay = startDate.getDay(); // 0 (Sun) - 6 (Sat)
      
      if (weekStart === 'sunday') {
        // Start from Sunday of the current week
        const sundayOffset = currentDay === 0 ? 0 : currentDay; // If today is Sunday, offset is 0
        startDate.setDate(startDate.getDate() - sundayOffset + currentWeekOffset * KANBAN_TIME.daysPerWeek);
      } else {
        // Start from Monday of the current week
        const mondayOffset = (currentDay + KANBAN_TIME.daysPerWeek - 1) % KANBAN_TIME.daysPerWeek; // Convert to Monday=0
        startDate.setDate(startDate.getDate() - mondayOffset + currentWeekOffset * KANBAN_TIME.daysPerWeek);
      }

      return Array.from({ length: KANBAN_TIME.daysPerWeek }, (_, i) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        return buildColumnForDate(date, i, Math.floor(i / KANBAN_TIME.daysPerWeek) + 1);
      });
    }

    // Desktop: align to calendar week start, then render scrollWeeks × visibleDays panels
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 1 + (currentWeekOffset * KANBAN_TIME.daysPerWeek));
    const currentDay = startDate.getDay();
    if (weekStart === 'sunday') {
      const sundayOffset = currentDay === 0 ? 0 : currentDay;
      startDate.setDate(startDate.getDate() - sundayOffset);
    } else {
      const mondayOffset = currentDay === 0 ? KANBAN_TIME.daysPerWeek - 1 : currentDay - 1;
      startDate.setDate(startDate.getDate() - mondayOffset);
    }

    const columns: DayColumn[] = [];
    let dayIndex = 0;
    for (let weekIndex = 0; weekIndex < KANBAN_VIEWPORT_WEEK.scrollWeeks; weekIndex += 1) {
      const weekAnchor = new Date(startDate);
      weekAnchor.setDate(startDate.getDate() + weekIndex * KANBAN_TIME.daysPerWeek);
      for (let d = 0; d < KANBAN_VIEWPORT_WEEK.visibleDays; d += 1) {
        const date = new Date(weekAnchor);
        date.setDate(weekAnchor.getDate() + d);
        columns.push(buildColumnForDate(date, dayIndex, weekIndex + 1));
        dayIndex += 1;
      }
    }
    return columns;
  };

  // Memoize week columns so downstream effects don't re-run every render. Include todayDateKey so the "today" column indicator stays correct after midnight.
  const weekColumns = React.useMemo(() => getWeekColumns(), [mobileMode, mobileWeekOffset, weekOffset, todayDateKey]);
  const weekGroups = React.useMemo(() => {
    const columnsPerGroup = mobileMode
      ? KANBAN_TIME.daysPerWeek
      : KANBAN_VIEWPORT_WEEK.visibleDays;
    const groups: DayColumn[][] = [];
    for (let i = 0; i < weekColumns.length; i += columnsPerGroup) {
      groups.push(weekColumns.slice(i, i + columnsPerGroup));
    }
    return groups;
  }, [weekColumns, mobileMode]);

  // Compute visible date range once for the current week columns
  const visibleRange = React.useMemo(() => {
    if (!weekColumns.length) return null;
    const start = new Date(weekColumns[0].date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(weekColumns[weekColumns.length - 1].date);
    end.setHours(23, 59, 59, 999);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  }, [weekColumns]);

  // Fallback range when visibleRange not yet set (e.g. first paint)
  const fallbackEnd = React.useMemo(() => {
    const d = new Date();
    const daySpan = mobileMode
      ? KANBAN_TIME.daysPerWeek
      : KANBAN_VIEWPORT_WEEK.visibleDays * KANBAN_VIEWPORT_WEEK.scrollWeeks;
    d.setDate(d.getDate() + daySpan);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [mobileMode]);

  const startDate = React.useMemo(() => {
    if (!visibleRange) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return start;
    }
    return new Date(visibleRange.startIso);
  }, [visibleRange?.startIso]);

  const endDate = React.useMemo(() => {
    if (!visibleRange) return fallbackEnd;
    return new Date(visibleRange.endIso);
  }, [visibleRange?.endIso, fallbackEnd]);

  const { eventsByDate: calendarEventsByDate, refetch: refetchCalendarEvents } = useCalendarEventsByDate(
    startDate,
    endDate,
    { enabled: !!accessToken }
  );

  // Force refetch when week view's visible range becomes available so calendar events show without waiting for cache
  const prevVisibleRangeRef = React.useRef<typeof visibleRange>(null);
  React.useEffect(() => {
    if (visibleRange && visibleRange !== prevVisibleRangeRef.current && accessToken) {
      prevVisibleRangeRef.current = visibleRange;
      refetchCalendarEvents();
    }
  }, [visibleRange, accessToken, refetchCalendarEvents]);

  // Stop scroll dragging when task drag starts
  React.useEffect(() => {
    if (activeId) {
      setIsDragging(false);
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }
    }
  }, [activeId]);

  // Cleanup: Remove dragging class on unmount and cancel scroll animation
  React.useEffect(() => {
    return () => {
      document.body.classList.remove('dragging');
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  // Auto-zoom calculation for desktop view only
  React.useEffect(() => {
    if (mobileMode || viewMode === 'month') return;
    
    let timeoutId: NodeJS.Timeout;
    let resizeTimeoutId: NodeJS.Timeout;
    
    const calculateZoom = () => {
      const container = scrollContainerRef.current;
      const columns = columnsContainerRef.current;
      
      if (!container || !columns) return;
      
      // OPTIMIZED: Use requestAnimationFrame only for critical layout reads
      // Then defer heavy processing to requestIdleCallback to avoid blocking
      requestAnimationFrame(() => {
        // Get viewport height - use the actual visible height of the scroll container
        const containerRect = container.getBoundingClientRect();
        const viewportHeight = containerRect.height;
        const viewportWidth = containerRect.width;
        
        if (viewportHeight === 0) {
          setZoomScale(1);
          return;
        }
        
        // Defer heavy DOM measurements to idle callback to avoid blocking animation frame
        const processMeasurements = () => {
          const weekHeaderEl = columns.querySelector('[data-kanban-week-group-header]');
          const weekHeaderHeight =
            weekHeaderEl instanceof HTMLElement
              ? weekHeaderEl.getBoundingClientRect().height
              : KANBAN_COLUMN_HEIGHT.weekGroupHeaderFallbackPx;
          const containerPadding = mobileMode
            ? KANBAN_COLUMN_DIMENSIONS.padding.desktop * 2
            : KANBAN_VIEWPORT_WEEK.outerPaddingVerticalPx * 2;
          const availableColumnRow = Math.max(
            KANBAN_COLUMN_HEIGHT.minRowHeightPx,
            viewportHeight
              - containerPadding
              - weekHeaderHeight
              - KANBAN_COLUMN_HEIGHT.weekHeaderToColumnsGapPx,
          );
          setColumnRowHeightPx(Math.floor(availableColumnRow));
          // Columns use a fixed viewport row height with internal scroll — no scale-down zoom
          setZoomScale(1);
        };
        
        // Use requestIdleCallback if available, otherwise use setTimeout with small delay
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processMeasurements, { timeout: KANBAN_ZOOM.idleCallbackTimeoutMs });
        } else {
          setTimeout(processMeasurements, 0);
        }
      });
    };
    
    // Debounced resize handler
    const handleResize = () => {
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = setTimeout(calculateZoom, KANBAN_ZOOM.resizeDebounce);
    };
    
    // Calculate zoom on mount and when tasks change
    // Use a longer delay to ensure DOM is fully rendered and animations are complete
    timeoutId = setTimeout(calculateZoom, KANBAN_ZOOM.calculateDelay);
    
    // Recalculate on window resize and (when supported) container resize
    const hasResizeObserver = typeof ResizeObserver !== 'undefined';
    let resizeObserver: ResizeObserver | null = null;
    if (hasResizeObserver) {
      resizeObserver = new ResizeObserver(handleResize);
      if (scrollContainerRef.current) {
        resizeObserver.observe(scrollContainerRef.current);
      }
      if (columnsContainerRef.current) {
        resizeObserver.observe(columnsContainerRef.current);
      }
    }
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
    };
  }, [tasks, mobileMode, viewMode, weekOffset, calendarEventsByDate]);

  // Get tasks for a specific day (dateString = YYYY-MM-DD parsed as local; tasks sorted by time-of-day chronologically)
  const getTasksForDay = (dateString: string) => getTasksForDayView(tasks, dateString);



  const handleTaskClick = (task: Task, dateString?: string) => {
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
      if (dateString) setSelectedDate(dateString);
      setSelectedTask(safeTask);
      setDialogOpen(true);
    });
  };

  useTaskDeepLinkOpener((task) => {
    handleTaskClick(task);
  });

  const handleAddTask = (dateString: string) => {
    setSelectedDate(dateString);
    setSelectedTask(null);
    setDialogOpen(true);
  };

  const getInitialDateTime = () => {
    if (!selectedDate) return undefined;
    const [year, month, day] = selectedDate.split('-').map(Number);
    
    // Validate parsed values
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      // Silently handle invalid date
      return undefined;
    }
    
    const date = new Date(year, month - 1, day, KANBAN_TIME.defaultHour, 0, 0, 0);
    
    // Validate the created date
    if (isNaN(date.getTime())) {
      // Silently handle invalid date
      return undefined;
    }
    
    return date.toISOString();
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  // Drag-to-scroll handlers (mouse and touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Only handle primary pointer (first touch or left mouse button)
    if (!e.isPrimary) return;
    
    // Don't start scroll dragging if clicking on a task card or interactive element
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-dnd-kit-dragging]') ||
      target.closest('[data-task-card]') ||
      target.closest('button') ||
      target.closest('[role="button"]') ||
      activeId // Don't scroll if actively dragging a task
    ) {
      return;
    }
    
    setIsDragging(true);
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Stop scrolling if a task is being dragged
    if (activeId) {
      setIsDragging(false);
      return;
    }
    
    if (!isDragging) return;
    e.preventDefault();
    
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * KANBAN_SCROLL.speedMultiplier;
    
    // Use requestAnimationFrame for smoother scrolling
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
    }
    
    scrollAnimationRef.current = requestAnimationFrame(() => {
      container.scrollLeft = scrollLeft - walk;
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
  };

  const handlePointerLeave = () => {
    setIsDragging(false);
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
  };

  const kanbanCardListPadX =
    (shouldUseMobileLayout
      ? KANBAN_COLUMN_DIMENSIONS.contentPadding.mobile
      : KANBAN_COLUMN_DIMENSIONS.contentPadding.tablet)
    + KANBAN_COLUMN_DIMENSIONS.cardHoverBleedPx.horizontal;
  const kanbanCardListPadY =
    (shouldUseMobileLayout
      ? KANBAN_COLUMN_DIMENSIONS.contentPadding.mobile
      : KANBAN_COLUMN_DIMENSIONS.contentPadding.tablet)
    + KANBAN_COLUMN_DIMENSIONS.cardHoverBleedPx.vertical;
  const kanbanCardItemClassName =
    'w-full max-w-full overflow-visible relative z-0 hover:z-20 focus-within:z-20';

  // Render mobile single column or desktop multi-column
  if (mobileMode) {
    const currentColumn = weekColumns[mobileDayIndex] ?? weekColumns[0];
    if (!currentColumn) {
      return null;
    }
    const dayTasks = getTasksForDay(currentColumn.dateString);
    const columnDate = dateStringToLocalDate(currentColumn.dateString);
    const calEvents = calendarEventsByDate[currentColumn.dateString] || [];
    const combinedItems = buildSortedKanbanDayItems(columnDate, dayTasks, calEvents);
    const sortableTaskIds = getKanbanColumnSortableIds(combinedItems, currentColumn.dateString);
    const hasContent = combinedItems.length > 0;

    return (
      <div 
        className={shouldUseMobileLayout ? "flex flex-col flex-1 min-h-0 w-full max-w-full min-w-0 overflow-x-hidden" : "min-h-full flex flex-col"}
        style={{
          // Use gradient background on both mobile and desktop
          backgroundImage: isDark
            ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.dark.from}, ${KANBAN_BACKGROUND_GRADIENTS.dark.via}, ${KANBAN_BACKGROUND_GRADIENTS.dark.to})`
            : `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`,
        } as React.CSSProperties}
      >

        {/* Mobile Single Column - No nested scroll, parent container handles scrolling */}
        <div 
          className="flex-1 px-4 pt-2 sm:px-6 sm:pt-4 w-full max-w-full min-w-0 box-border" 
          style={{ 
            // Remove transparent background override to allow parent gradient to show through
            // Add minimum height to fill space between header and nav bar when no tasks
            minHeight: shouldUseMobileLayout
              ? getMobileViewportContentMinHeight(mobileAboveChromeOffsetPx)
              : 'auto',
            // Add bottom padding to ensure content is not hidden by nav bar
            // Use the same calculation as App.tsx scroll container for consistency
            paddingBottom: shouldUseMobileLayout
              ? NAV_BAR_SCROLL_PADDING_MOBILE
              : undefined,
          } as React.CSSProperties}
        >
          <DroppableColumn id={currentColumn.dateString} className={shouldUseMobileLayout ? "" : "min-h-full"}>
              <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
                <div className="w-full min-h-0 flex-1 flex flex-col" style={{ backgroundColor: 'transparent', background: 'transparent' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 mb-3 min-w-0">
                      <div className={cn(
                        "w-1 h-5 sm:h-6 rounded-full flex-shrink-0",
                        currentColumn.isToday ? "bg-primary" : "bg-muted"
                      )} />
                      <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                        {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
                      </span>
                      
                      {/* Today Button - Text on mobile, icon + text on larger screens */}
                      <Button
                        variant="outline"
                        onClick={() => onMobileWeekChange?.(0)}
                        disabled={mobileWeekOffset === 0}
                        className="rounded-full h-7 px-3 gap-1.5 sm:h-8 sm:px-3 flex-shrink-0 text-xs ml-auto sm:ml-2"
                        aria-label="Jump to today"
                      >
                        <Icon name="calendar-days" size={KANBAN_MOBILE.button.iconSize.mobile} className="hidden sm:block flex-shrink-0 mr-1" />
                        <span>Today</span>
                      </Button>
                      
                      {/* Add Button - Icon only on mobile, text on larger screens */}
                      <Button
                        variant="outline"
                        onClick={() => handleAddTask(currentColumn.dateString)}
                        className="rounded-full h-7 w-7 p-0 gap-0 sm:w-auto sm:h-8 sm:px-3 sm:gap-1.5 flex-shrink-0 text-xs"
                        aria-label="Add new task"
                      >
                        <Icon name="plus" size={KANBAN_MOBILE.button.iconSize.mobile} className="flex-shrink-0 sm:mr-1" />
                        <span className="hidden sm:inline">Add</span>
                      </Button>
                    </div>

                    <div
                      className="w-full max-w-full flex flex-col items-center min-w-0" 
                      style={{ 
                        minHeight: 0, 
                        height: '100%',
                        width: '100%',
                        backgroundImage: shouldUseMobileLayout
                          ? 'transparent'
                          : (isDark
                            ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.dark.from}, ${KANBAN_BACKGROUND_GRADIENTS.dark.via}, ${KANBAN_BACKGROUND_GRADIENTS.dark.to})`
                            : `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`),
                        backgroundColor: shouldUseMobileLayout
                          ? 'transparent'
                          : undefined,
                      } as React.CSSProperties}
                    >
                    <AnimatePresence mode="sync">
                          {!hasContent ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-2"
                          style={{
                            // On mobile/tablet, make background transparent to show parent gradient
                            // On desktop, use the gradient background
                            backgroundImage: shouldUseMobileLayout
                              ? 'transparent'
                              : (isDark
                                ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.dark.from}, ${KANBAN_BACKGROUND_GRADIENTS.dark.via}, ${KANBAN_BACKGROUND_GRADIENTS.dark.to})`
                                : `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`),
                            backgroundColor: shouldUseMobileLayout
                              ? 'transparent'
                              : undefined,
                          } as React.CSSProperties}
                        >
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                            <Icon name="plus" size={shouldUseMobileLayout ? 24 : 32} className="text-primary/40" />
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">No tasks scheduled</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddTask(currentColumn.dateString)}
                            className="rounded-full h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                          >
                            <Icon name="plus" size={shouldUseMobileLayout ? ICON_SIZE_SM : ICON_SIZE_MD} className="mr-1.5 sm:mr-2" />
                            Add your first task
                          </Button>
                        </motion.div>
                      ) : (
                          <div
                            className="flex flex-col w-full min-w-0"
                            style={{
                              gap: KANBAN_COLUMN_DIMENSIONS.cardsGapPx,
                              paddingLeft: kanbanCardListPadX,
                              paddingRight: kanbanCardListPadX,
                              paddingTop: kanbanCardListPadY,
                              paddingBottom: kanbanCardListPadY,
                              // No paddingBottom - nav bar clearance handled by spacer in App.tsx
                              minHeight: 0,
                              height: 'auto',
                              width: '100%',
                              maxWidth: shouldUseMobileLayout
                                ? '100%'
                                : KANBAN_COLUMN_DIMENSIONS.cardsContainerMaxWidth.desktop,
                              margin: shouldUseMobileLayout
                                ? 0
                                : (KANBAN_COLUMN_DIMENSIONS.cardsContainerMargin as React.CSSProperties['margin']),
                              boxSizing: 'border-box',
                              // On mobile/tablet, make background transparent to show parent gradient
                              // On desktop, use the gradient background
                              backgroundImage: shouldUseMobileLayout
                                ? 'transparent'
                                : (isDark
                                  ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.dark.from}, ${KANBAN_BACKGROUND_GRADIENTS.dark.via}, ${KANBAN_BACKGROUND_GRADIENTS.dark.to})`
                                  : `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`),
                              backgroundColor: shouldUseMobileLayout
                                ? 'transparent'
                                : undefined,
                            } as React.CSSProperties}
                          >
                              <KanbanColumnItems
                                combinedItems={combinedItems}
                                dateString={currentColumn.dateString}
                                allTasks={tasks}
                                kanbanCardItemClassName={kanbanCardItemClassName}
                                onTaskClick={handleTaskClick}
                                onTaskComplete={onTaskComplete}
                              />
                            </div>
                      )}
                    </AnimatePresence>
                    </div>
                </div>
              </SortableContext>
            </DroppableColumn>
        </div>

        {/* Task Dialog */}
        <TaskDialog
          open={dialogOpen}
          onClose={() => {
            logger.info('SevenDayKanban mobile: TaskDialog onClose called');
            setDialogOpen(false);
            setSelectedTask(null);
            setSelectedDate(null);
          }}
          task={selectedTask}
          initialDate={getInitialDateTime()}
        />
      </div>
    );
  }

  const backgroundGradient = isDark
    ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.dark.from}, ${KANBAN_BACKGROUND_GRADIENTS.dark.via}, ${KANBAN_BACKGROUND_GRADIENTS.dark.to})`
    : `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.desktop.from}, ${KANBAN_BACKGROUND_GRADIENTS.desktop.via}, ${KANBAN_BACKGROUND_GRADIENTS.desktop.to})`;
  
  return (
    <div 
      className={cn(
        "flex flex-col",
        mobileMode ? "w-full" : "h-full"
      )}
      data-tour="kanban"
      data-kanban-view="true"
      style={{
        backgroundImage: backgroundGradient,
      }}
    >
      {/* Week View - Kanban Board */}
        <div className={cn(
          mobileMode ? "w-full" : "flex-1 min-h-0 overflow-hidden"
        )}>
          <div 
            ref={scrollContainerRef}
            className={cn(
              mobileMode ? "w-full" : "h-full min-h-0 w-full",
              "overflow-x-auto",
              mobileMode ? "" : "overflow-y-hidden",
              !mobileMode && KANBAN_VIEWPORT_WEEK.scrollSnap && "snap-x snap-mandatory",
              "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent",
              activeId && "cursor-default" // Change cursor when dragging task
            )}
            style={
              mobileMode
                ? undefined
                : {
                    paddingLeft: KANBAN_VIEWPORT_WEEK.sidebarGapPx,
                    paddingRight: KANBAN_VIEWPORT_WEEK.trailingEdgeGapPx,
                    scrollPaddingLeft: KANBAN_VIEWPORT_WEEK.sidebarGapPx,
                    scrollPaddingRight: KANBAN_VIEWPORT_WEEK.trailingEdgeGapPx,
                  }
            }
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          >
            <div 
              ref={columnsContainerRef}
              data-kanban-zoom-scale={zoomScale}
              className={cn(
                "flex",
                mobileMode
                  ? "gap-1 sm:gap-1.5 md:gap-2 lg:gap-2 p-2 sm:p-2.5 md:p-2.5 lg:p-3 min-w-max"
                  : "gap-0 h-full max-h-full items-stretch flex-shrink-0",
              )}
              style={{
                transform: zoomScale !== 1 ? `scale(${zoomScale})` : 'none',
                transformOrigin: 'top left',
                transition: KANBAN_ANIMATION.transformTransition,
                minHeight: mobileMode ? '100%' : undefined,
                ...(!mobileMode
                  ? {
                      paddingTop: KANBAN_VIEWPORT_WEEK.outerPaddingVerticalPx,
                      paddingBottom: KANBAN_VIEWPORT_WEEK.outerPaddingVerticalPx,
                    }
                  : {}),
                backgroundImage: mobileMode ? (isDark
                  ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.dark.from}, ${KANBAN_BACKGROUND_GRADIENTS.dark.via}, ${KANBAN_BACKGROUND_GRADIENTS.dark.to})`
                  : `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`)
                  : undefined,
              }}
            >
              {weekGroups.map((group, groupIndex) => {
                // Check if this is the start of a week based on weekStart setting
                const firstDayOfGroup = group[0];
                const isStartOfWeek = firstDayOfGroup && (
                  (weekStart === 'sunday' && firstDayOfGroup.date.getDay() === 0) ||
                  (weekStart === 'monday' && firstDayOfGroup.date.getDay() === 1)
                );
                
                const showWeekDivider = mobileMode ? isStartOfWeek : groupIndex > 0;
                const weekGutterWidthPx = mobileMode
                  ? KANBAN_WEEK_GROUP_HEADER.transition.widthPx
                  : KANBAN_VIEWPORT_WEEK.betweenWeeksGapPx;
                
                return (
                  <React.Fragment key={`week-group-${groupIndex}`}>
                    {showWeekDivider && (
                      <KanbanWeekPanelGutter
                        widthPx={weekGutterWidthPx}
                        showDivider
                      />
                    )}

                  <div
                    className={cn(
                      "flex flex-col gap-2 flex-shrink-0 self-stretch h-full min-h-0",
                      mobileMode ? "min-w-max flex-1" : "snap-start",
                    )}
                    style={
                      mobileMode
                        ? undefined
                        : {
                            width: desktopWeekPanelWidthPx,
                            minWidth: desktopWeekPanelWidthPx,
                          }
                    }
                  >
                    {(() => {
                      const groupStart = group[0]?.date;
                      const groupEnd = group[group.length - 1]?.date;
                      const groupContainsToday = group.some((col) => col.isToday);
                      const dateRangeLabel =
                        groupStart && groupEnd
                          ? formatKanbanWeekGroupDateRange(groupStart, groupEnd)
                          : KANBAN_WEEK_GROUP_LABELS[groupIndex] ?? `Week ${groupIndex + 1}`;

                      return (
                        <div
                          data-kanban-week-group-header
                          className="flex items-center gap-2 min-w-0 flex-shrink-0"
                          style={{
                            paddingTop: KANBAN_WEEK_GROUP_HEADER.paddingY,
                            paddingBottom: KANBAN_WEEK_GROUP_HEADER.paddingY,
                            paddingLeft: KANBAN_WEEK_GROUP_HEADER.paddingX,
                            paddingRight: KANBAN_WEEK_GROUP_HEADER.paddingX,
                            gap: KANBAN_WEEK_GROUP_HEADER.gap,
                          }}
                        >
                          <span
                            className={cn(
                              'uppercase font-semibold flex-shrink-0 border',
                              groupContainsToday
                                ? 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/15 dark:border-primary/30'
                                : 'bg-muted/50 text-muted-foreground border-border/60 dark:bg-muted/30',
                            )}
                            style={{
                              fontSize: KANBAN_WEEK_GROUP_HEADER.badge.fontSizePx,
                              paddingLeft: KANBAN_WEEK_GROUP_HEADER.badge.paddingX,
                              paddingRight: KANBAN_WEEK_GROUP_HEADER.badge.paddingX,
                              paddingTop: KANBAN_WEEK_GROUP_HEADER.badge.paddingY,
                              paddingBottom: KANBAN_WEEK_GROUP_HEADER.badge.paddingY,
                              letterSpacing: `${KANBAN_WEEK_GROUP_HEADER.badge.letterSpacingEm}em`,
                              borderRadius: KANBAN_WEEK_GROUP_HEADER.badge.borderRadiusPx,
                            }}
                          >
                            {KANBAN_WEEK_GROUP_LABELS[groupIndex] ?? `Week ${groupIndex + 1}`}
                          </span>
                          <span
                            className="text-muted-foreground truncate flex-shrink-0"
                            style={{
                              fontSize: KANBAN_WEEK_GROUP_HEADER.dateRange.fontSizePx,
                              fontWeight: KANBAN_WEEK_GROUP_HEADER.dateRange.fontWeight,
                            }}
                          >
                            {dateRangeLabel}
                          </span>
                          <span
                            className="flex-1 min-w-[24px] bg-gradient-to-r from-border/80 via-border/30 to-transparent dark:from-border/50 dark:via-border/20"
                            style={{ height: KANBAN_WEEK_GROUP_HEADER.hairlineHeightPx }}
                          />
                        </div>
                      );
                    })()}

                    <div
                      className={cn(
                        "flex items-stretch flex-shrink-0 w-full min-w-0",
                        mobileMode && "gap-1 sm:gap-1.5 md:gap-2 lg:gap-2",
                      )}
                      style={
                        mobileMode
                          ? undefined
                          : {
                              height: columnRowHeightPx,
                              minHeight: columnRowHeightPx,
                              maxHeight: columnRowHeightPx,
                              gap: KANBAN_VIEWPORT_WEEK.betweenColumnsGapPx,
                            }
                      }
                    >
                      {group.map((column, columnIndex) => {
                const dayTasks = getTasksForDay(column.dateString);
                const columnDate = dateStringToLocalDate(column.dateString);
                const calEvents = calendarEventsByDate[column.dateString] || [];
                const combinedItems = buildSortedKanbanDayItems(columnDate, dayTasks, calEvents);
                const sortableTaskIds = getKanbanColumnSortableIds(combinedItems, column.dateString);
                const hasContent = combinedItems.length > 0;
                      const globalIndex =
                        groupIndex
                        * (mobileMode ? KANBAN_TIME.daysPerWeek : KANBAN_VIEWPORT_WEEK.visibleDays)
                        + columnIndex;
                      const isSecondWeek = groupIndex === 1;
                      const dayColors = getDayColors(column.dayName);
                      const accentColor = column.isToday
                        ? KANBAN_DAY_COLORS.today.text
                        : hasHeader(dayColors)
                          ? dayColors.header.from
                          : KANBAN_DAY_COLORS.today.text;

                return (
                  <div
                    key={column.dateString}
                    className="flex flex-col self-stretch h-full min-h-0 flex-shrink-0"
                    style={
                      mobileMode
                        ? undefined
                        : {
                            width: KANBAN_VIEWPORT_WEEK.dayColumnWidthPx,
                            minWidth: KANBAN_VIEWPORT_WEEK.dayColumnWidthPx,
                          }
                    }
                  >
                    {/* Reserve equal chrome above every column so card heights match */}
                    <div
                      className="flex justify-center flex-shrink-0"
                      style={{
                        height: KANBAN_COLUMN_HEIGHT.todayIndicatorChromePx,
                        marginBottom: column.isToday
                          ? undefined
                          : 0,
                      }}
                      aria-hidden={!column.isToday}
                    >
                      {column.isToday && (
                        <div
                          className="rounded-full self-end"
                          style={{
                            width: `${KANBAN_DAY_COLORS.today.indicatorLine.widthPercent * KANBAN_WEEK_GROUP_HEADER.columnHeader.todayIndicator.widthScale}%`,
                            height: KANBAN_WEEK_GROUP_HEADER.columnHeader.todayIndicator.heightPx,
                            marginBottom: parseInt(KANBAN_DAY_COLORS.today.indicatorLine.marginBottom, 10),
                            backgroundColor: accentColor,
                            opacity: KANBAN_WEEK_GROUP_HEADER.columnHeader.todayIndicator.opacity,
                          }}
                        />
                      )}
                    </div>
                    <motion.div
                      data-column-date={column.dateString}
                      data-kanban-day-column
                      className={cn(
                        'flex flex-col flex-1 min-h-0 h-full rounded-2xl overflow-hidden soft-shadow border border-primary/10 dark:border-border/50',
                        // Only use Tailwind bg when we are not applying column-wrapper tint (weekend or no header colors)
                        !column.isWeekend && !hasHeader(dayColors) && (isDark ? 'bg-card/80' : 'bg-transparent'),
                        column.isWeekend && isDark && 'bg-card/60',
                        column.isToday && 'ring-1 ring-primary/25 dark:ring-primary/35',
                        isSecondWeek && !column.isToday && 'ring-1 ring-primary/10 dark:ring-primary/15',
                      )}
                      style={{
                        ...(column.isWeekend && !isDark && {
                          backgroundImage: `linear-gradient(to bottom, ${KANBAN_DAY_COLORS.weekend.from}${Math.round(KANBAN_DAY_COLORS.weekend.opacity * 2.55).toString(16).padStart(2, '0')}, ${KANBAN_DAY_COLORS.weekend.to}${Math.round(KANBAN_DAY_COLORS.weekend.opacity * 2.55).toString(16).padStart(2, '0')})`,
                        }),
                        // Full-column tint so today stands out when scrolling vertically (brighter today, muted others)
                        ...(!column.isWeekend && hasHeader(dayColors) && (() => {
                          const w = KANBAN_DAY_COLORS.columnWrapper;
                          const pct = column.isToday
                            ? (isDark ? w.todayDarkOpacity : w.todayOpacity)
                            : (isDark ? w.nonTodayDarkOpacity : w.nonTodayOpacity);
                          return { backgroundColor: toAlphaHex(dayColors.header.from, pct) };
                        })()),
                      }}
                      initial={{ opacity: 0, y: KANBAN_ANIMATION.initialY }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        duration: KANBAN_ANIMATION.duration, 
                              delay: globalIndex * KANBAN_ANIMATION.delayPerColumn,
                        ease: KANBAN_ANIMATION.easing
                      }}
                    >
                    <div
                      className="border-b border-primary/8 dark:border-border/40 backdrop-blur-sm"
                      style={{
                        paddingLeft: KANBAN_WEEK_GROUP_HEADER.columnHeader.paddingX,
                        paddingRight: KANBAN_WEEK_GROUP_HEADER.columnHeader.paddingX,
                        paddingTop: KANBAN_WEEK_GROUP_HEADER.columnHeader.paddingY,
                        paddingBottom: KANBAN_WEEK_GROUP_HEADER.columnHeader.paddingY,
                        backgroundImage: getColumnHeaderGradient(column.dayName, column.isToday, isDark),
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {column.isToday && (
                          <span
                            className="rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-background dark:ring-offset-card"
                            style={{
                              width: KANBAN_WEEK_GROUP_HEADER.columnHeader.dotSizeTodayPx,
                              height: KANBAN_WEEK_GROUP_HEADER.columnHeader.dotSizeTodayPx,
                              backgroundColor: accentColor,
                              boxShadow: `0 0 0 2px ${toAlphaHex(accentColor, 0.25)}`,
                            }}
                          />
                        )}
                        <h3
                          className={cn(
                            'flex-1 min-w-0 uppercase tracking-wide font-semibold truncate',
                            column.isToday
                              ? 'text-primary dark:text-primary'
                              : 'text-foreground/90 dark:text-foreground/95',
                          )}
                          style={{
                            fontSize: shouldUseMobileLayout
                              ? KANBAN_WEEK_GROUP_HEADER.columnHeader.fontSizePx
                              : KANBAN_WEEK_GROUP_HEADER.columnHeader.fontSizeSmPx,
                          }}
                        >
                          {column.dayName.substring(0, 3)}{' '}
                          <span
                            className="font-bold"
                            style={{
                              fontSize: shouldUseMobileLayout
                                ? KANBAN_WEEK_GROUP_HEADER.columnHeader.dateFontSizePx
                                : KANBAN_WEEK_GROUP_HEADER.columnHeader.dateFontSizeSmPx,
                            }}
                          >
                            {column.date.getDate()}
                          </span>
                        </h3>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-full flex-shrink-0 hover:bg-muted/50 dark:hover:bg-muted/50"
                          onClick={() => handleAddTask(column.dateString)}
                          data-tour="add-task"
                        >
                          <Icon name="plus" size={ICON_SIZE_SM} />
                        </Button>
                      </div>
                    </div>

                    <DroppableColumn
                      id={column.dateString}
                      fillHeight
                      className="flex-1 min-h-0 overflow-x-visible overflow-y-hidden"
                    >
                      <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
                        <div 
                          className={cn(
                            'flex flex-col flex-1 min-h-0 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent',
                            isDark ? 'bg-muted/10' : ''
                          )}
                          style={{
                            paddingLeft: kanbanCardListPadX,
                            paddingRight: kanbanCardListPadX,
                            paddingTop: kanbanCardListPadY,
                            paddingBottom: kanbanCardListPadY,
                            backgroundImage: isDark
                              ? getColumnBgGradient(column.dayName, isDark, column.isToday)
                              : getColumnBgGradient(column.dayName, false, column.isToday),
                          }}
                        >
                          <AnimatePresence mode="sync">
                                {!hasContent ? (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                      className="flex flex-1 flex-col items-center justify-center py-12 text-center pointer-events-none min-h-0"
                              >
                                      <p className="text-sm text-muted-foreground pointer-events-none">No tasks</p>
                              </motion.div>
                            ) : (
                                  <div 
                                    className="flex flex-col w-full"
                                    style={{
                                      gap: KANBAN_COLUMN_DIMENSIONS.cardsGapPx,
                                      width: '100%',
                                      maxWidth: shouldUseMobileLayout 
                                        ? KANBAN_COLUMN_DIMENSIONS.cardsContainerMaxWidth.mobile
                                        : KANBAN_COLUMN_DIMENSIONS.cardsContainerMaxWidth.desktop,
                                      margin: KANBAN_COLUMN_DIMENSIONS.cardsContainerMargin as React.CSSProperties['margin'],
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <KanbanColumnItems
                                      combinedItems={combinedItems}
                                      dateString={column.dateString}
                                      allTasks={tasks}
                                      kanbanCardItemClassName={kanbanCardItemClassName}
                                      onTaskClick={handleTaskClick}
                                      onTaskComplete={onTaskComplete}
                                    />
                                  </div>
                            )}
                    </AnimatePresence>
                    </div>
              </SortableContext>
                    </DroppableColumn>
                        </motion.div>
                    </div>
                      );
                    })}
                    </div>
                  </div>
                </React.Fragment>
                );
              })}
            </div>
          </div>

        {/* Task Dialog */}
        <TaskDialog
          open={dialogOpen}
          onClose={() => {
            logger.info('SevenDayKanban desktop: TaskDialog onClose called');
            setDialogOpen(false);
            setSelectedTask(null);
            setSelectedDate(null);
          }}
          task={selectedTask}
          initialDate={getInitialDateTime()}
        />
      </div>
    </div>
  );
}

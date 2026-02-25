import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
import { cn, prepareTaskForDialog, getWeekStart, getDateString, getTaskWithOccurrenceSubtasks, dateStringToLocalDate, parseCalendarEventTime, isSeriesBaseTask, hasSeriesOccurrenceForDate, dedupeTasksForDay } from '../lib/utils';
import { isDateInRecurrence } from '../lib/recurrence';
import { toast } from 'sonner';
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
} from '../lib/kanban-constants';
import { COLOR_BACKGROUND_WHITE } from '../lib/color-theme';
import { TASK_CARD_TIMELINE } from '../lib/task-card-constants';
import { VIEWPORT_BREAKPOINTS, MOBILE_SPACING, NAV_BAR_BOTTOM_PADDING_MOBILE, HEADER_HEIGHT, NAV_BAR_HEIGHT, NAV_BAR_SCROLL_BUFFER_REM, ICON_SIZE_SM } from '../lib/layout-constants';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { MINUTES_PER_HOUR, RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED, RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS, RECURRENCE_SERIES_OCCURRENCE_SEPARATOR } from '../lib/business-constants';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { buildTaskLayouts } from '../lib/task-layout';
import type { Task } from '../types';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

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
  /** Called when a task is marked complete (for confetti). */
  onTaskComplete?: (originElement?: HTMLElement | null) => void;
}

export function SevenDayKanban({ 
  mobileMode = false, 
  viewMode = 'week', 
  mobileDayIndex = 0,
  mobileWeekOffset = 0,
  onMobileWeekChange,
  onTaskComplete,
}: SevenDayKanbanProps) {
  const { tasks } = useTasks();
  const { activeId } = useDragDrop();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const { accessToken } = useAuth();
  const { calendarStatus } = useCalendar();
  const shouldUseMobileLayout = useMobileLayout(); // Use mobile layout for tablets in portrait/landscape
  
  // Calculate responsive column width based on viewport
  // Tablets should use mobile column width for one-column layout
  const [columnWidth, setColumnWidth] = React.useState<number>(KANBAN_COLUMN_DIMENSIONS.width.desktop);
  
  React.useEffect(() => {
    const updateColumnWidth = () => {
      const width = window.innerWidth;
      // Use mobile layout hook to determine if we should use mobile column width
      // This ensures tablets get mobile layout in both portrait and landscape
      if (shouldUseMobileLayout) {
        // Mobile and tablets: use mobile column width for one-column layout
        setColumnWidth(KANBAN_COLUMN_DIMENSIONS.width.mobile);
      } else {
        // Desktop: use appropriate column width based on viewport
        if (width >= VIEWPORT_BREAKPOINTS.desktop) {
          setColumnWidth(KANBAN_COLUMN_DIMENSIONS.width.desktop);
        } else {
          setColumnWidth(KANBAN_COLUMN_DIMENSIONS.width.smallMonitor);
        }
      }
    };
    
    updateColumnWidth();
    window.addEventListener('resize', updateColumnWidth);
    window.addEventListener('orientationchange', updateColumnWidth);
    return () => {
      window.removeEventListener('resize', updateColumnWidth);
      window.removeEventListener('orientationchange', updateColumnWidth);
    };
  }, [shouldUseMobileLayout]); // Re-calculate when mobile layout preference changes
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
  
  // Track if we've scrolled to next day on mount (only once)
  const hasScrolledToNextDayRef = React.useRef(false);

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

  // Get week start setting
  const weekStart = getWeekStart();
  
  // Generate week columns starting from tomorrow
  const getWeekColumns = (): DayColumn[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use mobileWeekOffset in mobile mode, weekOffset in desktop mode
    const currentWeekOffset = mobileMode ? mobileWeekOffset : weekOffset;
    
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
    } else {
      // Desktop: Start from tomorrow (today is shown in Today Agenda timeline, so exclude it)
      // But align to week start for proper week grouping
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() + 1 + (currentWeekOffset * KANBAN_TIME.daysPerWeek));
      
      // Align to week start
      const currentDay = startDate.getDay(); // 0 (Sun) - 6 (Sat)
      if (weekStart === 'sunday') {
        // Align to Sunday
        const sundayOffset = currentDay === 0 ? 0 : currentDay;
        startDate.setDate(startDate.getDate() - sundayOffset);
      } else {
        // Align to Monday
        const mondayOffset = currentDay === 0 ? KANBAN_TIME.daysPerWeek - 1 : currentDay - 1; // If Sunday, go back 6 days to Monday
        startDate.setDate(startDate.getDate() - mondayOffset);
      }
    }

    const totalDays = mobileMode ? KANBAN_TIME.daysPerWeek : KANBAN_TIME.daysInWeek;

    return Array.from({ length: totalDays }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isToday = 
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

      const dayOfWeek = date.getDay();
      const dayName = DAYS_OF_WEEK[dayOfWeek === 0 ? 6 : dayOfWeek - 1]; // Monday-based array

      // Normalize date to local midnight to ensure consistent date string format
      // This prevents timezone issues when comparing dates
      // Use getDateString() for consistency with calendar event grouping
      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateString = getDateString(normalizedDate);

      return {
        date,
        dayName,
        dateString,
        isToday,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6, // Sunday or Saturday
        weekNumber: Math.floor(i / KANBAN_TIME.daysPerWeek) + 1,
        dayIndex: i,
      };
    });
  };

  // Memoize week columns so downstream effects don't re-run every render. Include todayDateKey so the "today" column indicator stays correct after midnight.
  const weekColumns = React.useMemo(() => getWeekColumns(), [mobileMode, mobileWeekOffset, weekOffset, todayDateKey]);
  const weekGroups = React.useMemo(() => {
    const groups: DayColumn[][] = [];
    for (let i = 0; i < weekColumns.length; i += KANBAN_TIME.daysPerWeek) {
      groups.push(weekColumns.slice(i, i + KANBAN_TIME.daysPerWeek));
    }
    return groups;
  }, [weekColumns]);

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

  // Fallback range when visibleRange not yet set (e.g. first paint): next KANBAN_TIME.daysInWeek days so hook can fetch
  const fallbackEnd = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + KANBAN_TIME.daysInWeek);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

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
        
        if (viewportHeight === 0) {
          setZoomScale(1);
          return;
        }
        
        // Defer heavy DOM measurements to idle callback to avoid blocking animation frame
        const processMeasurements = () => {
          // Find the tallest column by checking all child divs (the motion.div column elements)
          let maxColumnHeight = 0;
          const columnElements = columns.children;
          
          // OPTIMIZED: Limit the number of columns checked and batch reads efficiently
          const maxColumnsToCheck = KANBAN_TIME.daysInWeek;
          const columnsToCheck = Array.from(columnElements).slice(0, maxColumnsToCheck);
          
          // OPTIMIZED: Batch all layout reads in a single pass to minimize forced reflows
          // Read all layout properties first, then process
          const measurements: Array<{ height: number; scrollHeight: number }> = [];
          
          // Single batch read - all getBoundingClientRect calls happen together
          const rects = columnsToCheck
            .filter((col): col is HTMLElement => col instanceof HTMLElement)
            .map(col => ({
              rect: col.getBoundingClientRect(),
              scrollHeight: col.scrollHeight,
            }));
          
          // Process measurements after all reads are complete
          for (const { rect, scrollHeight } of rects) {
            const columnHeight = Math.max(rect.height, scrollHeight);
            maxColumnHeight = Math.max(maxColumnHeight, columnHeight);
          }
          
          // If no columns found or height is 0, reset zoom
          if (maxColumnHeight === 0) {
            setZoomScale(1);
            return;
          }
          
          // Calculate zoom scale if tallest column exceeds viewport
          // Add padding to prevent edge clipping
          if (maxColumnHeight > viewportHeight) {
            const scale = (viewportHeight - KANBAN_ZOOM.padding) / maxColumnHeight;
            // Clamp scale between min and max
            const clampedScale = Math.max(KANBAN_ZOOM.minScale, Math.min(KANBAN_ZOOM.maxScale, scale));
            setZoomScale(clampedScale);
          } else {
            // No zoom needed if content fits
            setZoomScale(1);
          }
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
  }, [tasks, mobileMode, viewMode, weekOffset]);

  // Scroll to next day (tomorrow) on mount for desktop view
  // Positions tomorrow at the left edge to hide previous days, but allows horizontal scroll
  // FIXED: Accounts for column resizing and zoom scaling
  React.useEffect(() => {
    // Only for desktop view, not mobile
    if (mobileMode || viewMode === 'month') return;
    
    const container = scrollContainerRef.current;
    const columns = columnsContainerRef.current;
    if (!container || !columns) return;
    
    // CRITICAL: Reset ref at the beginning to ensure scroll happens on every mount (including page refresh)
    // This prevents the ref from blocking scroll on page refresh
    hasScrolledToNextDayRef.current = false;
    
    // Immediately reset scroll position to 0 to prevent browser scroll restoration from interfering
    // This must happen synchronously before any async operations
    container.scrollLeft = 0;
    
    // Calculate tomorrow's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    // Find tomorrow's column in weekColumns
    const tomorrowColumn = weekColumns.find(col => {
      const colDate = new Date(col.date);
      colDate.setHours(0, 0, 0, 0);
      return colDate.getTime() === tomorrow.getTime();
    });
    
    if (!tomorrowColumn) return;
    
    // Find the index of tomorrow's column
    const tomorrowIndex = weekColumns.findIndex(col => col.dateString === tomorrowColumn.dateString);
    if (tomorrowIndex === -1) return;
    
    // Wait for zoom calculation and column rendering to complete
    // This ensures columns are properly sized before calculating scroll position
    const scrollToNextDay = () => {
      // Double-check that scroll is still at 0 (browser might have restored it)
      // Force reset again to ensure we start from a known position
      if (container.scrollLeft !== 0) {
        container.scrollLeft = 0;
      }
      
      // Use requestAnimationFrame to ensure DOM is ready and zoom has been applied
      requestAnimationFrame(() => {
        // Triple-check scroll position and reset if needed (browser restoration can happen asynchronously)
        if (container.scrollLeft !== 0) {
          container.scrollLeft = 0;
        }
        
        // Wait one more frame after resetting scroll to ensure layout is stable
        requestAnimationFrame(() => {
          // Final check and reset before calculation
          if (container.scrollLeft !== 0) {
            container.scrollLeft = 0;
          }
          // Get all column elements
          const columnElements = columns.querySelectorAll('[data-column-date]');
          if (columnElements.length === 0) return;
          
          // Find tomorrow's column element
          const tomorrowElement = Array.from(columnElements).find(el => {
            const dateAttr = el.getAttribute('data-column-date');
            return dateAttr === tomorrowColumn.dateString;
          }) as HTMLElement | undefined;
          
          if (!tomorrowElement) return;
          
          // FIXED: Use getBoundingClientRect() which accounts for transforms and zoom scaling
          // This is more accurate than offsetLeft when columns are scaled/zoomed
          // getBoundingClientRect() returns positions after CSS transforms (including scale) are applied
          const containerRect = container.getBoundingClientRect();
          const elementRect = tomorrowElement.getBoundingClientRect();
          
          // Calculate the relative position accounting for zoom/scale
          // getBoundingClientRect() already accounts for the transform scale, so we get the actual rendered position
          // Get the actual left position relative to the container's scroll position (now at 0)
          const relativeLeft = elementRect.left - containerRect.left + container.scrollLeft;
          
          // Account for container padding - use constants from KANBAN_COLUMN_DIMENSIONS
          // Container has padding: p-2 (8px) on mobile/tablet, p-3 (12px) on desktop
          // Match the actual padding values: p-2 on mobile/tablet, p-3 on desktop
          // Tablets use mobile layout, so they use mobile padding
          const containerPadding = shouldUseMobileLayout
            ? KANBAN_COLUMN_DIMENSIONS.padding.mobile // p-2 = 8px on mobile/tablet
            : KANBAN_COLUMN_DIMENSIONS.padding.desktop; // p-3 = 12px on desktop
          
          // Calculate scroll position to position tomorrow's column at the left edge of viewport
          // This hides previous days while still allowing horizontal scroll to see week one and week two
          // getBoundingClientRect() already accounts for zoom scale, so elementRect.width is the scaled width
          // This ensures accurate positioning regardless of zoom level
          // Position tomorrow at the left edge with container padding for visual spacing
          const scrollPosition = relativeLeft - containerPadding;
          
          // Scroll to position where tomorrow's column is at the left edge (previous days hidden)
          // Users can still scroll left to see week one and right to see week two
          container.scrollTo({
            left: Math.max(0, scrollPosition),
            behavior: 'smooth',
          });
          
          // Mark as scrolled
          hasScrolledToNextDayRef.current = true;
        });
      });
    };
    
    // Wait for zoom calculation to complete before scrolling
    // This ensures columns are properly sized/resized before calculating scroll position
    // Use a delay that accounts for zoom calculation and buffer (KANBAN_ZOOM.calculateDelay + KANBAN_SCROLL.zoomBufferMs)
    // plus additional time for DOM rendering, transform application, and browser scroll restoration
    // Increased delay to ensure browser scroll restoration completes before we calculate
    const scrollTimeout = setTimeout(scrollToNextDay, Math.max(KANBAN_SCROLL.initialScrollDelay, KANBAN_ZOOM.calculateDelay + KANBAN_SCROLL.zoomBufferMs));
    
    return () => {
      clearTimeout(scrollTimeout);
    };
  }, [weekColumns, mobileMode, viewMode, zoomScale]); // Include zoomScale to recalculate when zoom changes

  // Get tasks for a specific day (dateString = YYYY-MM-DD parsed as local; tasks sorted by time-of-day chronologically)
  const getTasksForDay = (dateString: string) => {
    // Defensive check: ensure tasks is an array
    if (!Array.isArray(tasks)) {
      logger.warn('getTasksForDay: tasks is not an array', tasks);
      return [];
    }

    try {
      const checkDate = dateStringToLocalDate(dateString);
      if (isNaN(checkDate.getTime())) {
        logger.warn('getTasksForDay: Invalid date string', dateString);
        return [];
      }

      const sorted = tasks
        .filter(task => {
          // Defensive check: ensure task is valid
          if (!task || typeof task !== 'object') {
            return false;
          }
          // Exclude _subtasks_ occurrence records: they are merged into the base/completed task via getTaskWithOccurrenceSubtasks, not shown as separate cards
          if (task.id.includes(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS)) {
            return false;
          }
          // Show base only when no occurrence for this day; hide base when an occurrence exists (no duplicate).
          if (isSeriesBaseTask(task) && hasSeriesOccurrenceForDate(tasks, task.id, dateString)) return false;
          // Second line of defense: if this task's id is a base (no __) and an occurrence exists for this day, hide it. Catches base when recurrence was stripped after load/sync.
          if (!task.id.includes(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR) && hasSeriesOccurrenceForDate(tasks, task.id, dateString)) return false;
          // Include completed occurrences for the day they belong to (id = baseId_completed_YYYY-MM-DD) so they show grayed on kanban
          if (task.id.includes(RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED)) {
            const suffix = RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED;
            const datePart = task.id.split(suffix)[1];
            return datePart === dateString;
          }
          
          // CRITICAL: For recurring tasks, ensure they have a scheduledDate
          // Recurring tasks need a scheduledDate (base date) for isDateInRecurrence to work
          if (task.recurrence && task.recurrence.type !== 'none' && !task.scheduledDate) {
            if (import.meta.env.DEV) {
              logger.warn('Recurring task missing scheduledDate, cannot determine recurrence dates', {
                taskId: task.id,
                taskTitle: task.title,
                recurrenceType: task.recurrence.type,
                dateString
              });
            }
            return false;
          }
          
          try {
            // Check if task matches this date (either exact match or recurrence pattern)
            const matches = isDateInRecurrence(task, checkDate);
            
            // Debug logging for recurring tasks
            if (import.meta.env.DEV && task.recurrence && task.recurrence.type !== 'none') {
              if (matches) {
                logger.debug('Recurring task matches date', {
                  taskId: task.id,
                  taskTitle: task.title,
                  scheduledDate: task.scheduledDate,
                  checkDate: dateString,
                  recurrenceType: task.recurrence.type,
                  recurrenceInterval: task.recurrence.interval,
                  daysOfWeek: task.recurrence.daysOfWeek
                });
              }
            }
            
            if (!matches) return false;
            // Avoid duplicate: if this is a base recurring task and we have a completed occurrence for this day, show only the completed occurrence (grayed)
            if (task.recurrence && task.recurrence.type !== 'none') {
              const completedOccurrenceId = `${task.id}${RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED}${dateString}`;
              if (tasks.some(t => t.id === completedOccurrenceId)) return false;
            }
            return true;
          } catch (error) {
            logger.error('Error checking date in recurrence:', error, task);
            return false;
          }
        })
        .sort((a, b) => {
          try {
            // Sort by TIME OF DAY only (hours and minutes), not full timestamp
            // This is important for recurring tasks where scheduledDate is the base date
            // but we want to sort by the time they occur during the day
            const dateA = a.scheduledDate ? new Date(a.scheduledDate) : null;
            const dateB = b.scheduledDate ? new Date(b.scheduledDate) : null;
            
            if (!dateA || isNaN(dateA.getTime())) return 1;
            if (!dateB || isNaN(dateB.getTime())) return -1;
            
            // Extract time of day in minutes (hours * MINUTES_PER_HOUR + minutes)
            const timeOfDayA = dateA.getHours() * MINUTES_PER_HOUR + dateA.getMinutes();
            const timeOfDayB = dateB.getHours() * MINUTES_PER_HOUR + dateB.getMinutes();
            
            return timeOfDayA - timeOfDayB;
          } catch (error) {
            logger.error('Error sorting tasks:', error, a, b);
            return 0;
          }
        });
      return dedupeTasksForDay(sorted, dateString);
    } catch (error) {
      logger.error('Error in getTasksForDay:', error);
      return [];
    }
  };



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

  // Render mobile single column or desktop multi-column
  if (mobileMode) {
    const currentColumn = weekColumns[mobileDayIndex] ?? weekColumns[0];
    if (!currentColumn) {
      return null;
    }
    const dayTasks = getTasksForDay(currentColumn.dateString);
    const dayLayouts = buildTaskLayouts(dayTasks, undefined, false); // Use fixed spacing for kanban view
    // For recurring tasks, use unique ID per date occurrence to maintain chronological order
    const taskIds = Array.isArray(dayTasks) ? dayTasks
      .map(t => {
        if (!t?.id) return null;
        const isRecurring = t.recurrence && t.recurrence.type !== 'none';
        return isRecurring ? `${t.id}__${currentColumn.dateString}` : t.id;
      })
      .filter((id): id is string => id !== null) : [];

    return (
      <div 
        className={shouldUseMobileLayout ? "flex flex-col h-full w-full max-w-full min-w-0 overflow-x-hidden" : "min-h-full flex flex-col"}
        style={{
          // Use gradient background on both mobile and desktop
          backgroundImage: isDark
            ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.dark.from}, ${KANBAN_BACKGROUND_GRADIENTS.dark.via}, ${KANBAN_BACKGROUND_GRADIENTS.dark.to})`
            : `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`,
        } as React.CSSProperties}
      >

        {/* Mobile Single Column - No nested scroll, parent container handles scrolling */}
        <div 
          className="flex-1 px-4 pt-2 sm:px-6 sm:pt-4" 
          style={{ 
            // Remove transparent background override to allow parent gradient to show through
            // Add minimum height to fill space between header and nav bar when no tasks
            minHeight: shouldUseMobileLayout
              ? `calc(100vh - ${HEADER_HEIGHT}px - ${NAV_BAR_HEIGHT}px)`
              : 'auto',
            // Add bottom padding to ensure content is not hidden by nav bar
            // Use the same calculation as App.tsx scroll container for consistency
            paddingBottom: shouldUseMobileLayout
              ? `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`
              : undefined,
          } as React.CSSProperties}
        >
          <DroppableColumn id={currentColumn.dateString} className={shouldUseMobileLayout ? "" : "min-h-full"}>
              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
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

                    {(() => {
                      // Get calendar events for this day (mobile)
                      // useCalendarEventsByDate already groups events by local date string using getDateString
                      // This ensures consistency with desktop view
                      const calEvents = calendarEventsByDate[currentColumn.dateString] || [];
                      
                      // Create combined items (tasks + calendar events) sorted by time
                      type MobileCombinedItem = 
                        | { type: 'task'; task: Task; marginTop: number; sortTime: number }
                        | { type: 'event'; event: typeof calEvents[0]; sortTime: number };
                      
                      const combinedItems: MobileCombinedItem[] = [];
                      
                      // Normalize date to column's date for accurate time-of-day sorting
                      const columnDate = new Date(currentColumn.date);
                      columnDate.setHours(0, 0, 0, 0);
                      
                      // Add tasks with their sort time (normalize to column date for time-of-day sorting)
                      for (const layout of dayLayouts) {
                        const taskTime = layout.task.scheduledDate || layout.task.dueDate;
                        let sortTime: number;
                        
                        if (taskTime) {
                          const taskDate = new Date(taskTime);
                          // Normalize to column's date but preserve the time of day
                          const normalizedDate = new Date(columnDate);
                          normalizedDate.setHours(taskDate.getHours(), taskDate.getMinutes(), taskDate.getSeconds(), taskDate.getMilliseconds());
                          sortTime = normalizedDate.getTime();
                        } else {
                          // For tasks without time, use end of day so they appear after timed items
                          sortTime = Number.MAX_SAFE_INTEGER;
                        }
                        
                        combinedItems.push({
                          type: 'task',
                          task: layout.task,
                          marginTop: layout.marginTop,
                          sortTime,
                        });
                      }
                      
// Add calendar events (normalize to column date for time-of-day sorting; use parseCalendarEventTime for correct local time)
                          for (const event of calEvents) {
                            const eventStart = parseCalendarEventTime(event.start);
                            // Normalize to column's date but preserve the time of day (in local timezone)
                            const normalizedDate = new Date(columnDate);
                            normalizedDate.setHours(eventStart.getHours(), eventStart.getMinutes(), eventStart.getSeconds(), eventStart.getMilliseconds());
                            const sortTime = normalizedDate.getTime();
                            
                            combinedItems.push({
                              type: 'event',
                              event,
                              sortTime,
                            });
                          }
                          
                          // Sort by time (earliest first, tasks without time go to end)
                          // Secondary sort by type (events before tasks at same time) for consistent ordering
                          combinedItems.sort((a, b) => {
                            if (a.sortTime !== b.sortTime) {
                              return a.sortTime - b.sortTime;
                            }
                            // If same time, events come before tasks
                            if (a.type === 'event' && b.type === 'task') return -1;
                            if (a.type === 'task' && b.type === 'event') return 1;
                            return 0;
                          });
                          
                          const hasContent = combinedItems.length > 0;
                          
                          return (
                    <div
                      className="w-full flex flex-col items-center" 
                      style={{ 
                        minHeight: 0, 
                        height: '100%',
                        width: '100%',
                        // No paddingBottom - nav bar clearance handled by spacer in App.tsx
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
                    <AnimatePresence mode="popLayout">
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
                            className="flex flex-col w-full"
                            style={{
                              gap: KANBAN_COLUMN_DIMENSIONS.cardsGapPx,
                              padding: 0,
                              // No paddingBottom - nav bar clearance handled by spacer in App.tsx
                              minHeight: 0,
                              height: 'auto',
                              width: '100%',
                              maxWidth: shouldUseMobileLayout 
                                ? KANBAN_COLUMN_DIMENSIONS.cardsContainerMaxWidth.mobile
                                : KANBAN_COLUMN_DIMENSIONS.cardsContainerMaxWidth.desktop,
                              margin: KANBAN_COLUMN_DIMENSIONS.cardsContainerMargin as React.CSSProperties['margin'],
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
                              {combinedItems.map((item, idx) => {
                                if (item.type === 'event') {
                                  return (
                                    <div
                                      key={`mobile-event-${item.event.id}`}
                                      className="w-full max-w-full overflow-hidden"
                                      style={{ 
                                        display: 'block',
                                        width: '100%',
                                        minWidth: '100%',
                                        transform: `scale(${TASK_CARD_TIMELINE.scale.kanban})`,
                                        transformOrigin: 'top center',
                                      }}
                                    >
                                      <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2, delay: idx * 0.02 }}
                                        style={{ width: '100%' }}
                                      >
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
                                      </motion.div>
                                    </div>
                                  );
                                } else {
                                  return (
                          <div
                                      key={item.task.id}
                            className="w-full max-w-full overflow-hidden"
                            style={{ 
                              display: 'block',
                              width: '100%',
                              minWidth: '100%',
                              transform: `scale(${TASK_CARD_TIMELINE.scale.kanban})`,
                              transformOrigin: 'top center',
                            }}
                          >
                            <DraggableTaskCard
                                        task={getTaskWithOccurrenceSubtasks(item.task, currentColumn.dateString, tasks)}
                                        onClick={() => handleTaskClick(item.task, currentColumn.dateString)}
                            droppableId={currentColumn.dateString}
                            occurrenceDate={currentColumn.dateString}
                            onComplete={onTaskComplete}
                          />
                          </div>
                                  );
                                }
                              })}
                            </div>
                      )}
                    </AnimatePresence>
                    </div>
                      );
                    })()}
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

  // Desktop multi-column view
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
          mobileMode ? "w-full" : "flex-1 overflow-hidden"
        )}>
          <div 
            ref={scrollContainerRef}
            className={cn(
              mobileMode ? "w-full" : "h-full",
              "overflow-x-auto",
              // On mobile, rely on parent scroll container - no overflow-y-auto
              // On desktop, allow vertical scrolling within the kanban
              mobileMode ? "" : "overflow-y-auto",
              "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent",
              activeId && "cursor-default" // Change cursor when dragging task
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          >
            <div 
              ref={columnsContainerRef}
              data-kanban-zoom-scale={zoomScale}
              className="flex gap-1 sm:gap-1.5 md:gap-2 lg:gap-2 p-2 sm:p-2.5 md:p-2.5 lg:p-3 min-w-max"
              style={{
                transform: zoomScale !== 1 ? `scale(${zoomScale})` : 'none',
                transformOrigin: 'top left',
                transition: KANBAN_ANIMATION.transformTransition,
                // No paddingBottom - nav bar clearance handled by spacer in App.tsx
                minHeight: mobileMode ? '100%' : undefined,
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
                
                return (
                  <React.Fragment key={`week-group-${groupIndex}`}>
                    {isStartOfWeek && (
                      <div className="flex flex-col items-center justify-center px-4 sm:px-6 mx-2 sm:mx-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/80 dark:bg-card/70 border border-primary/30 dark:border-primary/40 flex items-center justify-center shadow-xl mb-2">
                          <span className="text-4xl sm:text-5xl font-light text-primary">+</span>
                        </div>
                        <span className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">
                          Transition
                        </span>
                      </div>
                    )}

                  <div className="flex flex-col gap-2 min-w-max">
                    <div className="flex items-center gap-3 px-2 py-2 sm:py-3">
                      <span
                        className={cn(
                          'font-bold tracking-[0.5em] uppercase',
                          groupIndex === 1 ? 'text-primary dark:text-primary/80' : 'text-muted-foreground'
                        )}
                        style={{ fontSize: shouldUseMobileLayout ? KANBAN_TEXT_SIZES.weekLabel.mobile : KANBAN_TEXT_SIZES.weekLabel.desktop }}
                      >
                        {groupIndex === 0 ? 'WEEK ONE' : 'WEEK TWO'}
                      </span>
                      <span className="flex-1 h-px bg-gradient-to-r from-primary/30 via-transparent to-transparent dark:from-primary/40" />
                    </div>

                    <div className="flex gap-1 sm:gap-1.5 md:gap-2 lg:gap-2">
                      {group.map((column, columnIndex) => {
                const dayTasks = getTasksForDay(column.dateString);
                // For recurring tasks, use unique ID per date occurrence to maintain chronological order
                const taskIds = Array.isArray(dayTasks) ? dayTasks
                  .map(t => {
                    if (!t?.id) return null;
                    const isRecurring = t.recurrence && t.recurrence.type !== 'none';
                    return isRecurring ? `${t.id}__${column.dateString}` : t.id;
                  })
                  .filter((id): id is string => id !== null) : [];
                      const globalIndex = groupIndex * KANBAN_TIME.daysPerWeek + columnIndex;
                      const isSecondWeek = groupIndex === 1;
                      const dayLayouts = buildTaskLayouts(dayTasks, undefined, false); // Use fixed spacing for kanban view

                return (
                  <div
                    key={column.dateString}
                    className="flex flex-col"
                    style={{
                      minWidth: `${columnWidth}px`,
                      width: `${columnWidth}px`,
                    }}
                  >
                    {/* Horizontal line indicator above column box for current day */}
                    {column.isToday && (
                      <div
                        className="flex justify-center"
                        style={{
                          marginBottom: KANBAN_DAY_COLORS.today.indicatorLine.marginBottom,
                        }}
                      >
                        <div
                          style={{
                            width: `${KANBAN_DAY_COLORS.today.indicatorLine.widthPercent}%`,
                            height: KANBAN_DAY_COLORS.today.indicatorLine.height,
                            backgroundColor: KANBAN_DAY_COLORS.today.indicatorLine.color,
                            borderRadius: KANBAN_DAY_COLORS.today.indicatorLine.borderRadius,
                          }}
                        />
                      </div>
                    )}
                    <motion.div
                      data-column-date={column.dateString}
                      className={cn(
                        'flex flex-col rounded-2xl overflow-hidden soft-shadow border border-primary/10 dark:border-border/50',
                        // Only use Tailwind bg when we are not applying column-wrapper tint (weekend or no header colors)
                        !column.isWeekend && !hasHeader(getDayColors(column.dayName)) && (isDark ? 'bg-card/80' : 'bg-transparent'),
                        column.isWeekend && isDark && 'bg-card/60',
                        isSecondWeek && 'ring-1 ring-primary/15 dark:ring-primary/25'
                      )}
                      style={{
                        minWidth: `${columnWidth}px`,
                        width: `${columnWidth}px`,
                        ...(column.isWeekend && !isDark && {
                          backgroundImage: `linear-gradient(to bottom, ${KANBAN_DAY_COLORS.weekend.from}${Math.round(KANBAN_DAY_COLORS.weekend.opacity * 2.55).toString(16).padStart(2, '0')}, ${KANBAN_DAY_COLORS.weekend.to}${Math.round(KANBAN_DAY_COLORS.weekend.opacity * 2.55).toString(16).padStart(2, '0')})`,
                        }),
                        // Full-column tint so today stands out when scrolling vertically (brighter today, muted others)
                        ...(!column.isWeekend && hasHeader(getDayColors(column.dayName)) && (() => {
                          const dayColors = getDayColors(column.dayName);
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
                      className={cn(
                        'p-1.5 sm:p-2 border-b backdrop-blur-sm transition-all',
                        // Enhanced styling for today - full pastel color gradient at 100% opacity, no frame/border
                        !column.isToday && isDark && 'bg-card/50 border-border',
                        !column.isToday && !isDark && hasHeader(getDayColors(column.dayName)) && 'bg-transparent'
                      )}
                      style={(() => {
                        const baseStyle: React.CSSProperties = {};
                        if (!isDark) {
                          const dayColors = getDayColors(column.dayName);
                          if (hasHeader(dayColors)) {
                            // Helper function to darken hex color by a factor (creates deeper colors)
                            const darkenColor = (hex: string, factor: number): string => {
                              const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
                              const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
                              const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
                              return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                            };
                            
                            // Today: full opacity so current day stands out when scrolling; non-today: reduced opacity
                            const headerOpacity = column.isToday 
                              ? KANBAN_DAY_COLORS.today.headerOpacity // Full opacity for today
                              : KANBAN_DAY_COLORS.standard.nonTodayHeaderOpacity; // Reduced for non-today so today column is brighter
                            
                            // Use solid pastel color (from color only, no gradient)
                            const solidColor = column.isToday 
                              ? (KANBAN_DAY_COLORS.today.colorDarkeningFactor === 1.0 
                                  ? dayColors.header.from 
                                  : darkenColor(dayColors.header.from, KANBAN_DAY_COLORS.today.colorDarkeningFactor))
                              : dayColors.header.from;
                            
                            // Solid color with opacity (no gradient)
                            baseStyle.backgroundColor = `${solidColor}${Math.round(headerOpacity * 2.55).toString(16).padStart(2, '0')}`;
                            baseStyle.backgroundImage = 'none'; // Remove gradient
                            
                            // For today: no border/frame, just the solid pastel color at 100% opacity
                            if (column.isToday) {
                              // Remove border/frame - just use the solid color
                              baseStyle.borderBottomWidth = KANBAN_DAY_COLORS.today.borderWidthNone;
                              baseStyle.borderColor = KANBAN_DAY_COLORS.today.borderColorTransparent;
                              // No ring or shadow - clean gradient only
                              baseStyle.boxShadow = KANBAN_DAY_COLORS.today.boxShadowNone;
                            } else {
                              // Standard border for non-today days
                              baseStyle.borderColor = `${dayColors.header.border}${Math.round(dayColors.header.borderOpacity * 2.55).toString(16).padStart(2, '0')}`;
                            }
                          }
                        } else {
                          // Dark mode: solid pastel color (no gradient)
                          if (column.isToday) {
                            // Get day colors for solid color even in dark mode
                            const dayColors = getDayColors(column.dayName);
                            if (hasHeader(dayColors)) {
                              // Use solid pastel color at 100% opacity in dark mode
                              const solidColor = dayColors.header.from;
                              baseStyle.backgroundColor = `${solidColor}${Math.round(KANBAN_DAY_COLORS.today.headerOpacity * 2.55).toString(16).padStart(2, '0')}`;
                              baseStyle.backgroundImage = 'none'; // Remove gradient
                            }
                            // Remove border/frame - just use the solid color
                            baseStyle.borderBottomWidth = KANBAN_DAY_COLORS.today.borderWidthNone;
                            baseStyle.borderColor = KANBAN_DAY_COLORS.today.borderColorTransparent;
                            // No ring or shadow - clean solid color only
                            baseStyle.boxShadow = KANBAN_DAY_COLORS.today.boxShadowNone;
                          } else {
                            // Non-today days in dark mode: reduced opacity so today column stands out when scrolling
                            const dayColors = getDayColors(column.dayName);
                            if (hasHeader(dayColors)) {
                              const solidColor = dayColors.header.from;
                              const opacity = KANBAN_DAY_COLORS.standard.nonTodayHeaderOpacity;
                              baseStyle.backgroundColor = `${solidColor}${Math.round(opacity * 2.55).toString(16).padStart(2, '0')}`;
                              baseStyle.backgroundImage = 'none'; // Remove gradient
                            }
                          }
                        }
                        return baseStyle;
                      })()}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 
                            className={cn(
                              'uppercase text-xs sm:text-sm tracking-wider mb-0.5 sm:mb-1 font-bold',
                              !column.isToday && 'text-gray-700 dark:text-foreground'
                            )}
                            style={column.isToday ? { color: KANBAN_DAY_COLORS.today.text } : undefined}
                          >
                            {column.dayName.substring(0, 3)} {column.date.getDate()}
                          </h3>
                        </div>
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

                    <DroppableColumn id={column.dateString} className="flex-1 min-h-0">
                      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                        {(() => {
                          // Get calendar events for this day
                          const calEvents = calendarEventsByDate[column.dateString] || [];
                          
                          // Create combined items (tasks + calendar events) sorted chronologically by time-of-day
                          type CombinedItem = 
                            | { type: 'task'; task: Task; marginTop: number; sortTime: number }
                            | { type: 'event'; event: typeof calEvents[0]; sortTime: number };
                          
                          const combinedItems: CombinedItem[] = [];
                          
                          // Normalize date to column's date for accurate time-of-day sorting
                          const columnDate = new Date(column.date);
                          columnDate.setHours(0, 0, 0, 0);
                          
                          // Add tasks with their sort time (normalize to column date for time-of-day sorting)
                          for (const layout of dayLayouts) {
                            const taskTime = layout.task.scheduledDate || layout.task.dueDate;
                            let sortTime: number;
                            
                            if (taskTime) {
                              const taskDate = new Date(taskTime);
                              // Normalize to column's date but preserve the time of day
                              const normalizedDate = new Date(columnDate);
                              normalizedDate.setHours(taskDate.getHours(), taskDate.getMinutes(), taskDate.getSeconds(), taskDate.getMilliseconds());
                              sortTime = normalizedDate.getTime();
                            } else {
                              // For tasks without time, use end of day so they appear after timed items
                              sortTime = Number.MAX_SAFE_INTEGER;
                            }
                            
                            combinedItems.push({
                              type: 'task',
                              task: layout.task,
                              marginTop: layout.marginTop,
                              sortTime,
                            });
                          }
                          
                          // Add calendar events (normalize to column date for time-of-day sorting; use parseCalendarEventTime for correct local time)
                          for (const event of calEvents) {
                            const eventStart = parseCalendarEventTime(event.start);
                            // Normalize to column's date but preserve the time of day (in local timezone)
                            const normalizedDate = new Date(columnDate);
                            normalizedDate.setHours(eventStart.getHours(), eventStart.getMinutes(), eventStart.getSeconds(), eventStart.getMilliseconds());
                            const sortTime = normalizedDate.getTime();
                            
                            combinedItems.push({
                              type: 'event',
                              event,
                              sortTime,
                            });
                          }
                          
                          // Sort by time (earliest first, tasks without time go to end)
                          // Secondary sort by type (events before tasks at same time) for consistent ordering
                          combinedItems.sort((a, b) => {
                            if (a.sortTime !== b.sortTime) {
                              return a.sortTime - b.sortTime;
                            }
                            // If same time, events come before tasks
                            if (a.type === 'event' && b.type === 'task') return -1;
                            if (a.type === 'task' && b.type === 'event') return 1;
                            return 0;
                          });
                          
                          const hasContent = combinedItems.length > 0;
                          
                          return (
                        <div 
                          className={cn(
                            'p-2 sm:p-3 flex flex-col items-stretch h-full min-h-full',
                            isDark ? 'bg-muted/10' : ''
                          )}
                          style={{
                            backgroundImage: isDark
                              ? getColumnBgGradient(column.dayName, isDark, column.isToday)
                              : getColumnBgGradient(column.dayName, false, column.isToday),
                                  minHeight: `${MOBILE_SPACING.emptyStateMinHeight}px`,
                          }}
                        >
                          <AnimatePresence mode="popLayout">
                                {!hasContent ? (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                      className="flex flex-col items-center justify-center py-12 text-center pointer-events-none"
                                      style={{ minHeight: `${MOBILE_SPACING.emptyStateMinHeight}px` }}
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
                                    {combinedItems.map((item, idx) => {
                                      if (item.type === 'event') {
                                        return (
                                          <div
                                            key={`event-${item.event.id}`}
                                            className="w-full max-w-full overflow-hidden"
                                            style={{
                                              display: 'block',
                                              width: '100%',
                                              minWidth: '100%',
                                              transform: `scale(${TASK_CARD_TIMELINE.scale.kanban})`,
                                              transformOrigin: 'top center',
                                            }}
                                          >
                                            <motion.div
                                              initial={{ opacity: 0, y: 10 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              exit={{ opacity: 0, scale: 0.95 }}
                                              transition={{ duration: 0.2, delay: idx * 0.02 }}
                                              style={{ width: '100%' }}
                                            >
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
                                            </motion.div>
                                          </div>
                                        );
                                      } else {
                                        return (
                                  <div 
                                            key={item.task.id} 
                                    className="w-full max-w-full overflow-hidden"
                                    style={{ 
                                      display: 'block',
                                      width: '100%',
                                      minWidth: '100%',
                                      transform: `scale(${TASK_CARD_TIMELINE.scale.kanban})`,
                                      transformOrigin: 'top center',
                                    }}
                                  >
                                  <DraggableTaskCard
                                              task={getTaskWithOccurrenceSubtasks(item.task, column.dateString, tasks)}
                                              onClick={() => handleTaskClick(item.task, column.dateString)}
                                    droppableId={column.dateString}
                                    occurrenceDate={column.dateString}
                                    onComplete={onTaskComplete}
                                  />
                                  </div>
                                        );
                                      }
                                    })}
                                  </div>
                            )}
                          </AnimatePresence>
                        </div>
                          );
                        })()}
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

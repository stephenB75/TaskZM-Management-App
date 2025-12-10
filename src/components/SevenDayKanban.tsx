import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { DroppableColumn } from './DroppableColumn';
import { cn, prepareTaskForDialog } from '../lib/utils';
import { isDateInRecurrence } from '../lib/recurrence';
import { toast } from 'sonner';
import { logger } from '../lib/logger';
import { projectId } from '../utils/supabase/info';
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
import { VIEWPORT_BREAKPOINTS, MOBILE_SPACING } from '../lib/layout-constants';
import { buildTaskLayouts } from '../lib/task-layout';
import type { Task } from '../types';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

// Helper function to get day colors
const getDayColors = (dayName: string) => {
  const dayKey = dayName.toLowerCase() as keyof typeof KANBAN_DAY_COLORS;
  return KANBAN_DAY_COLORS[dayKey] || KANBAN_DAY_COLORS.monday;
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
}

export function SevenDayKanban({ 
  mobileMode = false, 
  viewMode = 'week', 
  mobileDayIndex = 0,
  mobileWeekOffset = 0,
  onMobileWeekChange
}: SevenDayKanbanProps) {
  const { tasks } = useTasks();
  const { activeId } = useDragDrop();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const { accessToken } = useAuth();
  const { calendarStatus } = useCalendar();
  
  // Calculate responsive column width based on viewport
  const [columnWidth, setColumnWidth] = React.useState(KANBAN_COLUMN_DIMENSIONS.width.desktop);
  
  React.useEffect(() => {
    const updateColumnWidth = () => {
      const width = window.innerWidth;
      // Use constants for breakpoints
      if (width < VIEWPORT_BREAKPOINTS.mobile) {
        setColumnWidth(KANBAN_COLUMN_DIMENSIONS.width.mobile);
      } else if (width >= VIEWPORT_BREAKPOINTS.mobile && width < VIEWPORT_BREAKPOINTS.tablet) {
        setColumnWidth(KANBAN_COLUMN_DIMENSIONS.width.tablet);
      } else if (width >= VIEWPORT_BREAKPOINTS.tablet && width < VIEWPORT_BREAKPOINTS.desktop) {
        setColumnWidth(KANBAN_COLUMN_DIMENSIONS.width.smallMonitor);
      } else {
        setColumnWidth(KANBAN_COLUMN_DIMENSIONS.width.desktop);
      }
    };
    
    updateColumnWidth();
    window.addEventListener('resize', updateColumnWidth);
    return () => window.removeEventListener('resize', updateColumnWidth);
  }, []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarEventsByDate, setCalendarEventsByDate] = useState<Record<string, Array<{ title: string; start: string; end: string; provider: 'google' | 'apple' }>>>({});
  
  // Drag-to-scroll state
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollAnimationRef = React.useRef<number | null>(null);
  
  // Auto-zoom state for desktop view
  const columnsContainerRef = React.useRef<HTMLDivElement>(null);
  const [zoomScale, setZoomScale] = useState(1);

  // Helpers for subtle gradients to avoid blending into backgrounds
  const toAlphaHex = (hex: string, percent: number) => {
    const clean = hex.replace('#', '');
    const val = Math.round(Math.min(100, Math.max(0, percent)) * 2.55)
      .toString(16)
      .padStart(2, '0');
    return `#${clean}${val}`;
  };

  const getColumnBgGradient = (dayName: string) => {
    const dayColors = getDayColors(dayName);
    // Light mode: use day color with soft gradient
    const base = dayColors.background;
    const start = toAlphaHex(base, 28);
    const end = toAlphaHex(base, 6);
    return `linear-gradient(180deg, ${start} 0%, ${end} 100%)`;
  };

  const darkColumnGradient = 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)';

  // Generate week columns starting from tomorrow
  const getWeekColumns = (): DayColumn[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use mobileWeekOffset in mobile mode, weekOffset in desktop mode
    const currentWeekOffset = mobileMode ? mobileWeekOffset : weekOffset;
    
    // For desktop: start from tomorrow (today is shown in Today Agenda timeline)
    // For mobile: start from Monday of the current week
    let startDate: Date;
    if (mobileMode) {
      // Mobile: Start from Monday of the current week
      startDate = new Date(today);
      const currentDay = startDate.getDay(); // 0 (Sun) - 6 (Sat)
      const mondayOffset = (currentDay + 6) % 7; // Convert to Monday=0
      startDate.setDate(startDate.getDate() - mondayOffset + currentWeekOffset * 7);
    } else {
      // Desktop: Start from tomorrow (today is shown in Today Agenda timeline, so exclude it)
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() + 1 + (currentWeekOffset * 7));
    }

    const totalDays = mobileMode ? 7 : KANBAN_TIME.daysInWeek;

    return Array.from({ length: totalDays }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isToday = 
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

      const dayOfWeek = date.getDay();
      const dayName = DAYS_OF_WEEK[dayOfWeek === 0 ? 6 : dayOfWeek - 1]; // Monday-based array

      return {
        date,
        dayName,
        dateString: date.toISOString().split('T')[0],
        isToday,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6, // Sunday or Saturday
        weekNumber: Math.floor(i / 7) + 1,
        dayIndex: i,
      };
    });
  };

  // Memoize week columns so downstream effects don't re-run every render
  const weekColumns = React.useMemo(() => getWeekColumns(), [mobileMode, mobileWeekOffset, weekOffset]);
  const weekGroups = React.useMemo(() => {
    const groups: DayColumn[][] = [];
    for (let i = 0; i < weekColumns.length; i += 7) {
      groups.push(weekColumns.slice(i, i + 7));
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

  // Fetch external calendar events (Google/Apple) for the visible week to overlay in the kanban view
  React.useEffect(() => {
    const fetchCalendarEvents = async () => {
      try {
        if (!accessToken) return;
        const providers: Array<'google' | 'apple'> = [];
        if (calendarStatus.google) providers.push('google');
        if (calendarStatus.apple) providers.push('apple');
        if (providers.length === 0 || !visibleRange) {
          setCalendarEventsByDate({});
          return;
        }

        const BASE_URL = `https://${projectId}.supabase.co/functions/v1/taskzm-database-function`;
        const aggregated: Record<string, Array<{ title: string; start: string; end: string; provider: 'google' | 'apple' }>> = {};

        for (const provider of providers) {
          const resp = await fetch(
            `${BASE_URL}/calendar/events/${provider}?startDate=${visibleRange.startIso}&endDate=${visibleRange.endIso}`,
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
            const dateKey = eventStart.toISOString().split('T')[0];
            aggregated[dateKey] = aggregated[dateKey] || [];
            aggregated[dateKey].push({
              title: event.title || 'Calendar Event',
              start: event.start,
              end: event.end,
              provider,
            });
          }
        }

        setCalendarEventsByDate(aggregated);
      } catch (error) {
        logger.warn('Failed to fetch external calendar events for kanban view:', error);
      }
    };

    fetchCalendarEvents();
  }, [accessToken, calendarStatus.apple, calendarStatus.google, visibleRange?.startIso, visibleRange?.endIso]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
      
      // Get viewport height - use the actual visible height of the scroll container
      const containerRect = container.getBoundingClientRect();
      const viewportHeight = containerRect.height;
      
      // Find the tallest column by checking all child divs (the motion.div column elements)
      let maxColumnHeight = 0;
      const columnElements = columns.children;
      
      // Measure each column's actual content height
      Array.from(columnElements).forEach((col) => {
        if (col instanceof HTMLElement) {
          // Get the actual rendered height of the column
          // Use scrollHeight to account for overflowing content, or getBoundingClientRect for rendered height
          const rect = col.getBoundingClientRect();
          const scrollHeight = col.scrollHeight;
          
          // Use the larger of the two to ensure we capture all content
          const columnHeight = Math.max(rect.height, scrollHeight);
          maxColumnHeight = Math.max(maxColumnHeight, columnHeight);
        }
      });
      
      // If no columns found or height is 0, reset zoom
      if (maxColumnHeight === 0 || viewportHeight === 0) {
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
    
    // Recalculate on window resize and container resize
    const resizeObserver = new ResizeObserver(handleResize);
    
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }
    
    if (columnsContainerRef.current) {
      resizeObserver.observe(columnsContainerRef.current);
    }
    
    // Also listen for window resize events
    window.addEventListener('resize', handleResize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
    };
  }, [tasks, mobileMode, viewMode, weekOffset]);

  // Get tasks for a specific day
  const getTasksForDay = (dateString: string) => {
    // Defensive check: ensure tasks is an array
    if (!Array.isArray(tasks)) {
      logger.warn('getTasksForDay: tasks is not an array', tasks);
      return [];
    }

    try {
      const checkDate = new Date(dateString + 'T00:00:00');
      if (isNaN(checkDate.getTime())) {
        logger.warn('getTasksForDay: Invalid date string', dateString);
        return [];
      }

      return tasks
        .filter(task => {
          // Defensive check: ensure task is valid
          if (!task || typeof task !== 'object') {
            return false;
          }
          try {
            // Check if task matches this date (either exact match or recurrence pattern)
            return isDateInRecurrence(task, checkDate);
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
            
            // Extract time of day in minutes (hours * 60 + minutes)
            const timeOfDayA = dateA.getHours() * 60 + dateA.getMinutes();
            const timeOfDayB = dateB.getHours() * 60 + dateB.getMinutes();
            
            return timeOfDayA - timeOfDayB;
          } catch (error) {
            logger.error('Error sorting tasks:', error, a, b);
            return 0;
          }
        });
    } catch (error) {
      logger.error('Error in getTasksForDay:', error);
      return [];
    }
  };



  const handleTaskClick = (task: Task) => {
    logger.info('handleTaskClick called with task:', task);
    try {
      if (!task || !task.id) {
        logger.error('Invalid task passed to handleTaskClick:', task);
        toast.error('Invalid task data');
        return;
      }
      
      const safeTask = prepareTaskForDialog(task);
      if (!safeTask) {
        logger.error('prepareTaskForDialog returned null for task:', task);
        toast.error('Invalid task data');
        return;
      }
      
      logger.info('Setting selected task and opening dialog:', safeTask);
      // Set both states together - React will batch these updates
      setSelectedTask(safeTask);
      setDialogOpen(true);
      logger.info('State updated: selectedTask set, dialogOpen set to true');
    } catch (error) {
      logger.error('Error opening task:', error, task);
      toast.error('Failed to open task');
    }
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
    const taskIds = Array.isArray(dayTasks) ? dayTasks.map(t => t?.id).filter(Boolean) : [];

    return (
      <div 
        className="h-full flex flex-col"
        style={{
          backgroundImage: isDark
            ? `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.dark.from}, ${KANBAN_BACKGROUND_GRADIENTS.dark.via}, ${KANBAN_BACKGROUND_GRADIENTS.dark.to})`
            : `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`,
        }}
      >

        {/* Mobile Single Column */}
        <div className="flex-1 overflow-hidden px-4 pt-2 pb-24 sm:px-6 sm:pt-4 sm:pb-6" style={{ paddingBottom: KANBAN_MOBILE.bottomPaddingCalc }}>
          <DroppableColumn id={currentColumn.dateString} className="h-full">
              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                <ScrollArea className="h-full" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' } as React.CSSProperties}>
                  <div className="pb-6 sm:pb-8">
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
                        <CalendarDays className="hidden sm:block w-3.5 h-3.5 flex-shrink-0 mr-1" />
                        <span>Today</span>
                      </Button>
                      
                      {/* Add Button - Icon only on mobile, text on larger screens */}
                      <Button
                        variant="outline"
                        onClick={() => handleAddTask(currentColumn.dateString)}
                        className="rounded-full h-7 w-7 p-0 gap-0 sm:w-auto sm:h-8 sm:px-3 sm:gap-1.5 flex-shrink-0 text-xs"
                        aria-label="Add new task"
                      >
                        <Plus className="w-3.5 h-3.5 flex-shrink-0 sm:mr-1" />
                        <span className="hidden sm:inline">Add</span>
                      </Button>
                    </div>

                    <AnimatePresence mode="popLayout">
                      {dayTasks.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-2"
                        >
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                            <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-primary/40" />
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">No tasks scheduled</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddTask(currentColumn.dateString)}
                            className="rounded-full h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1.5 sm:w-4 sm:h-4 sm:mr-2" />
                            Add your first task
                          </Button>
                        </motion.div>
                      ) : (
                        dayLayouts.map(({ task, marginTop }) => (
                          <div
                            key={task.id}
                            style={{ 
                              transform: 'scale(0.85)',
                              transformOrigin: 'top center',
                              marginTop: `${marginTop}px`,
                            }}
                          >
                            <DraggableTaskCard
                            task={task}
                            onClick={() => handleTaskClick(task)}
                            droppableId={currentColumn.dateString}
                          />
                          </div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
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
      className="h-full flex flex-col" 
      data-tour="kanban"
      data-kanban-view="true"
      style={{
        backgroundImage: backgroundGradient,
      }}
    >
      
      {/* Week View - Kanban Board */}
        <div className="flex-1 overflow-hidden">
          <div 
            ref={scrollContainerRef}
            className={cn(
              "h-full overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent",
              activeId && "cursor-default" // Change cursor when dragging task
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          >
            <div 
              ref={columnsContainerRef}
              className="flex gap-1 sm:gap-1.5 md:gap-2 lg:gap-2 p-2 sm:p-2.5 md:p-2.5 lg:p-3 min-w-max"
              style={{
                transform: zoomScale !== 1 ? `scale(${zoomScale})` : 'none',
                transformOrigin: 'top left',
                transition: KANBAN_ANIMATION.transformTransition,
              }}
            >
              {weekGroups.map((group, groupIndex) => (
                <React.Fragment key={`week-group-${groupIndex}`}>
                  {groupIndex === 1 && (
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
                          'text-[14px] sm:text-[15px] font-bold tracking-[0.5em] uppercase',
                          groupIndex === 1 ? 'text-primary dark:text-primary/80' : 'text-muted-foreground'
                        )}
                      >
                        {groupIndex === 0 ? 'WEEK ONE' : 'WEEK TWO'}
                      </span>
                      <span className="flex-1 h-px bg-gradient-to-r from-primary/30 via-transparent to-transparent dark:from-primary/40" />
                    </div>

                    <div className="flex gap-1 sm:gap-1.5 md:gap-2 lg:gap-2">
                      {group.map((column, columnIndex) => {
                const dayTasks = getTasksForDay(column.dateString);
                const taskIds = Array.isArray(dayTasks) ? dayTasks.map(t => t?.id).filter(Boolean) : [];
                      const globalIndex = groupIndex * 7 + columnIndex;
                      const isSecondWeek = groupIndex === 1;
                      const dayLayouts = buildTaskLayouts(dayTasks, undefined, false); // Use fixed spacing for kanban view

                return (
                  <motion.div
                    key={column.dateString}
                    className={cn(
                      'flex flex-col rounded-2xl overflow-hidden soft-shadow border border-primary/10 dark:border-border/50',
                      !column.isWeekend && (isDark ? 'bg-card/80' : 'bg-white/80'),
                            column.isWeekend && isDark && 'bg-card/60',
                            isSecondWeek && 'ring-1 ring-primary/15 dark:ring-primary/25'
                    )}
                    style={{
                      minWidth: `${columnWidth}px`,
                      width: `${columnWidth}px`,
                      ...(column.isWeekend && !isDark && {
                        backgroundImage: `linear-gradient(to bottom, ${KANBAN_DAY_COLORS.weekend.from}${Math.round(KANBAN_DAY_COLORS.weekend.opacity * 2.55).toString(16).padStart(2, '0')}, ${KANBAN_DAY_COLORS.weekend.to}${Math.round(KANBAN_DAY_COLORS.weekend.opacity * 2.55).toString(16).padStart(2, '0')})`,
                      }),
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
                        'p-1.5 sm:p-2 border-b backdrop-blur-sm',
                        column.isToday && 'ring-2 ring-inset',
                        isDark 
                          ? 'bg-card/50 border-border' 
                          : getDayColors(column.dayName).header && 'bg-transparent'
                      )}
                      style={{
                        ...(column.isToday && {
                          ringColor: `${KANBAN_DAY_COLORS.today.ring}${Math.round(KANBAN_DAY_COLORS.today.ringOpacity * 2.55).toString(16).padStart(2, '0')}`,
                        }),
                        ...(!isDark && getDayColors(column.dayName).header && {
                          backgroundImage: `linear-gradient(to right, ${getDayColors(column.dayName).header.from}${Math.round(getDayColors(column.dayName).header.opacity * 2.55).toString(16).padStart(2, '0')}, ${getDayColors(column.dayName).header.via}${Math.round(70 * 2.55).toString(16).padStart(2, '0')}, ${getDayColors(column.dayName).header.to}${Math.round(getDayColors(column.dayName).header.opacity * 2.55).toString(16).padStart(2, '0')})`,
                          borderColor: `${getDayColors(column.dayName).header.border}${Math.round(getDayColors(column.dayName).header.borderOpacity * 2.55).toString(16).padStart(2, '0')}`,
                        }),
                      }}
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
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      {/* External calendar events (read-only) */}
                      {calendarEventsByDate[column.dateString]?.length ? (
                        <div className="mt-1 space-y-1">
                          {calendarEventsByDate[column.dateString]
                            .slice(0, 3)
                            .map((ev, idx) => (
                              <div
                                key={`${column.dateString}-cal-${idx}`}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 dark:bg-muted/20 rounded-md px-2 py-1"
                              >
                                <span className={cn(
                                  'h-2 w-2 rounded-full',
                                  ev.provider === 'apple' ? 'bg-primary' : 'bg-blue-500'
                                )} />
                                <span className="truncate">{ev.title}</span>
                                <span className="text-[10px] text-muted-foreground/80 ml-auto">
                                  {formatTime(ev.start)}
                                </span>
                              </div>
                            ))}
                          {calendarEventsByDate[column.dateString].length > 3 && (
                            <div className="text-[10px] text-muted-foreground/80">
                              +{calendarEventsByDate[column.dateString].length - 3} more
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <DroppableColumn id={column.dateString} className="flex-1">
                      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                        <div 
                          className={cn(
                            'p-2 sm:p-3 flex flex-col h-full',
                            isDark ? 'bg-muted/10' : ''
                          )}
                          style={{
                            backgroundImage: isDark
                              ? darkColumnGradient
                              : getColumnBgGradient(column.dayName),
                                  minHeight: `${MOBILE_SPACING.emptyStateMinHeight}px`,
                          }}
                        >
                          <AnimatePresence mode="popLayout">
                            {dayTasks.length === 0 ? (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                      className="flex flex-col items-center justify-center py-12 text-center pointer-events-none"
                                      style={{ minHeight: `${MOBILE_SPACING.emptyStateMinHeight}px` }}
                              >
                                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 pointer-events-none">
                                  <Plus className="w-6 h-6 text-primary/40" />
                                </div>
                                      <p className="text-sm text-muted-foreground mb-3 pointer-events-none">No tasks</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddTask(column.dateString)}
                                        className="rounded-full pointer-events-auto"
                                >
                                  Add task
                                </Button>
                              </motion.div>
                            ) : (
                              <>
                                {dayLayouts.map(({ task, marginTop }) => (
                                  <div 
                                    key={task.id} 
                                    className="px-2 sm:px-2.5"
                                    style={{ 
                                      transform: 'scale(0.85)',
                                      transformOrigin: 'top center',
                                      marginTop: `${marginTop}px`,
                                    }}
                                  >
                                  <DraggableTaskCard
                                    task={task}
                                    onClick={() => handleTaskClick(task)}
                                    droppableId={column.dateString}
                                  />
                                  </div>
                                ))}
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </SortableContext>
                    </DroppableColumn>
                        </motion.div>
                      );
                    })}
                    </div>
                  </div>
                </React.Fragment>
              ))}
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

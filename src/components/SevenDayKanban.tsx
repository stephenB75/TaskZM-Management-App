import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { useDragDrop } from '../contexts/DragDropContext';
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Drag-to-scroll state
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollAnimationRef = React.useRef<number | null>(null);
  
  // Auto-zoom state for desktop view
  const columnsContainerRef = React.useRef<HTMLDivElement>(null);
  const [zoomScale, setZoomScale] = useState(1);

  // Generate week columns starting from tomorrow
  const getWeekColumns = (): DayColumn[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use mobileWeekOffset in mobile mode, weekOffset in desktop mode
    const currentWeekOffset = mobileMode ? mobileWeekOffset : weekOffset;
    
    // Start from tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1 + (currentWeekOffset * 7));

    return Array.from({ length: KANBAN_TIME.daysInWeek }, (_, i) => {
      const date = new Date(tomorrow);
      date.setDate(tomorrow.getDate() + i);
      
      const isToday = 
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

      // Get day of week (0 = Sunday, 1 = Monday, etc.)
      const dayOfWeek = date.getDay();
      const dayName = DAYS_OF_WEEK[dayOfWeek === 0 ? 6 : dayOfWeek - 1]; // Adjust for Monday-based array

      return {
        date,
        dayName,
        dateString: date.toISOString().split('T')[0],
        isToday,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6, // Saturday (0) or Sunday (6)
      };
    });
  };

  const weekColumns = getWeekColumns();

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
            const timeA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
            const timeB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
            if (isNaN(timeA)) return 1;
            if (isNaN(timeB)) return -1;
            return timeA - timeB;
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
    const currentColumn = weekColumns[mobileDayIndex];
    const dayTasks = getTasksForDay(currentColumn.dateString);
    const taskIds = Array.isArray(dayTasks) ? dayTasks.map(t => t?.id).filter(Boolean) : [];

    return (
      <div 
        className="h-full flex flex-col dark:from-gray-800 dark:via-gray-900 dark:to-gray-800"
        style={{
          backgroundImage: `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.mobile.from}, ${KANBAN_BACKGROUND_GRADIENTS.mobile.to})`,
        }}
      >

        {/* Mobile Single Column */}
        <div className="flex-1 overflow-hidden px-4 pt-2 pb-24 sm:px-6 sm:pt-4 sm:pb-6" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
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
                        (Array.isArray(dayTasks) ? dayTasks : []).map((task) => (
                          <DraggableTaskCard
                            key={task.id}
                            task={task}
                            onClick={() => handleTaskClick(task)}
                            droppableId={currentColumn.dateString}
                          />
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
  return (
    <div 
      className="h-full flex flex-col dark:from-gray-800 dark:via-gray-900 dark:to-gray-800" 
      data-tour="kanban"
      data-kanban-view="true"
      style={{
        backgroundImage: `linear-gradient(to bottom, ${KANBAN_BACKGROUND_GRADIENTS.desktop.from}, ${KANBAN_BACKGROUND_GRADIENTS.desktop.via}, ${KANBAN_BACKGROUND_GRADIENTS.desktop.to})`,
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
              className="flex gap-1 sm:gap-1.5 md:gap-2 p-2 sm:p-2.5 md:p-3 min-w-max"
              style={{
                transform: zoomScale !== 1 ? `scale(${zoomScale})` : 'none',
                transformOrigin: 'top left',
                transition: KANBAN_ANIMATION.transformTransition,
              }}
            >
              {weekColumns.map((column, index) => {
                const dayTasks = getTasksForDay(column.dateString);
                const taskIds = Array.isArray(dayTasks) ? dayTasks.map(t => t?.id).filter(Boolean) : [];

                return (
                  <motion.div
                    key={column.dateString}
                    className={cn(
                      'flex flex-col rounded-2xl overflow-hidden soft-shadow',
                      !column.isWeekend && 'bg-white/80 dark:bg-card/80'
                    )}
                    style={{
                      minWidth: `${KANBAN_COLUMN_DIMENSIONS.width}px`,
                      width: `${KANBAN_COLUMN_DIMENSIONS.width}px`,
                      ...(column.isWeekend && {
                        backgroundImage: `linear-gradient(to bottom, ${KANBAN_DAY_COLORS.weekend.from}${Math.round(KANBAN_DAY_COLORS.weekend.opacity * 2.55).toString(16).padStart(2, '0')}, ${KANBAN_DAY_COLORS.weekend.to}${Math.round(KANBAN_DAY_COLORS.weekend.opacity * 2.55).toString(16).padStart(2, '0')})`,
                      }),
                    }}
                    initial={{ opacity: 0, y: KANBAN_ANIMATION.initialY }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: KANBAN_ANIMATION.duration, 
                      delay: index * KANBAN_ANIMATION.delayPerColumn,
                      ease: KANBAN_ANIMATION.easing
                    }}
                  >
                    {/* Column Header */}
                    <div 
                      className={cn(
                        'p-1.5 sm:p-2 border-b backdrop-blur-sm',
                        column.isToday && 'ring-2 ring-inset'
                      )}
                      style={{
                        ...(column.isToday && {
                          ringColor: `${KANBAN_DAY_COLORS.today.ring}${Math.round(KANBAN_DAY_COLORS.today.ringOpacity * 2.55).toString(16).padStart(2, '0')}`,
                        }),
                        ...(getDayColors(column.dayName).header && {
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
                          className="h-6 w-6 rounded-full flex-shrink-0 hover:bg-card/50 dark:hover:bg-muted/50"
                          onClick={() => handleAddTask(column.dateString)}
                          data-tour="add-task"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Task List - Droppable Zone */}
                    <DroppableColumn id={column.dateString} className="flex-1">
                      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                        <div 
                          className="p-2 sm:p-3 space-y-2 h-full"
                          style={{
                            backgroundColor: `${getDayColors(column.dayName).background}${Math.round(getDayColors(column.dayName).backgroundOpacity * 2.55).toString(16).padStart(2, '0')}`,
                          }}
                        >
                          <AnimatePresence mode="popLayout">
                            {dayTasks.length === 0 ? (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-12 text-center"
                              >
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                  <Plus className="w-6 h-6 text-primary/40" />
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">No tasks</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddTask(column.dateString)}
                                  className="rounded-full"
                                >
                                  Add task
                                </Button>
                              </motion.div>
                            ) : (
                              <>
                                {dayTasks.map((task) => (
                                  <DraggableTaskCard
                                    key={task.id}
                                    task={task}
                                    onClick={() => handleTaskClick(task)}
                                    droppableId={column.dateString}
                                  />
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

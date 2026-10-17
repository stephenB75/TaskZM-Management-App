import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { motion } from "motion/react";
import { calendarEventColorStyle } from "../lib/calendar-event-color";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useIsMobile } from "./ui/use-mobile";
import { CSS } from "@dnd-kit/utilities";
import { useTasks } from "../contexts/TaskContext";
import { useDragDrop } from "../contexts/DragDropContext";
import { useAuth } from "../contexts/AuthContext";
import { useCalendar } from "../contexts/CalendarContext";
import { useCalendarEventsByDate, type CalendarEvent } from "../hooks/useCalendarEvents";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { cn, prepareTaskForDialog, parseCalendarEventTime, getDateString, isSeriesBaseTask, hasSeriesOccurrenceForDate, dedupeTasksForDay, dateStringToLocalDate, getTaskSortTimeOnDay, getCalendarEventSortTimeOnDay, compareChronologicalItemsOnDay } from "../lib/utils";
import { isDateInRecurrence } from "../lib/recurrence";
import { DraggableTaskCard } from "./DraggableTaskCard";
import { TaskDialog } from "./TaskDialog";
import { toast } from '../lib/toast-wrapper';
import { MINUTES_PER_HOUR, RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED, RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS, RECURRENCE_SERIES_OCCURRENCE_SEPARATOR } from "../lib/business-constants";
import { getCheckboxSizePxForWidth, getCheckboxVisualSizePxForWidth, NAV_BAR_BOTTOM_PADDING_MOBILE, MOBILE_PADDING_BOTTOM, PANEL_PADDING_BOTTOM, ICON_SIZE_LG, ICON_SIZE_XS, ICON_SIZE_SM, MAIN_BG_GRADIENT_CLASS, VIEWPORT_BREAKPOINTS } from "../lib/layout-constants";
import { TASK_CARD_ICON_COLORS, MONTH_VIEW_TASK_PRIORITY_STYLES, MONTH_VIEW_LOW_PRIORITY_DARK_TEXT } from "../lib/task-card-constants";
import { useTheme } from "../contexts/ThemeContext";
import type { Task } from "../types";

interface MonthCalendarViewProps {
  mobileMode?: boolean;
  /** Month to show when the parent owns navigation. */
  date?: Date;
  /** Hide the built-in month header when the parent renders its own. */
  hideHeader?: boolean;
}

interface DayTasks {
  date: Date;
  tasks: Task[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

// Draggable Task Component for Month View
function DraggableMonthTask({
  task,
  onTaskClick,
  onToggleComplete,
}: {
  task: Task;
  onTaskClick: (task: Task) => void;
  onToggleComplete?: (task: Task) => void;
}) {
  const isMobile = useIsMobile();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";
  const [checkboxSizePx, setCheckboxSizePx] = useState(() => getCheckboxSizePxForWidth(typeof window !== "undefined" ? window.innerWidth : VIEWPORT_BREAKPOINTS.desktop));
  const [visualSizePx, setVisualSizePx] = useState(() => getCheckboxVisualSizePxForWidth(typeof window !== "undefined" ? window.innerWidth : VIEWPORT_BREAKPOINTS.desktop));
  useEffect(() => {
    const onResize = () => {
      setCheckboxSizePx(getCheckboxSizePxForWidth(window.innerWidth));
      setVisualSizePx(getCheckboxVisualSizePxForWidth(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id,
    disabled: isMobile, // Disable drag on mobile
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition ||
      "transform 250ms cubic-bezier(0.25, 0.8, 0.25, 1)",
    opacity: isDragging ? 0.7 : 1,
    touchAction: isMobile ? "auto" : "none", // Allow normal touch on mobile
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleComplete) {
      onToggleComplete(task);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isMobile ? {} : listeners)} // Only apply drag listeners on desktop
      className={cn(
        "text-xs p-1 rounded-r rounded-l-none border-l-[3px] transition-all relative select-none smooth-drag-transform",
        !isMobile && "cursor-grab hover:shadow-sm active:cursor-grabbing", // Only show drag cursor on desktop
        MONTH_VIEW_TASK_PRIORITY_STYLES[task.priority as keyof typeof MONTH_VIEW_TASK_PRIORITY_STYLES] ?? MONTH_VIEW_TASK_PRIORITY_STYLES.default,
        task.status === "done" && "opacity-60",
      )}
      data-dnd-kit-dragging={isDragging}
      data-sortable-id={task.id}
      title={task.title}
      onClick={(e) => {
        e.stopPropagation();
        onTaskClick(task);
      }}
    >
      <div className="flex items-start gap-1">
        <button
          onClick={handleToggleComplete}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex-shrink-0 hover:opacity-80 transition-opacity mt-0.5 flex items-center justify-center"
          style={{ minWidth: checkboxSizePx, minHeight: checkboxSizePx }}
          aria-label={task.status === "done" ? "Mark as incomplete" : "Mark as complete"}
        >
          <Icon name="circle"
            size={visualSizePx}
            className={cn(
              "transition-colors",
              task.status === "done"
                ? isDark ? `${TASK_CARD_ICON_COLORS.tab.dark} ${TASK_CARD_ICON_COLORS.tabCheckboxFill.dark}` : `${TASK_CARD_ICON_COLORS.tab.light} ${TASK_CARD_ICON_COLORS.tabCheckboxFill.light}`
                : "text-gray-300 hover:text-gray-400",
            )}
          />
        </button>
        <div className="flex items-start gap-0.5 flex-1 min-w-0">
          {task.priority === "urgent" && (
            <Icon name="alert-circle" size={ICON_SIZE_XS} className="text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "truncate font-medium leading-tight text-[11px]",
              task.status === "done"
                ? "line-through text-muted-foreground"
                : "text-foreground/90",
              (task.priority === "low" || !task.priority) && isDark && (task.status === "done" ? MONTH_VIEW_LOW_PRIORITY_DARK_TEXT.titleDone : MONTH_VIEW_LOW_PRIORITY_DARK_TEXT.title),
            )}>
              {task.title}
            </p>
            {task.scheduledDate && (
              <div className={cn(
                "flex items-center gap-0.5 mt-0.5",
                (task.priority === "low" || !task.priority) && isDark ? MONTH_VIEW_LOW_PRIORITY_DARK_TEXT.time : "text-muted-foreground",
              )}>
                <Icon name="clock" size={8} className="flex-shrink-0" />
                <span className="text-[9px] leading-none">
                  {new Date(
                    task.scheduledDate,
                  ).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
            )}
          </div>
          {/* Recurring icon in row 1 column 4 (end of row) */}
          {task.recurrence && task.recurrence.type !== "none" && (
            <Icon name="repeat" size={ICON_SIZE_SM} weight="duotone" className={cn("flex-shrink-0 mt-0.5", TASK_CARD_ICON_COLORS.body)} />
          )}
        </div>
      </div>
    </div>
  );
}

// Calendar Event Component for Month View (compact version)
interface CalendarEventData {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  calendarColor?: string;
  provider: 'google' | 'apple' | 'outlook';
  isRecurring?: boolean; // Flag indicating if this is a recurring event
}

function MonthCalendarEvent({ event }: { event: CalendarEventData }) {
  const startTime = parseCalendarEventTime(event.start).toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });

  return (
    <div
      className="planner-event-chip text-xs p-1 rounded-r rounded-l-none border-l-[3px] transition-all relative select-none"
      style={calendarEventColorStyle(event.calendarColor)}
      title={`${event.title}${event.location ? ` - ${event.location}` : ''}`}
    >
      <div className="flex items-start gap-1">
        <Icon name="calendar" size={ICON_SIZE_XS} weight="duotone" className="flex-shrink-0 mt-0.5 text-neutral-500 dark:text-neutral-400" />
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium leading-tight text-[11px] text-neutral-900 dark:text-neutral-100">
            {event.title}
          </p>
          <div className="flex items-center gap-0.5 mt-0.5">
            <Icon name="clock" size={8} className="flex-shrink-0 text-neutral-500 dark:text-neutral-400" />
            <span className="text-[9px] leading-none text-neutral-600 dark:text-neutral-300">
              {startTime}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Droppable Day Component
function DroppableDay({
  dayData,
  dateString,
  calendarEvents,
  onTaskClick,
  onToggleComplete,
  isExpanded,
  onExpandToggle,
}: {
  dayData: DayTasks;
  dateString: string;
  calendarEvents: CalendarEventData[];
  onTaskClick: (task: Task) => void;
  onToggleComplete?: (task: Task) => void;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}) {
  const isMobile = useIsMobile();
  const { setNodeRef, isOver } = useDroppable({
    id: dateString,
    disabled: isMobile, // Disable drop on mobile
  });

  // Combine and sort tasks and events by time
  type CombinedItem = 
    | { type: 'task'; data: Task; sortTime: number }
    | { type: 'event'; data: CalendarEventData; sortTime: number };
  
  const combinedItems: CombinedItem[] = [];
  const taskList = Array.isArray(dayData.tasks) ? dayData.tasks : [];
  const referenceDay = dateStringToLocalDate(dateString);
  
  // Add tasks (normalize to column day so recurring tasks sort by time-of-day)
  for (const task of taskList) {
    combinedItems.push({ type: 'task', data: task, sortTime: getTaskSortTimeOnDay(referenceDay, task) });
  }
  
  // Add calendar events (normalize to column day for mixed chronological sort)
  for (const event of calendarEvents) {
    combinedItems.push({ type: 'event', data: event, sortTime: getCalendarEventSortTimeOnDay(referenceDay, event.start) });
  }
  
  // Sort by time (earliest first; no-time tasks last; events before tasks at same time)
  combinedItems.sort((a, b) =>
    compareChronologicalItemsOnDay(
      a.sortTime,
      b.sortTime,
      a.data.id,
      b.data.id,
    ),
  );
  
  const totalItems = combinedItems.length;
  const showAllItems = isExpanded || totalItems <= 2;
  const visibleItems = showAllItems ? combinedItems : combinedItems.slice(0, 2);
  const remainingCount = totalItems - 2;

  return (
    <div ref={setNodeRef} className="w-full h-full">
      <Card
        className={cn(
          "h-full w-full p-0.5 md:p-1.5 relative overflow-hidden transition-all hover:shadow-md flex flex-col",
          dayData.isToday &&
            "ring-2 ring-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg",
          !dayData.isCurrentMonth && "opacity-50 bg-muted/30",
          isOver && "ring-2 ring-neutral-500 bg-neutral-500/10",
        )}
      >
        {/* Day number */}
        <div className="flex items-center justify-between mb-0.5 flex-shrink-0 px-0.5">
          <span
            className={cn(
              "text-[10px] md:text-xs font-medium text-foreground dark:text-gray-100",
              dayData.isToday &&
                "bg-primary text-primary-foreground rounded-full h-5 w-5 md:h-6 md:w-6 flex items-center justify-center shadow-md font-bold text-[10px] md:text-xs",
            )}
          >
            {dayData.date.getDate()}
          </span>
          {totalItems > 0 && (
            <div className="flex items-center gap-0.5">
              {taskList.length > 0 && (
                <Badge
                  variant="secondary"
                  className="h-3.5 md:h-4 text-[9px] md:text-[10px] px-0.5 md:px-1 bg-primary/10 text-primary dark:bg-primary/50 dark:text-primary-foreground flex-shrink-0"
                >
                  {taskList.length}
                </Badge>
              )}
              {calendarEvents.length > 0 && (
                <Badge
                  variant="secondary"
                  className="h-3.5 md:h-4 text-[9px] md:text-[10px] px-0.5 md:px-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex-shrink-0"
                >
                  {calendarEvents.length}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Combined Tasks and Events */}
        <SortableContext
          items={Array.isArray(dayData.tasks) ? dayData.tasks.map((t) => t?.id).filter(Boolean) : []}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
            {visibleItems.map((item, idx) => {
              if (item.type === 'event') {
                return (
                  <MonthCalendarEvent 
                    key={`event-${item.data.id}`} 
                    event={item.data} 
                  />
                );
              } else {
                return (
                  <DraggableMonthTask
                    key={item.data.id}
                    task={item.data}
                    onTaskClick={onTaskClick}
                    onToggleComplete={onToggleComplete}
                  />
                );
              }
            })}

            {!showAllItems && remainingCount > 0 && onExpandToggle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExpandToggle();
                }}
                className="text-[9px] text-center text-primary hover:text-primary/80 hover:underline dark:text-primary-foreground dark:hover:text-primary-foreground/90 py-0.5 flex-shrink-0 w-full transition-colors cursor-pointer"
              >
                +{remainingCount} more
              </button>
            )}
          </div>
        </SortableContext>
      </Card>
    </div>
  );
}

export function MonthCalendarView({
  mobileMode = false,
  date,
  hideHeader = false,
}: MonthCalendarViewProps) {
  const { tasks, updateTask } = useTasks();
  const { activeId } = useDragDrop();
  const { accessToken } = useAuth();
  const { calendarStatus } = useCalendar();
  const [internalDate, setCurrentDate] = useState(new Date());
  const currentDate = date ?? internalDate;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    null,
  );
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    new Set(),
  );
  const [calendarEventsByDate, setCalendarEventsByDate] = useState<Record<string, CalendarEventData[]>>({});
  const todayRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const calendarGridRef = useRef<HTMLDivElement>(null);

  // Fetch calendar events for the visible month using optimized hook
  const monthStartDate = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return new Date(year, month - 1, 1);
  }, [currentDate]);

  const monthEndDate = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return new Date(year, month + 2, 0);
  }, [currentDate]);

  const { eventsByDate: calendarEventsByDateData } = useCalendarEventsByDate(
    monthStartDate,
    monthEndDate,
    {
      enabled: !!accessToken,
      debounceMs: 300,
    }
  );

  // Convert to CalendarEventData format and update state
  useEffect(() => {
    const aggregated: Record<string, CalendarEventData[]> = {};
    
    for (const [dateKey, events] of Object.entries(calendarEventsByDateData)) {
      aggregated[dateKey] = events.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        location: event.location,
        provider: event.provider,
        calendarColor: event.calendarColor,
      }));
    }

    setCalendarEventsByDate(aggregated);
  }, [calendarEventsByDateData]);

  const goToPreviousMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    // Scroll to today after a brief delay to ensure rendering
    setTimeout(() => {
      todayRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }, 100);
  };

  // Auto-scroll to today when component mounts or when returning to current month
  useEffect(() => {
    const today = new Date();
    const isCurrentMonth =
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();

    if (isCurrentMonth && expandedDays.size === 0) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }, 300);
    }
  }, [currentDate, expandedDays.size]);

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

  const handleToggleComplete = (task: Task) => {
    updateTask(task.id, {
      status: task.status === "done" ? "todo" : "done",
      completedAt:
        task.status === "done"
          ? null
          : new Date().toISOString(),
    });
  };

  const getTasksForDate = (date: Date): Task[] => {
    // Defensive check: ensure tasks is an array
    if (!Array.isArray(tasks)) {
      console.warn('getTasksForDate: tasks is not an array', tasks);
      return [];
    }

    try {
      if (!date || isNaN(date.getTime())) {
        console.warn('getTasksForDate: Invalid date', date);
        return [];
      }

      const dateString = getDateString(date);
      const sorted = tasks
        .filter((task) => {
          // Defensive check: ensure task is valid
          if (!task || typeof task !== 'object') {
            return false;
          }
          try {
            if (task.id.includes(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS)) {
              return false;
            }
            // Show base only when no occurrence for this day; hide base when an occurrence exists (no duplicate).
            if (isSeriesBaseTask(task) && hasSeriesOccurrenceForDate(tasks, task.id, dateString)) return false;
            if (!task.id.includes(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR) && hasSeriesOccurrenceForDate(tasks, task.id, dateString)) return false;
            // Check if task matches this date (either exact match or recurrence pattern)
            if (!isDateInRecurrence(task, date)) return false;
            // Hide base when a completed occurrence exists for this day (show grayed occurrence only).
            if (task.recurrence && task.recurrence.type !== 'none') {
              const completedOccurrenceId = `${task.id}${RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED}${dateString}`;
              if (tasks.some((t) => t.id === completedOccurrenceId)) return false;
            }
            return true;
          } catch (error) {
            console.error('Error checking date in recurrence:', error, task);
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
            console.error('Error sorting tasks:', error, a, b);
            return 0;
          }
        });
      return dedupeTasksForDay(sorted, dateString);
    } catch (error) {
      console.error('Error in getTasksForDate:', error);
      return [];
    }
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Days to show from previous month
    const startDay = firstDay.getDay(); // 0 = Sunday

    // Days to show from next month
    const endDay = 6 - lastDay.getDay();

    const days: DayTasks[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(
        year,
        month - 1,
        prevMonthLastDay - i,
      );
      days.push({
        date,
        tasks: getTasksForDate(date),
        isToday: false,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);

      days.push({
        date,
        tasks: getTasksForDate(date),
        isToday: dateOnly.getTime() === today.getTime(),
        isCurrentMonth: true,
      });
    }

    // Next month days
    for (let day = 1; day <= endDay; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        tasks: getTasksForDate(date),
        isToday: false,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate, tasks]);

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const weekDays = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ];

  return (
    <div className={cn("flex flex-col", mobileMode ? "flex-1 min-h-0" : "h-full", MAIN_BG_GRADIENT_CLASS)} data-month-calendar="true" data-tour="month-calendar-view">
      {/* Calendar Header - dark mode: solid dark bar with light text/icons for visibility */}
      {!hideHeader && (
      <motion.div
        className="flex-shrink-0 px-4 py-3 border-b border-primary/10 bg-white/70 dark:bg-gray-800/95 dark:border-gray-700 backdrop-blur-md"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between text-foreground dark:text-gray-100">
          <div className="flex items-center gap-3">
            <Icon name="calendar" size={ICON_SIZE_LG} className="text-primary dark:text-primary" weight="duotone" />
            <h2 className="text-lg font-semibold">
              {monthName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="rounded-full text-xs dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousMonth}
                className="h-8 w-8 rounded-full dark:text-gray-200 dark:hover:bg-white/10"
              >
                <Icon name="chevron-left" size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextMonth}
                className="h-8 w-8 rounded-full dark:text-gray-200 dark:hover:bg-white/10"
              >
                <Icon name="chevron-right" size={16} />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {/* Calendar Grid */}
      <div className={cn("flex-1 px-1 py-2 md:p-3", !mobileMode && "overflow-hidden")}>
        <div className={cn("w-full flex flex-col", mobileMode ? "min-h-0" : "h-full")}>
          <div className="flex flex-col h-full">
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-0 md:gap-2 mb-1 md:mb-2 flex-shrink-0 w-full">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-[10px] md:text-sm font-medium text-muted-foreground py-1 md:py-2 w-full truncate"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="flex-1 min-h-0">
              {/* On mobile, rely on parent scroll container - no ScrollArea */}
              {mobileMode ? (
                <div 
                  ref={calendarGridRef}
                  className={cn(
                    "grid grid-cols-7 gap-0 md:gap-1.5 w-full"
                  )}
                  style={{
                    paddingBottom: MOBILE_PADDING_BOTTOM, // Small visual spacing - nav bar clearance handled by spacer in App.tsx
                  }}
                >
              {calendarDays.map((dayData, index) => {
                const dateString = dayData.date
                  .toISOString()
                  .split("T")[0];
                return (
                  <motion.div
                    key={`${dayData.date.toISOString()}-${index}`}
                    ref={dayData.isToday ? todayRef : null}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.01 }}
                    className="min-h-[90px] md:min-h-[100px] w-full aspect-square md:aspect-auto"
                  >
                    <DroppableDay
                      dayData={dayData}
                      dateString={dateString}
                      calendarEvents={calendarEventsByDate[dateString] || []}
                      onTaskClick={handleTaskClick}
                      onToggleComplete={handleToggleComplete}
                      isExpanded={expandedDays.has(dateString)}
                      onExpandToggle={() => {
                        setExpandedDays((prev) => {
                          const next = new Set(prev);
                          if (next.has(dateString)) {
                            next.delete(dateString);
                          } else {
                            next.add(dateString);
                          }
                          return next;
                        });
                      }}
                    />
                  </motion.div>
                );
              })}
                </div>
              ) : (
              <ScrollArea ref={scrollAreaRef} className="h-full w-full">
                <div 
                  ref={calendarGridRef}
                  className={cn(
                    "grid grid-cols-7 gap-0 md:gap-1.5 pb-4 w-full"
                  )}
                  style={{ paddingBottom: PANEL_PADDING_BOTTOM }}
                >
              {calendarDays.map((dayData, index) => {
                const dateString = dayData.date
                  .toISOString()
                  .split("T")[0];
                return (
                  <motion.div
                    key={`${dayData.date.toISOString()}-${index}`}
                    ref={dayData.isToday ? todayRef : null}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.01 }}
                    className="min-h-[90px] md:min-h-[100px] w-full aspect-square md:aspect-auto"
                  >
                    <DroppableDay
                      dayData={dayData}
                      dateString={dateString}
                      calendarEvents={calendarEventsByDate[dateString] || []}
                      onTaskClick={handleTaskClick}
                      onToggleComplete={handleToggleComplete}
                      isExpanded={expandedDays.has(dateString)}
                      onExpandToggle={() => {
                        setExpandedDays((prev) => {
                          const next = new Set(prev);
                          if (next.has(dateString)) {
                            next.delete(dateString);
                          } else {
                            next.add(dateString);
                          }
                          return next;
                        });
                      }}
                    />
                  </motion.div>
                );
              })}
                </div>
              </ScrollArea>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-specific info panel */}
      {mobileMode && (
        <motion.div
          className="flex-shrink-0 p-3 border-t border-primary/10 bg-white/70 dark:bg-gray-800/95 dark:border-gray-700 dark:text-gray-200 backdrop-blur-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-gray-300">
            <span>Drag tasks between days</span>
            <Badge variant="outline" className="text-xs">
              {Array.isArray(tasks) ? tasks.filter((t) => t?.scheduledDate).length : 0}{" "}
              scheduled
            </Badge>
          </div>
        </motion.div>
      )}

      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
      />
    </div>
  );
}
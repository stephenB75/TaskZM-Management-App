import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import { motion } from "motion/react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTasks } from "../contexts/TaskContext";
import { useDragDrop } from "../contexts/DragDropContext";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  Repeat,
  Circle,
  ZoomOut,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { cn, prepareTaskForDialog } from "../lib/utils";
import { isDateInRecurrence } from "../lib/recurrence";
import { DraggableTaskCard } from "./DraggableTaskCard";
import { TaskDialog } from "./TaskDialog";
import { toast } from "sonner";
import type { Task } from "../types";

interface MonthCalendarViewProps {
  mobileMode?: boolean;
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition ||
      "transform 250ms cubic-bezier(0.25, 0.8, 0.25, 1)",
    opacity: isDragging ? 0.7 : 1,
  };

  const priorityColors = {
    urgent: "border-l-red-400 bg-red-50 dark:bg-red-950/20",
    high: "border-l-orange-400 bg-orange-50 dark:bg-orange-950/20",
    medium: "border-l-blue-400 bg-blue-50 dark:bg-blue-950/20",
    low: "border-l-gray-400 bg-gray-50 dark:bg-muted/20",
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
      {...listeners}
      className={cn(
        "text-xs p-1 rounded border-l-2 cursor-grab hover:shadow-sm transition-all relative active:cursor-grabbing select-none smooth-drag-transform",
        priorityColors[task.priority],
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
          className="flex-shrink-0 w-3 h-3 hover:opacity-80 transition-opacity mt-0.5"
          aria-label={task.status === "done" ? "Mark as incomplete" : "Mark as complete"}
        >
          <Circle
            className={cn(
              "w-3 h-3 transition-colors",
              task.status === "done"
                ? "text-primary fill-primary"
                : "text-gray-300 hover:text-gray-400",
            )}
          />
        </button>
        <div className="flex items-start gap-0.5 flex-1 min-w-0">
          {task.priority === "urgent" && (
            <AlertCircle className="w-2.5 h-2.5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          {task.recurrence && task.recurrence.type !== "none" && (
            <Repeat className="w-2.5 h-2.5 text-primary flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "truncate font-medium leading-tight text-[11px]",
              task.status === "done"
                ? "line-through text-muted-foreground"
                : "text-foreground/90",
            )}>
              {task.title}
            </p>
            {task.scheduledDate && (
              <div className="flex items-center gap-0.5 text-muted-foreground mt-0.5">
                <Clock className="w-2 h-2 flex-shrink-0" />
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
        </div>
      </div>
    </div>
  );
}

// Droppable Day Component
function DroppableDay({
  dayData,
  dateString,
  onTaskClick,
  onToggleComplete,
  isExpanded,
  onExpandToggle,
}: {
  dayData: DayTasks;
  dateString: string;
  onTaskClick: (task: Task) => void;
  onToggleComplete?: (task: Task) => void;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateString,
  });

  const showAllTasks = isExpanded || dayData.tasks.length <= 2;
  const visibleTasks = showAllTasks ? dayData.tasks : dayData.tasks.slice(0, 2);
  const remainingCount = dayData.tasks.length - 2;

  return (
    <div ref={setNodeRef} className="w-full h-full">
      <Card
        className={cn(
          "h-full w-full p-0.5 md:p-1.5 relative overflow-hidden transition-all hover:shadow-md flex flex-col",
          dayData.isToday &&
            "ring-2 ring-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg",
          !dayData.isCurrentMonth && "opacity-50 bg-muted/30",
          isOver && "ring-2 ring-[#7B68EE] bg-[#7B68EE]/10",
        )}
      >
        {/* Day number */}
        <div className="flex items-center justify-between mb-0.5 flex-shrink-0 px-0.5">
          <span
            className={cn(
              "text-[10px] md:text-xs font-medium",
              dayData.isToday &&
                "bg-primary text-primary-foreground rounded-full h-5 w-5 md:h-6 md:w-6 flex items-center justify-center shadow-md font-bold text-[10px] md:text-xs",
            )}
          >
            {dayData.date.getDate()}
          </span>
          {dayData.tasks.length > 0 && (
            <Badge
              variant="secondary"
              className="h-3.5 md:h-4 text-[9px] md:text-[10px] px-0.5 md:px-1 bg-primary/10 text-primary flex-shrink-0"
            >
              {dayData.tasks.length}
            </Badge>
          )}
        </div>

        {/* Tasks */}
        <SortableContext
          items={Array.isArray(dayData.tasks) ? dayData.tasks.map((t) => t?.id).filter(Boolean) : []}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
            {(Array.isArray(visibleTasks) ? visibleTasks : []).map((task) => (
              <DraggableMonthTask
                key={task.id}
                task={task}
                onTaskClick={onTaskClick}
                onToggleComplete={onToggleComplete}
              />
            ))}

            {!showAllTasks && remainingCount > 0 && onExpandToggle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExpandToggle();
                }}
                className="text-[9px] text-center text-primary hover:text-primary/80 hover:underline py-0.5 flex-shrink-0 w-full transition-colors cursor-pointer"
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
}: MonthCalendarViewProps) {
  const { tasks, updateTask } = useTasks();
  const { activeId } = useDragDrop();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    null,
  );
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    new Set(),
  );
  const todayRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const calendarGridRef = useRef<HTMLDivElement>(null);

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

  const zoomOut = () => {
    setExpandedDays(new Set());
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

  // On desktop, when any day is expanded, zoom out to show full month
  useEffect(() => {
    if (!mobileMode && expandedDays.size > 0) {
      // Scroll to top to show entire calendar
      setTimeout(() => {
        if (scrollAreaRef.current) {
          // Try multiple ways to access the scroll container
          const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (scrollElement) {
            scrollElement.scrollTo({
              top: 0,
              behavior: 'smooth',
            });
          } else {
            // Fallback: try direct scroll
            const scrollContainer = scrollAreaRef.current.querySelector('.overflow-auto') || scrollAreaRef.current;
            (scrollContainer as HTMLElement)?.scrollTo?.({
              top: 0,
              behavior: 'smooth',
            });
          }
        }
      }, 150);
    }
  }, [expandedDays.size, mobileMode]);
  const handleTaskClick = (task: Task) => {
    console.log('MonthCalendarView: handleTaskClick called with task:', task);
    try {
      if (!task || !task.id) {
        console.error('Invalid task passed to handleTaskClick:', task);
        toast.error('Invalid task data');
        return;
      }
      
      const safeTask = prepareTaskForDialog(task);
      if (!safeTask) {
        console.error('prepareTaskForDialog returned null for task:', task);
        toast.error('Invalid task data');
        return;
      }
      
      console.log('MonthCalendarView: Setting selected task and opening dialog:', safeTask);
      setSelectedTask(safeTask);
      setDialogOpen(true);
    } catch (error) {
      console.error('Error opening task:', error, task);
      toast.error('Failed to open task');
    }
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

      return tasks
        .filter((task) => {
          // Defensive check: ensure task is valid
          if (!task || typeof task !== 'object') {
            return false;
          }
          try {
            // Check if task matches this date (either exact match or recurrence pattern)
            return isDateInRecurrence(task, date);
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
            
            // Extract time of day in minutes (hours * 60 + minutes)
            const timeOfDayA = dateA.getHours() * 60 + dateA.getMinutes();
            const timeOfDayB = dateB.getHours() * 60 + dateB.getMinutes();
            
            return timeOfDayA - timeOfDayB;
          } catch (error) {
            console.error('Error sorting tasks:', error, a, b);
            return 0;
          }
        });
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
    <div className="h-full flex flex-col bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" data-month-calendar="true">
      {/* Calendar Header */}
      <motion.div
        className="flex-shrink-0 px-4 py-3 border-b border-primary/10 bg-white/70 dark:bg-background/70 backdrop-blur-md"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {monthName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="rounded-full text-xs"
            >
              Today
            </Button>
            {!mobileMode && expandedDays.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={zoomOut}
                className="rounded-full text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                title="Zoom out to normal view"
              >
                <ZoomOut className="w-3.5 h-3.5" />
                Zoom Out
              </Button>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousMonth}
                className="h-8 w-8 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextMonth}
                className="h-8 w-8 rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden px-1 py-2 md:p-3">
        <div className="h-full flex flex-col w-full">
          {/* Wrapper that includes both headers and calendar days for zoom */}
          <div 
            className={cn(
              "flex flex-col h-full transition-transform duration-500 ease-in-out",
              // On desktop, zoom out when any day is expanded to show full month
              !mobileMode && expandedDays.size > 0 && "scale-[0.82] origin-top"
            )}
          >
            {/* Week day headers - now included in zoom */}
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
              <ScrollArea ref={scrollAreaRef} className="h-full w-full">
                <div 
                  ref={calendarGridRef}
                  className={cn(
                    "grid grid-cols-7 gap-0 md:gap-1.5 pb-4 w-full"
                  )}
                  style={{
                    // Adjust padding when scaled to maintain proper spacing
                    paddingBottom: !mobileMode && expandedDays.size > 0 ? '2rem' : '1rem',
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
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.01 }}
                    className="min-h-[90px] md:min-h-[100px] w-full aspect-square md:aspect-auto"
                  >
                    <DroppableDay
                      dayData={dayData}
                      dateString={dateString}
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
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-specific info panel */}
      {mobileMode && (
        <motion.div
          className="flex-shrink-0 p-3 border-t border-primary/10 bg-white/70 dark:bg-background/70 backdrop-blur-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
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
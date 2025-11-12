import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { TodayAgendaView } from "./TodayAgendaView";
import { SevenDayKanban } from "./SevenDayKanban";
import { MonthCalendarView } from "./MonthCalendarView";
import {
  Sparkles,
  Calendar,
  CalendarDays,
  Clock,
  Target,
  Brain,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { AIRecommendationPanel } from "./AIRecommendationPanel";
import { AppHeader } from "./AppHeader";
import { useTasks } from "../contexts/TaskContext";
import { useAIScheduler, type ScheduleResult } from "../hooks/useAIScheduler";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import type { Task } from "../types";

interface DashboardViewProps {
  mobileView: "today" | "week";
  onMobileViewChange: (view: "today" | "week") => void;
  aiPanelOpen: boolean;
  onAiPanelChange: (open: boolean) => void;
  hideAgenda?: boolean;
}

interface SchedulePlan {
  task: Task;
  scheduledDate: Date;
  reason?: string;
}

// Mini Calendar Component for AI Re-scheduler (matching TaskDialog style)
function RescheduleMiniCalendar({
  rescheduleType,
  rescheduleDate,
  onTypeChange,
  onDateSelect,
}: {
  rescheduleType: "day" | "week" | "month";
  rescheduleDate: Date | undefined;
  onTypeChange: (type: "day" | "week" | "month") => void;
  onDateSelect: (date: Date | undefined) => void;
}) {
  const [viewDate, setViewDate] = useState(() => {
    try {
      if (rescheduleDate && rescheduleDate instanceof Date && !isNaN(rescheduleDate.getTime())) {
        return rescheduleDate;
      }
      return new Date();
    } catch (error) {
      console.error('Error initializing viewDate:', error);
      return new Date();
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sync view date when rescheduleDate changes
  useEffect(() => {
    try {
      if (rescheduleDate && rescheduleDate instanceof Date && !isNaN(rescheduleDate.getTime())) {
        setViewDate(rescheduleDate);
      }
    } catch (error) {
      console.error('Error syncing viewDate:', error);
    }
  }, [rescheduleDate]);

  // Generate days for the current month view
  const getDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay(); // 0 = Sunday
    
    const days: Date[] = [];
    const startDate = new Date(year, month, 1);
    
    // Adjust to start from a Sunday
    const daysToSubtract = startDay;
    startDate.setDate(startDate.getDate() - daysToSubtract);
    
    // Generate 35 days (5 weeks) for a full calendar grid
    for (let i = 0; i < 35; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    
    return days;
  };

  const days = getDays();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const goToPreviousMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setViewDate(new Date());
  };

  const isToday = (date: Date) => {
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    try {
      if (!rescheduleDate || !(rescheduleDate instanceof Date) || isNaN(rescheduleDate.getTime())) {
        return false;
      }
      return date.getDate() === rescheduleDate.getDate() &&
             date.getMonth() === rescheduleDate.getMonth() &&
             date.getFullYear() === rescheduleDate.getFullYear();
    } catch (error) {
      console.error('Error checking if date is selected:', error);
      return false;
    }
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === viewDate.getMonth() &&
           date.getFullYear() === viewDate.getFullYear();
  };

  const isDisabled = (date: Date) => {
    return date < today;
  };

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handleDateClick = (date: Date) => {
    if (isDisabled(date)) return;
    try {
      onDateSelect(date);
    } catch (error) {
      console.error('Error selecting date:', error);
    }
  };

  const getDisplayDate = () => {
    if (!rescheduleDate) return null;
    
    try {
      if (rescheduleType === "week") {
        const monday = new Date(rescheduleDate);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        return `Week starting: ${monday.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}`;
      } else if (rescheduleType === "month") {
        return rescheduleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else {
        return rescheduleDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch (error) {
      console.error('Error formatting display date:', error);
      return null;
    }
  };

  return (
    <div className="w-full bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border-2 border-primary/30 shadow-lg">
      {/* Toggle Buttons */}
      <div className="flex gap-2 mb-3">
        <Button
          type="button"
          variant={rescheduleType === "day" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            try {
              onTypeChange("day");
            } catch (error) {
              console.error('Error changing type to day:', error);
            }
          }}
          className={cn(
            "flex-1 text-xs h-8",
            rescheduleType === "day"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          )}
        >
          <Calendar className="w-3.5 h-3.5 mr-1.5" />
          Day
        </Button>
        <Button
          type="button"
          variant={rescheduleType === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            try {
              onTypeChange("week");
            } catch (error) {
              console.error('Error changing type to week:', error);
            }
          }}
          className={cn(
            "flex-1 text-xs h-8",
            rescheduleType === "week"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          )}
        >
          <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
          Week
        </Button>
        <Button
          type="button"
          variant={rescheduleType === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            try {
              onTypeChange("month");
            } catch (error) {
              console.error('Error changing type to month:', error);
            }
          }}
          className={cn(
            "flex-1 text-xs h-8",
            rescheduleType === "month"
              ? "bg-primary text-primary-foreground"
              : "border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          )}
        >
          <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
          Month
        </Button>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          className="h-7 w-7"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{monthName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="h-6 px-2 text-xs text-primary hover:bg-primary/10"
          >
            Today
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="h-7 w-7"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid - showing 35 days (5 weeks) */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const dateStr = date.toISOString().split('T')[0];
          const day = date.getDate();
          const isTodayDate = isToday(date);
          const isSelectedDate = isSelected(date);
          const isCurrentMonthDate = isCurrentMonth(date);
          const isDisabledDate = isDisabled(date);

          return (
            <button
              key={`${dateStr}-${index}`}
              type="button"
              onClick={() => handleDateClick(date)}
              disabled={isDisabledDate}
              className={cn(
                "h-8 w-8 rounded-md text-xs font-medium transition-all hover:scale-110",
                isDisabledDate
                  ? "text-muted-foreground/30 cursor-not-allowed opacity-50"
                  : isSelectedDate
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                  : isTodayDate
                  ? "bg-primary/20 text-primary font-bold ring-1 ring-primary/30 hover:bg-primary/30"
                  : isCurrentMonthDate
                  ? "text-foreground hover:bg-primary/10"
                  : "text-muted-foreground/50 hover:bg-muted/50"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected date info */}
      {rescheduleDate && (
        <div className="mt-3 pt-3 border-t border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">
              {getDisplayDate()}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDateSelect(undefined)}
            className="h-6 px-2 text-xs"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

export function DashboardView({
  mobileView,
  onMobileViewChange,
  aiPanelOpen,
  onAiPanelChange,
  hideAgenda = false,
}: DashboardViewProps) {
  const { tasks, updateTask } = useTasks();
  const { rescheduleDay, rescheduleWeek, rescheduleMonth, getScheduledTasksForDay, getScheduledTasksForWeek, getScheduledTasksForMonth } = useAIScheduler();
  const [viewMode, setViewMode] = useState<"week" | "month">(
    "week",
  );
  const [showSchedulePreview, setShowSchedulePreview] =
    useState(false);
  const [schedulePlan, setSchedulePlan] = useState<
    SchedulePlan[]
  >([]);
  const [mobileDayIndex, setMobileDayIndex] = useState(0);
  const [mobileWeekOffset, setMobileWeekOffset] = useState(0);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleType, setRescheduleType] = useState<"day" | "week" | "month" | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Generate week columns for mobile day selector with week offset
  const getWeekColumns = (weekOffset = 0) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1 + weekOffset * 7);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(tomorrow);
      date.setDate(tomorrow.getDate() + i);

      const dayOfWeek = date.getDay();
      const dayNames = [
        "SUN",
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
        "SAT",
      ];

      return {
        date,
        dayName: dayNames[dayOfWeek],
        dateString: date.toISOString().split("T")[0],
      };
    });
  };

  const weekColumns = getWeekColumns(mobileWeekOffset);

  const handleWeekChange = (direction: "prev" | "next") => {
    if (direction === "next") {
      setMobileWeekOffset((prev) => prev + 1);
    } else {
      setMobileWeekOffset((prev) => Math.max(0, prev - 1));
    }
    setMobileDayIndex(0); // Reset to first day when changing weeks
  };

  const getTasksForDay = (dateString: string) => {
    return tasks.filter((task) => {
      if (!task.scheduledDate) return false;
      try {
        const taskDate = new Date(task.scheduledDate);
        if (isNaN(taskDate.getTime())) return false;
        return (
          taskDate.toISOString().split("T")[0] === dateString
        );
      } catch {
        return false;
      }
    });
  };

  const handleScheduleUnscheduledTasks = () => {
    const unscheduledTasks = tasks.filter(
      (t) => !t.scheduledDate && t.status !== "done",
    );

    if (unscheduledTasks.length === 0) {
      toast.info("No unscheduled tasks found", {
        description: "All your tasks are already scheduled!",
      });
      return;
    }

    // Sort tasks by priority and status for intelligent scheduling
    const sortedTasks = [...unscheduledTasks].sort((a, b) => {
      // Priority weights: urgent=4, high=3, medium=2, low=1
      const priorityWeight = {
        urgent: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      const aPriority = priorityWeight[a.priority] || 1;
      const bPriority = priorityWeight[b.priority] || 1;

      // Status weights: on-hold=1, todo=2, in-progress=3
      const statusWeight = {
        "on-hold": 1,
        todo: 2,
        "in-progress": 3,
        done: 0,
      };
      const aStatus = statusWeight[a.status] || 0;
      const bStatus = statusWeight[b.status] || 0;

      // First sort by status (in-progress first)
      if (aStatus !== bStatus) return bStatus - aStatus;

      // Then by priority
      if (aPriority !== bPriority) return bPriority - aPriority;

      // Then by due date (if exists)
      if (a.dueDate && b.dueDate) {
        return (
          new Date(a.dueDate).getTime() -
          new Date(b.dueDate).getTime()
        );
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      return 0;
    });

    const plan: SchedulePlan[] = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    let currentDay = new Date(tomorrow);
    let tasksScheduledToday = 0;
    const maxTasksPerDay = 3;

    sortedTasks.forEach((task) => {
      // Determine scheduling based on priority and status
      let daysToAdd = 0;
      let reason = "";

      if (task.status === "in-progress") {
        daysToAdd = 0;
        reason = "In-progress - scheduled ASAP";
      } else if (task.priority === "urgent") {
        daysToAdd = 0;
        reason = "Urgent priority - scheduled for tomorrow";
      } else if (task.priority === "high") {
        daysToAdd =
          tasksScheduledToday >= maxTasksPerDay ? 1 : 0;
        reason =
          daysToAdd === 0
            ? "High priority - scheduled soon"
            : "High priority - next available slot";
      } else if (task.priority === "medium") {
        daysToAdd = Math.floor(tasksScheduledToday / 2) + 1;
        reason = "Medium priority - balanced schedule";
      } else {
        daysToAdd = Math.floor(tasksScheduledToday / 2) + 2;
        reason = "Low priority - scheduled for later";
      }

      // Check if task has a due date and adjust if needed
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const suggestedDate = new Date(tomorrow);
        suggestedDate.setDate(
          suggestedDate.getDate() + daysToAdd,
        );

        // If suggested date is after due date, schedule closer to due date
        if (suggestedDate > dueDate) {
          const daysDiff = Math.max(
            0,
            Math.floor(
              (dueDate.getTime() - tomorrow.getTime()) /
                (1000 * 60 * 60 * 24),
            ) - 1,
          );
          daysToAdd = Math.max(0, daysDiff);
          reason = "Due date approaching - prioritized";
        }
      }

      // Calculate time slot based on priority and estimated time
      let timeSlot = tasksScheduledToday % maxTasksPerDay;
      const scheduleDate = new Date(tomorrow);
      scheduleDate.setDate(scheduleDate.getDate() + daysToAdd);

      // Schedule urgent/in-progress tasks in the morning
      if (
        task.status === "in-progress" ||
        task.priority === "urgent"
      ) {
        scheduleDate.setHours(9, 0, 0, 0);
      } else if (task.priority === "high") {
        const hourOffset =
          timeSlot === 0 ? 0 : timeSlot === 1 ? 2 : 4;
        scheduleDate.setHours(9 + hourOffset, 0, 0, 0);
      } else {
        const hourOffset =
          timeSlot === 0 ? 2 : timeSlot === 1 ? 4 : 6;
        scheduleDate.setHours(9 + hourOffset, 0, 0, 0);
      }

      plan.push({ task, scheduledDate: scheduleDate, reason });
      tasksScheduledToday++;
    });

    setSchedulePlan(plan);
    setShowSchedulePreview(true);
  };

  const confirmScheduling = () => {
    schedulePlan.forEach(({ task, scheduledDate }) => {
      updateTask(task.id, {
        scheduledDate: scheduledDate.toISOString(),
      });
    });

    toast.success(
      `Successfully scheduled ${schedulePlan.length} task${schedulePlan.length === 1 ? "" : "s"}!`,
      {
        description:
          "Your tasks are now distributed across upcoming days",
        duration: 3000,
      },
    );

    setShowSchedulePreview(false);
    setSchedulePlan([]);
  };

  const formatScheduleDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleRandomReschedule = async (type: "day" | "week" | "month", selectedDate?: Date) => {
    if (!selectedDate) {
      toast.error("Please select a date", {
        description: "You must select a specific date, week, or month to reschedule.",
        duration: 3000,
      });
      return;
    }

    // Validate date
    if (!(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
      toast.error("Invalid date selected", {
        description: "Please select a valid date.",
        duration: 3000,
      });
      return;
    }

    setIsRescheduling(true);
    setShowRescheduleDialog(false);
    
    try {
      let result: ScheduleResult | undefined;
      let taskCount = 0;
      let description = "";

      try {
        if (type === "day") {
          const targetDate = new Date(selectedDate);
          targetDate.setHours(0, 0, 0, 0);
          
          taskCount = getScheduledTasksForDay(targetDate).length;
          if (taskCount === 0) {
            toast.info("No tasks found", {
              description: `No scheduled tasks found for ${targetDate.toLocaleDateString()}`,
              duration: 3000,
            });
            setIsRescheduling(false);
            return;
          }
          
          result = await rescheduleDay(targetDate);
          description = `Rescheduled ${result?.scheduled?.length || 0} task${(result?.scheduled?.length || 0) === 1 ? '' : 's'} for ${targetDate.toLocaleDateString()}`;
        } else if (type === "week") {
          // Calculate Monday of the selected week
          const monday = new Date(selectedDate);
          const day = monday.getDay();
          const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
          monday.setDate(diff);
          monday.setHours(0, 0, 0, 0);
          
          taskCount = getScheduledTasksForWeek(monday).length;
          if (taskCount === 0) {
            toast.info("No tasks found", {
              description: `No scheduled tasks found for the week starting ${monday.toLocaleDateString()}`,
              duration: 3000,
            });
            setIsRescheduling(false);
            return;
          }
          
          result = await rescheduleWeek(monday);
          description = `Rescheduled ${result?.scheduled?.length || 0} task${(result?.scheduled?.length || 0) === 1 ? '' : 's'} for the week starting ${monday.toLocaleDateString()}`;
        } else {
          // Use first day of the selected month
          const targetMonth = new Date(selectedDate);
          targetMonth.setDate(1);
          targetMonth.setHours(0, 0, 0, 0);
          
          taskCount = getScheduledTasksForMonth(targetMonth).length;
          if (taskCount === 0) {
            toast.info("No tasks found", {
              description: `No scheduled tasks found for ${targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
              duration: 3000,
            });
            setIsRescheduling(false);
            return;
          }
          
          result = await rescheduleMonth(targetMonth);
          description = `Rescheduled ${result?.scheduled?.length || 0} task${(result?.scheduled?.length || 0) === 1 ? '' : 's'} for ${targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        }
      } catch (rescheduleError) {
        console.error(`Error during ${type} reschedule:`, rescheduleError);
        throw rescheduleError;
      }

      // Ensure result exists and has expected structure
      if (!result || typeof result !== 'object') {
        throw new Error("Invalid result from reschedule function");
      }

      // Safely access result properties with defaults
      const scheduledCount = result.scheduled?.length || 0;
      const exceedsLimitCount = result.exceedsLimit?.length || 0;
      const daysExceedingLimitCount = result.daysExceedingLimit?.length || 0;

      // Check if any tasks exceeded the limit (couldn't be scheduled)
      if (exceedsLimitCount > 0) {
        toast.warning(
          `${exceedsLimitCount} task${exceedsLimitCount === 1 ? '' : 's'} could not be rescheduled`,
          {
            description: "These tasks exceed the 5-hour daily limit and need manual scheduling.",
            duration: 5000,
          }
        );
      }

      // Check if any days exceed 5 hours
      if (daysExceedingLimitCount > 0) {
        toast.warning(
          `${daysExceedingLimitCount} day${daysExceedingLimitCount === 1 ? '' : 's'} exceed${daysExceedingLimitCount === 1 ? 's' : ''} the 5-hour limit`,
          {
            description: "Some tasks may need manual adjustment.",
            duration: 5000,
          }
        );
      }

      if (scheduledCount > 0) {
        toast.success(`Rescheduled ${scheduledCount} task${scheduledCount === 1 ? '' : 's'}!`, {
          description,
          duration: 4000,
        });
      } else if (exceedsLimitCount === 0 && daysExceedingLimitCount === 0) {
        toast.info("No tasks were rescheduled", {
          description: "No scheduled tasks were found for the selected period.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Rescheduling error:", error);
      toast.error("Rescheduling failed", {
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        duration: 4000,
      });
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header - Using AppHeader for consistency */}
      <AppHeader
        title="Dashboard"
        description={viewMode === "week" ? "Week View" : "Month View"}
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle - Desktop Only */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 border border-primary/10">
              <Calendar
                className={cn(
                  "w-4 h-4 transition-colors",
                  viewMode === "week"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  viewMode === "week"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                Week
              </span>
              <Switch
                checked={viewMode === "month"}
                onCheckedChange={(checked) =>
                  setViewMode(checked ? "month" : "week")
                }
                className="mx-1"
              />
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  viewMode === "month"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                Month
              </span>
              <CalendarDays
                className={cn(
                  "w-4 h-4 transition-colors",
                  viewMode === "month"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
            </div>

            {/* AI Scheduler Buttons - Desktop Only */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScheduleUnscheduledTasks}
                className="rounded-full bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7] border-primary/20 hover:from-[#C9E4F7] hover:to-[#E6D5F0] transition-all whitespace-nowrap"
                data-tour="ai-scheduler"
              >
                <Sparkles className="w-4 h-4 mr-2 text-primary flex-shrink-0" />
                AI Scheduler Suggestions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    setShowRescheduleDialog(true);
                  } catch (error) {
                    console.error('Error opening reschedule dialog:', error);
                    toast.error('Failed to open reschedule dialog', {
                      description: 'Please try again',
                      duration: 3000,
                    });
                  }
                }}
                className="rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 hover:from-primary/20 hover:to-primary/10 transition-all"
                disabled={isRescheduling}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2 text-primary", isRescheduling && "animate-spin")} />
                Re-schedule
              </Button>
            </div>
          </div>
        }
      />
      {/* Spacer for fixed header on mobile - accounts for header height + border */}
      <div className="md:hidden h-[73px] flex-shrink-0" />

      {/* Mobile Day Selector - Only show on mobile when viewing week */}
      {mobileView === "week" && (
        <div className="lg:hidden border-b border-primary/10">
          <div className="px-1 py-2 sm:px-2">
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
              {/* Previous Week Button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleWeekChange("prev")}
                disabled={mobileWeekOffset === 0}
                className="h-8 w-8 flex-shrink-0 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {/* Scrollable Day Selector */}
              <div className="flex-1 overflow-x-auto scrollbar-hide min-w-0">
                <div className="flex gap-0.5 sm:gap-1.5">
                  {weekColumns.map((column, index) => {
                    const isSelected =
                      index === mobileDayIndex;
                    const dayTasks = getTasksForDay(
                      column.dateString,
                    );

                    return (
                      <button
                        key={column.dateString}
                        onClick={() =>
                          setMobileDayIndex(index)
                        }
                        className={cn(
                          "flex flex-col items-center justify-center px-1.5 py-1.5 sm:px-2.5 sm:py-2 rounded-xl transition-all flex-shrink-0 w-[calc((100%-12px)/7)] sm:w-auto sm:min-w-[48px]",
                          isSelected
                            ? "bg-gradient-to-br from-[#E6D5F0] to-[#C9E4F7] text-primary shadow-md border-2 border-primary/30"
                            : "bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 border border-transparent",
                        )}
                      >
                        <span
                          className={cn(
                            "text-[9px] sm:text-[10px] uppercase tracking-wide mb-0.5 sm:mb-1 leading-tight",
                            isSelected
                              ? "font-semibold"
                              : "text-muted-foreground font-medium",
                          )}
                        >
                          {column.dayName}
                        </span>
                        <span
                          className={cn(
                            "text-sm sm:text-base font-semibold leading-none",
                            isSelected
                              ? "text-primary"
                              : "text-foreground",
                          )}
                        >
                          {column.date.getDate()}
                        </span>
                        {dayTasks.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5 sm:mt-1">
                            {Array.from({
                              length: Math.min(
                                dayTasks.length,
                                3,
                              ),
                            }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full",
                                  isSelected
                                    ? "bg-primary"
                                    : "bg-primary/40",
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Next Week Button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleWeekChange("next")}
                className="h-8 w-8 flex-shrink-0 rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Desktop: Today Agenda Sidebar - only show when hideAgenda is false */}
        {!hideAgenda && (
          <motion.div
            className="hidden lg:flex flex-col w-64 border-r border-primary/10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <TodayAgendaView hideHeader={true} />
          </motion.div>
        )}

        {/* Mobile: Tabbed View | Desktop: Kanban/Calendar */}
        <motion.div
          className="flex-1 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: 0.2,
            ease: "easeOut",
          }}
        >
          {/* Desktop: Full Kanban or Calendar */}
          <div
            className="hidden lg:block h-full"
            data-tour="kanban-board"
          >
            {viewMode === "week" ? (
              <SevenDayKanban viewMode={viewMode} />
            ) : (
              <MonthCalendarView />
            )}
          </div>

          {/* Mobile: Tabbed Content */}
          <div className="lg:hidden h-full">
            {mobileView === "today" ? (
              <TodayAgendaView hideHeader={true} />
            ) : viewMode === "week" ? (
              <SevenDayKanban
                mobileMode
                viewMode={viewMode}
                mobileDayIndex={mobileDayIndex}
                mobileWeekOffset={mobileWeekOffset}
                onMobileWeekChange={setMobileWeekOffset}
              />
            ) : (
              <MonthCalendarView mobileMode />
            )}
          </div>
        </motion.div>
      </div>

      {/* AI Recommendations Side Panel */}
      <Sheet open={aiPanelOpen} onOpenChange={onAiPanelChange}>
        <SheetContent
          side="right"
          className="w-full sm:w-[400px] bg-gradient-to-b from-white to-[#F9F7FD] dark:from-gray-900 dark:to-gray-800"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#E6D5F0] to-[#C9E4F7]">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              AI Recommendations
            </SheetTitle>
            <SheetDescription>
              Smart scheduling suggestions powered by AI
            </SheetDescription>
          </SheetHeader>
          <AIRecommendationPanel
            onClose={() => onAiPanelChange(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Schedule Preview Dialog */}
      <Dialog
        open={showSchedulePreview}
        onOpenChange={setShowSchedulePreview}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Review AI Scheduling Plan
            </DialogTitle>
            <DialogDescription>
              Here's how I'll schedule your{" "}
              {schedulePlan.length} unscheduled task
              {schedulePlan.length === 1 ? "" : "s"} across
              upcoming days
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-3">
              {schedulePlan.map(
                ({ task, scheduledDate, reason }, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4 bg-gradient-to-br from-[#C9E4F7]/20 to-[#B8E6D5]/20">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-medium text-sm">
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  task.priority === "urgent" &&
                                    "border-red-400 text-red-700 bg-red-50",
                                  task.priority === "high" &&
                                    "border-orange-400 text-orange-700 bg-orange-50",
                                  task.priority === "medium" &&
                                    "border-blue-400 text-blue-700 bg-blue-50",
                                  task.priority === "low" &&
                                    "border-gray-400 text-gray-700 bg-gray-50",
                                )}
                              >
                                {task.priority}
                              </Badge>
                              {task.status ===
                                "in-progress" && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-green-400 text-green-700 bg-green-50"
                                >
                                  active
                                </Badge>
                              )}
                            </div>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                              {task.description}
                            </p>
                          )}

                          {/* AI Reasoning */}
                          {reason && (
                            <div className="mb-2 flex items-start gap-1.5 p-2 rounded-md bg-primary/5 border border-primary/10">
                              <Brain className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-primary/80 italic">
                                {reason}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-primary" />
                              <span className="text-foreground/70">
                                {formatScheduleDate(
                                  scheduledDate,
                                )}
                              </span>
                            </div>
                            {task.estimatedTime && (
                              <div className="flex items-center gap-1">
                                <span className="text-foreground/30">
                                  •
                                </span>
                                <Clock className="w-3 h-3 text-foreground/50" />
                                <span className="text-foreground/70">
                                  {task.estimatedTime} min
                                </span>
                              </div>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center gap-1">
                                <span className="text-foreground/30">
                                  •
                                </span>
                                <Target className="w-3 h-3 text-foreground/50" />
                                <span className="text-foreground/70">
                                  Due{" "}
                                  {new Date(
                                    task.dueDate,
                                  ).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ),
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSchedulePreview(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmScheduling}
              className="rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Confirm Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-schedule Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={(open) => {
        try {
          setShowRescheduleDialog(open);
          if (!open) {
            setRescheduleType(null);
            setRescheduleDate(undefined);
          }
        } catch (error) {
          console.error('Error handling dialog open change:', error);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              AI Re-schedule Tasks
            </DialogTitle>
            <DialogDescription>
              Select a time period and date to reschedule tasks. Tasks will be unscheduled and then rescheduled using AI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Mini Calendar with Type Toggle */}
            {rescheduleType ? (
              <RescheduleMiniCalendar
                rescheduleType={rescheduleType}
                rescheduleDate={rescheduleDate}
                onTypeChange={(type) => {
                  try {
                    setRescheduleType(type);
                    setRescheduleDate(undefined);
                  } catch (error) {
                    console.error('Error changing reschedule type:', error);
                    toast.error('Failed to change period type', {
                      description: 'Please try again',
                      duration: 3000,
                    });
                  }
                }}
                onDateSelect={(date) => {
                  try {
                    setRescheduleDate(date);
                  } catch (error) {
                    console.error('Error selecting date:', error);
                    toast.error('Failed to select date', {
                      description: 'Please try again',
                      duration: 3000,
                    });
                  }
                }}
              />
            ) : (
              /* Type Selection - shown when no type selected */
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Period Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      try {
                        setRescheduleType("day");
                      } catch (error) {
                        console.error('Error setting reschedule type to day:', error);
                        toast.error('Failed to select period type', {
                          description: 'Please try again',
                          duration: 3000,
                        });
                      }
                    }}
                  >
                    Day
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      try {
                        setRescheduleType("week");
                      } catch (error) {
                        console.error('Error setting reschedule type to week:', error);
                        toast.error('Failed to select period type', {
                          description: 'Please try again',
                          duration: 3000,
                        });
                      }
                    }}
                  >
                    Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      try {
                        setRescheduleType("month");
                      } catch (error) {
                        console.error('Error setting reschedule type to month:', error);
                        toast.error('Failed to select period type', {
                          description: 'Please try again',
                          duration: 3000,
                        });
                      }
                    }}
                  >
                    Month
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  setShowRescheduleDialog(false);
                  setRescheduleType(null);
                  setRescheduleDate(undefined);
                } catch (error) {
                  console.error('Error closing reschedule dialog:', error);
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                try {
                  if (rescheduleType && rescheduleDate) {
                    handleRandomReschedule(rescheduleType, rescheduleDate);
                  } else {
                    toast.error("Please select a date", {
                      description: "You must select both a period type and a date.",
                      duration: 3000,
                    });
                  }
                } catch (error) {
                  console.error('Error in reschedule button click:', error);
                  toast.error('Failed to start rescheduling', {
                    description: 'Please try again',
                    duration: 3000,
                  });
                }
              }}
              disabled={!rescheduleType || !rescheduleDate || isRescheduling}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isRescheduling && "animate-spin")} />
              {isRescheduling ? "Rescheduling..." : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
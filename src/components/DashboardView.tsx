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
import { useSubscription } from "../contexts/SubscriptionContext";
import { logger } from "../lib/logger";
import { useAIScheduler, type ScheduleResult } from "../hooks/useAIScheduler";
import { cn, sanitizeHTML, hasHTMLTags } from "../lib/utils";
import { toast } from "../lib/toast-wrapper";
import type { Task } from "../types";
import { TOGGLE_SWITCH_DIMENSIONS, TOGGLE_SWITCH_SPACING, TOGGLE_SWITCH_TEXT_SIZES } from "../lib/layout-constants";
import { TOGGLE_SWITCH_COLORS } from "../lib/ui-colors";

interface DashboardViewProps {
  mobileView: "today" | "week";
  onMobileViewChange: (view: "today" | "week") => void;
  aiPanelOpen: boolean;
  onAiPanelChange: (open: boolean) => void;
  hideAgenda?: boolean;
  panelOpen?: boolean; // Indicates if a side panel is open (for header adjustment)
  panelKey?: string | number; // Key to track panel transitions
}

interface SchedulePlan {
  task: Task;
  scheduledDate: Date;
  reason?: string;
}

const getTwoWeekDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = (day + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  end.setHours(23, 59, 59, 999);
  return { startDate: start, endDate: end };
};

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
      logger.error('Error initializing viewDate:', error);
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
      logger.error('Error syncing viewDate:', error);
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
      logger.error('Error checking if date is selected:', error);
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
      logger.error('Error formatting display date:', error);
      return null;
    }
  };

  return (
    <div className="w-full bg-white/80 dark:bg-card/80 rounded-lg p-3 border-2 border-primary/30 shadow-lg">
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
              logger.error('Error changing type to day:', error);
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
              logger.error('Error changing type to week:', error);
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
              logger.error('Error changing type to month:', error);
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
  panelOpen = false,
  panelKey,
}: DashboardViewProps) {
  // Hooks must be called unconditionally (React Rules of Hooks)
  // Context hooks will throw if used outside providers - that's expected
  // and should be caught by Error Boundary, not try-catch here
  const tasksContext = useTasks();
  const subscriptionContext = useSubscription();
  const aiSchedulerContext = useAIScheduler();

  // Extract values with safe defaults
  const tasks = tasksContext?.tasks || [];
  const updateTask = tasksContext?.updateTask;
  const hasFeature = subscriptionContext?.hasFeature;
  const features = subscriptionContext?.features;
  const rescheduleDay = aiSchedulerContext?.rescheduleDay;
  const rescheduleWeek = aiSchedulerContext?.rescheduleWeek;
  const rescheduleMonth = aiSchedulerContext?.rescheduleMonth;
  const getScheduledTasksForDay = aiSchedulerContext?.getScheduledTasksForDay;
  const getScheduledTasksForWeek = aiSchedulerContext?.getScheduledTasksForWeek;
  const getScheduledTasksForMonth = aiSchedulerContext?.getScheduledTasksForMonth;
  const generateSchedulePlan = aiSchedulerContext?.generateSchedulePlan;

  // Safe wrapper for hasFeature
  const safeHasFeature = (feature: keyof import('../types').SubscriptionFeatures): boolean => {
    if (!hasFeature) return false;
    try {
      return hasFeature(feature);
    } catch (error) {
      logger.error('Error checking feature:', feature, error);
      return false;
    }
  };
  const [viewMode, setViewMode] = useState<"week" | "month">(
    "week",
  );
  const [showSchedulePreview, setShowSchedulePreview] =
    useState(false);
  const [schedulePlan, setSchedulePlan] = useState<
    SchedulePlan[]
  >([]);
  // Calculate current day index in the week (Monday = 0, Sunday = 6)
  const getCurrentDayIndex = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    return (dayOfWeek + 6) % 7; // Convert to Monday=0, Sunday=6
  };

  // Calculate tomorrow's day index in the week (Monday = 0, Sunday = 6)
  const getTomorrowDayIndex = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayOfWeek = tomorrow.getDay(); // 0 (Sun) - 6 (Sat)
    return (dayOfWeek + 6) % 7; // Convert to Monday=0, Sunday=6
  };

  const [mobileDayIndex, setMobileDayIndex] = useState(getTomorrowDayIndex());
  const [mobileWeekOffset, setMobileWeekOffset] = useState(0);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleType, setRescheduleType] = useState<"day" | "week" | "month" | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Generate week columns for mobile day selector with week offset
  const getWeekColumns = (weekOffset = 0) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from Monday of the current week
    const startOfWeek = new Date(today);
    const dayOfWeek = startOfWeek.getDay(); // 0 (Sun) - 6 (Sat)
    const mondayOffset = (dayOfWeek + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - mondayOffset + weekOffset * 7);

    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

    const daysToShow = 7; // Mobile Today Agenda week view should remain 7 days

    return Array.from({ length: daysToShow }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);

      const dow = date.getDay();

      return {
        date,
        dayName: dayNames[dow],
        dateString: date.toISOString().split("T")[0],
        weekNumber: Math.floor(i / 7) + 1,
        dayIndex: i,
      };
    });
  };

  const weekColumns = getWeekColumns(mobileWeekOffset);

  // Update day index to tomorrow when returning to current week
  useEffect(() => {
    if (mobileWeekOffset === 0) {
      setMobileDayIndex(getTomorrowDayIndex());
    }
  }, [mobileWeekOffset]);

  const handleWeekChange = (direction: "prev" | "next") => {
    if (direction === "next") {
      setMobileWeekOffset((prev) => prev + 1);
      setMobileDayIndex(0); // Reset to first day when going to next week
    } else {
      const newOffset = Math.max(0, mobileWeekOffset - 1);
      setMobileWeekOffset(newOffset);
      // If returning to current week (offset 0), set to tomorrow's day index
      if (newOffset === 0) {
        setMobileDayIndex(getTomorrowDayIndex());
      } else {
        setMobileDayIndex(0); // Reset to first day when going to previous week
      }
    }
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
    if (!safeHasFeature('aiScheduler')) {
      toast.error('AI Scheduler is a Pro feature', {
        description: 'Upgrade to Pro to unlock AI-powered task scheduling.',
      });
      return;
    }

    if (features?.aiSchedulerLimit !== undefined) {
      const { hasReachedLimit, incrementAIUsage } = require('../lib/ai-scheduler-usage');
      if (hasReachedLimit(features.aiSchedulerLimit)) {
        toast.error('AI Scheduler limit reached', {
          description: `You've used ${features.aiSchedulerLimit}/${features.aiSchedulerLimit} AI suggestions this week. Upgrade to Pro for unlimited AI scheduling.`,
          action: {
            label: 'Upgrade',
            onClick: () => window.dispatchEvent(new CustomEvent('show-pricing-dialog')),
          },
        });
        return;
      }
      incrementAIUsage();
    }

    const unscheduledTasks = tasks.filter((t) => !t.scheduledDate && t.status !== "done");
    if (unscheduledTasks.length === 0) {
      toast.info("No unscheduled tasks found", {
        description: "All your tasks are already scheduled!",
      });
      return;
    }

    if (!generateSchedulePlan) {
      toast.error('Unable to start AI Scheduler', {
        description: 'Please try again in a moment.',
      });
      return;
    }

    // AI Suggestions: Generate suggestions using category hours for two week period
    // Start from tomorrow (next day), not today
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setDate(end.getDate() + 13); // 14 days total (tomorrow + 13 more)
    end.setHours(23, 59, 59, 999);
    const range = { startDate: tomorrow, endDate: end };
    const result = generateSchedulePlan(undefined, range, { 
      forceCategoryHours: true,
      enforceMinimumHours: true // Always enforce 5-hour minimum before pushing to next day
    });

    if (result.scheduled.length === 0 && result.exceedsLimit.length === 0) {
      toast.info("No available time slots", {
        description: "AI Scheduler couldn't find any openings within the next two weeks.",
      });
      return;
    }

    setSchedulePlan(result.scheduled);
    setShowSchedulePreview(true);

    if (result.exceedsLimit.length > 0) {
      toast.warning(
        `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? '' : 's'} need manual scheduling`,
        {
          description: 'No available slots within the next two weeks for these tasks.',
          duration: 5000,
        }
      );
    }
  };

  const confirmScheduling = () => {
    schedulePlan.forEach(({ task, scheduledDate }) => {
      if (!updateTask) {
        console.error('updateTask is not available');
        return;
      }
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
    // Check if user has access to AI Scheduler feature
    if (!safeHasFeature('aiScheduler')) {
      toast.error('Re-schedule is a Pro feature', {
        description: 'Upgrade to Pro to unlock AI-powered task rescheduling.',
      });
      return;
    }
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
          
          taskCount = getScheduledTasksForDay ? getScheduledTasksForDay(targetDate).length : 0;
          if (taskCount === 0) {
            toast.info("No tasks found", {
              description: `No scheduled tasks found for ${targetDate.toLocaleDateString()}`,
              duration: 3000,
            });
            setIsRescheduling(false);
            return;
          }
          
          if (!rescheduleDay) {
            throw new Error('rescheduleDay is not available');
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
          
          taskCount = getScheduledTasksForWeek ? getScheduledTasksForWeek(monday).length : 0;
          if (taskCount === 0) {
            toast.info("No tasks found", {
              description: `No scheduled tasks found for the week starting ${monday.toLocaleDateString()}`,
              duration: 3000,
            });
            setIsRescheduling(false);
            return;
          }
          
          if (!rescheduleWeek) {
            throw new Error('rescheduleWeek is not available');
          }
          result = await rescheduleWeek(monday);
          description = `Rescheduled ${result?.scheduled?.length || 0} task${(result?.scheduled?.length || 0) === 1 ? '' : 's'} for the week starting ${monday.toLocaleDateString()}`;
        } else {
          // Use first day of the selected month
          const targetMonth = new Date(selectedDate);
          targetMonth.setDate(1);
          targetMonth.setHours(0, 0, 0, 0);
          
          taskCount = getScheduledTasksForMonth ? getScheduledTasksForMonth(targetMonth).length : 0;
          if (taskCount === 0) {
            toast.info("No tasks found", {
              description: `No scheduled tasks found for ${targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
              duration: 3000,
            });
            setIsRescheduling(false);
            return;
          }
          
          if (!rescheduleMonth) {
            throw new Error('rescheduleMonth is not available');
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
        panelOpen={panelOpen}
        panelKey={panelKey}
        description={viewMode === "week" ? "Week View" : "Month View"}
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle - Desktop Only */}
            <div className={cn(
              "hidden md:flex items-center rounded-full border",
              "gap-2", // gap-2 = 8px
              "px-3 py-1.5", // px-3 = 12px, py-1.5 = 6px
              TOGGLE_SWITCH_COLORS.container.background.light,
              TOGGLE_SWITCH_COLORS.container.background.dark,
              TOGGLE_SWITCH_COLORS.container.border.light,
              TOGGLE_SWITCH_COLORS.container.border.dark,
            )}>
              <Calendar
                className={cn(
                  "w-4 h-4 transition-colors", // w-4 h-4 = 16px
                  viewMode === "week"
                    ? TOGGLE_SWITCH_COLORS.text.active.light + " " + TOGGLE_SWITCH_COLORS.text.active.dark
                    : TOGGLE_SWITCH_COLORS.text.inactive.light + " " + TOGGLE_SWITCH_COLORS.text.inactive.dark,
                )}
              />
              <span
                className={cn(
                  TOGGLE_SWITCH_TEXT_SIZES.label.small,
                  "font-medium transition-colors",
                  viewMode === "week"
                    ? TOGGLE_SWITCH_COLORS.text.active.light + " " + TOGGLE_SWITCH_COLORS.text.active.dark
                    : TOGGLE_SWITCH_COLORS.text.inactive.light + " " + TOGGLE_SWITCH_COLORS.text.inactive.dark,
                )}
              >
                Week
              </span>
              <Switch
                checked={viewMode === "month"}
                onCheckedChange={(checked) =>
                  setViewMode(checked ? "month" : "week")
                }
                className="mx-1" // mx-1 = 4px
              />
              <span
                className={cn(
                  TOGGLE_SWITCH_TEXT_SIZES.label.small,
                  "font-medium transition-colors",
                  viewMode === "month"
                    ? TOGGLE_SWITCH_COLORS.text.active.light + " " + TOGGLE_SWITCH_COLORS.text.active.dark
                    : TOGGLE_SWITCH_COLORS.text.inactive.light + " " + TOGGLE_SWITCH_COLORS.text.inactive.dark,
                )}
              >
                Month
              </span>
              <CalendarDays
                className={cn(
                  "w-4 h-4 transition-colors", // w-4 h-4 = 16px
                  viewMode === "month"
                    ? TOGGLE_SWITCH_COLORS.text.active.light + " " + TOGGLE_SWITCH_COLORS.text.active.dark
                    : TOGGLE_SWITCH_COLORS.text.inactive.light + " " + TOGGLE_SWITCH_COLORS.text.inactive.dark,
                )}
              />
            </div>

            {/* AI Scheduler Buttons - Desktop Only */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScheduleUnscheduledTasks}
                className="rounded-full bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7] dark:from-[#6A5A8A] dark:to-[#5A7A9A] border-primary/20 dark:border-primary/40 hover:from-[#C9E4F7] hover:to-[#E6D5F0] dark:hover:from-[#5A7A9A] dark:hover:to-[#6A5A8A] transition-all whitespace-nowrap"
                data-tour="ai-scheduler"
              >
                <Sparkles className="w-4 h-4 mr-2 text-primary dark:text-primary-foreground flex-shrink-0" />
                <span className="text-foreground dark:text-gray-100">AI Scheduler Suggestions</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Check if user has access to AI Scheduler feature
                  if (!safeHasFeature('aiScheduler')) {
                    toast.error('Re-schedule is a Pro feature', {
                      description: 'Upgrade to Pro to unlock AI-powered task rescheduling.',
                    });
                    return;
                  }
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
                className="rounded-full bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border-primary/20 dark:border-primary/40 hover:from-primary/20 hover:to-primary/10 dark:hover:from-primary/30 dark:hover:to-primary/20 transition-all"
                disabled={isRescheduling}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2 text-primary dark:text-primary-foreground", isRescheduling && "animate-spin")} />
                <span className="text-foreground dark:text-gray-100">Re-schedule</span>
              </Button>
            </div>
          </div>
        }
      />
      {/* Spacer for fixed header on mobile - accounts for header height + border */}

      {/* Mobile 7-Day Calendar - Only show on mobile when viewing week */}
      {mobileView === "week" && (
        <div className="md:hidden border-b border-primary/10 bg-white/50 dark:bg-card/50 backdrop-blur-sm">
          <div className="px-2 py-3 sm:px-4 sm:py-4">
            {/* Week Navigation Header */}
            <div className="flex items-center justify-between mb-3">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleWeekChange("prev")}
                disabled={mobileWeekOffset === 0}
                className="h-8 w-8 flex-shrink-0 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex-1 text-center">
                <span className="text-sm font-semibold text-foreground">
                  {weekColumns[0]?.date && weekColumns[6]?.date
                    ? `${weekColumns[0].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekColumns[6].date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: weekColumns[0].date.getFullYear() !== weekColumns[6].date.getFullYear() ? "numeric" : undefined })}`
                    : "Week View"}
                </span>
              </div>
              
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleWeekChange("next")}
                className="h-8 w-8 flex-shrink-0 rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* 7-Day Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Day Headers */}
              {weekColumns.map((column) => (
                <div
                  key={`header-${column.dateString}`}
                  className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground py-1"
                >
                  {column.dayName.substring(0, 3)}
                </div>
              ))}
              
              {/* Date Cells */}
                  {weekColumns.map((column, index) => {
                    const isSelected = index === mobileDayIndex;
                    const dayTasks = getTasksForDay(column.dateString);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isToday = 
                  column.date.getFullYear() === today.getFullYear() &&
                  column.date.getMonth() === today.getMonth() &&
                  column.date.getDate() === today.getDate();

                    return (
                      <button
                        key={column.dateString}
                        onClick={() => setMobileDayIndex(index)}
                        className={cn(
                      "flex flex-col items-center justify-center py-2 rounded-lg transition-all relative",
                          isSelected
                            ? "bg-gradient-to-br from-[#E6D5F0] to-[#C9E4F7] text-primary shadow-md border-2 border-primary/30"
                        : isToday
                        ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-white/50 dark:bg-card/50 hover:bg-white dark:hover:bg-card border border-transparent",
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm sm:text-base font-semibold leading-none",
                            isSelected
                          ? "text-primary"
                          : isToday
                              ? "text-primary"
                              : "text-foreground",
                          )}
                        >
                          {column.date.getDate()}
                        </span>
                        {dayTasks.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                            {Array.from({
                              length: Math.min(dayTasks.length, 3),
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
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Desktop: Today Agenda Sidebar - only show when hideAgenda is false (hidden on tablets to save space) */}
        {!hideAgenda && (
          <motion.div
            className="hidden xl:flex flex-col w-64 border-r border-primary/10 bg-white/50 dark:bg-background/50 backdrop-blur-sm"
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
          {/* Desktop/Tablet: Full Kanban or Calendar */}
          <div
            className="hidden md:block h-full"
            data-tour="kanban-board"
          >
            {viewMode === "week" ? (
              <SevenDayKanban viewMode={viewMode} />
            ) : (
              <MonthCalendarView />
            )}
          </div>

          {/* Mobile: Tabbed Content */}
          <div className="md:hidden h-full">
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
          className="w-full sm:w-[360px] md:w-[400px] bg-gradient-to-b from-white to-[#F9F7FD] dark:from-gray-900 dark:to-gray-800"
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
                                    "border-gray-400 text-gray-700 dark:text-foreground bg-gray-50 dark:bg-muted/20",
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
                            <div 
                              className={cn(
                                "text-[10px] text-muted-foreground mb-2 line-clamp-4 break-words px-1.5",
                                // Rich text formatting styles - only apply if HTML is present
                                // Note: Rich text editor font size changes will override this base size via inline styles
                                hasHTMLTags(task.description) && "[&_strong]:font-bold [&_b]:font-bold",
                                hasHTMLTags(task.description) && "[&_em]:italic [&_i]:italic",
                                hasHTMLTags(task.description) && "[&_u]:underline",
                                hasHTMLTags(task.description) && "[&_s]:line-through [&_strike]:line-through",
                                hasHTMLTags(task.description) && "[&_ul]:list-disc [&_ul]:ml-3",
                                hasHTMLTags(task.description) && "[&_ol]:list-decimal [&_ol]:ml-3",
                                hasHTMLTags(task.description) && "[&_li]:ml-1",
                                hasHTMLTags(task.description) && "[&_p]:my-0.5 [&_p]:break-words"
                              )}
                              {...(hasHTMLTags(task.description) 
                                ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(task.description) } }
                                : { children: task.description }
                              )}
                            />
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
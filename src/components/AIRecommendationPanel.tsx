import React, { useState } from "react";
import { motion } from "motion/react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_XS, ICON_SIZE_3XL } from "../lib/layout-constants";
import { useAI } from "../contexts/AIContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useAIScheduler } from "../hooks/useAIScheduler";
import { useTheme } from "../contexts/ThemeContext";
import { TWO_WEEK_DAYS_OFFSET } from "../lib/ai-config";
import {
  END_OF_DAY_HOUR,
  END_OF_DAY_MINUTE,
  END_OF_DAY_SECOND,
  END_OF_DAY_MILLISECOND,
  DAYS_IN_WEEK,
  TWO_WEEKS_DAYS,
  DAYS_IN_MONTH_APPROX,
} from "../lib/business-constants";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Calendar as CalendarComponent } from "./ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { UI_INBOX_GRADIENTS } from "../lib/ui-colors";
import type { SchedulePlan, ScheduleResult } from "../hooks/useAIScheduler";
import type { Task } from "../types";

interface AIRecommendationPanelProps {
  onClose: () => void;
}

const getTwoWeekDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = (day + (DAYS_IN_WEEK - 1)) % DAYS_IN_WEEK;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + TWO_WEEK_DAYS_OFFSET);
  end.setHours(23, 59, 59, 999);
  return { startDate: start, endDate: end };
};

export function AIRecommendationPanel({
  onClose,
}: AIRecommendationPanelProps) {
  const { hasFeature, features } = useSubscription();
  const { settings: aiSettings } = useAI();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const {
    generateSchedulePlan,
    applySchedulePlan,
    getUnscheduledTasks,
    rescheduleDay,
    rescheduleWeek,
    rescheduleMonth,
    getScheduledTasksForDay,
    getScheduledTasksForWeek,
    getScheduledTasksForMonth,
    isScheduling,
  } = useAIScheduler();
  const [showSchedulePreview, setShowSchedulePreview] =
    useState(false);
  const [schedulePlan, setSchedulePlan] = useState<
    SchedulePlan[]
  >([]);
  const [showExceedsLimitDialog, setShowExceedsLimitDialog] = useState(false);
  const [exceedsLimitData, setExceedsLimitData] = useState<{
    days: Array<{ date: string; hours: number; tasks: Task[] }>;
    tasks: Task[];
  } | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleType, setRescheduleType] = useState<'day' | 'week' | 'month' | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [rescheduleDateOpen, setRescheduleDateOpen] = useState(false);
  const [suggestionPeriod, setSuggestionPeriod] = useState<'day' | 'week' | 'month' | 'twoWeeks'>('twoWeeks');
  const [suggestionDate, setSuggestionDate] = useState<Date | undefined>(new Date());
  const [suggestionDateOpen, setSuggestionDateOpen] = useState(false);

  // Listen for tour events to open/close dialogs
  React.useEffect(() => {
    const handleTourOpenDialog = (event: CustomEvent<{ dialog: 'schedule-preview' | 'reschedule-day' | 'reschedule-week' | 'reschedule-month' }>) => {
      const dialog = event.detail.dialog;
      if (dialog === 'schedule-preview') {
        // For tour, create a demo schedule preview with empty plan (will show empty state)
        setSchedulePlan([]);
        setShowSchedulePreview(true);
      } else if (dialog === 'reschedule-day') {
        setRescheduleType('day');
        setSelectedDate(new Date());
        setShowRescheduleDialog(true);
      } else if (dialog === 'reschedule-week') {
        setRescheduleType('week');
        setSelectedDate(new Date());
        setShowRescheduleDialog(true);
      } else if (dialog === 'reschedule-month') {
        setRescheduleType('month');
        setSelectedDate(new Date());
        setShowRescheduleDialog(true);
      }
    };

    const handleTourCloseDialog = () => {
      setShowSchedulePreview(false);
      setShowRescheduleDialog(false);
      setRescheduleType(null);
    };

    window.addEventListener('tour-open-ai-dialog', handleTourOpenDialog as EventListener);
    window.addEventListener('tour-close-ai-dialog', handleTourCloseDialog as EventListener);
    return () => {
      window.removeEventListener('tour-open-ai-dialog', handleTourOpenDialog as EventListener);
      window.removeEventListener('tour-close-ai-dialog', handleTourCloseDialog as EventListener);
    };
  }, []);

  const handleScheduleUnscheduledTasks = async () => {
    // Check if user has access to AI Scheduler feature
    if (!hasFeature('aiScheduler')) {
      toast.error('AI Scheduler is a Pro feature', {
        description: 'Upgrade to Pro to unlock AI-powered task scheduling.',
      });
      return;
    }

    // Check AI scheduler usage limit for free tier
    if (features.aiSchedulerLimit !== undefined) {
      const { hasReachedLimit, getRemainingCount, incrementAIUsage } = require('../lib/ai-scheduler-usage');
      if (hasReachedLimit(features.aiSchedulerLimit)) {
        const remaining = getRemainingCount(features.aiSchedulerLimit);
        toast.error('AI Scheduler limit reached', {
          description: `You've used ${features.aiSchedulerLimit}/${features.aiSchedulerLimit} AI suggestions this week. Upgrade to Pro for unlimited AI scheduling.`,
          action: {
            label: 'Upgrade',
            onClick: () => {
              // Trigger upgrade prompt
              window.dispatchEvent(new CustomEvent('show-pricing-dialog'));
            },
          },
        });
        return;
      }
      // Increment usage before scheduling
      incrementAIUsage();
    }

    // Calculate date range based on selected period and date
    // AI Scheduler now uses user-selected date (suggestionDate) or TODAY as base date
    let range: { startDate: Date; endDate: Date };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use user-selected suggestionDate if provided, otherwise default to today
    const baseDate = suggestionDate ? new Date(suggestionDate) : new Date(today);
    baseDate.setHours(0, 0, 0, 0);
    
    // Ensure we don't schedule in the past - use today as minimum
    const startDate = baseDate >= today ? baseDate : today;
    
    if (suggestionPeriod === 'day') {
      // For day suggestions, use the selected date (or today)
      const start = new Date(startDate);
      const end = new Date(startDate);
      end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      range = { startDate: start, endDate: end };
    } else if (suggestionPeriod === 'week') {
      // For week suggestions, start from selected date and span 7 days
      const start = new Date(startDate);
      const end = new Date(startDate);
      end.setDate(end.getDate() + (DAYS_IN_WEEK - 1)); // 7 days total
      end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      range = { startDate: start, endDate: end };
    } else if (suggestionPeriod === 'month') {
      // For month suggestions, start from selected date and span 30 days
      const start = new Date(startDate);
      const end = new Date(startDate);
      end.setDate(end.getDate() + (DAYS_IN_MONTH_APPROX - 1)); // 30 days total
      end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      range = { startDate: start, endDate: end };
    } else {
      // Two weeks (default) - start from selected date or today
      const start = new Date(startDate);
      const end = new Date(startDate);
      end.setDate(end.getDate() + (TWO_WEEKS_DAYS - 1)); // 14 days total
      end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      range = { startDate: start, endDate: end };
    }
    
    const result = await generateSchedulePlan(undefined, range, { forceCategoryHours: true });
    
    // Check if any days exceed 5 hours
    if (result.daysExceedingLimit.length > 0) {
      // Show consultation dialog before proceeding
      setExceedsLimitData({
        days: result.daysExceedingLimit,
        tasks: result.exceedsLimit
      });
      setShowExceedsLimitDialog(true);
      return;
    }
    
    // If no days exceed limit, proceed normally
    setSchedulePlan(result.scheduled);
    setShowSchedulePreview(true);
    
    // Show warning if tasks exceed limit (no available slots)
    if (result.exceedsLimit.length > 0) {
      toast.warning(
        `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? '' : 's'} exceed the 5-hour daily limit`,
        {
          description: 'These tasks will need to be scheduled manually.',
          duration: 5000,
        }
      );
    }
  };

  const handleProceedWithExceedsLimit = async () => {
    setShowExceedsLimitDialog(false);
    // Regenerate plan and proceed with scheduling using category hours
    // Use the same period as the original suggestion
    // AI Scheduler Suggestions should always start from tomorrow (next day), not today
    let range: { startDate: Date; endDate: Date };
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    if (suggestionPeriod === 'day') {
      // For day suggestions, start from tomorrow
      const start = new Date(tomorrow);
      const end = new Date(tomorrow);
      end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      range = { startDate: start, endDate: end };
    } else if (suggestionPeriod === 'week') {
      // For week suggestions, start from tomorrow and span 7 days
      const start = new Date(tomorrow);
      const end = new Date(tomorrow);
      end.setDate(end.getDate() + (DAYS_IN_WEEK - 1)); // 7 days total (tomorrow + 6 more)
      end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      range = { startDate: start, endDate: end };
    } else if (suggestionPeriod === 'month') {
      // For month suggestions, start from tomorrow and span 30 days
      const start = new Date(tomorrow);
      const end = new Date(tomorrow);
      end.setDate(end.getDate() + (DAYS_IN_MONTH_APPROX - 1)); // 30 days total (tomorrow + 29 more)
      end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      range = { startDate: start, endDate: end };
    } else {
      // Two weeks (default) - start from tomorrow
      const start = new Date(tomorrow);
      const end = new Date(tomorrow);
      end.setDate(end.getDate() + (TWO_WEEKS_DAYS - 1)); // 14 days total (tomorrow + 13 more)
      end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
      range = { startDate: start, endDate: end };
    }
    
    const result = await generateSchedulePlan(undefined, range, { 
      forceCategoryHours: true,
      enforceMinimumHours: false // Don't enforce minimum for suggestions
    });
    setSchedulePlan(result.scheduled);
    setShowSchedulePreview(true);
    
    // Show warning about tasks that couldn't be scheduled
    if (result.exceedsLimit.length > 0) {
      toast.warning(
        `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? '' : 's'} could not be scheduled`,
        {
          description: 'No available slots within 14 days. Please schedule manually.',
          duration: 5000,
        }
      );
    }
    
    setExceedsLimitData(null);
  };

  const handleCancelExceedsLimit = () => {
    setShowExceedsLimitDialog(false);
    setExceedsLimitData(null);
  };

  const handleReschedule = async () => {
    // Check if user has access to AI Scheduler feature
    if (!hasFeature('aiScheduler')) {
      toast.error('Re-schedule is a Pro feature', {
        description: 'Upgrade to Pro to unlock AI-powered task rescheduling.',
      });
      return;
    }

    if (!selectedDate || !rescheduleType) return;

    try {
      let result: ScheduleResult;
      let taskCount = 0;

      if (rescheduleType === 'day') {
        taskCount = getScheduledTasksForDay(selectedDate).length;
        if (taskCount === 0) {
          toast.info('No tasks found', {
            description: `No scheduled tasks found for ${selectedDate.toLocaleDateString()}`,
            duration: 3000,
          });
          return;
        }
        result = await rescheduleDay(selectedDate);
      } else if (rescheduleType === 'week') {
        // Get Monday of the week
        const monday = new Date(selectedDate);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        
        taskCount = getScheduledTasksForWeek(monday).length;
        if (taskCount === 0) {
          toast.info('No tasks found', {
            description: `No scheduled tasks found for the week starting ${monday.toLocaleDateString()}`,
            duration: 3000,
          });
          return;
        }
        result = await rescheduleWeek(monday);
      } else {
        taskCount = getScheduledTasksForMonth(selectedDate).length;
        if (taskCount === 0) {
          toast.info('No tasks found', {
            description: `No scheduled tasks found for ${selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
            duration: 3000,
          });
          return;
        }
        result = await rescheduleMonth(selectedDate);
      }

      // Check if any days exceed 5 hours
      if (result.daysExceedingLimit.length > 0) {
        setExceedsLimitData({
          days: result.daysExceedingLimit,
          tasks: result.exceedsLimit
        });
        setShowExceedsLimitDialog(true);
        setShowRescheduleDialog(false);
        return;
      }

      toast.success(
        `Successfully rescheduled ${taskCount} task${taskCount === 1 ? '' : 's'}!`,
        {
          description: `Tasks for ${rescheduleType === 'day' ? 'the day' : rescheduleType === 'week' ? 'the week' : 'the month'} have been rescheduled`,
          duration: 3000,
        }
      );

      setShowRescheduleDialog(false);
      setRescheduleType(null);
      setSelectedDate(new Date());

      // Show warning if tasks couldn't be scheduled
      if (result.exceedsLimit.length > 0) {
        toast.warning(
          `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? '' : 's'} could not be scheduled`,
          {
            description: 'No available slots within 14 days. Please schedule manually.',
            duration: 5000,
          }
        );
      }
    } catch (error) {
      toast.error('Rescheduling failed', {
        description: 'Something went wrong. Please try again.',
        duration: 4000,
      });
      console.error('Reschedule error:', error);
    }
  };

  const confirmScheduling = async () => {
    await applySchedulePlan(schedulePlan);

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
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday =
      date.toDateString() === today.toDateString();
    const isTomorrow =
      date.toDateString() === tomorrow.toDateString();

    if (isToday)
      return `Today at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
    if (isTomorrow)
      return `Tomorrow at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      {/* Exceeds Limit Consultation Dialog */}
      <AlertDialog open={showExceedsLimitDialog} onOpenChange={setShowExceedsLimitDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon name="clock" size={ICON_SIZE_LG} className="text-orange-500" />
              Daily Limit Exceeded - Consultation Required
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p>
                  Some days in the schedule exceed the 5-hour daily limit. 
                  Would you like to proceed with scheduling anyway?
                </p>
                {exceedsLimitData && exceedsLimitData.days.length > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      Days exceeding 5 hours:
                    </p>
                    <ul className="space-y-1 text-sm text-orange-800 dark:text-orange-200">
                      {exceedsLimitData.days.map((day, idx) => (
                        <li key={idx} className="flex items-center justify-between">
                          <span>{formatDate(day.date)}</span>
                          <span className="font-medium">
                            {day.hours.toFixed(1)} hours ({day.tasks.length} tasks)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {exceedsLimitData && exceedsLimitData.tasks.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                      {exceedsLimitData.tasks.length} task{exceedsLimitData.tasks.length === 1 ? '' : 's'} cannot be scheduled:
                    </p>
                    <ul className="text-xs text-yellow-800 dark:text-yellow-200 list-disc list-inside">
                      {exceedsLimitData.tasks.slice(0, 3).map((task, idx) => (
                        <li key={idx}>{task.title}</li>
                      ))}
                      {exceedsLimitData.tasks.length > 3 && (
                        <li>...and {exceedsLimitData.tasks.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExceedsLimit}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleProceedWithExceedsLimit}
              className="bg-primary hover:bg-primary/90"
            >
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent
          className="max-w-md border border-primary/10"
          data-tour="reschedule-dialog"
          style={{
            backgroundImage: isDark
              ? 'linear-gradient(180deg, rgba(17,24,39,0.96) 0%, rgba(17,24,39,0.9) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,240,255,0.95) 100%)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="refresh-cw" size={ICON_SIZE_LG} className="text-primary" />
              Reschedule {rescheduleType === 'day' ? 'Day' : rescheduleType === 'week' ? 'Week' : 'Month'}
            </DialogTitle>
            <DialogDescription>
              Select a {rescheduleType === 'day' ? 'date' : rescheduleType === 'week' ? 'date (week will be calculated)' : 'month'} to reschedule tasks.
              Tasks will be unscheduled and then rescheduled using AI.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select {rescheduleType === 'day' ? 'Date' : rescheduleType === 'week' ? 'Date (Week Starting)' : 'Month'}</label>
              <Popover open={rescheduleDateOpen} onOpenChange={setRescheduleDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <Icon name="calendar" size={ICON_SIZE_MD} weight="duotone" className="mr-2" />
                    {selectedDate ? (
                      rescheduleType === 'month' ? (
                        selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      ) : rescheduleType === 'week' ? (
                        (() => {
                          const monday = new Date(selectedDate);
                          const day = monday.getDay();
                          const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
                          monday.setDate(diff);
                          return `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                        })()
                      ) : (
                        selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setRescheduleDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {selectedDate && rescheduleType && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  {rescheduleType === 'day' && (
                    <>
                      {getScheduledTasksForDay(selectedDate).length} task{getScheduledTasksForDay(selectedDate).length === 1 ? '' : 's'} scheduled for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </>
                  )}
                  {rescheduleType === 'week' && (() => {
                    const monday = new Date(selectedDate);
                    const day = monday.getDay();
                    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
                    monday.setDate(diff);
                    const weekTasks = getScheduledTasksForWeek(monday);
                    return (
                      <>
                        {weekTasks.length} task{weekTasks.length === 1 ? '' : 's'} scheduled for the week starting {monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </>
                    );
                  })()}
                  {rescheduleType === 'month' && (
                    <>
                      {getScheduledTasksForMonth(selectedDate).length} task{getScheduledTasksForMonth(selectedDate).length === 1 ? '' : 's'} scheduled for {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRescheduleDialog(false);
                setRescheduleType(null);
                setSelectedDate(new Date());
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={!selectedDate || isScheduling}
              className="bg-primary hover:bg-primary/90"
            >
              {isScheduling ? (
                <>
                  <Icon name="refresh-cw" size={ICON_SIZE_MD} className="mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                <>
                  <Icon name="refresh-cw" size={ICON_SIZE_MD} className="mr-2" />
                  Reschedule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Preview Dialog */}
      <Dialog
        open={showSchedulePreview}
        onOpenChange={setShowSchedulePreview}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]" data-tour="ai-schedule-preview-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="calendar" size={ICON_SIZE_LG} weight="duotone" className="text-primary" />
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
                    <Card className={cn("p-4", UI_INBOX_GRADIENTS.card.className)}>
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
                            <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1 px-1.5">
                              {task.description}
                            </p>
                          )}

                          {/* AI Reasoning */}
                          {reason && (
                            <div className="mb-2 flex items-start gap-1.5 p-2 rounded-md bg-primary/5 border border-primary/10">
                              <Icon name="brain" size={ICON_SIZE_XS} weight="duotone" className="text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-primary/80 italic">
                                {reason}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <div className="flex items-center gap-1">
                              <Icon name="calendar" size={ICON_SIZE_XS} weight="duotone" className="text-primary" />
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
                                <Icon name="clock" size={ICON_SIZE_XS} className="text-foreground/50" />
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
                                <Icon name="target" size={ICON_SIZE_XS} weight="duotone" className="text-foreground/50" />
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
              onClick={() => {
                setShowSchedulePreview(false);
                setSchedulePlan([]);
              }}
              className="rounded-full"
            >
              <Icon name="x" size={ICON_SIZE_MD} className="mr-2" />
              Cancel
            </Button>
            <Button
              onClick={confirmScheduling}
              className={cn("rounded-full", UI_INBOX_GRADIENTS.button.className, UI_INBOX_GRADIENTS.button.hover.className)}
            >
              <Icon name="check" size={ICON_SIZE_MD} className="mr-2" />
              Schedule {schedulePlan.length} Task
              {schedulePlan.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-6 h-[calc(100vh-8rem)]">
        {/* AI Scheduler Action */}
        {(() => {
          const unscheduledTasks = getUnscheduledTasks();
          const unscheduledCount = unscheduledTasks.length;

          // Show scheduler when AI scheduling is enabled
          if (aiSettings.autoSchedulingEnabled) {
            // Show full scheduler with schedule button when there are unscheduled tasks and scheduling is enabled
            const showScheduleButton = unscheduledCount > 0 && aiSettings.scheduleUnscheduledTasks;
            
            return (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <Card className={cn("p-4 border-2 border-primary/20", UI_INBOX_GRADIENTS.card.className)}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon name="brain" size={ICON_SIZE_LG} weight="duotone" className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">
                        AI Smart Scheduler
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {showScheduleButton ? (
                          <>
                            {unscheduledCount} task
                            {unscheduledCount === 1 ? "" : "s"}{" "}
                            ready to schedule
                            {aiSettings.priorityBasedScheduling &&
                              " by priority (Urgent → High → Medium → Low)"}
                          </>
                        ) : (
                          "Schedule and reschedule your tasks using AI"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {showScheduleButton && (
                      <>
                        {/* Period Selector for AI Suggestions */}
                        <div className="flex items-center gap-2">
                          <Select
                            value={suggestionPeriod}
                            onValueChange={(value) => setSuggestionPeriod(value as 'day' | 'week' | 'month' | 'twoWeeks')}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day">Today</SelectItem>
                              <SelectItem value="week">This Week</SelectItem>
                              <SelectItem value="month">This Month</SelectItem>
                              <SelectItem value="twoWeeks">Two Weeks</SelectItem>
                            </SelectContent>
                          </Select>
                          {(suggestionPeriod === 'day' || suggestionPeriod === 'week' || suggestionPeriod === 'month') && (
                            <Popover open={suggestionDateOpen} onOpenChange={setSuggestionDateOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs flex-1"
                                >
                                  <Icon name="calendar" size={ICON_SIZE_XS} weight="duotone" className="mr-1" />
                                  {suggestionDate?.toLocaleDateString('en-US', {
                                    month: suggestionPeriod === 'month' ? 'long' : 'short',
                                    day: suggestionPeriod !== 'month' ? 'numeric' : undefined,
                                    year: 'numeric'
                                  })}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={suggestionDate}
                                  onSelect={(date) => {
                                    setSuggestionDate(date);
                                    setSuggestionDateOpen(false);
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                        <Button
                          onClick={handleScheduleUnscheduledTasks}
                          className="w-full rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                          size="default"
                        >
                          <Icon name="sparkles" size={ICON_SIZE_MD} weight="duotone" className="mr-2" />
                          {aiSettings.priorityBasedScheduling
                            ? "Schedule by Priority"
                            : "Schedule Tasks"}
                        </Button>
                      </>
                    )}
                    
                    {/* Reschedule Options - Always show when AI scheduling is enabled */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name="refresh-cw" size={ICON_SIZE_MD} className="text-primary/70" />
                        <span className="text-xs font-medium text-muted-foreground">Reschedule Tasks</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRescheduleType('day');
                            setSelectedDate(new Date());
                            setShowRescheduleDialog(true);
                          }}
                          className="rounded-full text-xs"
                          disabled={isScheduling}
                        >
                          <Icon name="refresh-cw" size={ICON_SIZE_SM} className="mr-1.5" />
                          Day
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRescheduleType('week');
                            setSelectedDate(new Date());
                            setShowRescheduleDialog(true);
                          }}
                          className="rounded-full text-xs"
                          disabled={isScheduling}
                        >
                          <Icon name="calendar-days" size={ICON_SIZE_SM} weight="duotone" className="mr-1.5" />
                          Week
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRescheduleType('month');
                            setSelectedDate(new Date());
                            setShowRescheduleDialog(true);
                          }}
                          className="rounded-full text-xs"
                          disabled={isScheduling}
                        >
                          <Icon name="calendar-range" size={ICON_SIZE_SM} weight="duotone" className="mr-1.5" />
                          Month
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          }

          // Show info message when AI scheduling is disabled but there are unscheduled tasks
          if (
            unscheduledCount > 0 &&
            !aiSettings.autoSchedulingEnabled
          ) {
            return (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <Card className="p-4 border border-muted bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Icon name="sparkles" size={ICON_SIZE_LG} weight="duotone" className="text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        AI scheduling is disabled. Enable it in
                        Settings to automatically schedule your{" "}
                        {unscheduledCount} unscheduled task
                        {unscheduledCount === 1 ? "" : "s"}.
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          }

          return null;
        })()}

        {/* AI Scheduler Info */}
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className={cn("w-20 h-20 mb-6 rounded-full flex items-center justify-center", UI_INBOX_GRADIENTS.emptyState.className)}>
            <Icon name="brain" size={ICON_SIZE_3XL} weight="duotone" className="text-primary" />
          </div>
          <h3 className="font-semibold text-lg mb-2">
            AI Smart Scheduler
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Use the scheduler above to automatically organize
            your unscheduled tasks across upcoming days based on
            priority.
          </p>
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 max-w-md">
            <p className="text-xs text-muted-foreground">
              The AI scheduler analyzes task priority, due
              dates, and status to intelligently distribute your
              workload. Enable priority-based scheduling in
              Settings for optimal results.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
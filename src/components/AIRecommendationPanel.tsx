import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  Brain,
  Clock,
  Target,
  Calendar,
  X,
  Check,
  RefreshCw,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { useAI } from "../contexts/AIContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useAIScheduler } from "../hooks/useAIScheduler";
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
import type { SchedulePlan, ScheduleResult } from "../hooks/useAIScheduler";
import type { Task } from "../types";

interface AIRecommendationPanelProps {
  onClose: () => void;
}

export function AIRecommendationPanel({
  onClose,
}: AIRecommendationPanelProps) {
  const { hasFeature, features } = useSubscription();
  const { settings: aiSettings } = useAI();
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

  const handleScheduleUnscheduledTasks = () => {
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

    const result = generateSchedulePlan();
    
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

  const handleProceedWithExceedsLimit = () => {
    setShowExceedsLimitDialog(false);
    // Regenerate plan and proceed with scheduling
    const result = generateSchedulePlan();
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
      return `Today at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    if (isTomorrow)
      return `Tomorrow at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

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
              <Clock className="w-5 h-5 text-orange-500" />
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
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
                    <Calendar className="mr-2 h-4 w-4" />
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
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
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
                            <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1">
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
              onClick={() => {
                setShowSchedulePreview(false);
                setSchedulePlan([]);
              }}
              className="rounded-full"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={confirmScheduling}
              className="rounded-full bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7] hover:from-[#C9E4F7] hover:to-[#E6D5F0]"
            >
              <Check className="w-4 h-4 mr-2" />
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
                <Card className="p-4 border-2 border-primary/20 bg-gradient-to-br from-[#C9E4F7]/30 to-[#B8E6D5]/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Brain className="w-5 h-5 text-primary" />
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
                      <Button
                        onClick={handleScheduleUnscheduledTasks}
                        className="w-full rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                        size="default"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {aiSettings.priorityBasedScheduling
                          ? "Schedule by Priority"
                          : "Schedule Tasks"}
                      </Button>
                    )}
                    
                    {/* Reschedule Options - Always show when AI scheduling is enabled */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <RefreshCw className="w-4 h-4 text-primary/70" />
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
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
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
                          <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
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
                          <CalendarRange className="w-3.5 h-3.5 mr-1.5" />
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
                    <Sparkles className="w-5 h-5 text-muted-foreground" />
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
          <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-[#E6D5F0] to-[#C9E4F7] flex items-center justify-center">
            <Brain className="w-10 h-10 text-primary" />
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
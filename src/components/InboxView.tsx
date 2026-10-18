import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
// Icons migrated to Icon component
import { triggerSelectionHaptic } from "../lib/native-haptics";
import { Icon } from "./Icon";
import { useTasks } from "../contexts/TaskContext";
import { usePermissions } from "../hooks/usePermissions";
import { useAIScheduler } from "../hooks/useAIScheduler";
import { useAI } from "../contexts/AIContext";
import { AI_PANEL_UI_TEXT } from "../lib/navigation-constants";
import { getTaskMinutes } from "../lib/daily-hours-utils";
import { PRIORITY_WEIGHTS } from "../lib/ai-config";
import {
  END_OF_DAY_HOUR,
  END_OF_DAY_MINUTE,
  END_OF_DAY_SECOND,
  END_OF_DAY_MILLISECOND,
  TWO_WEEKS_DAYS,
  DAYS_IN_WEEK,
} from "../lib/business-constants";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { InboxTaskCard } from "./InboxTaskCard";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { TaskDialog } from "./TaskDialog";
import { UI_INBOX_GRADIENTS, TOGGLE_SWITCH_COLORS } from "../lib/ui-colors";
import { TOGGLE_SWITCH_DIMENSIONS, TOGGLE_SWITCH_SPACING, TOGGLE_SWITCH_TEXT_SIZES, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE, VIEWPORT_BREAKPOINTS, HEADER_GAP_SMALL, HEADER_GAP_XSMALL, MOBILE_PADDING_BOTTOM, COMPONENT_DIMENSIONS, HEADER_DESCRIPTION_SIZE, HEADER_DESCRIPTION_MARGIN_TOP, PANEL_PADDING_TOP_MOBILE, PANEL_EMPTY_STATE_PADDING_Y_LARGE, EMPTY_STATE_MARGIN_BOTTOM_SMALL, EMPTY_STATE_MARGIN_BOTTOM_LARGE, EMPTY_STATE_PADDING_X, ICON_SIZE_XS, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_XL, ICON_SIZE_3XL, getCheckboxSizePxForWidth, getCheckboxVisualSizePxForWidth } from "../lib/layout-constants";
import { toast } from "../lib/toast-wrapper";
import { logger } from "../lib/logger";
import { cn, prepareTaskForDialog, getDateString, parseCalendarEventTime } from "../lib/utils";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { useAuth } from "../contexts/AuthContext";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { CalendarEventCard } from "./CalendarEventCard";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { useOrientation } from "../hooks/useOrientation";
import { CheckboxSwitch as Switch } from "./ui/checkbox-switch";
import { Label } from "./ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
// Trash2 icon migrated to Icon component
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import type { Task } from "../types";

const getTwoWeekDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = (day + (DAYS_IN_WEEK - 1)) % DAYS_IN_WEEK;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + (TWO_WEEKS_DAYS - 1));
  end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
  return { startDate: start, endDate: end };
};


interface InboxHeaderPillProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
}

function InboxHeaderPill({ icon, label, onClick, disabled, busy, className }: InboxHeaderPillProps) {
  return (
    <button
      type="button"
      onClick={() => {
        void triggerSelectionHaptic();
        onClick();
      }}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 min-w-8 flex-shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-2 sm:h-9 sm:min-w-9 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5",
        className,
      )}
    >
      <Icon name={icon} size={ICON_SIZE_MD} className={cn("flex-shrink-0", busy && "animate-pulse")} />
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </button>
  );
}

export function InboxView() {
  const { tasks, addTask, bulkDeleteTasks, updateTask, isLoading } = useTasks();
  const permissionsResult = usePermissions();
  const permissions = permissionsResult || {
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: true,
    canAssignTask: true,
    canManageTeam: true,
    canViewAnalytics: true,
    role: 'admin' as const,
  };
  const { scheduleAllTasks, generateSchedulePlan, applySchedulePlan, isScheduling } = useAIScheduler();
  const { settings: aiSettings } = useAI();
  const shouldUseMobileLayout = useMobileLayout();
  const orientation = useOrientation();
  const isLandscape = orientation === 'landscape';
  
  // Detect small monitor (1024px - 1279px) for responsive checkbox sizing
  const [isSmallMonitor, setIsSmallMonitor] = useState(false);
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsSmallMonitor(width >= VIEWPORT_BREAKPOINTS.tablet && width < VIEWPORT_BREAKPOINTS.desktop);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // Tap target (44px on touch) and drawn size (20px on mobile/tablet) for checkboxes
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
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] =
    useState<string>("all");
  const [filterStatus, setFilterStatus] =
    useState<string>("all");
  const [isTaskDialogOpen, setIsTaskDialogOpen] =
    useState(false);
  const [selectedTask, setSelectedTask] = useState<
    Task | undefined
  >();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [showScheduled, setShowScheduled] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Today's date for calendar events (stable per calendar day)
  const todayDateString = getDateString(new Date());
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [todayDateString]);
  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
    return d;
  }, [todayDateString]);
  const { accessToken } = useAuth();
  const { events: todayCalendarEventsData } = useCalendarEvents(todayStart, todayEnd, {
    enabled: !!accessToken,
    debounceMs: TIMING_CONSTANTS.delays.calendarEventsDebounce,
  });
  const todayCalendarEvents = useMemo(() => {
    return todayCalendarEventsData.filter((event) => {
      if (!event?.start) return false;
      try {
        const eventDate = parseCalendarEventTime(event.start);
        if (isNaN(eventDate.getTime())) return false;
        return getDateString(eventDate) === todayDateString;
      } catch {
        return false;
      }
    });
  }, [todayCalendarEventsData, todayDateString]);

  const sortedTodayCalendarEvents = useMemo(
    () => [...todayCalendarEvents].sort((a, b) => parseCalendarEventTime(a.start).getTime() - parseCalendarEventTime(b.start).getTime()),
    [todayCalendarEvents]
  );

  // Get unscheduled tasks (or scheduled if showScheduled is true)
  // Consistent definition: unscheduled = scheduledDate === null/undefined and not done
  // This includes: regular tasks, recurring tasks, and rollover tasks
  const taskList = Array.isArray(tasks) ? tasks : [];
  const unscheduledTasks = taskList.filter(
    (t) => {
      if (showScheduled) {
        // Show scheduled tasks that are not done
        return t.scheduledDate && t.status !== "done";
      } else {
        // Show unscheduled tasks that are not done
        // Includes: regular tasks, recurring tasks, and rollover tasks (all have scheduledDate === null)
        return !t.scheduledDate && t.status !== "done";
      }
    }
  );

  // Apply filters
  const filteredTasks = unscheduledTasks.filter((task) => {
    const matchesSearch =
      !searchQuery ||
      task.title
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      false ||
      task.description
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      false;
    const matchesPriority =
      filterPriority === "all" ||
      task.priority === filterPriority;
    const matchesStatus =
      filterStatus === "all" || task.status === filterStatus;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  // Sort by priority
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Use PRIORITY_WEIGHTS from ai-config.ts instead of hardcoded values
    const aPriority = PRIORITY_WEIGHTS[a.priority] || 1;
    const bPriority = PRIORITY_WEIGHTS[b.priority] || 1;

    if (aPriority !== bPriority) return bPriority - aPriority;

    // Secondary sort by created date
    return (
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
    );
  });

  const handleQuickAdd = () => {
    if (!quickAddTitle.trim()) return;

    // Create a temporary task object for AI duration estimation
    const tempTask: Task = {
      id: 'temp',
      title: quickAddTitle.trim(),
      description: "",
      status: "todo",
      priority: "medium",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectId: "default",
      folderId: null,
      dueDate: null,
      scheduledDate: null,
      estimatedTime: null, // Explicitly null to trigger AI estimator
      actualTime: null,
      dependencies: [],
      subtasks: [],
      recurrence: { type: 'none', interval: 1 },
      notes: '',
      assignedTo: [],
      createdBy: 'local',
      completedAt: null,
    };

    // Use AI Duration Estimator to get estimated duration
    const aiEstimatedMinutes = getTaskMinutes(tempTask);
    
    logger.debug('InboxView: AI Duration Estimator triggered for quick add task', {
      taskTitle: quickAddTitle.trim(),
      aiEstimatedMinutes,
    });

    // Check permissions
    if (!permissions.canCreateTask) {
      toast.error('Permission Denied', {
        description: 'Viewer role does not have permission to create tasks. Please contact an admin.',
      });
      return;
    }

    const newTask: Partial<Task> = {
      title: quickAddTitle.trim(),
      description: "",
      status: "todo",
      priority: "medium",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedTime: aiEstimatedMinutes > 0 ? aiEstimatedMinutes : null,
    };

    addTask(newTask);
    setQuickAddTitle("");
    setIsQuickAddOpen(false);

    toast.success("Task added to inbox", {
      description:
        "You can schedule it later or let the scheduler handle it",
      playSound: true,
    });
  };

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
      setIsTaskDialogOpen(true);
    });
  };

  const isSchedulingRef = useRef(false);
  
  const handleScheduleSelected = useCallback(async () => {
    if (!permissions.canEditTask) {
      toast.error('Permission Denied', {
        description: 'Viewer role does not have permission to edit tasks. Please contact an admin.',
      });
      return;
    }
    if (!aiSettings.autoSchedulingEnabled || !aiSettings.scheduleUnscheduledTasks) {
      toast.info(
        aiSettings.autoSchedulingEnabled
          ? AI_PANEL_UI_TEXT.schedule.settingOff
          : AI_PANEL_UI_TEXT.disabled(selectedTaskIds.size),
      );
      return;
    }
    if (selectedTaskIds.size === 0) {
      toast.info("No tasks selected", {
        description: "Please select tasks to schedule",
      });
      return;
    }

    // Prevent duplicate calls - if already scheduling, return early
    if (isScheduling || isSchedulingRef.current) {
      logger.debug('Already scheduling, ignoring duplicate call', { isScheduling, isSchedulingRef: isSchedulingRef.current });
      return;
    }

    // Get selected tasks
    const selectedTasks = sortedTasks.filter(task => selectedTaskIds.has(task.id));
    
    if (selectedTasks.length === 0) {
      toast.info("No valid tasks to schedule", {
        description: "Selected tasks may have been filtered out",
      });
      return;
    }

    // Set flag to prevent duplicate calls
    isSchedulingRef.current = true;

    const loadingToast = toast.loading(
      "Scheduling selected tasks...",
      {
        description: `Organizing ${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}`,
      },
    );

    try {
      // Calculate two week date range
      const { startDate, endDate } = getTwoWeekDateRange();
      
      // Generate schedule plan for selected tasks only
      const result = await generateSchedulePlan(
        selectedTasks,
        { startDate, endDate },
        {
          forceCategoryHours: true,
          enforceMinimumHours: true
        }
      ).catch((error) => {
        logger.error('Promise rejected in generateSchedulePlan:', error);
        throw error;
      });

      // Apply the schedule plan
      if (result && result.scheduled && result.scheduled.length > 0) {
        await applySchedulePlan(result.scheduled, false).catch((planError) => {
          logger.error('Error applying schedule plan:', planError);
          // Don't throw - result is still valid even if some tasks failed to update
        });
      }

      toast.dismiss(loadingToast);

      if (result && result.scheduled && result.scheduled.length > 0) {
        toast.success("Tasks scheduled!", {
          description: `Scheduled ${result.scheduled.length} task${result.scheduled.length === 1 ? "" : "s"} across the next two weeks`,
        });
        
        // Clear selection after successful scheduling
        setSelectedTaskIds(new Set());
      } else {
        toast.info("No available slots", {
          description: "Auto Scheduler couldn't find openings within the next two weeks.",
        });
      }

      if (result && result.exceedsLimit && result.exceedsLimit.length > 0) {
        toast.warning(
          `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? "" : "s"} need manual scheduling`,
          {
            description: "No remaining time within the next two weeks for these tasks.",
          },
        );
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      logger.error('Error in handleScheduleSelected:', error);
      
      // Filter out browser extension errors from user-facing messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isExtensionError = errorMessage.includes('message channel') || 
                               errorMessage.includes('listener indicated') ||
                               errorMessage.includes('asynchronous response');
      
      if (!isExtensionError) {
        toast.error("Scheduling failed", {
          description: errorMessage || "Please try again",
        });
      } else {
        // Extension error - log but don't show to user, scheduler might still work
        logger.warn('Browser extension error detected (non-critical):', errorMessage);
      }
    } finally {
      // Reset flag when done
      isSchedulingRef.current = false;
    }
  }, [permissions.canEditTask, aiSettings, selectedTaskIds, sortedTasks, generateSchedulePlan, applySchedulePlan, isScheduling]);

  const handleUnscheduleSelected = useCallback(async () => {
    if (!permissions.canEditTask) {
      toast.error('Permission Denied', {
        description: 'Viewer role does not have permission to edit tasks. Please contact an admin.',
      });
      return;
    }
    if (selectedTaskIds.size === 0) {
      toast.info("No tasks selected", {
        description: "Please select tasks to unschedule",
      });
      return;
    }

    const selectedTasks = sortedTasks.filter(task => selectedTaskIds.has(task.id));
    
    if (selectedTasks.length === 0) {
      toast.info("No valid tasks to unschedule", {
        description: "Selected tasks may have been filtered out",
      });
      return;
    }

    const loadingToast = toast.loading(
      "Unscheduling selected tasks...",
      {
        description: `Removing schedule from ${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}`,
      },
    );

    try {
      // Remove scheduledDate from all selected tasks
      const updatePromises = selectedTasks.map(task =>
        updateTask(task.id, { scheduledDate: null })
      );

      await Promise.all(updatePromises);

      toast.dismiss(loadingToast);
      toast.success("Tasks unscheduled!", {
        description: `Removed schedule from ${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}`,
      });
      
      // Clear selection after successful unscheduling
      setSelectedTaskIds(new Set());
    } catch (error) {
      toast.dismiss(loadingToast);
      logger.error('Error in handleUnscheduleSelected:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error("Unscheduling failed", {
        description: errorMessage || "Please try again",
      });
    }
  }, [permissions.canEditTask, selectedTaskIds, sortedTasks, updateTask]);

  const handleScheduleAll = useCallback(async () => {
    if (!permissions.canEditTask) {
      toast.error('Permission Denied', {
        description: 'Viewer role does not have permission to edit tasks. Please contact an admin.',
      });
      return;
    }
    if (!aiSettings.autoSchedulingEnabled || !aiSettings.scheduleUnscheduledTasks) {
      toast.info(
        aiSettings.autoSchedulingEnabled
          ? AI_PANEL_UI_TEXT.schedule.settingOff
          : AI_PANEL_UI_TEXT.disabled(unscheduledTasks.length),
      );
      return;
    }
    logger.debug('handleScheduleAll called', { unscheduledTasksCount: unscheduledTasks.length });
    
    // Prevent duplicate calls - if already scheduling, return early
    if (isScheduling || isSchedulingRef.current) {
      logger.debug('Already scheduling, ignoring duplicate call', { isScheduling, isSchedulingRef: isSchedulingRef.current });
      return;
    }
    
    if (unscheduledTasks.length === 0) {
      logger.debug('No tasks to schedule - inbox is empty');
      toast.info("No tasks to schedule", {
        description: "Your inbox is empty!",
      });
      return;
    }
    
    // Set flag to prevent duplicate calls
    isSchedulingRef.current = true;

    const loadingToast = toast.loading(
      "Scheduling inbox tasks...",
      {
        description: `Organizing ${unscheduledTasks.length} task${unscheduledTasks.length === 1 ? "" : "s"}`,
      },
    );

    try {
      logger.debug('Calling scheduleAllTasks', { period: 'twoWeeks', onlyWithoutDueDate: true, forceCategoryHours: true });
      
      // Schedule only tasks without due dates for a two week period, using category hours
      const result = await scheduleAllTasks({ 
        period: 'twoWeeks',
        onlyWithoutDueDate: true,
        forceCategoryHours: true 
      }).catch((error) => {
        logger.error('Promise rejected in scheduleAllTasks:', error);
        throw error;
      });
      
      toast.dismiss(loadingToast);
      
      if (result && result.scheduled && result.scheduled.length > 0) {
        toast.success("Inbox cleared!", {
          description: `Scheduled ${result.scheduled.length} task${result.scheduled.length === 1 ? "" : "s"} across the next two weeks`,
        });
      } else {
        toast.info("No available slots", {
          description: "Auto Scheduler couldn't find openings within the next two weeks.",
        });
      }

      if (result && result.exceedsLimit && result.exceedsLimit.length > 0) {
        toast.warning(
          `${result.exceedsLimit.length} task${result.exceedsLimit.length === 1 ? "" : "s"} need manual scheduling`,
          {
            description: "No remaining time within the next two weeks for these tasks.",
          },
        );
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      logger.error('Error in handleScheduleAll:', error);
      
      // Filter out browser extension errors from user-facing messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isExtensionError = errorMessage.includes('message channel') || 
                               errorMessage.includes('listener indicated') ||
                               errorMessage.includes('asynchronous response');
      
      if (!isExtensionError) {
        toast.error("Scheduling failed", {
          description: errorMessage || "Please try again",
        });
      } else {
        logger.warn('Browser extension error detected (non-critical):', errorMessage);
      }
    } finally {
      // Reset flag when done
      isSchedulingRef.current = false;
    }
  }, [permissions.canEditTask, aiSettings, unscheduledTasks, scheduleAllTasks, isScheduling]);

  const handleToggleSelect = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.size === sortedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(sortedTasks.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    
    // Check permissions
    if (!permissions.canDeleteTask) {
      toast.error('Permission Denied', {
        description: 'Viewer role does not have permission to delete tasks. Please contact an admin.',
      });
      return;
    }
    
    const taskIdsArray = Array.from(selectedTaskIds);
    await bulkDeleteTasks(taskIdsArray);
    setSelectedTaskIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  // Clear selection when tasks change (e.g., after deletion or filter change)
  useEffect(() => {
    setSelectedTaskIds(prev => {
      const currentTaskIds = new Set(sortedTasks.map(t => t.id));
      const filtered = new Set([...prev].filter(id => currentTaskIds.has(id)));
      return filtered.size !== prev.size ? filtered : prev;
    });
  }, [sortedTasks]);

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);

  const renderInboxTaskList = () => (
    <div className="flex flex-col">
      <AnimatePresence mode="popLayout">
        {isLoading && sortedTasks.length === 0 ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center text-center"
            style={{
              paddingTop: PANEL_EMPTY_STATE_PADDING_Y_LARGE,
              paddingBottom: PANEL_EMPTY_STATE_PADDING_Y_LARGE,
              paddingLeft: EMPTY_STATE_PADDING_X,
              paddingRight: EMPTY_STATE_PADDING_X,
            }}
          >
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground mt-3">Loading tasks…</p>
          </motion.div>
        ) : sortedTasks.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center text-center"
            style={{
              paddingTop: PANEL_EMPTY_STATE_PADDING_Y_LARGE,
              paddingBottom: PANEL_EMPTY_STATE_PADDING_Y_LARGE,
              paddingLeft: EMPTY_STATE_PADDING_X,
              paddingRight: EMPTY_STATE_PADDING_X,
            }}
          >
            <Icon
              name="inbox"
              size={ICON_SIZE_3XL}
              weight="duotone"
              className="text-primary"
              style={{
                marginBottom: EMPTY_STATE_MARGIN_BOTTOM_LARGE,
              }}
            />
            <h3
              className="text-xl"
              style={{
                marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
              }}
            >
              Your inbox is clear!
            </h3>
            <p
              className="text-muted-foreground max-w-sm"
              style={{
                marginBottom: EMPTY_STATE_MARGIN_BOTTOM_LARGE,
              }}
            >
              {unscheduledTasks.length > 0
                ? "No tasks match your current filters."
                : "All tasks are scheduled. Add new tasks or adjust your filters."}
            </p>
          </motion.div>
        ) : (
          sortedTasks.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.03 }}
              layout
            >
              <InboxTaskCard
                task={task}
                selected={selectedTaskIds.has(task.id)}
                onToggleSelect={() => toggleTaskSelection(task.id)}
                onClick={() => handleTaskClick(task)}
                checkboxSizePx={checkboxSizePx}
                visualSizePx={visualSizePx}
              />
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div
      className={cn(`flex flex-col ${UI_INBOX_GRADIENTS.main.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`, shouldUseMobileLayout ? 'min-h-full' : 'h-full')}
      data-tour="inbox-panel"
    >
      <AppHeader
        title="Inbox"
        panelOpen={true}
        isSidePanelHeader={true}
        description={selectedTaskIds.size > 0 
          ? undefined 
          : (showScheduled 
            ? `${unscheduledTasks.length} scheduled task${unscheduledTasks.length === 1 ? "" : "s"}`
            : `${unscheduledTasks.length} unscheduled task${unscheduledTasks.length === 1 ? "" : "s"}`
          )
        }
        hideDesktopLogo
        actions={
          <div className={cn(
            "flex flex-shrink-0 max-w-full",
            selectedTaskIds.size > 0 ? "flex-col items-end" : "items-center flex-wrap gap-1"
          )} style={{ 
            gap: !shouldUseMobileLayout
              ? HEADER_GAP_XSMALL // Reduced gap for desktop to prevent overlap (4px)
              : HEADER_GAP_SMALL 
          }}>
            {selectedTaskIds.size > 0 ? (
              <>
                <p 
                  className="hidden text-muted-foreground text-right sm:block"
                  style={{ 
                    fontSize: HEADER_DESCRIPTION_SIZE,
                    marginBottom: HEADER_DESCRIPTION_MARGIN_TOP,
                  }}
                >
                  {showScheduled 
                    ? `${unscheduledTasks.length} scheduled task${unscheduledTasks.length === 1 ? "" : "s"}`
                    : `${unscheduledTasks.length} unscheduled task${unscheduledTasks.length === 1 ? "" : "s"}`
                  }
                </p>
                <div className="flex items-center flex-wrap flex-shrink-0 justify-end" style={{ gap: HEADER_GAP_SMALL }}>
                  <InboxHeaderPill
                    icon="check-square"
                    label={selectedTaskIds.size === sortedTasks.length ? "Deselect all" : "Select all"}
                    onClick={handleSelectAll}
                  />
                  {showScheduled ? (
                    <InboxHeaderPill
                      icon="calendar"
                      label={`Unschedule (${selectedTaskIds.size})`}
                      disabled={!permissions.canEditTask}
                      onClick={handleUnscheduleSelected}
                    />
                  ) : (
                    <InboxHeaderPill
                      icon="sparkle"
                      label={`Schedule (${selectedTaskIds.size})`}
                      disabled={isScheduling || !permissions.canEditTask}
                      busy={isScheduling}
                      onClick={handleScheduleSelected}
                    />
                  )}
                  <InboxHeaderPill
                    icon="trash-2"
                    label={`Delete (${selectedTaskIds.size})`}
                    onClick={() => {
                      if (!permissions.canDeleteTask) {
                        toast.error('Permission Denied', {
                          description: 'Viewer role does not have permission to delete tasks. Please contact an admin.',
                        });
                        return;
                      }
                      setShowBulkDeleteConfirm(true);
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <InboxHeaderPill
                  icon="plus"
                  label="New task"
                  className="hidden sm:inline-flex"
                  disabled={!permissions.canCreateTask}
                  onClick={() => {
                    setSelectedTask(undefined);
                    setIsTaskDialogOpen(true);
                  }}
                />
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Quick Add and Filters Section */}
        <div 
          className="px-4 md:px-8 py-6 border-b border-primary/10 bg-white/50 dark:bg-background/50 backdrop-blur-sm flex-shrink-0"
          style={shouldUseMobileLayout ? undefined : undefined} // App.tsx scroll container handles top spacing on mobile - no extra padding needed
        >
          <div className="flex flex-col gap-4">
            {/* Filters */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Icon name="search" size={ICON_SIZE_MD} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  className="pl-9 bg-white dark:bg-card"
                />
              </div>

              <Select
                value={filterPriority}
                onValueChange={setFilterPriority}
              >
                <SelectTrigger className="w-full bg-white dark:bg-card">
                  <Icon name="filter" size={ICON_SIZE_MD} className="mr-2" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Priority
                  </SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterStatus}
                onValueChange={setFilterStatus}
              >
                <SelectTrigger className="w-full bg-white dark:bg-card">
                  <Icon name="filter" size={ICON_SIZE_MD} className="mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Status
                  </SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">
                    In Progress
                  </SelectItem>
                  <SelectItem value="on-hold">
                    On Hold
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Show Scheduled Tasks Toggle */}
              <div className={cn(
                "flex items-center justify-between rounded-lg border",
                TOGGLE_SWITCH_SPACING.container.padding.allClass,
                TOGGLE_SWITCH_COLORS.card.background.light,
                TOGGLE_SWITCH_COLORS.card.background.dark,
                TOGGLE_SWITCH_COLORS.card.border.light,
              )}>
                <div className={cn("flex items-center", TOGGLE_SWITCH_SPACING.container.gapClass)}>
                  <Icon 
                    name="calendar"
                    size={ICON_SIZE_MD}
                    weight="duotone"
                    className={cn(
                      TOGGLE_SWITCH_COLORS.text.active.light
                    )} />
                  <Label htmlFor="show-scheduled" className={cn(
                    TOGGLE_SWITCH_TEXT_SIZES.label.medium,
                    "font-medium cursor-pointer"
                  )}>
                    Show Scheduled Tasks
                  </Label>
                </div>
                <Switch
                  id="show-scheduled"
                  checked={showScheduled}
                  onCheckedChange={setShowScheduled}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Task List */}
        {/* On mobile, rely on parent scroll container in App.tsx - no ScrollArea */}
        <div className="flex-1 min-h-0">
          {!shouldUseMobileLayout ? (
            <ScrollArea className="h-full">
              <div className="p-4 md:p-8 pb-safe">
                {/* Today's calendar events - timeline context in Inbox */}
                {todayCalendarEvents.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Icon name="calendar" size={ICON_SIZE_XS} weight="duotone" />
                      Today&apos;s calendar
                    </h3>
                    <div className="space-y-2">
                      {sortedTodayCalendarEvents.map((event) => (
                        <CalendarEventCard
                          key={event.id}
                          title={event.title}
                          start={event.start}
                          end={event.end}
                          location={event.location}
                          provider={event.provider}
                          calendarColor={event.calendarColor}
                          isRecurring={event.isRecurring}
                          variant="timelineCompact"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {renderInboxTaskList()}
              </div>
            </ScrollArea>
            ) : (
              <div className="p-4 md:p-8" style={{ paddingBottom: shouldUseMobileLayout ? MOBILE_PADDING_BOTTOM : undefined }}>
                {/* Today's calendar events - timeline context in Inbox */}
                {todayCalendarEvents.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Icon name="calendar" size={ICON_SIZE_XS} weight="duotone" />
                      Today&apos;s calendar
                    </h3>
                    <div className="space-y-2">
                      {sortedTodayCalendarEvents.map((event) => (
                        <CalendarEventCard
                          key={event.id}
                          title={event.title}
                          start={event.start}
                          end={event.end}
                          location={event.location}
                          provider={event.provider}
                          calendarColor={event.calendarColor}
                          isRecurring={event.isRecurring}
                          variant="timelineCompact"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {renderInboxTaskList()}
              </div>
            )}
        </div>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setSelectedTask(undefined);
        }}
        task={selectedTask}
      />
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTaskIds.size} task{selectedTaskIds.size === 1 ? '' : 's'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
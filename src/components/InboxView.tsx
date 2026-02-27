import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { usePermissions } from "../hooks/usePermissions";
import { useAIScheduler } from "../hooks/useAIScheduler";
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
import { TaskDialog } from "./TaskDialog";
import { UI_INBOX_GRADIENTS, TOGGLE_SWITCH_COLORS } from "../lib/ui-colors";
import { TOGGLE_SWITCH_DIMENSIONS, TOGGLE_SWITCH_SPACING, TOGGLE_SWITCH_TEXT_SIZES, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE, VIEWPORT_BREAKPOINTS, HEADER_GAP_SMALL, HEADER_GAP_XSMALL, MOBILE_PADDING_BOTTOM, COMPONENT_DIMENSIONS, HEADER_DESCRIPTION_SIZE, HEADER_DESCRIPTION_MARGIN_TOP, PANEL_PADDING_TOP_MOBILE, PANEL_EMPTY_STATE_PADDING_Y_LARGE, EMPTY_STATE_MARGIN_BOTTOM_SMALL, EMPTY_STATE_MARGIN_BOTTOM_LARGE, EMPTY_STATE_PADDING_X, INBOX_CARD_SHADOW_MOBILE, ICON_SIZE_XS, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_XL, ICON_SIZE_3XL, getCheckboxSizePxForWidth, getCheckboxVisualSizePxForWidth } from "../lib/layout-constants";
import { TASK_CARD_ASSIGNED_USER_COLORS, TASK_CARD_ADDITIONAL_FONT_SIZES, TASK_CARD_TEXT_COLORS } from "../lib/task-card-constants";
import { toast } from "../lib/toast-wrapper";
import { logger } from "../lib/logger";
import { cn, getInitials, getAbbreviatedDisplayName, prepareTaskForDialog, sanitizeHTML, hasHTMLTags, getDateString, parseCalendarEventTime } from "../lib/utils";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { useAuth } from "../contexts/AuthContext";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { CalendarEventCard } from "./CalendarEventCard";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { useOrientation } from "../hooks/useOrientation";
import { CheckboxSwitch as Switch } from "./ui/checkbox-switch";
import { Checkbox } from "./ui/checkbox";
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

export function InboxView() {
  const { tasks, addTask, bulkDeleteTasks, updateTask } = useTasks();
  const { getTeamMember } = useTeam();
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
  const unscheduledTasks = tasks.filter(
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
        "You can schedule it later or let AI handle it",
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
          description: "AI Scheduler couldn't find openings within the next two weeks.",
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
  }, [permissions.canEditTask, selectedTaskIds, sortedTasks, generateSchedulePlan, applySchedulePlan, isScheduling]);

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
          description: "AI Scheduler couldn't find openings within the next two weeks.",
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
  }, [permissions.canEditTask, unscheduledTasks, scheduleAllTasks, isScheduling]);

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "border-l-red-400 bg-red-50/50 dark:bg-red-950/10";
      case "high":
        return "border-l-orange-400 bg-orange-50/50 dark:bg-orange-950/10";
      case "medium":
        return "border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/10";
      case "low":
        return "border-l-gray-400 bg-gray-50/50 dark:bg-muted/10";
      default:
        return "border-l-gray-400 bg-gray-50/50 dark:bg-muted/10";
    }
  };

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
            gap: typeof window !== 'undefined' && window.innerWidth >= VIEWPORT_BREAKPOINTS.tablet 
              ? HEADER_GAP_XSMALL // Reduced gap for desktop to prevent overlap (4px)
              : HEADER_GAP_SMALL 
          }}>
            {selectedTaskIds.size > 0 ? (
              <>
                <p 
                  className="text-muted-foreground text-right"
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
                <div className="flex items-center flex-wrap flex-shrink-0" style={{ gap: HEADER_GAP_SMALL }}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={handleSelectAll}
                        className="cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectAll();
                          }
                        }}
                      >
                        <Icon 
                          name="check-square"
                          size={ICON_SIZE_XL}
                          className="text-primary dark:text-primary-foreground flex-shrink-0"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{selectedTaskIds.size === sortedTasks.length ? "Deselect All" : "Select All"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={isScheduling || !permissions.canEditTask ? undefined : handleScheduleSelected}
                        className={cn(
                          "cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80",
                          (isScheduling || !permissions.canEditTask) && "opacity-50 cursor-not-allowed"
                        )}
                        role="button"
                        tabIndex={isScheduling || !permissions.canEditTask ? -1 : 0}
                        onKeyDown={(e) => {
                          if (isScheduling || !permissions.canEditTask) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleScheduleSelected();
                          }
                        }}
                      >
                        <Icon 
                          name="head-circuit"
                          size={ICON_SIZE_XL}
                          weight="duotone"
                          className={cn(
                            "text-primary dark:text-primary-foreground flex-shrink-0",
                            isScheduling && "animate-spin"
                          )}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Schedule ({selectedTaskIds.size})</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={!permissions.canEditTask ? undefined : handleUnscheduleSelected}
                        className={cn(
                          "cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80",
                          !permissions.canEditTask && "opacity-50 cursor-not-allowed"
                        )}
                        role="button"
                        tabIndex={!permissions.canEditTask ? -1 : 0}
                        onKeyDown={(e) => {
                          if (!permissions.canEditTask) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleUnscheduleSelected();
                          }
                        }}
                      >
                        <Icon 
                          name="calendar"
                          size={ICON_SIZE_XL}
                          weight="duotone"
                          className="text-primary dark:text-primary-foreground flex-shrink-0"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Unschedule ({selectedTaskIds.size})</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={() => {
                          if (!permissions.canDeleteTask) {
                            toast.error('Permission Denied', {
                              description: 'Viewer role does not have permission to delete tasks. Please contact an admin.',
                            });
                            return;
                          }
                          setShowBulkDeleteConfirm(true);
                        }}
                        className={cn(
                          "cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80",
                          !permissions.canDeleteTask && "opacity-50 cursor-not-allowed"
                        )}
                        role="button"
                        tabIndex={!permissions.canDeleteTask ? -1 : 0}
                        onKeyDown={(e) => {
                          if (!permissions.canDeleteTask) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setShowBulkDeleteConfirm(true);
                          }
                        }}
                      >
                        <Icon 
                          name="trash-2"
                          size={ICON_SIZE_XL}
                          className="text-destructive flex-shrink-0"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete ({selectedTaskIds.size})</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                </div>
              </>
            ) : (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={unscheduledTasks.length === 0 || !permissions.canEditTask ? undefined : handleScheduleAll}
                        className={cn(
                          "cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80",
                          (unscheduledTasks.length === 0 || !permissions.canEditTask) && "opacity-50 cursor-not-allowed"
                        )}
                        role="button"
                        tabIndex={unscheduledTasks.length === 0 || !permissions.canEditTask ? -1 : 0}
                        onKeyDown={(e) => {
                          if (unscheduledTasks.length === 0 || !permissions.canEditTask) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleScheduleAll();
                          }
                        }}
                      >
                        <Icon 
                          name="head-circuit"
                          size={ICON_SIZE_XL}
                          weight="duotone"
                          className="text-primary dark:text-primary-foreground flex-shrink-0"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Schedule All</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={() => {
                          if (!permissions.canCreateTask) {
                            toast.error('Permission Denied', {
                              description: 'Viewer role does not have permission to create tasks. Please contact an admin.',
                            });
                            return;
                          }
                          setSelectedTask(undefined);
                          setIsTaskDialogOpen(true);
                        }}
                        className={cn(
                          "hidden sm:flex cursor-pointer items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80",
                          !permissions.canCreateTask && "opacity-50 cursor-not-allowed"
                        )}
                        role="button"
                        tabIndex={!permissions.canCreateTask ? -1 : 0}
                        onKeyDown={(e) => {
                          if (!permissions.canCreateTask) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedTask(undefined);
                            setIsTaskDialogOpen(true);
                          }
                        }}
                      >
                        <Icon 
                          name="check-square"
                          size={ICON_SIZE_XL}
                          className="text-primary dark:text-primary-foreground flex-shrink-0"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>New Task</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
            {/* Quick Add */}
            <AnimatePresence>
              {isQuickAddOpen ? (
                <motion.div
                  key="quick-add-input"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative flex items-center gap-2">
                    <Input
                      placeholder="Quick add task..."
                      value={quickAddTitle}
                      onChange={(e) =>
                        setQuickAddTitle(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleQuickAdd();
                        if (e.key === "Escape") {
                          setIsQuickAddOpen(false);
                          setQuickAddTitle("");
                        }
                      }}
                      autoFocus
                      className="flex-1 bg-white dark:bg-card border-primary/20 focus:border-primary"
                    />
                    <div
                      onClick={quickAddTitle.trim() ? handleQuickAdd : undefined}
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full transition-opacity hover:opacity-80 flex-shrink-0",
                        quickAddTitle.trim() 
                          ? "bg-primary text-primary-foreground cursor-pointer" 
                          : "bg-primary/20 text-primary/50 cursor-not-allowed"
                      )}
                      role="button"
                      tabIndex={quickAddTitle.trim() ? 0 : -1}
                      onKeyDown={(e) => {
                        if (!quickAddTitle.trim()) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleQuickAdd();
                        }
                      }}
                    >
                      <Icon 
                        name="plus" 
                        size={ICON_SIZE_MD} 
                        className="text-current"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="quick-add-button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-dashed border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => {
                      if (!permissions.canCreateTask) {
                        toast.error('Permission Denied', {
                          description: 'Viewer role does not have permission to create tasks. Please contact an admin.',
                        });
                        return;
                      }
                      setIsQuickAddOpen(true);
                    }}
                    disabled={!permissions.canCreateTask}
                  >
                    <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                    Quick add task to inbox
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

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
          {typeof window !== 'undefined' && window.innerWidth >= VIEWPORT_BREAKPOINTS.tablet ? (
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
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {sortedTasks.length === 0 ? (
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
                          <Card
                            className={cn(
                              // Responsive padding: smaller on mobile, comfortable on desktop
                              "px-3 py-2.5 md:px-4 md:py-4",
                              // Responsive borders: thinner on mobile, standard on desktop
                              "border-l-2 md:border-l-4 border-gray-300/80 md:border-gray-300/90",
                              "cursor-pointer transition-all",
                              // Better shadow blending on mobile
                              "shadow-lg hover:shadow-xl",
                              "sm:shadow-lg sm:hover:shadow-xl",
                              getPriorityColor(task.priority),
                            )}
                            style={{
                              // Custom shadow for better mobile blending
                              boxShadow: shouldUseMobileLayout 
                                ? INBOX_CARD_SHADOW_MOBILE
                                : undefined
                            }}
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="flex items-start gap-2 md:gap-3">
                              <div
                                className="mt-0.5 flex-shrink-0 flex items-center justify-center"
                                style={{ minWidth: checkboxSizePx, minHeight: checkboxSizePx }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={selectedTaskIds.has(task.id)}
                                  onCheckedChange={() => {
                                    setSelectedTaskIds(prev => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(task.id)) {
                                        newSet.delete(task.id);
                                      } else {
                                        newSet.add(task.id);
                                      }
                                      return newSet;
                                    });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-shrink-0"
                                  style={{ width: visualSizePx, height: visualSizePx, minWidth: visualSizePx, minHeight: visualSizePx }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h4 className="font-medium text-sm leading-tight">
                                    {task.title}
                                  </h4>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-xs",
                                        task.priority ===
                                          "urgent" &&
                                          "border-red-400 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
                                        task.priority ===
                                          "high" &&
                                          "border-orange-400 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/20",
                                        task.priority ===
                                          "medium" &&
                                          "border-blue-400 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/20",
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
                                        className="text-xs border-green-400 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
                                      >
                                        active
                                      </Badge>
                                    )}
                                    {task.status ===
                                      "on-hold" && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs border-yellow-400 text-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800"
                                      >
                                        on hold
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

                                {/* Assignee Display */}
                                {task.assignedTo &&
                                  task.assignedTo.length > 0 && (
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      {task.assignedTo
                                        .slice(0, 3)
                                        .map((userId) => {
                                          const member =
                                            getTeamMember(userId);
                                          if (!member)
                                            return null;

                                          const initials =
                                            getInitials(
                                              member.name,
                                            );

                                          return (
                                            <div
                                              key={userId}
                                              className="flex items-center gap-1.5"
                                            >
                                              {member.avatar ? (
                                                <div 
                                                  className="rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0"
                                                  style={{
                                                    width: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.width}px`,
                                                    height: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.height}px`,
                                                  }}
                                                >
                                                  <img
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                      const target = e.target as HTMLImageElement;
                                                      target.style.display = 'none';
                                                      const parent = target.parentElement;
                                                      if (parent) {
                                                        const fallback = document.createElement('div');
                                                        fallback.className = `rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.gradientDark} ${TASK_CARD_ASSIGNED_USER_COLORS.text} ${TASK_CARD_ASSIGNED_USER_COLORS.textDark} flex items-center justify-center ${TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.desktop} font-semibold`;
                                                        fallback.style.width = `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.width}px`;
                                                        fallback.style.height = `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.height}px`;
                                                        fallback.textContent = initials;
                                                        parent.appendChild(fallback);
                                                      }
                                                    }}
                                                  />
                                                </div>
                                              ) : (
                                                <div 
                                                  className={`rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.gradientDark} ${TASK_CARD_ASSIGNED_USER_COLORS.text} ${TASK_CARD_ASSIGNED_USER_COLORS.textDark} flex items-center justify-center ${TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile} font-semibold`}
                                                  style={{
                                                    width: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.width}px`,
                                                    height: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.height}px`,
                                                  }}
                                                >
                                                  {initials}
                                                </div>
                                              )}
                                              <span className={`${TASK_CARD_TEXT_COLORS.assignedUserName} font-semibold`} style={{ fontSize: TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserNameStandalone.fontSize }}>
                                                {getAbbreviatedDisplayName(member.name)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      {task.assignedTo.length >
                                        3 && (
                                        <span className={`${TASK_CARD_TEXT_COLORS.assignedUserCount} text-xs`}>
                                          {TASK_CARD_TEXT.moreAssigned(task.assignedTo.length - 3)}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                <div className="flex items-center gap-2 text-xs flex-wrap">
                                  {task.dueDate && (
                                    <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                      <Icon name="calendar" size={ICON_SIZE_XS} weight="duotone" />
                                      <span>
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
                                  {task.estimatedTime && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      {task.dueDate && (
                                        <span>•</span>
                                      )}
                                      <Icon name="clock" size={ICON_SIZE_XS} />
                                      <span>
                                        {task.estimatedTime} min
                                      </span>
                                    </div>
                                  )}
                                  {task.recurrence && task.recurrence.type !== "none" && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      {(task.dueDate || task.estimatedTime) && (
                                        <span>•</span>
                                      )}
                                      <Icon name="repeat" size={ICON_SIZE_XS} weight="duotone" className="text-muted-foreground" />
                                    </div>
                                  )}
                                  {task.tags &&
                                    task.tags.length > 0 && (
                                      <div className="flex items-center gap-1">
                                        {(task.dueDate ||
                                          task.estimatedTime ||
                                          (task.recurrence && task.recurrence.type !== "none")) && (
                                          <span className="text-muted-foreground">
                                            •
                                          </span>
                                        )}
                                        <Icon name="tag" size={ICON_SIZE_XS} className="text-muted-foreground" />
                                        <span className="text-muted-foreground">
                                          {task.tags
                                            .slice(0, 2)
                                            .join(", ")}
                                          {task.tags.length > 2 &&
                                            ` +${task.tags.length - 2}`}
                                        </span>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </ScrollArea>
            ) : (
              <div className="p-4 md:p-8" style={{ paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet ? MOBILE_PADDING_BOTTOM : undefined }}>
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
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {sortedTasks.length === 0 ? (
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
                        <Card
                          className={cn(
                            // Responsive padding: smaller on mobile, comfortable on desktop
                            "px-3 py-2.5 md:px-4 md:py-4",
                            // Responsive borders: thinner on mobile, standard on desktop
                            "border-l-2 md:border-l-4 border-gray-300/80 md:border-gray-300/90",
                            "cursor-pointer transition-all",
                            // Better shadow blending on mobile
                            "shadow-lg hover:shadow-xl",
                            "sm:shadow-lg sm:hover:shadow-xl",
                            getPriorityColor(task.priority),
                          )}
                          style={{
                            // Custom shadow for better mobile blending
                            boxShadow: shouldUseMobileLayout 
                              ? INBOX_CARD_SHADOW_MOBILE
                              : undefined
                          }}
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="flex items-start gap-2 md:gap-3">
                            <div
                              className="mt-0.5 flex-shrink-0 flex items-center justify-center"
                              style={{ minWidth: checkboxSizePx, minHeight: checkboxSizePx }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={selectedTaskIds.has(task.id)}
                                onCheckedChange={() => {
                                  setSelectedTaskIds(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(task.id)) {
                                      newSet.delete(task.id);
                                    } else {
                                      newSet.add(task.id);
                                    }
                                    return newSet;
                                  });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-shrink-0"
                                style={{ width: visualSizePx, height: visualSizePx, minWidth: visualSizePx, minHeight: visualSizePx }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="font-medium text-sm leading-tight">
                                  {task.title}
                                </h4>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      task.priority ===
                                        "urgent" &&
                                        "border-red-400 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
                                      task.priority ===
                                        "high" &&
                                        "border-orange-400 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/20",
                                      task.priority ===
                                        "medium" &&
                                        "border-blue-400 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/20",
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
                                      className="text-xs border-green-400 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
                                    >
                                      active
                                    </Badge>
                                  )}
                                  {task.status ===
                                    "on-hold" && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-yellow-400 text-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800"
                                    >
                                      on hold
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

                              {/* Assignee Display */}
                              {task.assignedTo &&
                                task.assignedTo.length > 0 && (
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    {task.assignedTo
                                      .slice(0, 3)
                                      .map((userId) => {
                                        const member =
                                          getTeamMember(userId);
                                        if (!member)
                                          return null;

                                        const initials =
                                          getInitials(
                                            member.name,
                                          );

                                        return (
                                          <div
                                            key={userId}
                                            className="flex items-center gap-1.5"
                                          >
                                            {member.avatar ? (
                                              <div 
                                                className="rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0"
                                                style={{
                                                  width: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.width}px`,
                                                  height: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.height}px`,
                                                }}
                                              >
                                                <img
                                                  src={member.avatar}
                                                  alt={member.name}
                                                  className="w-full h-full object-cover"
                                                  onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const parent = target.parentElement;
                                                    if (parent) {
                                                      const fallback = document.createElement('div');
                                                      fallback.className = `rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.text} flex items-center justify-center ${TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile} font-semibold`;
                                                      fallback.style.width = `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.width}px`;
                                                      fallback.style.height = `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.height}px`;
                                                      fallback.textContent = initials;
                                                      parent.appendChild(fallback);
                                                    }
                                                  }}
                                                />
                                              </div>
                                            ) : (
                                              <div 
                                                className={`rounded-full ${TASK_CARD_ASSIGNED_USER_COLORS.gradient} ${TASK_CARD_ASSIGNED_USER_COLORS.gradientDark} ${TASK_CARD_ASSIGNED_USER_COLORS.text} ${TASK_CARD_ASSIGNED_USER_COLORS.textDark} flex items-center justify-center ${TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile} font-semibold`}
                                                style={{
                                                  width: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.width}px`,
                                                  height: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.desktop.height}px`,
                                                }}
                                              >
                                                {initials}
                                              </div>
                                            )}
                                            <span className={`${TASK_CARD_TEXT_COLORS.assignedUserName} font-semibold`} style={{ fontSize: TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserNameStandalone.fontSize }}>
                                              {getAbbreviatedDisplayName(member.name)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    {task.assignedTo.length >
                                      3 && (
                                      <span className="text-xs text-gray-500">
                                        +
                                        {task.assignedTo
                                          .length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}

                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                {task.dueDate && (
                                  <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                    <Icon name="calendar" size={ICON_SIZE_XS} weight="duotone" />
                                    <span>
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
                                {task.estimatedTime && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    {task.dueDate && (
                                      <span>•</span>
                                    )}
                                    <Icon name="clock" size={ICON_SIZE_XS} />
                                    <span>
                                      {task.estimatedTime} min
                                    </span>
                                  </div>
                                )}
                                {task.recurrence && task.recurrence.type !== "none" && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    {(task.dueDate || task.estimatedTime) && (
                                      <span>•</span>
                                    )}
                                    <Icon name="repeat" size={ICON_SIZE_XS} weight="duotone" className="text-muted-foreground" />
                                  </div>
                                )}
                                {task.tags &&
                                  task.tags.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      {(task.dueDate ||
                                        task.estimatedTime ||
                                        (task.recurrence && task.recurrence.type !== "none")) && (
                                        <span className="text-muted-foreground">
                                          •
                                        </span>
                                      )}
                                      <Icon name="tag" size={ICON_SIZE_XS} className="text-muted-foreground" />
                                      <span className="text-muted-foreground">
                                        {task.tags
                                          .slice(0, 2)
                                          .join(", ")}
                                        {task.tags.length > 2 &&
                                          ` +${task.tags.length - 2}`}
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
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
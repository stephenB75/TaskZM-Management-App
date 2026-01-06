import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Inbox,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Tag,
  Sparkles,
} from "lucide-react";
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
import { TOGGLE_SWITCH_DIMENSIONS, TOGGLE_SWITCH_SPACING, TOGGLE_SWITCH_TEXT_SIZES, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE, VIEWPORT_BREAKPOINTS, HEADER_GAP_SMALL, MOBILE_PADDING_BOTTOM, COMPONENT_DIMENSIONS } from "../lib/layout-constants";
import { toast } from "../lib/toast-wrapper";
import { cn, getInitials, prepareTaskForDialog, sanitizeHTML, hasHTMLTags } from "../lib/utils";
import { useIsMobile } from "./ui/use-mobile";
import { CheckboxSwitch as Switch } from "./ui/checkbox-switch";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Trash2 } from "lucide-react";
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
  const isMobile = useIsMobile();
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
    
    console.log('🤖 InboxView: AI Duration Estimator triggered for quick add task', {
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
    if (selectedTaskIds.size === 0) {
      toast.info("No tasks selected", {
        description: "Please select tasks to schedule",
      });
      return;
    }

    // Prevent duplicate calls - if already scheduling, return early
    if (isScheduling || isSchedulingRef.current) {
      console.log('⚠️ Already scheduling, ignoring duplicate call', { isScheduling, isSchedulingRef: isSchedulingRef.current });
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
        console.error('❌ Promise rejected in generateSchedulePlan:', error);
        throw error;
      });

      // Apply the schedule plan
      if (result && result.scheduled && result.scheduled.length > 0) {
        await applySchedulePlan(result.scheduled, false).catch((planError) => {
          console.error('❌ Error applying schedule plan:', planError);
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
      console.error('❌ Error in handleScheduleSelected:', error);
      
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
        console.warn('⚠️ Browser extension error detected (non-critical):', errorMessage);
      }
    } finally {
      // Reset flag when done
      isSchedulingRef.current = false;
    }
  }, [selectedTaskIds, sortedTasks, generateSchedulePlan, applySchedulePlan, isScheduling]);

  const handleUnscheduleSelected = useCallback(async () => {
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
      console.error('❌ Error in handleUnscheduleSelected:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error("Unscheduling failed", {
        description: errorMessage || "Please try again",
      });
    }
  }, [selectedTaskIds, sortedTasks, updateTask]);

  const handleScheduleAll = useCallback(async () => {
    console.log('🎬 handleScheduleAll CALLED', { 
      unscheduledTasksCount: unscheduledTasks.length,
      unscheduledTasks: unscheduledTasks.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate }))
    });
    
    // Prevent duplicate calls - if already scheduling, return early
    if (isScheduling || isSchedulingRef.current) {
      console.log('⚠️ Already scheduling, ignoring duplicate call', { isScheduling, isSchedulingRef: isSchedulingRef.current });
      return;
    }
    
    if (unscheduledTasks.length === 0) {
      console.log('⚠️ No tasks to schedule - inbox is empty');
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
      console.log('🎯 About to call scheduleAllTasks', {
        period: 'twoWeeks',
        onlyWithoutDueDate: true,
        forceCategoryHours: true
      });
      
      // Schedule only tasks without due dates for a two week period, using category hours
      const result = await scheduleAllTasks({ 
        period: 'twoWeeks',
        onlyWithoutDueDate: true,
        forceCategoryHours: true 
      }).catch((error) => {
        // Handle promise rejection explicitly
        console.error('❌ Promise rejected in scheduleAllTasks:', error);
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
      console.error('❌ Error in handleScheduleAll:', error);
      
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
        console.warn('⚠️ Browser extension error detected (non-critical):', errorMessage);
      }
    } finally {
      // Reset flag when done
      isSchedulingRef.current = false;
    }
  }, [unscheduledTasks, scheduleAllTasks, isScheduling]);

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
      className={cn(`flex flex-col ${UI_INBOX_GRADIENTS.main.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`, isMobile ? 'min-h-full' : 'h-full')}
      data-tour="inbox-panel"
    >
      <AppHeader
        title="Inbox"
        panelOpen={true}
        isSidePanelHeader={true}
        description={showScheduled 
          ? `${unscheduledTasks.length} scheduled task${unscheduledTasks.length === 1 ? "" : "s"}`
          : `${unscheduledTasks.length} unscheduled task${unscheduledTasks.length === 1 ? "" : "s"}`
        }
        hideDesktopLogo
        actions={
          <div className="flex items-center flex-wrap" style={{ gap: HEADER_GAP_SMALL }}>
            {selectedTaskIds.size > 0 ? (
              <>
                <Button
                  onClick={handleSelectAll}
                  variant="outline"
                  className="rounded-full whitespace-nowrap"
                  style={{
                    paddingLeft: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    paddingRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    fontSize: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.textSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.textSize.desktop,
                    whiteSpace: 'nowrap',
                  }}
                  size="sm"
                >
                  <span className="hidden md:inline">
                    {selectedTaskIds.size === sortedTasks.length ? "Deselect All" : "Select All"}
                  </span>
                  <span className="md:hidden">
                    {selectedTaskIds.size === sortedTasks.length ? "Deselect" : "All"}
                  </span>
                </Button>
                <Button
                  onClick={handleScheduleSelected}
                  className={`rounded-full whitespace-nowrap ${UI_INBOX_GRADIENTS.button.className} ${UI_INBOX_GRADIENTS.button.hover.className}`}
                  style={{
                    paddingLeft: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    paddingRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    fontSize: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.textSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.textSize.desktop,
                    whiteSpace: 'nowrap',
                  }}
                  size="sm"
                  disabled={isScheduling}
                >
                  <Sparkles 
                    style={{
                      width: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      height: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      marginRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.desktop,
                    }}
                  />
                  <span className="hidden md:inline">
                    Schedule ({selectedTaskIds.size})
                  </span>
                  <span className="md:hidden">
                    {selectedTaskIds.size}
                  </span>
                </Button>
                <Button
                  onClick={handleUnscheduleSelected}
                  variant="outline"
                  className="rounded-full whitespace-nowrap"
                  style={{
                    paddingLeft: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    paddingRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    fontSize: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.textSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.textSize.desktop,
                    whiteSpace: 'nowrap',
                  }}
                  size="sm"
                >
                  <Calendar 
                    style={{
                      width: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      height: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      marginRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.desktop,
                    }}
                  />
                  <span className="hidden md:inline">
                    Unschedule ({selectedTaskIds.size})
                  </span>
                  <span className="md:hidden">
                    {selectedTaskIds.size}
                  </span>
                </Button>
                <Button
                  onClick={() => {
                    if (!permissions.canDeleteTask) {
                      toast.error('Permission Denied', {
                        description: 'Viewer role does not have permission to delete tasks. Please contact an admin.',
                      });
                      return;
                    }
                    setShowBulkDeleteConfirm(true);
                  }}
                  disabled={!permissions.canDeleteTask}
                  variant="destructive"
                  className="rounded-full whitespace-nowrap"
                  style={{
                    paddingLeft: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    paddingRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    fontSize: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.textSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.textSize.desktop,
                    whiteSpace: 'nowrap',
                  }}
                  size="sm"
                >
                  <Trash2 
                    style={{
                      width: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      height: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      marginRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.desktop,
                    }}
                  />
                  <span className="hidden md:inline">
                    Delete ({selectedTaskIds.size})
                  </span>
                  <span className="md:hidden">
                    {selectedTaskIds.size}
                  </span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleScheduleAll}
                  className={`rounded-full whitespace-nowrap ${UI_INBOX_GRADIENTS.button.className} ${UI_INBOX_GRADIENTS.button.hover.className}`}
                  style={{
                    paddingLeft: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    paddingRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    fontSize: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.textSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.textSize.desktop,
                    whiteSpace: 'nowrap',
                  }}
                  size="sm"
                  disabled={unscheduledTasks.length === 0}
                >
                  <Sparkles 
                    style={{
                      width: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      height: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      marginRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.desktop,
                    }}
                  />
                  <span className="hidden md:inline">
                    Schedule All
                  </span>
                  <span className="md:hidden">
                    All
                  </span>
                </Button>
                <Button
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
                  disabled={!permissions.canCreateTask}
                  className="hidden sm:flex rounded-full whitespace-nowrap"
                  style={{
                    paddingLeft: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    paddingRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.paddingX.desktop,
                    fontSize: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.textSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.textSize.desktop,
                    whiteSpace: 'nowrap',
                  }}
                  size="sm"
                >
                  <Plus 
                    style={{
                      width: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      height: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconSize.desktop,
                      marginRight: isMobile ? COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.mobile : COMPONENT_DIMENSIONS.inboxHeader.button.iconMargin.desktop,
                    }}
                  />
                  <span className="hidden md:inline">
                    New Task
                  </span>
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Quick Add and Filters Section */}
        <div 
          className="px-4 md:px-8 py-6 border-b border-primary/10 bg-white/50 dark:bg-background/50 backdrop-blur-sm flex-shrink-0"
          style={isMobile ? { paddingTop: '1.5rem' } : undefined} // App.tsx header spacer handles top spacing
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
                  <Card className={`p-4 ${UI_INBOX_GRADIENTS.card.className} border-primary/20`}>
                    <div className="flex gap-2">
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
                        className="flex-1"
                      />
                      <Button
                        onClick={handleQuickAdd}
                        size="sm"
                        disabled={!quickAddTitle.trim()}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
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
                    <Plus className="w-4 h-4 mr-2" />
                    Quick add task to inbox
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filters */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
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
                  <Filter className="w-4 h-4 mr-2" />
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
                  <Filter className="w-4 h-4 mr-2" />
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
                  <Calendar className={cn(
                    TOGGLE_SWITCH_DIMENSIONS.icon.sizeClass,
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
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {sortedTasks.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center py-16 px-4 text-center"
                      >
                        <div className={`w-24 h-24 rounded-full ${UI_INBOX_GRADIENTS.emptyState.className} flex items-center justify-center mb-6 shadow-lg`}>
                          <Inbox className="w-12 h-12 text-primary" />
                        </div>
                        <h3 className="text-xl mb-2">
                          Your inbox is clear!
                        </h3>
                        <p className="text-muted-foreground max-w-sm mb-6">
                          {unscheduledTasks.length > 0
                            ? "No tasks match your current filters."
                            : "All tasks are scheduled. Add new tasks or adjust your filters."}
                        </p>
                        <Button
                          onClick={() => {
                            setSelectedTask(undefined);
                            setIsTaskDialogOpen(true);
                          }}
                          className="rounded-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Task
                        </Button>
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
                              boxShadow: isMobile 
                                ? '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.12)'
                                : undefined
                            }}
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="flex items-start gap-2 md:gap-3">
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
                                className={cn(
                                  "mt-0.5",
                                  isMobile 
                                    ? "!w-1 !h-1 !min-w-1 !min-h-1 [&_[data-slot='checkbox-indicator']_svg]:!w-0.5 [&_[data-slot='checkbox-indicator']_svg]:!h-0.5"
                                    : ""
                                )}
                                style={isMobile 
                                  ? { width: '4px', height: '4px', minWidth: '4px', minHeight: '4px' }
                                  : undefined
                                }
                              />
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
                                          "border-red-400 text-red-700 bg-red-50",
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
                                        className="text-xs border-green-400 text-green-700 bg-green-50"
                                      >
                                        active
                                      </Badge>
                                    )}
                                    {task.status ===
                                      "on-hold" && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs border-yellow-400 text-yellow-700 bg-yellow-50"
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
                                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700 flex items-center justify-center text-[8px] font-semibold">
                                                {initials}
                                              </div>
                                              <span className="text-xs text-gray-600 font-semibold">
                                                {member.name}
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
                                      <Calendar className="w-3 h-3" />
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
                                      <Clock className="w-3 h-3" />
                                      <span>
                                        {task.estimatedTime} min
                                      </span>
                                    </div>
                                  )}
                                  {task.tags &&
                                    task.tags.length > 0 && (
                                      <div className="flex items-center gap-1">
                                        {(task.dueDate ||
                                          task.estimatedTime) && (
                                          <span className="text-muted-foreground">
                                            •
                                          </span>
                                        )}
                                        <Tag className="w-3 h-3 text-muted-foreground" />
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
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {sortedTasks.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex flex-col items-center justify-center py-16 px-4 text-center"
                    >
                      <div className={`w-24 h-24 rounded-full ${UI_INBOX_GRADIENTS.emptyState.className} flex items-center justify-center mb-6 shadow-lg`}>
                        <Inbox className="w-12 h-12 text-primary" />
                      </div>
                      <h3 className="text-xl mb-2">
                        Your inbox is clear!
                      </h3>
                      <p className="text-muted-foreground max-w-sm mb-6">
                        {unscheduledTasks.length > 0
                          ? "No tasks match your current filters."
                          : "All tasks are scheduled. Add new tasks or adjust your filters."}
                      </p>
                      <Button
                        onClick={() => {
                          setSelectedTask(undefined);
                          setIsTaskDialogOpen(true);
                        }}
                        className="rounded-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Task
                      </Button>
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
                            boxShadow: isMobile 
                              ? '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.12)'
                              : undefined
                          }}
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="flex items-start gap-2 md:gap-3">
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
                              className={cn(
                                "mt-0.5",
                                isMobile 
                                  ? "!w-1 !h-1 !min-w-1 !min-h-1 [&_[data-slot='checkbox-indicator']_svg]:!w-0.5 [&_[data-slot='checkbox-indicator']_svg]:!h-0.5"
                                  : ""
                              )}
                              style={isMobile 
                                ? { width: '4px', height: '4px', minWidth: '4px', minHeight: '4px' }
                                : undefined
                              }
                            />
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
                                        "border-red-400 text-red-700 bg-red-50",
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
                                      className="text-xs border-green-400 text-green-700 bg-green-50"
                                    >
                                      active
                                    </Badge>
                                  )}
                                  {task.status ===
                                    "on-hold" && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-yellow-400 text-yellow-700 bg-yellow-50"
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
                                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700 flex items-center justify-center text-[8px] font-semibold">
                                              {initials}
                                            </div>
                                            <span className="text-xs text-gray-600 font-semibold">
                                              {member.name}
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
                                    <Calendar className="w-3 h-3" />
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
                                    <Clock className="w-3 h-3" />
                                    <span>
                                      {task.estimatedTime} min
                                    </span>
                                  </div>
                                )}
                                {task.tags &&
                                  task.tags.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      {(task.dueDate ||
                                        task.estimatedTime) && (
                                        <span className="text-muted-foreground">
                                          •
                                        </span>
                                      )}
                                      <Tag className="w-3 h-3 text-muted-foreground" />
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
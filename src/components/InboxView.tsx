import React, { useState } from "react";
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
import { useAIScheduler } from "../hooks/useAIScheduler";
import { getTaskMinutes } from "../lib/daily-hours-utils";
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
import { UI_INBOX_GRADIENTS } from "../lib/ui-colors";
import { toast } from "../lib/toast-wrapper";
import { cn, getInitials, prepareTaskForDialog, sanitizeHTML, hasHTMLTags } from "../lib/utils";
import { useIsMobile } from "./ui/use-mobile";
import { CheckboxSwitch as Switch } from "./ui/checkbox-switch";
import { Label } from "./ui/label";
import type { Task } from "../types";

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

export function InboxView() {
  const { tasks, addTask } = useTasks();
  const { getTeamMember } = useTeam();
  const { scheduleAllTasks } = useAIScheduler();
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

  // Get unscheduled tasks (or scheduled if showScheduled is true)
  const unscheduledTasks = tasks.filter(
    (t) => {
      if (showScheduled) {
        // Show scheduled tasks that are not done
        return t.scheduledDate && t.status !== "done";
      } else {
        // Show unscheduled tasks that are not done
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
    const priorityWeight = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    const aPriority = priorityWeight[a.priority] || 1;
    const bPriority = priorityWeight[b.priority] || 1;

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

    const newTask: Omit<Task, "id"> = {
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
    console.log('InboxView: handleTaskClick called with task:', task);
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
      
      console.log('InboxView: Setting selected task and opening dialog:', safeTask);
      setSelectedTask(safeTask);
      setIsTaskDialogOpen(true);
    } catch (error) {
      console.error('Error opening task:', error, task);
      toast.error('Failed to open task');
    }
  };

  const handleScheduleAll = async () => {
    console.log('🎬 handleScheduleAll CALLED', { 
      unscheduledTasksCount: unscheduledTasks.length,
      unscheduledTasks: unscheduledTasks.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate }))
    });
    
    if (unscheduledTasks.length === 0) {
      console.log('⚠️ No tasks to schedule - inbox is empty');
      toast.info("No tasks to schedule", {
        description: "Your inbox is empty!",
      });
      return;
    }

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
    }
  };

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
      className={`h-full flex flex-col ${UI_INBOX_GRADIENTS.main.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`}
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
          <div className="flex items-center gap-1.5">
            <Button
              onClick={handleScheduleAll}
              className={`rounded-full ${UI_INBOX_GRADIENTS.button.className} ${UI_INBOX_GRADIENTS.button.hover.className} px-2.5 sm:px-3`}
              size="sm"
              disabled={unscheduledTasks.length === 0}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">
                Schedule All
              </span>
            </Button>
            <Button
              onClick={() => {
                setSelectedTask(undefined);
                setIsTaskDialogOpen(true);
              }}
              className="hidden sm:flex rounded-full px-2.5 sm:px-3"
              size="sm"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline ml-2">
                New Task
              </span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Quick Add and Filters Section */}
        <div className="px-4 md:px-8 py-6 border-b border-primary/10 bg-white/50 dark:bg-background/50 backdrop-blur-sm flex-shrink-0">
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
                    onClick={() => setIsQuickAddOpen(true)}
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
                "p-3", // p-3 = 12px
                TOGGLE_SWITCH_COLORS.card.background.light,
                TOGGLE_SWITCH_COLORS.card.background.dark,
                TOGGLE_SWITCH_COLORS.card.border.light,
              )}>
                <div className="flex items-center gap-2"> {/* gap-2 = 8px */}
                  <Calendar className={cn(
                    "w-4 h-4", // w-4 h-4 = 16px
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
        <div className="flex-1 overflow-hidden">
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
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
// Icons migrated to Icon component - imports removed
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { AppHeader } from "./AppHeader";
import { 
  HEADER_MOBILE_SAFE_AREA_SPACER, 
  VIEWPORT_BREAKPOINTS, 
  NAV_BAR_BOTTOM_PADDING_MOBILE, 
  MOBILE_PADDING_BOTTOM,
  ARCHIVE_CHECKBOX_SIZE,
  ARCHIVE_CHECKMARK_CONTAINER_SIZE,
  ARCHIVE_CHECKMARK_ICON_SIZE,
  ARCHIVE_TITLE_TEXT_SIZE,
  ARCHIVE_ASSIGNEE_TEXT_SIZE,
  ARCHIVE_ASSIGNEE_AVATAR_SIZE,
  ARCHIVE_ASSIGNEE_INITIALS_SIZE,
} from "../lib/layout-constants";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { TaskDialog } from "./TaskDialog";
import { cn, prepareTaskForDialog, sanitizeHTML, hasHTMLTags, getInitials } from "../lib/utils";
import { useIsMobile } from "./ui/use-mobile";
import { Checkbox } from "./ui/checkbox";
import { toast } from "sonner";
import { UI_INBOX_GRADIENTS } from "../lib/ui-colors";
import { Icon } from "./Icon";
import { EMPTY_STATE_ICON_SIZE_LARGE, ICON_SIZE_MD } from "../lib/layout-constants";
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

export function ArchiveView() {
  const { tasks, updateTask, deleteTask, bulkDeleteTasks } = useTasks();
  const { getTeamMember } = useTeam();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] =
    useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<
    Task | undefined
  >();
  const [isTaskDialogOpen, setIsTaskDialogOpen] =
    useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Get completed tasks
  const completedTasks = tasks.filter(
    (t) => t.status === "done",
  );

  // Helper function to check if a date matches the filter
  const matchesDateFilter = (completedAt: string | null) => {
    if (filterDate === "all" || !completedAt) return true;

    const completedDate = new Date(completedAt);
    const now = new Date();
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    switch (filterDate) {
      case "today":
        return completedDate >= today;
      case "yesterday":
        return (
          completedDate >= yesterday && completedDate < today
        );
      case "this-week": {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return completedDate >= weekStart;
      }
      case "last-week": {
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay());
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 7);
        return (
          completedDate >= lastWeekStart &&
          completedDate < lastWeekEnd
        );
      }
      case "this-month": {
        const monthStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        );
        return completedDate >= monthStart;
      }
      case "last-month": {
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
        );
        const lastMonthEnd = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        );
        return (
          completedDate >= lastMonthStart &&
          completedDate < lastMonthEnd
        );
      }
      default:
        return true;
    }
  };

  // Apply filters
  const filteredTasks = completedTasks.filter((task) => {
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
    const matchesDate = matchesDateFilter(task.completedAt);

    return matchesSearch && matchesPriority && matchesDate;
  });

  // Sort by completion date (most recent first)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.completedAt && b.completedAt) {
      return (
        new Date(b.completedAt).getTime() -
        new Date(a.completedAt).getTime()
      );
    }
    if (a.completedAt) return -1;
    if (b.completedAt) return 1;
    return (
      new Date(b.updatedAt).getTime() -
      new Date(a.updatedAt).getTime()
    );
  });

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

  const handleRestore = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask(task.id, { status: "todo", completedAt: null });
  };

  const handleDelete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask(task.id);
  };

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
        return "border-red-400"; // Red
      case "high":
        return "border-orange-400"; // Orange
      case "medium":
        return "border-blue-400"; // Blue
      case "low":
        return "border-gray-400"; // Grey
      default:
        return "border-gray-300";
    }
  };

  const formatCompletedDate = (dateString: string | null) => {
    if (!dateString) return "Completed";
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays === 0) return "Completed today";
    if (diffInDays === 1) return "Completed yesterday";
    if (diffInDays < 7)
      return `Completed ${diffInDays} days ago`;
    if (diffInDays < 30)
      return `Completed ${Math.floor(diffInDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div 
      className={cn("flex flex-col", UI_INBOX_GRADIENTS.main.className, "dark:from-gray-950 dark:via-gray-900 dark:to-gray-900", isMobile ? 'min-h-full' : 'h-full')}
    >
      <AppHeader
        title="Archive"
        panelOpen={true}
        isSidePanelHeader={true}
        description={`${completedTasks.length} completed ${completedTasks.length === 1 ? "task" : "tasks"}`}
        hideDesktopLogo
        actions={
          selectedTaskIds.size > 0 ? (
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handleSelectAll}
                variant="outline"
                className="rounded-full px-2.5 sm:px-3"
                size="sm"
              >
                <span className="hidden sm:inline">
                  {selectedTaskIds.size === sortedTasks.length ? "Deselect All" : "Select All"}
                </span>
                <span className="sm:hidden">
                  {selectedTaskIds.size === sortedTasks.length ? "Deselect" : "Select All"}
                </span>
              </Button>
              <Button
                onClick={() => setShowBulkDeleteConfirm(true)}
                variant="destructive"
                className="rounded-full px-2.5 sm:px-3"
                size="sm"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  Delete ({selectedTaskIds.size})
                </span>
                <span className="sm:hidden">
                  {selectedTaskIds.size}
                </span>
              </Button>
            </div>
          ) : undefined
        }
      />
      {/* Spacer for fixed header on mobile */}

      <div className="flex-1 flex flex-col min-h-0">
        {/* Search and Filter Bar */}
        <div className="px-4 md:px-8 py-6 border-b border-primary/10 bg-white/50 dark:bg-background/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Icon name="search" size={ICON_SIZE_MD} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search completed tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-white dark:bg-card"
              />
            </div>

            <div className="flex flex-col gap-3">
              <Select
                value={filterPriority}
                onValueChange={setFilterPriority}
              >
                <SelectTrigger className="w-full h-10 bg-white dark:bg-card">
                  <Icon name="filter" size={ICON_SIZE_MD} className="mr-2" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Priorities
                  </SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterDate}
                onValueChange={setFilterDate}
              >
                <SelectTrigger className="w-full h-10 bg-white dark:bg-card">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">
                    Yesterday
                  </SelectItem>
                  <SelectItem value="this-week">
                    This Week
                  </SelectItem>
                  <SelectItem value="last-week">
                    Last Week
                  </SelectItem>
                  <SelectItem value="this-month">
                    This Month
                  </SelectItem>
                  <SelectItem value="last-month">
                    Last Month
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        {/* On mobile, rely on parent scroll container in App.tsx - no overflow-y-auto */}
        <div className="flex-1 min-h-0">
          {typeof window !== 'undefined' && window.innerWidth >= VIEWPORT_BREAKPOINTS.mobile ? (
          <div className="h-full overflow-y-auto overscroll-contain">
            <div className="p-4 md:px-8 pb-safe md:pb-8">
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {sortedTasks.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-16 text-center"
                      >
                        <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg", UI_INBOX_GRADIENTS.emptyState.className)}>
                          <Icon name="archive" size={EMPTY_STATE_ICON_SIZE_LARGE} weight="duotone" className="text-primary" />
                        </div>
                        <h3 className="text-xl mb-2">
                          No completed tasks
                        </h3>
                        <p className="text-muted-foreground max-w-sm">
                          {searchQuery || filterPriority !== "all"
                            ? "No tasks match your filters. Try adjusting your search."
                            : "Complete some tasks and they will appear here."}
                        </p>
                      </motion.div>
                    ) : (
                      sortedTasks.map((task, index) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <Card
                            className={cn(
                              // Responsive padding: smaller on mobile, comfortable on desktop
                              "px-2.5 py-2 md:px-3 md:py-3 cursor-pointer transition-all",
                              // Responsive borders: thinner on mobile, standard on desktop
                              "border-l-2 md:border-l-4 border-gray-300/80 md:border-gray-300/90",
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
                            <div className="flex items-start gap-2 md:gap-2.5">
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
                                className="mt-0.5"
                                style={{ 
                                  width: ARCHIVE_CHECKBOX_SIZE, 
                                  height: ARCHIVE_CHECKBOX_SIZE,
                                  minWidth: ARCHIVE_CHECKBOX_SIZE,
                                  minHeight: ARCHIVE_CHECKBOX_SIZE,
                                }}
                              />
                              {/* Checkmark Icon */}
                              <div 
                                className="rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0"
                                style={{ 
                                  width: ARCHIVE_CHECKMARK_CONTAINER_SIZE, 
                                  height: ARCHIVE_CHECKMARK_CONTAINER_SIZE 
                                }}
                              >
                                <Check 
                                  className="text-green-600 dark:text-green-400" 
                                  style={{ 
                                    width: ARCHIVE_CHECKMARK_ICON_SIZE, 
                                    height: ARCHIVE_CHECKMARK_ICON_SIZE 
                                  }}
                                />
                              </div>

                              {/* Task Content */}
                              <div className="flex-1 min-w-0">
                                <h3 
                                  className="line-through opacity-70 mb-0.5 line-clamp-2"
                                  style={{ fontSize: ARCHIVE_TITLE_TEXT_SIZE }}
                                >
                                  {task.title}
                                </h3>

                                {/* Description removed - only showing headline in archive view */}

                                {/* Assignee Display */}
                                {task.assignedTo &&
                                  task.assignedTo.length > 0 && (
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                      {task.assignedTo
                                        .slice(0, 3)
                                        .map((userId) => {
                                          const member =
                                            getTeamMember(userId);
                                          if (!member)
                                            return null;

                                          const initials = getInitials(member.name);

                                          return (
                                            <div
                                              key={userId}
                                              className="flex items-center gap-1"
                                            >
                                              <div 
                                              className="rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700 opacity-60 flex items-center justify-center font-semibold"
                                              style={{ 
                                                width: ARCHIVE_ASSIGNEE_AVATAR_SIZE, 
                                                height: ARCHIVE_ASSIGNEE_AVATAR_SIZE,
                                                fontSize: ARCHIVE_ASSIGNEE_INITIALS_SIZE,
                                              }}
                                            >
                                                {initials}
                                              </div>
                                              <span 
                                                className="text-gray-600 opacity-60 font-semibold"
                                                style={{ fontSize: ARCHIVE_ASSIGNEE_TEXT_SIZE }}
                                              >
                                                {member.name}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      {task.assignedTo.length >
                                        3 && (
                                        <span 
                                          className="text-gray-500 opacity-60"
                                          style={{ fontSize: ARCHIVE_ASSIGNEE_TEXT_SIZE }}
                                        >
                                          +
                                          {task.assignedTo
                                            .length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) =>
                                    handleRestore(task, e)
                                  }
                                  title="Restore task"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  onClick={(e) =>
                                    handleDelete(task, e)
                                  }
                                  title="Delete permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 md:px-8" style={{ paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet ? MOBILE_PADDING_BOTTOM : undefined }}>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {sortedTasks.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center py-16 text-center"
                    >
                      <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg", UI_INBOX_GRADIENTS.emptyState.className)}>
                        <Icon name="archive" size={EMPTY_STATE_ICON_SIZE_LARGE} weight="duotone" className="text-primary" />
                      </div>
                      <h3 className="text-xl mb-2">
                        No completed tasks
                      </h3>
                      <p className="text-muted-foreground max-w-sm">
                        {searchQuery || filterPriority !== "all"
                          ? "No tasks match your filters. Try adjusting your search."
                          : "Complete some tasks and they will appear here."}
                      </p>
                    </motion.div>
                  ) : (
                    sortedTasks.map((task, index) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <Card
                          className={cn(
                            // Responsive padding: smaller on mobile, comfortable on desktop
                            "px-2.5 py-2 md:px-3 md:py-3 cursor-pointer transition-all",
                            // Responsive borders: thinner on mobile, standard on desktop
                            "border-l-2 md:border-l-4 border-gray-300/80 md:border-gray-300/90",
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
                          <div className="flex items-start gap-2 md:gap-2.5">
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
                              className="mt-0.5"
                              style={{ 
                                width: ARCHIVE_CHECKBOX_SIZE, 
                                height: ARCHIVE_CHECKBOX_SIZE,
                                minWidth: ARCHIVE_CHECKBOX_SIZE,
                                minHeight: ARCHIVE_CHECKBOX_SIZE,
                              }}
                            />
                            {/* Checkmark Icon */}
                            <div 
                              className="rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0"
                              style={{ 
                                width: ARCHIVE_CHECKMARK_CONTAINER_SIZE, 
                                height: ARCHIVE_CHECKMARK_CONTAINER_SIZE 
                              }}
                            >
                              <Check 
                                className="text-green-600 dark:text-green-400" 
                                style={{ 
                                  width: ARCHIVE_CHECKMARK_ICON_SIZE, 
                                  height: ARCHIVE_CHECKMARK_ICON_SIZE 
                                }}
                              />
                            </div>

                            {/* Task Content */}
                            <div className="flex-1 min-w-0">
                              <h3 
                                className="line-through opacity-70 mb-0.5 line-clamp-2"
                                style={{ fontSize: ARCHIVE_TITLE_TEXT_SIZE }}
                              >
                                {task.title}
                              </h3>

                              {/* Description removed - only showing headline in archive view */}

                              {/* Assignee Display */}
                              {task.assignedTo &&
                                task.assignedTo.length > 0 && (
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {task.assignedTo
                                      .slice(0, 3)
                                      .map((userId) => {
                                        const member =
                                          getTeamMember(userId);
                                        if (!member)
                                          return null;

                                        const initials = getInitials(member.name);

                                        return (
                                          <div
                                            key={userId}
                                            className="flex items-center gap-1"
                                          >
                                            <div 
                                              className="rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700 opacity-60 flex items-center justify-center font-semibold"
                                              style={{ 
                                                width: ARCHIVE_ASSIGNEE_AVATAR_SIZE, 
                                                height: ARCHIVE_ASSIGNEE_AVATAR_SIZE,
                                                fontSize: ARCHIVE_ASSIGNEE_INITIALS_SIZE,
                                              }}
                                            >
                                                {initials}
                                              </div>
                                              <span 
                                                className="text-gray-600 opacity-60 font-semibold"
                                                style={{ fontSize: ARCHIVE_ASSIGNEE_TEXT_SIZE }}
                                              >
                                                {member.name}
                                              </span>
                                          </div>
                                        );
                                      })}
                                    {task.assignedTo.length >
                                      3 && (
                                      <span 
                                        className="text-gray-500 opacity-60"
                                        style={{ fontSize: ARCHIVE_ASSIGNEE_TEXT_SIZE }}
                                      >
                                        +
                                        {task.assignedTo
                                          .length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) =>
                                  handleRestore(task, e)
                                }
                                title="Restore task"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={(e) =>
                                  handleDelete(task, e)
                                }
                                title="Delete permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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
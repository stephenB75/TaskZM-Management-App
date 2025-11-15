import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Archive,
  Search,
  Filter,
  Calendar,
  Check,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { AppHeader } from "./AppHeader";
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
import { cn, prepareTaskForDialog, sanitizeHTML, hasHTMLTags } from "../lib/utils";
import { useIsMobile } from "./ui/use-mobile";
import type { Task } from "../types";

export function ArchiveView() {
  const { tasks, updateTask, deleteTask } = useTasks();
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
    console.log('ArchiveView: handleTaskClick called with task:', task);
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
      
      console.log('ArchiveView: Setting selected task and opening dialog:', safeTask);
      setSelectedTask(safeTask);
      setIsTaskDialogOpen(true);
    } catch (error) {
      console.error('Error opening task:', error, task);
      toast.error('Failed to open task');
    }
  };

  const handleRestore = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask(task.id, { status: "todo", completedAt: null });
  };

  const handleDelete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask(task.id);
  };

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
    <div className="h-full flex flex-col bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB] dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <AppHeader
        title="Archive"
        panelOpen={true}
        isSidePanelHeader={true}
        description={`${completedTasks.length} completed ${completedTasks.length === 1 ? "task" : "tasks"}`}
        hideDesktopLogo
      />
      {/* Spacer for fixed header on mobile */}
      <div className="md:hidden h-[64px]" />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Search and Filter Bar */}
        <div className="px-4 md:px-8 py-6 border-b border-primary/10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search completed tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-white dark:bg-gray-900"
              />
            </div>

            <div className="flex flex-col gap-3">
              <Select
                value={filterPriority}
                onValueChange={setFilterPriority}
              >
                <SelectTrigger className="w-full h-10 bg-white dark:bg-gray-900">
                  <Filter className="w-4 h-4 mr-2" />
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
                <SelectTrigger className="w-full h-10 bg-white dark:bg-gray-900">
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
        <div className="flex-1 overflow-hidden">
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
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E6D5F0] to-[#C9E4F7] flex items-center justify-center mb-6 shadow-lg">
                        <Archive className="w-12 h-12 text-primary" />
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
                            {/* Checkmark Icon */}
                            <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>

                            {/* Task Content */}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm line-through opacity-70 mb-0.5 line-clamp-2">
                                {task.title}
                              </h3>

                              {task.description && (
                                <div 
                                  className={cn(
                                    "text-xs text-muted-foreground line-clamp-2 opacity-60 leading-tight",
                                    hasHTMLTags(task.description) && "[&_strong]:font-bold [&_b]:font-bold",
                                    hasHTMLTags(task.description) && "[&_em]:italic [&_i]:italic",
                                    hasHTMLTags(task.description) && "[&_u]:underline",
                                    hasHTMLTags(task.description) && "[&_s]:line-through [&_strike]:line-through",
                                    hasHTMLTags(task.description) && "[&_ul]:list-disc [&_ul]:ml-3",
                                    hasHTMLTags(task.description) && "[&_ol]:list-decimal [&_ol]:ml-3",
                                    hasHTMLTags(task.description) && "[&_li]:ml-1",
                                    hasHTMLTags(task.description) && "[&_p]:my-0.5"
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
                                            <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700 opacity-60 flex items-center justify-center text-[7px] font-semibold">
                                              {initials}
                                            </div>
                                            <span className="text-[10px] text-gray-600 opacity-60 font-semibold">
                                              {member.name}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    {task.assignedTo.length >
                                      3 && (
                                      <span className="text-[10px] text-gray-500 opacity-60">
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
import React, { useState, useMemo } from "react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_XS, ICON_SIZE_3XL } from "../lib/layout-constants";
import { motion } from "motion/react";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { TaskDialog } from "./TaskDialog";
import { ScrollArea } from "./ui/scroll-area";
import { cn, getInitials, sanitizeHTML, hasHTMLTags } from "../lib/utils";
import { toast } from "sonner";
import type { Task, Folder as FolderType } from "../types";
import { Z_INDEX } from "../lib/layout-constants";
import { TASK_CARD_ASSIGNED_USER_COLORS, TASK_CARD_ADDITIONAL_FONT_SIZES } from "../lib/task-card-constants";
import { TASK_DIALOG_COLORS } from "../lib/task-dialog-constants";

interface FolderViewProps {
  folder: FolderType;
  onBack: () => void;
}

export function FolderView({ folder, onBack }: FolderViewProps) {
  const { tasks, updateTask, deleteTask, projects } = useTasks();
  const { getTeamMember } = useTeam();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();

  // Get tasks that belong to this folder (by tag - folder name)
  const folderTasks = useMemo(() => {
    if (!folder.name) return [];
    return tasks.filter((task) => 
      task.tags && 
      Array.isArray(task.tags) && 
      task.tags.includes(folder.name)
    );
  }, [tasks, folder.name]);

  // Apply filters
  const filteredTasks = useMemo(() => {
    return folderTasks.filter((task) => {
      const matchesSearch =
        !searchQuery ||
        task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority =
        filterPriority === "all" || task.priority === filterPriority;
      const matchesStatus =
        filterStatus === "all" || task.status === filterStatus;

      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [folderTasks, searchQuery, filterPriority, filterStatus]);

  // Sort by priority and due date
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const priorityWeight = {
        urgent: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      const aPriority = priorityWeight[a.priority] || 1;
      const bPriority = priorityWeight[b.priority] || 1;

      if (aPriority !== bPriority) return bPriority - aPriority;

      // Secondary sort by due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      // Tertiary sort by created date
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [filteredTasks]);

  const handleAddTask = () => {
    setSelectedTask(undefined);
    setIsTaskDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    try {
      // Validate task object before opening dialog
      if (!task) {
        console.error('Invalid task: task is null or undefined');
        toast.error('Invalid task data');
        return;
      }
      
      if (!task.id) {
        console.error('Invalid task: missing id', task);
        toast.error('Task is missing an ID');
        return;
      }

      // Create a safe copy of the task with all required fields
      // Use the original task but ensure all required fields exist
      const taskToEdit: Task = {
        ...task,
        // Ensure required fields have values
        id: task.id,
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: task.updatedAt || new Date().toISOString(),
        createdBy: task.createdBy || '',
        projectId: task.projectId || 'default',
        // Ensure arrays are always arrays
        tags: Array.isArray(task.tags) ? task.tags : [],
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
        dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
        assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
        // Ensure recurrence config is valid
        recurrence: task.recurrence && typeof task.recurrence === 'object' 
          ? {
              type: task.recurrence.type || 'none',
              interval: task.recurrence.interval || 1,
              daysOfWeek: Array.isArray(task.recurrence.daysOfWeek) ? task.recurrence.daysOfWeek : undefined,
              dayOfMonth: task.recurrence.dayOfMonth,
              endDate: task.recurrence.endDate || null,
            }
          : { type: 'none', interval: 1 },
        // Optional fields with safe defaults
        notes: task.notes || '',
      };

      setSelectedTask(taskToEdit);
      setIsTaskDialogOpen(true);
    } catch (error) {
      console.error('Error opening task dialog:', error, task);
      toast.error('Failed to open task. Please try again.');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: Task["status"]) => {
    try {
      await updateTask(taskId, { status: newStatus });
      if (newStatus === "done") {
        toast.success("Task completed!");
      }
    } catch (error) {
      toast.error("Failed to update task status");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success("Task deleted");
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return <Icon name="check-circle" size={ICON_SIZE_MD} className="text-green-500" />;
      case "in-progress":
        return <Icon name="play-circle" size={ICON_SIZE_MD} className="text-blue-500" />;
      case "on-hold":
        return <Icon name="pause" size={ICON_SIZE_MD} className="text-amber-500" />;
      default:
        return <Icon name="circle" size={ICON_SIZE_MD} className="text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400";
      case "high":
        return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400";
      case "medium":
        return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400";
      case "low":
        return "bg-gray-100 text-gray-700 border-gray-300 dark:bg-muted dark:text-muted-foreground";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300 dark:bg-muted dark:text-muted-foreground dark:border-border";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) {
      return "Today";
    }
    if (taskDate.getTime() === today.getTime() + 86400000) {
      return "Tomorrow";
    }
    if (taskDate.getTime() === today.getTime() - 86400000) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const stats = useMemo(() => {
    return {
      total: folderTasks.length,
      completed: folderTasks.filter((t) => t.status === "done").length,
      inProgress: folderTasks.filter((t) => t.status === "in-progress").length,
      todo: folderTasks.filter((t) => t.status === "todo").length,
    };
  }, [folderTasks]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB] dark:from-gray-950 dark:to-gray-900">
      <AppHeader
        panelOpen={true}
        isSidePanelHeader={true}
        title={
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${folder.color || "#3b82f6"}20` }}
            >
              <Icon name="folder" size={ICON_SIZE_LG} style={{ color: folder.color || "#3b82f6" }} />
            </div>
            <span>{folder.name || "Unnamed Folder"}</span>
          </div>
        }
        description={
          folder.description ||
          `${stats.total} task${stats.total === 1 ? "" : "s"} • ${stats.completed} completed`
        }
        actions={
          <Button
            onClick={handleAddTask}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            size="sm"
          >
                  <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
            <span className="hidden sm:inline">Add Task</span>
            <span className="sm:hidden">Add</span>
          </Button>
        }
        onBack={onBack}
        hideDesktopLogo
      />
      {/* Spacer for fixed header on mobile */}

      {/* Stats Bar */}
      <div className="px-4 pt-12 pb-3 mt-4 border-b bg-white/50 dark:bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs">
              {stats.total} total
            </Badge>
          </div>
          {stats.completed > 0 && (
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-xs border-green-500/30 text-green-700 dark:text-green-400"
              >
                {stats.completed} done
              </Badge>
            </div>
          )}
          {stats.inProgress > 0 && (
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-xs border-blue-500/30 text-blue-700 dark:text-blue-400"
              >
                {stats.inProgress} active
              </Badge>
            </div>
          )}
          {stats.todo > 0 && (
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-xs border-gray-500/30 text-gray-700 dark:text-muted-foreground"
              >
                {stats.todo} todo
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b bg-white/50 dark:bg-background/50 backdrop-blur-sm flex-shrink-0 relative z-10">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Icon name="search" size={ICON_SIZE_MD} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 relative z-20">
            <Select 
              value={filterPriority} 
              onValueChange={setFilterPriority}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <Icon name="filter" size={ICON_SIZE_MD} className="mr-2" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                <SelectItem value="all">All Priorities</SelectItem>
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
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-hidden min-h-0">
        <ScrollArea className="h-full">
        <div className="p-4 space-y-3 pb-safe md:pb-4">
          {sortedTasks.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="folder" size={ICON_SIZE_3XL} className="mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground mb-1">
                {searchQuery || filterPriority !== "all" || filterStatus !== "all"
                  ? "No tasks match your filters"
                  : "No tasks in this folder yet"}
              </p>
              {!searchQuery && filterPriority === "all" && filterStatus === "all" && (
                <Button
                  onClick={handleAddTask}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                  Add your first task
                </Button>
              )}
            </div>
          ) : (
            sortedTasks.map((task) => {
              // Safety check - skip invalid tasks
              if (!task || !task.id) {
                return null;
              }
              
              const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;
              const assignedMembers = (task.assignedTo || [])
                .map((id) => getTeamMember(id))
                .filter((member): member is NonNullable<typeof member> => member !== undefined && member !== null);

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={cn(
                      "group hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer",
                      "active:scale-[0.99] focus-within:ring-2 focus-within:ring-primary/20",
                      // Responsive borders: thinner on mobile, standard on desktop
                      "border border-transparent hover:border-primary/20",
                      "md:border md:border-transparent md:hover:border-primary/20"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditTask(task);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleEditTask(task);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit task: ${task.title || 'Untitled Task'}`}
                  >
                    <CardContent className="px-3 py-2.5 md:px-4 md:py-4">
                      <div className="flex items-start gap-2 md:gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              const newStatus: Task["status"] =
                                (task.status || "todo") === "done" ? "todo" : "done";
                              handleStatusChange(task.id, newStatus);
                            } catch (error) {
                              console.error('Error changing task status:', error);
                              toast.error('Failed to update task status');
                            }
                          }}
                          className="mt-0.5 flex-shrink-0"
                        >
                          {getStatusIcon(task.status || "todo")}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3
                              className={cn(
                                "font-medium text-sm",
                                (task.status || "todo") === "done" &&
                                  "line-through text-muted-foreground",
                                "group-hover:text-primary transition-colors"
                              )}
                            >
                              {task.title || "Untitled Task"}
                            </h3>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 flex-shrink-0",
                                getPriorityColor(task.priority || "medium")
                              )}
                            >
                              {task.priority || "medium"}
                            </Badge>
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

                          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                            {task.dueDate && (
                              <div className="flex items-center gap-1">
                                <Icon name="calendar" size={ICON_SIZE_XS} weight="duotone" />
                                <span>{formatDate(task.dueDate)}</span>
                              </div>
                            )}
                            {task.estimatedTime && (
                              <div className="flex items-center gap-1">
                                <Icon name="clock" size={ICON_SIZE_XS} />
                                <span>{task.estimatedTime}m</span>
                              </div>
                            )}
                            {project && (
                              <div className="flex items-center gap-1">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: project.color }}
                                />
                                <span>{project.name}</span>
                              </div>
                            )}
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Icon name="tag" size={ICON_SIZE_XS} />
                                <span>{task.tags.slice(0, 2).join(", ")}</span>
                                {task.tags.length > 2 && (
                                  <span>+{task.tags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {assignedMembers.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2">
                              {assignedMembers.slice(0, 3).map((member) => {
                                const initials = getInitials(member.name);
                                return (
                                  <Badge
                                    key={member.id}
                                    variant="secondary"
                                    className={`h-5 px-1.5 ${TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile}`}
                                  >
                                    <div className="flex items-center gap-1">
                                      {member.avatar ? (
                                        <div 
                                          className="rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0"
                                          style={{
                                            width: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.mobile.width}px`,
                                            height: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.mobile.height}px`,
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
                                                fallback.className = `rounded-full ${TASK_DIALOG_COLORS.assigneeFallbackGradient} flex items-center justify-center ${TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile} font-medium`;
                                                fallback.style.width = `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.mobile.width}px`;
                                                fallback.style.height = `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.mobile.height}px`;
                                                fallback.textContent = initials;
                                                parent.appendChild(fallback);
                                              }
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <div 
                                          className={`rounded-full ${TASK_DIALOG_COLORS.assigneeFallbackGradient} flex items-center justify-center ${TASK_CARD_ADDITIONAL_FONT_SIZES.assignedUserInitials.mobile} font-medium`}
                                          style={{
                                            width: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.mobile.width}px`,
                                            height: `${TASK_CARD_ASSIGNED_USER_COLORS.avatar.mobile.height}px`,
                                          }}
                                        >
                                          {initials}
                                        </div>
                                      )}
                                      <span>{member.name}</span>
                                    </div>
                                  </Badge>
                                );
                              })}
                              {assignedMembers.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{assignedMembers.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </ScrollArea>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setSelectedTask(undefined);
        }}
        task={selectedTask}
        initialDate={undefined}
        // When editing existing task, preserve its folder association
        // When creating new task, use current folder
        initialFolderId={selectedTask ? undefined : folder.id}
      />
    </div>
  );
}


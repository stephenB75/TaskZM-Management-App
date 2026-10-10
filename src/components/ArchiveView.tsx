import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTasks } from "../contexts/TaskContext";
import { AppHeader } from "./AppHeader";
import {
  VIEWPORT_BREAKPOINTS,
  MOBILE_PADDING_BOTTOM,
  getCheckboxSizePxForWidth,
  getCheckboxVisualSizePxForWidth,
  EMPTY_STATE_ICON_SIZE_LARGE,
  ICON_SIZE_MD,
} from "../lib/layout-constants";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { TaskDialog } from "./TaskDialog";
import { ArchiveTaskCard } from "./ArchiveTaskCard";
import { cn, prepareTaskForDialog } from "../lib/utils";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { toast } from '../lib/toast-wrapper';
import { UI_INBOX_GRADIENTS } from "../lib/ui-colors";
import { Icon } from "./Icon";
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
import {
  ARCHIVE_SECTION,
  ARCHIVE_UI_TEXT,
  groupArchivedTasksByDate,
} from "../lib/archive-constants";
import type { Task } from "../types";

export function ArchiveView() {
  const { tasks, updateTask, deleteTask, bulkDeleteTasks } = useTasks();
  const shouldUseMobileLayout = useMobileLayout();
  const [checkboxSizePx, setCheckboxSizePx] = useState(() =>
    getCheckboxSizePxForWidth(
      typeof window !== "undefined" ? window.innerWidth : VIEWPORT_BREAKPOINTS.desktop,
    ),
  );
  const [visualSizePx, setVisualSizePx] = useState(() =>
    getCheckboxVisualSizePxForWidth(
      typeof window !== "undefined" ? window.innerWidth : VIEWPORT_BREAKPOINTS.desktop,
    ),
  );

  useEffect(() => {
    const onResize = () => {
      setCheckboxSizePx(getCheckboxSizePxForWidth(window.innerWidth));
      setVisualSizePx(getCheckboxVisualSizePxForWidth(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const taskList = Array.isArray(tasks) ? tasks : [];
  const completedTasks = taskList.filter((t) => t.status === "done");

  const matchesDateFilter = (completedAt: string | null) => {
    if (filterDate === "all" || !completedAt) return true;

    const completedDate = new Date(completedAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    switch (filterDate) {
      case "today":
        return completedDate >= today;
      case "yesterday":
        return completedDate >= yesterday && completedDate < today;
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
        return completedDate >= lastWeekStart && completedDate < lastWeekEnd;
      }
      case "this-month": {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return completedDate >= monthStart;
      }
      case "last-month": {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        return completedDate >= lastMonthStart && completedDate < lastMonthEnd;
      }
      default:
        return true;
    }
  };

  const filteredTasks = completedTasks.filter((task) => {
    const matchesSearch =
      !searchQuery ||
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority =
      filterPriority === "all" || task.priority === filterPriority;
    const matchesDate = matchesDateFilter(task.completedAt);
    return matchesSearch && matchesPriority && matchesDate;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.completedAt && b.completedAt) {
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    }
    if (a.completedAt) return -1;
    if (b.completedAt) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const groupedTasks = useMemo(
    () => groupArchivedTasksByDate(sortedTasks),
    [sortedTasks],
  );

  const handleTaskClick = (task: Task) => {
    if (!task?.id) {
      toast.error("Invalid task data");
      return;
    }

    const safeTask = prepareTaskForDialog(task);
    if (!safeTask) {
      toast.error("Invalid task data");
      return;
    }

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

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
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
      setSelectedTaskIds(new Set(sortedTasks.map((t) => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    await bulkDeleteTasks(Array.from(selectedTaskIds));
    setSelectedTaskIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  useEffect(() => {
    setSelectedTaskIds((prev) => {
      const currentTaskIds = new Set(sortedTasks.map((t) => t.id));
      const filtered = new Set([...prev].filter((id) => currentTaskIds.has(id)));
      return filtered.size !== prev.size ? filtered : prev;
    });
  }, [sortedTasks]);

  const hasActiveFilters =
    Boolean(searchQuery) || filterPriority !== "all" || filterDate !== "all";

  const renderTaskList = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: ARCHIVE_SECTION.sectionGapPx,
      }}
    >
      <AnimatePresence mode="popLayout">
        {sortedTasks.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg",
                UI_INBOX_GRADIENTS.emptyState.className,
              )}
            >
              <Icon
                name="archive"
                size={EMPTY_STATE_ICON_SIZE_LARGE}
                weight="duotone"
                className="text-primary"
              />
            </div>
            <h3 className="text-xl mb-2">{ARCHIVE_UI_TEXT.emptyTitle}</h3>
            <p className="text-muted-foreground max-w-sm">
              {hasActiveFilters
                ? ARCHIVE_UI_TEXT.emptyFiltered
                : ARCHIVE_UI_TEXT.emptyDefault}
            </p>
          </motion.div>
        ) : (
          groupedTasks.map((group) => (
            <motion.section
              key={group.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              layout
            >
              <div
                className="flex items-baseline text-muted-foreground"
                style={{
                  gap: ARCHIVE_SECTION.headerGapPx,
                  marginBottom: ARCHIVE_SECTION.listGapPx,
                }}
              >
                <span
                  className="font-semibold uppercase tracking-wider"
                  style={{
                    fontSize: ARCHIVE_SECTION.titleFontSizePx,
                    letterSpacing: `${ARCHIVE_SECTION.titleLetterSpacingEm}em`,
                  }}
                >
                  {group.label}
                </span>
                <span
                  className="font-medium tabular-nums"
                  style={{ fontSize: ARCHIVE_SECTION.titleFontSizePx }}
                >
                  {group.tasks.length}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: ARCHIVE_SECTION.listGapPx,
                }}
              >
                {group.tasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: index * 0.02 }}
                    layout
                  >
                    <ArchiveTaskCard
                      task={task}
                      selected={selectedTaskIds.has(task.id)}
                      onToggleSelect={() => toggleTaskSelection(task.id)}
                      onClick={() => handleTaskClick(task)}
                      onRestore={(e) => handleRestore(task, e)}
                      onDelete={(e) => handleDelete(task, e)}
                      checkboxSizePx={checkboxSizePx}
                      visualSizePx={visualSizePx}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-col",
        UI_INBOX_GRADIENTS.main.className,
        "dark:from-gray-950 dark:via-gray-900 dark:to-gray-900",
        shouldUseMobileLayout ? "min-h-full" : "h-full",
      )}
    >
      <AppHeader
        title={ARCHIVE_UI_TEXT.title}
        panelOpen={true}
        isSidePanelHeader={true}
        description={`${completedTasks.length} ${
          completedTasks.length === 1
            ? ARCHIVE_UI_TEXT.completedTask
            : ARCHIVE_UI_TEXT.completedTasks
        }`}
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
                  {selectedTaskIds.size === sortedTasks.length
                    ? ARCHIVE_UI_TEXT.deselectAll
                    : ARCHIVE_UI_TEXT.selectAll}
                </span>
                <span className="sm:hidden">
                  {selectedTaskIds.size === sortedTasks.length
                    ? ARCHIVE_UI_TEXT.deselectShort
                    : ARCHIVE_UI_TEXT.selectAllShort}
                </span>
              </Button>
              <Button
                onClick={() => setShowBulkDeleteConfirm(true)}
                variant="destructive"
                className="rounded-full px-2.5 sm:px-3"
                size="sm"
              >
                <Icon name="trash-2" size={ICON_SIZE_MD} className="sm:mr-2" />
                <span className="hidden sm:inline">
                  {ARCHIVE_UI_TEXT.deleteSelected} ({selectedTaskIds.size})
                </span>
                <span className="sm:hidden">{selectedTaskIds.size}</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 md:px-8 py-4 md:py-5 border-b border-primary/10 bg-white/50 dark:bg-background/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Icon
                name="search"
                size={ICON_SIZE_MD}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder={ARCHIVE_UI_TEXT.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-white dark:bg-card"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-full h-10 bg-white dark:bg-card">
                  <Icon name="filter" size={ICON_SIZE_MD} className="mr-2" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ARCHIVE_UI_TEXT.priorityAll}</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterDate} onValueChange={setFilterDate}>
                <SelectTrigger className="w-full h-10 bg-white dark:bg-card">
                  <Icon
                    name="calendar"
                    size={ICON_SIZE_MD}
                    weight="duotone"
                    className="mr-2"
                  />
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ARCHIVE_UI_TEXT.timeAll}</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {!shouldUseMobileLayout ? (
            <div className="h-full overflow-y-auto overscroll-contain">
              <div className="p-4 md:px-8 pb-safe md:pb-8">{renderTaskList()}</div>
            </div>
          ) : (
            <div
              className="p-4 md:px-8"
              style={{
                paddingBottom:
                  typeof window !== "undefined" &&
                  window.innerWidth < VIEWPORT_BREAKPOINTS.tablet
                    ? MOBILE_PADDING_BOTTOM
                    : undefined,
              }}
            >
              {renderTaskList()}
            </div>
          )}
        </div>
      </div>

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
            <AlertDialogTitle>{ARCHIVE_UI_TEXT.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {ARCHIVE_UI_TEXT.deleteConfirmDescription(selectedTaskIds.size)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ARCHIVE_UI_TEXT.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {ARCHIVE_UI_TEXT.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

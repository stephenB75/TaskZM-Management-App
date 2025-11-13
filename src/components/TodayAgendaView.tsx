import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { useDroppable } from "@dnd-kit/core";
import { Calendar, Plus, StickyNote } from "lucide-react";
import { useTasks } from "../contexts/TaskContext";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { TaskDialog } from "./TaskDialog";
import { DraggableTodayAgendaTask } from "./DraggableTodayAgendaTask";
import { Confetti } from "./Confetti";
import { cn, prepareTaskForDialog } from "../lib/utils";
import { isDateInRecurrence } from "../lib/recurrence";
import { toast } from "sonner";
import type { Task } from "../types";

interface TodayAgendaViewProps {
  hideHeader?: boolean;
}

export function TodayAgendaView({
  hideHeader = false,
}: TodayAgendaViewProps = {}) {
  const { tasks, updateTask } = useTasks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    null,
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  // Make this view a droppable zone for tasks from Kanban
  const { setNodeRef, isOver } = useDroppable({
    id: "today-agenda",
  });

  // Get today's tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allTodayTasks = tasks.filter((task) => {
    // Check if task matches today (either exact match or recurrence pattern)
    return isDateInRecurrence(task, today);
  });

  // Filter out done tasks - they should not appear in Today Agenda
  // Done tasks automatically appear in Archive view
  const incompleteTasks = allTodayTasks.filter((task) => task.status !== "done");

  // Sort incomplete tasks by time
  const todayTasks = incompleteTasks.sort((a, b) => {
    const timeA = new Date(a.scheduledDate!).getTime();
    const timeB = new Date(b.scheduledDate!).getTime();
    return timeA - timeB;
  });

  // Find the first uncompleted task (next up)
  const nextUpTaskId = todayTasks[0]?.id;

  const handleTaskClick = (task: Task) => {
    console.log('TodayAgendaView: handleTaskClick called with task:', task);
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
      
      console.log('TodayAgendaView: Setting selected task and opening dialog:', safeTask);
      setSelectedTask(safeTask);
      setDialogOpen(true);
    } catch (error) {
      console.error('Error opening task:', error, task);
      toast.error('Failed to open task');
    }
  };

  const handleAddTask = () => {
    setSelectedTask(null);
    setDialogOpen(true);
  };

  const getTaskTime = (task: Task) => {
    if (!task.scheduledDate) return "";
    try {
      const date = new Date(task.scheduledDate);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      // Silently handle invalid scheduledDate
      return "";
    }
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-400"; // Red
      case "high":
        return "bg-orange-400"; // Orange
      case "medium":
        return "bg-blue-400"; // Blue
      case "low":
        return "bg-gray-400"; // Grey
      default:
        return "bg-gray-300";
    }
  };

  // Calculate height based on task duration
  // For tasks < 45 mins: more compact sizing to fit all elements comfortably
  // For tasks 45-59 mins: standard sizing
  // For tasks >= 60 mins: enhanced sizing to accommodate descriptions and all elements
  const getTaskHeight = (task: Task) => {
    const minutes = task.estimatedTime || 30; // Default to 30 minutes if not set
    
    if (minutes < 45) {
      // Compact sizing for shorter tasks: base height + minimal scaling
      // Ensures all elements (title, badges, pomodoro, etc.) fit comfortably
      const baseHeight = 60; // Base height for essential elements
      const scalingFactor = 0.8; // Reduced scaling for shorter tasks
      return Math.max(baseHeight, baseHeight + (minutes - 15) * scalingFactor);
    } else if (minutes >= 60) {
      // Enhanced sizing for tasks 1 hour or more: more space for descriptions
      const baseHeight = 140; // Increased base height for descriptions and all elements
      const scalingFactor = 2.0; // More generous scaling for longer tasks
      return Math.max(baseHeight, baseHeight + (minutes - 60) * scalingFactor);
    } else {
      // Standard sizing for medium tasks (45-59 mins)
      return Math.max(80, minutes * 1.5);
    }
  };

  return (
    <>
      <Confetti 
        trigger={showConfetti} 
        onComplete={() => {
          // Use timeout to ensure state update happens after animation cleanup
          if (confettiTimeoutRef.current) {
            clearTimeout(confettiTimeoutRef.current);
          }
          confettiTimeoutRef.current = setTimeout(() => {
            setShowConfetti(false);
            confettiTimeoutRef.current = null;
          }, 100);
        }} 
      />
      <div
        ref={setNodeRef}
        className={cn(
          "h-full flex flex-col transition-all duration-200",
          isOver &&
            "bg-primary/10 border-2 border-primary/30 border-dashed",
        )}
        data-tour="today-panel"
      >
      {/* Header */}
      {!hideHeader && (
        <>
          <AppHeader
            title="Today Agenda"
            panelOpen={true}
            description={
              isOver
                ? "Drop to add to today"
                : today.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
            }
            hideDesktopLogo
          />
          {/* Spacer for fixed header on mobile */}
          <div className="md:hidden h-[64px]" />
          {/* Spacer for fixed header on desktop */}
          <div className="hidden md:block h-[73px]" />
        </>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-hidden w-full">
        <ScrollArea className="h-full w-full" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' } as React.CSSProperties}>
          <div className="px-5 pt-[27.6px] pb-24 sm:pb-safe md:pt-4 md:pb-4 w-full relative">
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Calendar className="w-6 h-6 text-primary/40" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  No tasks today
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTask}
                  className="!rounded-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add task
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 w-full relative" style={{ overflow: 'visible' }}>
                  {todayTasks.map((task, index) => (
                    <DraggableTodayAgendaTask
                      key={task.id}
                      task={task}
                      index={index}
                      totalTasks={todayTasks.length}
                      onClick={handleTaskClick}
                      getTaskHeight={getTaskHeight}
                      getTaskTime={getTaskTime}
                      getPriorityColor={getPriorityColor}
                      isNextUp={task.id === nextUpTaskId}
                      onComplete={() => {
                        // Clear any existing timeout
                        if (confettiTimeoutRef.current) {
                          clearTimeout(confettiTimeoutRef.current);
                        }
                        // Only trigger confetti if it's not already showing
                        if (!showConfetti) {
                          setShowConfetti(true);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Next Up Task Details - Shows notes for the next uncompleted task */}
                {(() => {
                  const nextUpTask = todayTasks.find(
                    (task) => task.id === nextUpTaskId,
                  );

                  if (!nextUpTask || !nextUpTask.notes)
                    return null;

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6 pt-4 border-t border-primary/20"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <StickyNote className="w-4 h-4 text-primary" />
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                          Next Up Details
                        </h3>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-lg bg-gradient-to-r from-[#B8E6D5]/10 via-[#E6D5F0]/10 to-transparent border-l-2 border-[#B8E6D5] cursor-pointer hover:from-[#B8E6D5]/20 hover:via-[#E6D5F0]/15 transition-all"
                        onClick={() =>
                          handleTaskClick(nextUpTask)
                        }
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                              getPriorityColor(
                                nextUpTask.priority,
                              ),
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-xs line-clamp-1 flex-1 font-semibold">
                                {nextUpTask.title}
                              </h4>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {nextUpTask.scheduledDate && (
                                  <span className="text-[9px] text-muted-foreground">
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider bg-[#B8E6D5] text-green-800 dark:text-green-900">
                                  Next Up
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <StickyNote className="w-3 h-3 text-primary/60 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                                {nextUpTask.notes}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })()}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        initialDate={today.toISOString()}
      />
      </div>
    </>
  );
}
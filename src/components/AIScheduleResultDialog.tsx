import React from "react";
import { motion } from "motion/react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_XS } from "../lib/layout-constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "../lib/utils";
import type { SchedulePlan } from "../hooks/useAIScheduler";

interface AIScheduleResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduledTasks: SchedulePlan[];
}

export function AIScheduleResultDialog({
  open,
  onOpenChange,
  scheduledTasks,
}: AIScheduleResultDialogProps) {
  const formatScheduleDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday =
      date.toDateString() === today.toDateString();
    const isTomorrow =
      date.toDateString() === tomorrow.toDateString();

    if (isToday)
      return `Today at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
    if (isTomorrow)
      return `Tomorrow at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E6D5F0] to-[#C9E4F7] flex items-center justify-center">
              <Icon name="check" size={ICON_SIZE_LG} className="text-primary" />
            </div>
            <span>Tasks Scheduled Successfully!</span>
          </DialogTitle>
          <DialogDescription>
            AI scheduled {scheduledTasks.length} task
            {scheduledTasks.length === 1 ? "" : "s"} across
            upcoming days
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-4">
          <div className="space-y-3">
            {scheduledTasks.map(
              ({ task, scheduledDate, reason }, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-4 bg-gradient-to-br from-[#C9E4F7]/20 to-[#B8E6D5]/20 border-primary/10">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium text-sm">
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
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
                                  "border-gray-400 text-gray-700 dark:text-foreground bg-gray-50 dark:bg-muted/20",
                              )}
                            >
                              {task.priority}
                            </Badge>
                            {task.status === "in-progress" && (
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
                          <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1 px-1.5">
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
                            <Icon name="calendar" size={ICON_SIZE_XS} weight="duotone" className="text-primary" />
                            <span className="text-foreground/70 font-medium">
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
                              <Icon name="clock" size={ICON_SIZE_XS} className="text-foreground/50" />
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
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
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

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="sparkles" size={ICON_SIZE_MD} weight="duotone" className="text-primary" />
            <span>Tasks distributed intelligently</span>
          </div>
          <Button
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7] hover:from-[#C9E4F7] hover:to-[#E6D5F0]"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
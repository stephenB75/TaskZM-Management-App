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
import { cn, formatClockTime, getClockHourCycle } from "../lib/utils";
import { getTaskCategory } from "../lib/category-hours-utils";
import { SCHEDULE_RESULT_UI_TEXT } from "../lib/navigation-constants";
import type { SchedulePlan, UnscheduledTask } from "../hooks/useAIScheduler";

interface AIScheduleResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduledTasks: SchedulePlan[];
  unscheduledTasks?: UnscheduledTask[];
  maxHoursPerDay?: number;
}

export function AIScheduleResultDialog({
  open,
  onOpenChange,
  scheduledTasks,
  unscheduledTasks = [],
  maxHoursPerDay,
}: AIScheduleResultDialogProps) {
  const describeReason = ({ task, reason }: UnscheduledTask) =>
    reason === "dailyLimit" && maxHoursPerDay
      ? SCHEDULE_RESULT_UI_TEXT.reasons.dailyLimit(maxHoursPerDay)
      : SCHEDULE_RESULT_UI_TEXT.reasons.noCategorySlot(getTaskCategory(task));

  const formatScheduleDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday =
      date.toDateString() === today.toDateString();
    const isTomorrow =
      date.toDateString() === tomorrow.toDateString();

    if (isToday)
      return `Today at ${formatClockTime(date)}`;
    if (isTomorrow)
      return `Tomorrow at ${formatClockTime(date)}`;

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: getClockHourCycle(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] rounded-2xl border-0 bg-background shadow-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name={scheduledTasks.length > 0 ? "check" : "alert-circle"} size={ICON_SIZE_LG} className="text-primary" />
            <span>{SCHEDULE_RESULT_UI_TEXT.title(scheduledTasks.length)}</span>
          </DialogTitle>
          <DialogDescription>{SCHEDULE_RESULT_UI_TEXT.description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-4">
          <div className="space-y-3">
            {unscheduledTasks.length > 0 && (
              <div className="space-y-2 pb-2">
                <h4 className="text-sm font-medium">
                  {SCHEDULE_RESULT_UI_TEXT.unscheduledHeading(unscheduledTasks.length)}
                </h4>
                {unscheduledTasks.map((item) => (
                  <Card key={item.task.id} className="p-3 border-border">
                    <p className="text-sm font-medium">{item.task.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{describeReason(item)}</p>
                  </Card>
                ))}
                <p className="text-xs text-muted-foreground">{SCHEDULE_RESULT_UI_TEXT.fixHint}</p>
              </div>
            )}
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
                                  "border-red-400 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
                                task.priority === "high" &&
                                  "border-orange-400 text-orange-700 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800",
                                task.priority === "medium" &&
                                  "border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
                                task.priority === "low" &&
                                  "border-gray-400 text-gray-700 dark:text-foreground bg-gray-50 dark:bg-muted/20",
                              )}
                            >
                              {task.priority}
                            </Badge>
                            {task.status === "in-progress" && (
                              <Badge
                                variant="outline"
                                className="text-xs border-green-400 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
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
                            <Icon name="brain" size={ICON_SIZE_XS} weight="duotone" className="text-primary mt-0.5 flex-shrink-0" />
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
                              <Icon name="target" size={ICON_SIZE_XS} weight="duotone" className="text-foreground/50" />
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
          <span />
          <Button onClick={() => onOpenChange(false)} className="rounded-full">
            {SCHEDULE_RESULT_UI_TEXT.done}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
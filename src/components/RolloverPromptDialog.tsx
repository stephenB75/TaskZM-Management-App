import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { useTasks } from "../contexts/TaskContext";
import { ROLLOVER_UI_TEXT } from "../lib/notification-constants";
import { PlannerPriorityPill } from "./planner/PlannerPriorityPill";

/** Ask-before-rolling prompt: lists yesterday's unfinished tasks and moves them to the Inbox on confirm. */
export function RolloverPromptDialog() {
  const { pendingRollover, confirmRollover, dismissRollover } = useTasks();
  const open = pendingRollover.length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismissRollover()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ROLLOVER_UI_TEXT.promptTitle(pendingRollover.length)}</DialogTitle>
          <DialogDescription>{ROLLOVER_UI_TEXT.promptDescription}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-64 overflow-y-auto divide-y divide-border" data-testid="rollover-task-list">
          {pendingRollover.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-sm font-medium">{task.title}</span>
              <PlannerPriorityPill priority={task.priority} />
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="planner-pill" onClick={dismissRollover}>
            {ROLLOVER_UI_TEXT.promptKeep}
          </button>
          <button type="button" className="planner-pill planner-pill--dark" onClick={() => void confirmRollover()}>
            {ROLLOVER_UI_TEXT.promptMove}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

# Recurring Task Series

## Overview

When a user creates a task with **Repeat** (recurrence) enabled, the app creates a **task series**: multiple independent task records, one per occurrence date. Each occurrence behaves like a regular task: it can be edited on its own, scheduled, and time-tracked. Time is tracked **per occurrence** and **as a series total**.

## Creation

- **Trigger:** User creates a task and turns on "Repeat" (daily, weekly, or monthly) with optional interval and end date.
- **Behavior:** The app generates occurrence dates via `getOccurrenceDates()` (up to a capped count, e.g. 52–90) and creates one full `Task` per date via `addTaskSeries()`.
- **IDs:** Each task has id `baseId__YYYY-MM-DD` (e.g. `abc123__2025-02-03`). There is no separate "base" task record; the series is the set of all tasks sharing the same `baseId` (the part before `__`).
- **Recurrence on occurrences:** Each created task has `recurrence: { type: 'none' }` so it is treated as a normal task; the series link is only by id pattern.

## Edit One vs Edit Series

- **Edit one occurrence:** Open any task in the series (e.g. from Kanban or Today). Change title, date, subtasks, time, etc. Save updates only that task (that occurrence).
- **Edit entire series:** In the task dialog, when editing a series occurrence, a checkbox **"Apply title, description, priority, and other details to all tasks in this series"** is shown. If checked and the user saves, the same title, description, priority, estimated time, notes, tags, assignees, and folder are applied to every other task in the series. Each task keeps its own **scheduled date** and **status** (e.g. completed vs todo).

## Time Tracking

- **Per occurrence:** Each task in the series has its own `actualTime`. Pomodoro and manual time updates use that task’s id (`baseId__YYYY-MM-DD`), so time is stored per occurrence.
- **Series total:** `calculateRecurringTaskSeriesTotalTime(baseId, allTasks)` sums `actualTime` for the base id and all ids that belong to the series (baseId, baseId__date, baseId_subtasks_date, baseId_completed_date). The task dialog shows "This occurrence: Xh Ym" and "Series total: Xh Ym" when the task is part of a series and time is present.

## Display and Deduplication

- **Lists (Today, Kanban, Calendar):** Series tasks have `recurrence.type === 'none'` and a specific `scheduledDate`. They appear on the day that matches their `scheduledDate` (no virtual expansion).
- **Deduplication:** The recurring-task deduplication logic in `TaskContext` does not remove valid series tasks: it only deduplicates true duplicates (same id or same title+pattern+scheduledDate for the old recurring model). Series tasks have unique ids and unique scheduledDates, so they are all kept.

## Constants and Helpers

- **Id pattern:** `RECURRENCE_SERIES_OCCURRENCE_SEPARATOR` = `'__'` in `src/lib/business-constants.ts`.
- **Helpers:** `getSeriesBaseId(taskId)` returns the base id when `taskId` is `baseId__YYYY-MM-DD`; otherwise `null`. Use this to find all tasks in a series and to show "Apply to series" and series total time.

## Summary

| Aspect              | Behavior                                                                 |
|---------------------|--------------------------------------------------------------------------|
| Create with Repeat  | Creates N tasks (one per occurrence date) with ids `baseId__YYYY-MM-DD` |
| Edit one            | Edit and save only that task (that occurrence)                          |
| Edit series         | Check "Apply to all in series" and save to update all in series         |
| Time per occurrence | Stored in each task’s `actualTime`; timer uses that task’s id            |
| Series total time   | Sum of all series members’ `actualTime`; shown in dialog when relevant  |

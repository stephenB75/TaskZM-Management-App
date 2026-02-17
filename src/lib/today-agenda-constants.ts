/**
 * Today Agenda View Constants
 * Centralized text strings and configuration for TodayAgendaView component
 */

export const TODAY_AGENDA_TEXT = {
  emptyState: {
    noTasks: "No tasks today",
    addTask: "Add task",
  },
  nextUp: "Next Up",
  /** Shown on the vertical timeline when a task has no scheduled time (its own slot, no time set). */
  noTimeSlot: "—",
  /** Timeline label for midnight (end of day). */
  timelineMidnightLabel: "12:00 AM",
  /** Shown in drop zone when dragging over today agenda. */
  dropPlaceholder: "Drop task here to schedule for today",
  /** Shown in drop zone with emphasis (e.g. mobile). */
  dropPlaceholderWithEmoji: "✨ Drop task here to schedule for today",
} as const;


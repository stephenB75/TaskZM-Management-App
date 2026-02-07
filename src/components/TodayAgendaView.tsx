import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { useDroppable } from "@dnd-kit/core";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { useTasks } from "../contexts/TaskContext";
import { useTheme } from "../contexts/ThemeContext";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { useCalendar } from "../contexts/CalendarContext";
import { useAuth } from "../contexts/AuthContext";
import { CalendarEventCard } from "./CalendarEventCard";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { TaskDialog } from "./TaskDialog";
import { DraggableTaskCard } from "./DraggableTaskCard";
import { Confetti } from "./Confetti";
import { cn, prepareTaskForDialog, hasHTMLTags, sanitizeHTML, getDateString, getTaskWithOccurrenceSubtasks } from "../lib/utils";
import { isDateInRecurrence } from "../lib/recurrence";
import { toast } from "sonner";
import type { Task } from "../types";
import { UI_GRADIENT_COLORS, UI_TODAY_AGENDA_STATUS_COLORS } from "../lib/ui-colors";
import { TASK_CALCULATION_CONSTANTS } from "../lib/task-calculation-constants";
import { TASK_CARD_HEIGHT_CONFIG, TASK_CARD_CALCULATIONS, TASK_CARD_LAYOUT_METRICS, TASK_CARD_TIMELINE, getTodayAgendaBlockColors } from "../lib/task-card-constants";
import { TODAY_AGENDA_TEXT } from "../lib/today-agenda-constants";
import { HEADER_HEIGHT, TIMELINE_PADDING, VIEWPORT_BREAKPOINTS, MOBILE_SPACING, Z_INDEX, COMPONENT_DIMENSIONS, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE, NAV_BAR_HEIGHT, NAV_BAR_SCROLL_BUFFER_REM, HEADER_DESCRIPTION_SIZE, HEADER_DESCRIPTION_MARGIN_TOP, HEADER_DATE_SIZE, HEADER_DATE_SIZE_MOBILE, HEADER_DATE_NUMBER_SIZE, HEADER_DATE_NUMBER_SIZE_MOBILE, HEADER_DATE_MARGIN_TOP, MOBILE_PADDING_BOTTOM, DESKTOP_PADDING_TOP, TODAY_AGENDA_MIN_HEIGHT, HEADER_GAP_SMALL, HEADER_GAP_LARGE, PANEL_EMPTY_STATE_PADDING_Y, EMPTY_STATE_ICON_SIZE_SMALL, EMPTY_STATE_ICON_INNER_SIZE, EMPTY_STATE_MARGIN_BOTTOM_SMALL, EMPTY_STATE_PADDING_X, ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_XS, CONFETTI_RESET_DELAY_MS, TODAY_AGENDA_TIMELINE } from "../lib/layout-constants";
import { TEXT_SIZES } from "../lib/text-size-constants";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { KANBAN_MOBILE } from "../lib/kanban-constants";
import { getTaskMinutes } from "../lib/daily-hours-utils";
import { reorganizeAllTasksForDate } from "../lib/time-conflict";
import { logger } from "../lib/logger";
import { useCalendarEvents } from "../hooks/useCalendarEvents";

interface TodayAgendaViewProps {
  hideHeader?: boolean;
}

export function TodayAgendaView({
  hideHeader = false,
}: TodayAgendaViewProps = {}) {
  const { tasks, updateTask } = useTasks();
  const { actualTheme } = useTheme();
  const shouldUseMobileLayout = useMobileLayout();
  const { calendarStatus } = useCalendar();
  const { accessToken } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    null,
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number } | null>(null);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  // ScrollArea ref for programmatic scrolling (Layer 3 - optional)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  // Current time for display - updates every minute to show current time
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayCalendarEvents, setTodayCalendarEvents] = useState<Array<{ id: string; title: string; start: string; end: string; location?: string; provider: 'google' | 'apple' | 'outlook'; calendarColor?: string; isRecurring?: boolean }>>([]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  // Update current time every minute for display (position stays static)
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };
    
    // Update immediately
    updateTime();
    
    // Update every minute
    const interval = setInterval(updateTime, TIMING_CONSTANTS.intervals.timeUpdate);
    
    return () => clearInterval(interval);
  }, []);


  // Make this view a droppable zone for tasks from Kanban (disabled on mobile)
  const { setNodeRef, isOver } = useDroppable({
    id: "today-agenda",
    disabled: shouldUseMobileLayout, // Disable drop on mobile/tablet - only allow vertical scroll
  });

  // Get today's tasks (local date; timezone: today and filtering use local timezone via getDateString / isDateInRecurrence)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayDateString = getDateString(today);
  const allTodayTasks = Array.isArray(tasks) ? tasks.filter((task) => {
    // Defensive check: ensure task is valid
    if (!task || typeof task !== 'object') {
      return false;
    }
    try {
      // Check if task matches today (either exact match or recurrence pattern)
      if (!isDateInRecurrence(task, today)) return false;
      // Avoid duplicate: if this is a base recurring task and we have a completed occurrence for today, show only the completed occurrence
      if (task.recurrence && task.recurrence.type !== 'none') {
        const completedOccurrenceId = `${task.id}_completed_${todayDateString}`;
        if (tasks.some((t) => t.id === completedOccurrenceId)) return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking date in recurrence:', error, task);
      return false;
    }
  }) : [];

  // Show all tasks including completed ones (they will be grayed out)
  // Completed tasks remain visible but grayed out like recurring tasks
  const incompleteTasks = allTodayTasks;

  // Sort tasks chronologically by scheduled time (earliest first; tasks without time go to end)
  const todayTasks = useMemo(() => {
    const byId = new Map<string, Task>();
    for (const task of incompleteTasks) {
      if (!task?.id) continue;
      const existing = byId.get(task.id);
      if (!existing || task.status === 'done') byId.set(task.id, task);
    }
    const unique = Array.from(byId.values());
    return unique.sort((a, b) => {
      try {
        const dateA = a.scheduledDate ? new Date(a.scheduledDate) : null;
        const dateB = b.scheduledDate ? new Date(b.scheduledDate) : null;
        if (!dateA || isNaN(dateA.getTime())) return 1;
        if (!dateB || isNaN(dateB.getTime())) return -1;
        const timeA = dateA.getTime();
        const timeB = dateB.getTime();
        if (timeA === timeB) return a.id.localeCompare(b.id);
        return timeA - timeB;
      } catch (error) {
        console.error('Error sorting tasks:', error, a, b);
        return 0;
      }
    });
  }, [incompleteTasks]);

  // Fetch calendar events for today using optimized hook
  const todayStart = useMemo(() => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [today]);

  const todayEnd = useMemo(() => {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [today]);

  const { events: todayCalendarEventsData } = useCalendarEvents(todayStart, todayEnd, {
    enabled: !!accessToken,
    debounceMs: TIMING_CONSTANTS.delays.calendarEventsDebounce, // Slightly faster for today view
  });

  // Filter calendar events to only include those on today's date (using local timezone)
  // This prevents timezone conversion issues where events appear on wrong dates
  const todayString = useMemo(() => getDateString(today), [today]);

  // Update state when events change, filtering by local date
  useEffect(() => {
    const filteredEvents = todayCalendarEventsData.filter((event) => {
      if (!event?.start) return false;
      try {
        const eventDate = new Date(event.start);
        if (isNaN(eventDate.getTime())) return false;
        // Compare using local date string to avoid timezone issues
        const eventDateString = getDateString(eventDate);
        return eventDateString === todayString;
      } catch (error) {
        logger.warn('Error filtering calendar event by date:', error, event);
        return false;
      }
    });
    setTodayCalendarEvents(filteredEvents);
  }, [todayCalendarEventsData, todayString]);

  // Combine tasks and events, sort chronologically
  interface CombinedItem {
    type: 'task' | 'event';
    task?: Task;
    event?: { id: string; title: string; start: string; end: string; location?: string; provider: 'google' | 'apple' | 'outlook'; calendarColor?: string; isRecurring?: boolean };
    sortTime: number;
  }

  const combinedItems = useMemo(() => {
    const items: CombinedItem[] = [];
    
    // Add tasks with their sort time
    for (const task of todayTasks) {
      const taskTime = task.scheduledDate ? new Date(task.scheduledDate).getTime() : Number.MAX_SAFE_INTEGER;
      items.push({
        type: 'task',
        task,
        sortTime: taskTime,
      });
    }
    
    // Add calendar events (always have a specific time)
    for (const event of todayCalendarEvents) {
      const sortTime = new Date(event.start).getTime();
      items.push({
        type: 'event',
        event,
        sortTime,
      });
    }
    
    // Chronological order: earliest first; items without time go to end
    items.sort((a, b) => {
      return a.sortTime - b.sortTime;
    });
    
    return items;
  }, [todayTasks, todayCalendarEvents]);

  /** Split items into timeline blocks (have time in 7AM–12AM) and unscheduled (no time or outside range). */
  const { timelineBlocks, unscheduledItems } = useMemo(() => {
    const startHour = TODAY_AGENDA_TIMELINE.startHour;
    const endHour = TODAY_AGENDA_TIMELINE.endHour;
    const totalMinutes = TODAY_AGENDA_TIMELINE.totalMinutes;
    const pxPerMinute = TODAY_AGENDA_TIMELINE.pxPerMinute;
    const minH = TODAY_AGENDA_TIMELINE.minBlockHeightPx;
    const blocks: { item: CombinedItem; topPx: number; heightPx: number }[] = [];
    const unscheduled: CombinedItem[] = [];
    for (const item of combinedItems) {
      if (item.type === 'task' && item.task) {
        if (!item.task.scheduledDate) {
          unscheduled.push(item);
          continue;
        }
        const start = new Date(item.task.scheduledDate);
        const startMins = start.getHours() * 60 + start.getMinutes() - startHour * 60;
        if (startMins < 0 || startMins >= totalMinutes) {
          unscheduled.push(item);
          continue;
        }
        const durationMins = getTaskMinutes(item.task);
        const heightPx = Math.max(minH, Math.round(durationMins * pxPerMinute));
        const topPx = Math.round(startMins * pxPerMinute);
        blocks.push({ item, topPx, heightPx });
      } else if (item.type === 'event' && item.event) {
        const start = new Date(item.event.start);
        const end = new Date(item.event.end);
        const startMins = start.getHours() * 60 + start.getMinutes() - startHour * 60;
        const durationMins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
        if (startMins < 0 || startMins >= totalMinutes) {
          unscheduled.push(item);
          continue;
        }
        const heightPx = Math.max(minH, Math.round(durationMins * pxPerMinute));
        const topPx = Math.round(startMins * pxPerMinute);
        blocks.push({ item, topPx, heightPx });
      }
    }
    return { timelineBlocks: blocks, unscheduledItems: unscheduled };
  }, [combinedItems, getTaskMinutes]);

  /** Timeline total height (px) for 7 AM–12 AM. */
  const timelineHeightPx = TODAY_AGENDA_TIMELINE.totalMinutes * TODAY_AGENDA_TIMELINE.pxPerMinute;

  /** Current time position (px from top) for indicator; null if outside 7AM–12AM. */
  const currentTimeTopPx = useMemo(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes() - TODAY_AGENDA_TIMELINE.startHour * 60;
    if (mins < 0 || mins >= TODAY_AGENDA_TIMELINE.totalMinutes) return null;
    return Math.round(mins * TODAY_AGENDA_TIMELINE.pxPerMinute);
  }, [currentTime]);

  // Find the next uncompleted task after current time (next up)
  const nextUpTaskId = useMemo(() => {
    if (todayTasks.length === 0) return null;
    
    // Filter out completed tasks
    const uncompletedTasks = todayTasks.filter(task => task.status !== 'done');
    if (uncompletedTasks.length === 0) return null;
    
    const now = new Date();
    const currentTimeMs = now.getTime();
    
    // Find the first uncompleted task that starts at or after current time
    for (const task of uncompletedTasks) {
      if (!task.scheduledDate) continue;
      const taskTime = new Date(task.scheduledDate).getTime();
      if (taskTime >= currentTimeMs) {
        return task.id;
      }
    }
    
    // If no uncompleted task is after current time, return the first uncompleted task
    return uncompletedTasks[0]?.id || null;
  }, [todayTasks]);

  // Ensure today's task blocks don't overlap and have proper timeslots:
  // - DragDropContext uses findNextAvailableSlot when dropping on Today Agenda (task-to-task + optional calendar).
  // - TaskDialog uses checkTimeConflict + findNextAvailableSlot on save.
  // - This effect fixes any existing overlaps (e.g. from sync or legacy data) by moving tasks to the next free slot,
  //   and avoids placing tasks on top of calendar events when moving.
  const todayDateForReorganize = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [todayString]);
  const calendarEventsForReorganize = useMemo(() => {
    return todayCalendarEvents.map((event) => ({
      start: new Date(event.start),
      end: new Date(event.end),
      title: event.title ?? "",
    }));
  }, [todayCalendarEvents]);
  useEffect(() => {
    if (timelineBlocks.length === 0) return;
    const reorganizations = reorganizeAllTasksForDate(todayDateForReorganize, tasks, {
      ensureAfterCurrentTime: true,
      calendarEvents: calendarEventsForReorganize,
    });
    if (reorganizations.length === 0) return;
    reorganizations.forEach(({ taskId, newTime }) => {
      updateTask(taskId, { scheduledDate: newTime.toISOString() });
    });
  }, [tasks, timelineBlocks.length, todayDateForReorganize, calendarEventsForReorganize, updateTask]);

  // LAYER 1: Basic vertical scroll - ScrollArea handles scrolling automatically
  // LAYER 2: Next up badge is implemented via nextUpTaskId and isNextUp prop (see below)
  // LAYER 3: Optional auto-scroll can be added later if needed

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
      setDialogOpen(true);
    });
  };

  // Handle task completion - trigger confetti at card position (or center if no element)
  const handleTaskComplete = useCallback((originElement?: HTMLElement | null) => {
    if (originElement) {
      const rect = originElement.getBoundingClientRect();
      setConfettiOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      setConfettiOrigin(null);
    }
    setShowConfetti(true);
  }, []);

  const handleAddTask = () => {
    setSelectedTask(null);
    setDialogOpen(true);
  };

  const getTaskTime = (task: Task) => {
    if (!task.scheduledDate) return TODAY_AGENDA_TEXT.noTimeSlot;
    try {
      const date = new Date(task.scheduledDate);
      if (isNaN(date.getTime())) return TODAY_AGENDA_TEXT.noTimeSlot;
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      return TODAY_AGENDA_TEXT.noTimeSlot;
    }
  };

  const getEventTime = (isoStart: string) => {
    try {
      const date = new Date(isoStart);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
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

  /** Vertical timeline 7 AM–12 AM: time labels at 15-min intervals, task/event blocks by duration on the right. */
  const agendaListRows = useMemo(
    () => {
      const { startHour, endHour, columnWidth, pxPerMinute, totalMinutes, rowGapPx, lineMinWidthPx, dotSizePx, columnGapPx, rowPaddingTopPx, minBlockHeightPx, labelIntervalMinutes } = TODAY_AGENDA_TIMELINE;
      const timelineLabels: { minutesFromStart: number; label: string }[] = [];
      for (let m = 0; m <= totalMinutes; m += labelIntervalMinutes) {
        const h = startHour + Math.floor(m / 60);
        const min = m % 60;
        const isMidnight = h === 24 && min === 0;
        const label = isMidnight
          ? '12:00 AM'
          : (() => {
              const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
              const ampm = h < 12 ? 'AM' : 'PM';
              return `${hour12}:${min.toString().padStart(2, '0')} ${ampm}`;
            })();
        timelineLabels.push({ minutesFromStart: m, label });
      }
      return (
        <div className="flex flex-col w-full relative z-10">
          {/* Timeline: fixed height 7 AM – 12 AM */}
          <div className="flex w-full items-stretch" style={{ minHeight: timelineHeightPx, height: timelineHeightPx }}>
            {/* Left: time labels at 15-min intervals (7:00 AM, 7:15 AM, 7:30 AM, 7:45 AM, 8:00 AM, …) */}
            <div className="flex-shrink-0 relative" style={{ width: columnWidth, height: timelineHeightPx }}>
              {timelineLabels.map(({ minutesFromStart, label }) => {
                const topPx = minutesFromStart * pxPerMinute;
                return (
                  <div
                    key={minutesFromStart}
                    className="absolute left-0 flex items-center gap-1"
                    style={{ top: topPx, transform: 'translateY(-50%)' }}
                  >
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
                    <span className="flex-1 border-t border-primary/40 min-h-px" style={{ minWidth: lineMinWidthPx }} aria-hidden />
                    <span className="rounded-full bg-primary flex-shrink-0" style={{ width: dotSizePx, height: dotSizePx }} aria-hidden />
                  </div>
                );
              })}
            </div>
            {/* Right: task/event blocks positioned by time and duration; right padding so tab/headline aren’t cut off */}
            <div className="flex-1 min-w-0 relative pl-2 pr-6" style={{ marginLeft: columnGapPx }}>
              {currentTimeTopPx != null && (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-primary z-10"
                  style={{ top: currentTimeTopPx }}
                  aria-hidden
                />
              )}
              {timelineBlocks.map(({ item, topPx, heightPx }) => {
                const isNextUp = item.type === 'task' && item.task && item.task.id === nextUpTaskId;
                const key = item.type === 'task' && item.task ? `t-${item.task.id}` : item.type === 'event' && item.event ? `e-${item.event.id}` : `b-${topPx}`;
                // Align block exactly with timeline: top = start time in px, height = duration in px (so 2h task = 2h on timeline)
                const isTask = item.type === 'task' && item.task;
                const blockStyle = isTask
                  ? getTodayAgendaBlockColors(item.task!.priority, TODAY_AGENDA_TIMELINE.blockTintOpacity)
                  : null;
                return (
                  <div
                    key={key}
                    className="absolute left-0 right-0 overflow-visible rounded-r"
                    style={{
                      top: topPx,
                      height: Math.max(minBlockHeightPx, heightPx),
                      minHeight: minBlockHeightPx,
                      ...(blockStyle
                        ? {
                            backgroundColor: blockStyle.backgroundColor,
                            borderLeft: `${TODAY_AGENDA_TIMELINE.blockAccentWidthPx}px solid ${blockStyle.accentColor}`,
                          }
                        : {}),
                    }}
                  >
                    {item.type === 'task' && item.task ? (
                      <div data-task-id={item.task.id} className="w-full h-full">
                        <div
                          className="w-full min-w-full h-full flex flex-col"
                          style={{
                            ...(TASK_CARD_TIMELINE.scale.todayAgenda !== 1
                              ? { transform: `scale(${TASK_CARD_TIMELINE.scale.todayAgenda})`, transformOrigin: 'top center' }
                              : {}),
                          }}
                        >
                          <DraggableTaskCard
                            task={getTaskWithOccurrenceSubtasks(item.task, todayString, tasks)}
                            onClick={() => item.task && handleTaskClick(item.task)}
                            droppableId="today-agenda"
                            occurrenceDate={todayString}
                            isNextUp={item.task.id === nextUpTaskId}
                            onComplete={handleTaskComplete}
                            timelineBlockHeightPx={
                              TASK_CARD_TIMELINE.scale.todayAgenda !== 1
                                ? Math.round((Math.max(minBlockHeightPx, heightPx)) / TASK_CARD_TIMELINE.scale.todayAgenda)
                                : Math.max(minBlockHeightPx, heightPx)
                            }
                          />
                        </div>
                      </div>
                    ) : item.type === 'event' && item.event ? (
                      <div data-event-id={item.event.id} className="w-full h-full">
                        <div
                          className="w-full min-w-full h-full"
                          style={{
                            ...(TASK_CARD_TIMELINE.scale.todayAgenda !== 1
                              ? { transform: `scale(${TASK_CARD_TIMELINE.scale.todayAgenda})`, transformOrigin: 'top center' }
                              : {}),
                          }}
                        >
                          <CalendarEventCard title={item.event.title} start={item.event.start} end={item.event.end} location={item.event.location} provider={item.event.provider} calendarColor={item.event.calendarColor} isRecurring={item.event.isRecurring} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Unscheduled: no time or outside 7AM–12AM */}
          {unscheduledItems.length > 0 && (
            <div className="flex flex-col w-full mt-4 pt-4 border-t border-border" style={{ gap: TODAY_AGENDA_TIMELINE.itemGapPx }}>
              <span className="text-xs font-medium text-muted-foreground mb-1">No time slot</span>
              {unscheduledItems.map((item, index) => {
                const timeLabel = item.type === 'task' && item.task ? getTaskTime(item.task) : item.type === 'event' && item.event ? getEventTime(item.event.start) : '';
                const isNextUp = item.type === 'task' && item.task && item.task.id === nextUpTaskId;
                const key = item.type === 'task' && item.task ? `u-t-${item.task.id}` : item.type === 'event' && item.event ? `u-e-${item.event.id}` : `u-${index}`;
                const timelinePaddingTop = TODAY_AGENDA_TIMELINE.rowPaddingTopPx + (isNextUp ? TODAY_AGENDA_TIMELINE.nextUpBadgeOffsetPx : 0);
                return (
                  <div key={key} className="flex w-full items-start" style={{ gap: TODAY_AGENDA_TIMELINE.columnGapPx }}>
                    <div className="flex flex-shrink-0 flex-col" style={{ width: TODAY_AGENDA_TIMELINE.columnWidth, paddingTop: timelinePaddingTop }}>
                      <div className="flex items-center flex-shrink-0" style={{ gap: TODAY_AGENDA_TIMELINE.rowGapPx }}>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{timeLabel || '—'}</span>
                        <span className="flex-1 border-t-2 border-primary/50 dark:border-primary/40 min-h-px" style={{ minWidth: TODAY_AGENDA_TIMELINE.lineMinWidthPx }} aria-hidden />
                        <span className="rounded-full bg-primary flex-shrink-0" style={{ width: TODAY_AGENDA_TIMELINE.dotSizePx, height: TODAY_AGENDA_TIMELINE.dotSizePx }} aria-hidden />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 w-full pr-6" style={{ paddingTop: TODAY_AGENDA_TIMELINE.rowPaddingTopPx }}>
                      {item.type === 'task' && item.task ? (
                        <div data-task-id={item.task.id} className="w-full">
                          <div className="w-full min-w-full" style={{ ...(TASK_CARD_TIMELINE.scale.todayAgenda !== 1 ? { transform: `scale(${TASK_CARD_TIMELINE.scale.todayAgenda})`, transformOrigin: 'top center' } : {}) }}>
                            <DraggableTaskCard task={getTaskWithOccurrenceSubtasks(item.task, todayString, tasks)} onClick={() => item.task && handleTaskClick(item.task)} droppableId="today-agenda" occurrenceDate={todayString} isNextUp={item.task.id === nextUpTaskId} onComplete={handleTaskComplete} />
                          </div>
                        </div>
                      ) : item.type === 'event' && item.event ? (
                        <div data-event-id={item.event.id} className="w-full">
                          <div className="w-full min-w-full" style={{ ...(TASK_CARD_TIMELINE.scale.todayAgenda !== 1 ? { transform: `scale(${TASK_CARD_TIMELINE.scale.todayAgenda})`, transformOrigin: 'top center' } : {}) }}>
                            <CalendarEventCard title={item.event.title} start={item.event.start} end={item.event.end} location={item.event.location} provider={item.event.provider} calendarColor={item.event.calendarColor} isRecurring={item.event.isRecurring} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    },
    [timelineBlocks, unscheduledItems, timelineHeightPx, currentTimeTopPx, nextUpTaskId, todayString, tasks]
  );

  return (
    <>
      <Confetti 
        trigger={showConfetti}
        origin={confettiOrigin}
        onComplete={() => {
          // Use timeout to ensure state update happens after animation cleanup
          if (confettiTimeoutRef.current) {
            clearTimeout(confettiTimeoutRef.current);
          }
          confettiTimeoutRef.current = setTimeout(() => {
            setShowConfetti(false);
            setConfettiOrigin(null);
            confettiTimeoutRef.current = null;
          }, CONFETTI_RESET_DELAY_MS);
        }} 
      />
      <div
        ref={setNodeRef}
        data-droppable-id="today-agenda"
        data-today-agenda="true"
        className={cn(
          `flex flex-col transition-all duration-300`,
          isOver &&
            "bg-primary/20 border-4 border-primary/70 border-dashed shadow-xl shadow-primary/30 ring-4 ring-primary/40",
          shouldUseMobileLayout ? "w-full" : "h-full min-h-0", // h-full ensures proper height chain for ScrollArea (matches InboxView pattern)
          // On desktop, apply gradient background to root container (like Folders Panel)
          !shouldUseMobileLayout && `${UI_GRADIENT_COLORS.timeline.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`,
        )}
        style={{
          position: 'relative',
          zIndex: isOver ? Z_INDEX.DROP_ZONE : Z_INDEX.TIMELINE_LINE, // Ensure drop zone is above other elements when dragging over
          // On mobile, ensure transparent background to show parent gradient
          // On desktop, background gradient is applied via className above
          ...(shouldUseMobileLayout ? {
            backgroundColor: 'transparent',
            background: 'transparent',
          } : {
            // Remove minHeight on desktop - it conflicts with ScrollArea height constraints
            // Drop zone accessibility is handled by ScrollArea viewport
          }),
        } as React.CSSProperties}
        data-tour="today-panel"
      >
      {/* Header */}
      {!hideHeader && (
        <>
          {/* Header wrapper - fixed height to prevent shifting */}
          <div 
            className="relative flex-shrink-0"
            style={{ 
              // Use fixed height on both mobile and desktop to prevent shifting
              // On mobile, header is fixed at top, so height should be consistent
              height: `${HEADER_HEIGHT}px`,
            }}
          >
          <AppHeader
            title="Today Agenda"
            panelOpen={true}
            isSidePanelHeader={true}
            description={
              isOver
                ? "✨ Drop task here to schedule for today"
                : undefined
            }
            hideDesktopLogo
            actions={
              <div className={cn(
                "flex flex-col items-end text-right",
                shouldUseMobileLayout && "justify-center self-center" // Vertically center on mobile/tablet within header
              )}>
                <span 
                  className="font-bold text-foreground uppercase tracking-wide"
                  style={{ fontSize: shouldUseMobileLayout ? HEADER_DATE_SIZE_MOBILE : HEADER_DATE_SIZE }}
                >
                  {today.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span 
                  className="font-bold text-foreground"
                  style={{ 
                    fontSize: shouldUseMobileLayout ? HEADER_DATE_NUMBER_SIZE_MOBILE : HEADER_DATE_NUMBER_SIZE,
                    marginTop: HEADER_DATE_MARGIN_TOP,
                  }}
                >
                  {today.getDate()}
                </span>
              </div>
            }
          />
            {/* Current Time Indicator - Desktop only (bottom right corner of header) */}
            <div 
              className={cn(
                "hidden md:block absolute pointer-events-none",
                `z-[${Z_INDEX.TIME_INDICATOR}]`
              )}
              style={{
                bottom: HEADER_GAP_SMALL, // 0.5rem (8px) - matches bottom-2
                right: HEADER_GAP_LARGE, // 0.75rem (12px) - close to right-6 (1.5rem), using available constant
              }}
            >
              <span className="text-xs font-medium text-primary bg-background/90 dark:bg-card/90 px-2 py-1 rounded shadow-sm border border-primary/20 backdrop-blur-sm">
                {currentTime.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Timeline */}
      {/* On mobile (when hideHeader is false), rely on parent scroll container in App.tsx */}
      {/* On desktop (when hideHeader is true), use ScrollArea for standalone scrolling */}
      {hideHeader ? (
        shouldUseMobileLayout ? (
          <div className="w-full relative flex-1 min-h-0">
            <div 
              ref={timelineContainerRef}
              className="px-5 w-full relative"
              style={{
                paddingTop: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.desktop 
                  ? 0 // No top padding on mobile - header spacer in App.tsx handles spacing
                  : DESKTOP_PADDING_TOP,
                paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.desktop
                  ? `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})` // Full nav bar height + safe area + extra buffer
                  : undefined,
                // Ensure transparent background to show parent gradient
                backgroundColor: 'transparent',
                background: 'transparent',
              } as React.CSSProperties}
            >
            {combinedItems.length === 0 ? (
              <div 
                className={cn(
                  `flex flex-col items-center justify-center text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none transition-all duration-300`,
                  isOver && "scale-105"
                )}
                style={{
                  paddingTop: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingBottom: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingLeft: EMPTY_STATE_PADDING_X,
                  paddingRight: EMPTY_STATE_PADDING_X,
                }}
              >
                <motion.div 
                  className={cn(
                    "rounded-full bg-primary/10 flex items-center justify-center pointer-events-none transition-all duration-300",
                    isOver && "bg-primary/20 scale-110 ring-4 ring-primary/30"
                  )}
                  style={{
                    width: EMPTY_STATE_ICON_SIZE_SMALL,
                    height: EMPTY_STATE_ICON_SIZE_SMALL,
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                  animate={isOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon name="calendar" 
                    className={cn(
                      "text-primary/40 transition-colors duration-300",
                      isOver && "text-primary/60"
                    )}
                    style={{
                      width: EMPTY_STATE_ICON_INNER_SIZE,
                      height: EMPTY_STATE_ICON_INNER_SIZE,
                    }}
                  />
                </motion.div>
                <p 
                  className={cn(
                    "text-sm text-muted-foreground pointer-events-none transition-colors duration-300",
                    isOver && "text-primary/80 font-medium"
                  )}
                  style={{
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                >
                  {isOver ? "Drop task here to schedule for today" : TODAY_AGENDA_TEXT.emptyState.noTasks}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTask}
                  className={cn(
                    "!rounded-full pointer-events-auto transition-all duration-300",
                    isOver && "ring-2 ring-primary/50 scale-105"
                  )}
                >
                  <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                {agendaListRows}

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
                        <Icon name="sticky-note" size={ICON_SIZE_MD} weight="duotone" className="text-primary" />
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                          Next Up Details
                        </h3>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-lg bg-gradient-to-r cursor-pointer transition-all"
                        style={{
                          background: `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`,
                          borderLeftColor: UI_GRADIENT_COLORS.status.success.from,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}20, ${UI_GRADIENT_COLORS.status.success.to}15, transparent)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`;
                        }}
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
                                  <span className={cn(TEXT_SIZES.xs9, "text-muted-foreground")}>
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span 
                                  className={cn(TEXT_SIZES.xs9, "px-1.5 py-0.5 rounded-full uppercase tracking-wider")}
                                  style={{
                                    backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                    color: actualTheme === 'dark' ? UI_TODAY_AGENDA_STATUS_COLORS.success.text.light : UI_TODAY_AGENDA_STATUS_COLORS.success.text.dark,
                                  }}
                                >
                                  {TODAY_AGENDA_TEXT.nextUp}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <Icon name="sticky-note" size={ICON_SIZE_SM} weight="duotone" className="text-primary/60 mt-0.5 flex-shrink-0" />
                              <div 
                                className={cn(
                                  "text-xs text-muted-foreground leading-relaxed flex-1",
                                  // Rich text formatting styles - only apply if HTML is present
                                  hasHTMLTags(nextUpTask.notes) && "[&_strong]:font-bold [&_b]:font-bold",
                                  hasHTMLTags(nextUpTask.notes) && "[&_em]:italic [&_i]:italic",
                                  hasHTMLTags(nextUpTask.notes) && "[&_u]:underline",
                                  hasHTMLTags(nextUpTask.notes) && "[&_s]:line-through [&_strike]:line-through",
                                  hasHTMLTags(nextUpTask.notes) && "[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_mark]:rounded",
                                  hasHTMLTags(nextUpTask.notes) && "[&_ul]:list-disc [&_ul]:ml-3 [&_ul]:my-0.5 [&_ul]:space-y-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_ol]:list-decimal [&_ol]:ml-3 [&_ol]:my-0.5 [&_ol]:space-y-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_li]:ml-1 [&_li]:leading-relaxed",
                                  hasHTMLTags(nextUpTask.notes) && "[&_p]:my-1 [&_p]:leading-relaxed [&_p]:block [&_p:empty]:hidden",
                                  hasHTMLTags(nextUpTask.notes) && "[&_p+p]:mt-2",
                                  hasHTMLTags(nextUpTask.notes) && "[&_code]:bg-muted [&_code]:dark:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:inline-block"
                                )}
                                {...(hasHTMLTags(nextUpTask.notes) 
                                  ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(nextUpTask.notes) } }
                                  : { children: nextUpTask.notes }
                                )}
                              />
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
          </div>
        ) : (
          // LAYER 1: Desktop view with header - basic vertical scroll structure
          // Wrapper: flex-1 to take remaining space after header (matches InboxView pattern exactly)
          // When hideHeader is true, this is the only child, so flex-1 should take all space
          <div className={cn("flex-1 min-h-0", !hideHeader && "w-full relative")}>
            {/* overflow-auto allows both columns (tasks + timeline) to be visible; ScrollArea's overflow-x:hidden was clipping the timeline */}
            <div className="h-full w-full overflow-auto min-w-0">
              <div 
                ref={timelineContainerRef}
                className={cn("px-5 sm:pb-safe md:pt-12 md:pb-4 w-full relative min-w-0")}
                style={{
                  paddingTop: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.desktop 
                    ? `${Math.max(TIMELINE_PADDING.mobile, TIMELINE_PADDING.minMobilePadding)}px` 
                    : DESKTOP_PADDING_TOP,
                  paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.desktop
                    ? KANBAN_MOBILE.bottomPaddingCalc
                    : `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`,
                }}
              >
              {combinedItems.length === 0 ? (
              <div 
                className={cn(
                  `flex flex-col items-center justify-center text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none transition-all duration-300`,
                  isOver && "scale-105"
                )}
                style={{
                  paddingTop: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingBottom: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingLeft: EMPTY_STATE_PADDING_X,
                  paddingRight: EMPTY_STATE_PADDING_X,
                }}
              >
                <motion.div 
                  className={cn(
                    "rounded-full bg-primary/10 flex items-center justify-center pointer-events-none transition-all duration-300",
                    isOver && "bg-primary/20 scale-110 ring-4 ring-primary/30"
                  )}
                  style={{
                    width: EMPTY_STATE_ICON_SIZE_SMALL,
                    height: EMPTY_STATE_ICON_SIZE_SMALL,
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                  animate={isOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon name="calendar" 
                    className={cn(
                      "text-primary/40 transition-colors duration-300",
                      isOver && "text-primary/60"
                    )}
                    style={{
                      width: EMPTY_STATE_ICON_INNER_SIZE,
                      height: EMPTY_STATE_ICON_INNER_SIZE,
                    }}
                  />
                </motion.div>
                <p 
                  className={cn(
                    "text-sm text-muted-foreground pointer-events-none transition-colors duration-300",
                    isOver && "text-primary/80 font-medium"
                  )}
                  style={{
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                >
                  {isOver ? "Drop task here to schedule for today" : TODAY_AGENDA_TEXT.emptyState.noTasks}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTask}
                  className={cn(
                    "!rounded-full pointer-events-auto transition-all duration-300",
                    isOver && "ring-2 ring-primary/50 scale-105"
                  )}
                >
                  <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                {agendaListRows}

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
                        <Icon name="sticky-note" size={ICON_SIZE_MD} weight="duotone" className="text-primary" />
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                          Next Up Details
                        </h3>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-lg bg-gradient-to-r cursor-pointer transition-all"
                        style={{
                          background: `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`,
                          borderLeftColor: UI_GRADIENT_COLORS.status.success.from,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}20, ${UI_GRADIENT_COLORS.status.success.to}15, transparent)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`;
                        }}
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
                                  <span className={cn(TEXT_SIZES.xs9, "text-muted-foreground")}>
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span 
                                  className={cn(TEXT_SIZES.xs9, "px-1.5 py-0.5 rounded-full uppercase tracking-wider")}
                                  style={{
                                    backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                    color: actualTheme === 'dark' ? UI_TODAY_AGENDA_STATUS_COLORS.success.text.light : UI_TODAY_AGENDA_STATUS_COLORS.success.text.dark,
                                  }}
                                >
                                  {TODAY_AGENDA_TEXT.nextUp}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <Icon name="sticky-note" size={ICON_SIZE_SM} weight="duotone" className="text-primary/60 mt-0.5 flex-shrink-0" />
                              <div 
                                className={cn(
                                  "text-xs text-muted-foreground leading-relaxed flex-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_strong]:font-bold [&_b]:font-bold",
                                  hasHTMLTags(nextUpTask.notes) && "[&_em]:italic [&_i]:italic",
                                  hasHTMLTags(nextUpTask.notes) && "[&_u]:underline",
                                  hasHTMLTags(nextUpTask.notes) && "[&_s]:line-through [&_strike]:line-through",
                                  hasHTMLTags(nextUpTask.notes) && "[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_mark]:rounded",
                                  hasHTMLTags(nextUpTask.notes) && "[&_ul]:list-disc [&_ul]:ml-3 [&_ul]:my-0.5 [&_ul]:space-y-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_ol]:list-decimal [&_ol]:ml-3 [&_ol]:my-0.5 [&_ol]:space-y-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_li]:ml-1 [&_li]:leading-relaxed",
                                  hasHTMLTags(nextUpTask.notes) && "[&_p]:my-1 [&_p]:leading-relaxed [&_p]:block [&_p:empty]:hidden",
                                  hasHTMLTags(nextUpTask.notes) && "[&_p+p]:mt-2",
                                  hasHTMLTags(nextUpTask.notes) && "[&_code]:bg-muted [&_code]:dark:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:inline-block"
                                )}
                                {...(hasHTMLTags(nextUpTask.notes) 
                                  ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(nextUpTask.notes) } }
                                  : { children: nextUpTask.notes }
                                )}
                              />
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
          </div>
        </div>
        )
      ) : (
        // LAYER 1: When hideHeader=false (header IS visible)
        typeof window !== 'undefined' && window.innerWidth >= VIEWPORT_BREAKPOINTS.desktop ? (
          // Desktop: overflow-auto so tasks + timeline column are both visible (no overflow-x clip)
          <div className="flex-1 min-h-0">
            <div className="h-full w-full overflow-auto min-w-0">
              <div 
                ref={timelineContainerRef}
                className={cn("px-5 sm:pb-safe md:pt-12 md:pb-4 w-full relative min-w-0")}
                style={{
                  paddingTop: DESKTOP_PADDING_TOP,
                  paddingBottom: `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`,
                  backgroundColor: 'transparent',
                  background: 'transparent',
                } as React.CSSProperties}
              >
          {combinedItems.length === 0 ? (
            <div className={cn(
              `flex flex-col items-center justify-center py-12 text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none transition-all duration-300`,
              isOver && "scale-105"
            )}>
              <motion.div 
                className={cn(
                  "w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 pointer-events-none transition-all duration-300",
                  isOver && "bg-primary/20 scale-110 ring-4 ring-primary/30"
                )}
                animate={isOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Icon name="calendar" size={ICON_SIZE_MD} weight="duotone" className={cn(
                  "w-6 h-6 text-primary/40 transition-colors duration-300",
                  isOver && "text-primary/60"
                )} />
              </motion.div>
              <p className={cn(
                "text-sm text-muted-foreground mb-3 pointer-events-none transition-colors duration-300",
                isOver && "text-primary/80 font-medium"
              )}>
                {isOver ? "Drop task here to schedule for today" : TODAY_AGENDA_TEXT.emptyState.noTasks}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddTask}
                className={cn(
                  "!rounded-full pointer-events-auto transition-all duration-300",
                  isOver && "ring-2 ring-primary/50 scale-105"
                )}
              >
                <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                {TODAY_AGENDA_TEXT.emptyState.addTask}
              </Button>
            </div>
          ) : (
            <>
              {agendaListRows}

              {/* Next Up Task Details */}
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
                      <Icon name="sticky-note" size={ICON_SIZE_MD} weight="duotone" className="text-primary" />
                      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                        Next Up Details
                      </h3>
                    </div>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 rounded-lg bg-gradient-to-r cursor-pointer transition-all"
                      style={{
                        background: `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`,
                        borderLeftColor: UI_GRADIENT_COLORS.status.success.from,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}20, ${UI_GRADIENT_COLORS.status.success.to}15, transparent)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`;
                      }}
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
                                <span className={cn(TEXT_SIZES.xs9, "text-muted-foreground")}>
                                  {getTaskTime(nextUpTask)}
                                </span>
                              )}
                              <span 
                                className={cn(TEXT_SIZES.xs9, "px-1.5 py-0.5 rounded-full uppercase tracking-wider")}
                                style={{
                                  backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                  color: actualTheme === 'dark' ? UI_TODAY_AGENDA_STATUS_COLORS.success.text.light : UI_TODAY_AGENDA_STATUS_COLORS.success.text.dark,
                                }}
                              >
                                {TODAY_AGENDA_TEXT.nextUp}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-start gap-1.5 mt-1.5">
                            <Icon name="sticky-note" size={ICON_SIZE_XS} weight="duotone" className="text-primary/60 mt-0.5 flex-shrink-0" />
                            <div 
                              className={cn(
                                "text-xs text-muted-foreground leading-relaxed flex-1",
                                hasHTMLTags(nextUpTask.notes) && "[&_strong]:font-bold [&_b]:font-bold",
                                hasHTMLTags(nextUpTask.notes) && "[&_em]:italic [&_i]:italic",
                                hasHTMLTags(nextUpTask.notes) && "[&_u]:underline",
                                hasHTMLTags(nextUpTask.notes) && "[&_s]:line-through [&_strike]:line-through",
                                hasHTMLTags(nextUpTask.notes) && "[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_mark]:rounded",
                                hasHTMLTags(nextUpTask.notes) && "[&_ul]:list-disc [&_ul]:ml-3 [&_ul]:my-0.5 [&_ul]:space-y-1",
                                hasHTMLTags(nextUpTask.notes) && "[&_ol]:list-decimal [&_ol]:ml-3 [&_ol]:my-0.5 [&_ol]:space-y-1",
                                hasHTMLTags(nextUpTask.notes) && "[&_li]:ml-1 [&_li]:leading-relaxed",
                                hasHTMLTags(nextUpTask.notes) && "[&_p]:my-1 [&_p]:leading-relaxed [&_p]:block [&_p:empty]:hidden",
                                hasHTMLTags(nextUpTask.notes) && "[&_p+p]:mt-2",
                                hasHTMLTags(nextUpTask.notes) && "[&_code]:bg-muted [&_code]:dark:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:inline-block"
                              )}
                              {...(hasHTMLTags(nextUpTask.notes) 
                                ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(nextUpTask.notes) } }
                                : { children: nextUpTask.notes }
                              )}
                            />
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
            </div>
          </div>
        ) : (
          // Mobile: rely on parent scroll
          <div 
            ref={timelineContainerRef}
            className="px-5 w-full relative"
            style={{
              paddingTop: `${Math.max(TIMELINE_PADDING.mobile, TIMELINE_PADDING.minMobilePadding)}px`,
              paddingBottom: `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`,
              backgroundColor: 'transparent',
              background: 'transparent',
            } as React.CSSProperties}
          >
            {combinedItems.length === 0 ? (
              <div 
                className={cn(
                  `flex flex-col items-center justify-center text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none transition-all duration-300`,
                  isOver && "scale-105"
                )}
                style={{
                  paddingTop: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingBottom: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingLeft: EMPTY_STATE_PADDING_X,
                  paddingRight: EMPTY_STATE_PADDING_X,
                }}
              >
                <motion.div 
                  className={cn(
                    "rounded-full bg-primary/10 flex items-center justify-center pointer-events-none transition-all duration-300",
                    isOver && "bg-primary/20 scale-110 ring-4 ring-primary/30"
                  )}
                  style={{
                    width: EMPTY_STATE_ICON_SIZE_SMALL,
                    height: EMPTY_STATE_ICON_SIZE_SMALL,
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                  animate={isOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon name="calendar" 
                    className={cn(
                      "text-primary/40 transition-colors duration-300",
                      isOver && "text-primary/60"
                    )}
                    style={{
                      width: EMPTY_STATE_ICON_INNER_SIZE,
                      height: EMPTY_STATE_ICON_INNER_SIZE,
                    }}
                  />
                </motion.div>
                <p 
                  className={cn(
                    "text-sm text-muted-foreground pointer-events-none transition-colors duration-300",
                    isOver && "text-primary/80 font-medium"
                  )}
                  style={{
                    marginBottom: EMPTY_STATE_MARGIN_BOTTOM_SMALL,
                  }}
                >
                  {isOver ? "Drop task here to schedule for today" : TODAY_AGENDA_TEXT.emptyState.noTasks}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTask}
                  className={cn(
                    "!rounded-full pointer-events-auto transition-all duration-300",
                    isOver && "ring-2 ring-primary/50 scale-105"
                  )}
                >
                  <Icon name="plus" size={ICON_SIZE_MD} className="mr-2" />
                  {TODAY_AGENDA_TEXT.emptyState.addTask}
                </Button>
              </div>
            ) : (
              <>
                {agendaListRows}
                {(() => {
                  const nextUpTask = todayTasks.find((task) => task.id === nextUpTaskId);
                  if (!nextUpTask || !nextUpTask.notes) return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6 pt-4 border-t border-primary/20"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="sticky-note" size={ICON_SIZE_MD} weight="duotone" className="text-primary" />
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                          Next Up Details
                        </h3>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-lg bg-gradient-to-r cursor-pointer transition-all"
                        style={{
                          background: `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`,
                          borderLeftColor: UI_GRADIENT_COLORS.status.success.from,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}20, ${UI_GRADIENT_COLORS.status.success.to}15, transparent)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${UI_GRADIENT_COLORS.status.success.from}10, ${UI_GRADIENT_COLORS.status.success.to}10, transparent)`;
                        }}
                        onClick={() => handleTaskClick(nextUpTask)}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                              getPriorityColor(nextUpTask.priority),
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-xs line-clamp-1 flex-1 font-semibold">
                                {nextUpTask.title}
                              </h4>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {nextUpTask.scheduledDate && (
                                  <span className={cn(TEXT_SIZES.xs9, "text-muted-foreground")}>
                                    {getTaskTime(nextUpTask)}
                                  </span>
                                )}
                                <span 
                                  className={cn(TEXT_SIZES.xs9, "px-1.5 py-0.5 rounded-full uppercase tracking-wider")}
                                  style={{
                                    backgroundColor: UI_GRADIENT_COLORS.status.success.from,
                                    color: actualTheme === 'dark' ? UI_TODAY_AGENDA_STATUS_COLORS.success.text.light : UI_TODAY_AGENDA_STATUS_COLORS.success.text.dark,
                                  }}
                                >
                                  {TODAY_AGENDA_TEXT.nextUp}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <Icon name="sticky-note" size={ICON_SIZE_SM} weight="duotone" className="text-primary/60 mt-0.5 flex-shrink-0" />
                              <div 
                                className={cn(
                                  "text-xs text-muted-foreground leading-relaxed flex-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_strong]:font-bold [&_b]:font-bold",
                                  hasHTMLTags(nextUpTask.notes) && "[&_em]:italic [&_i]:italic",
                                  hasHTMLTags(nextUpTask.notes) && "[&_u]:underline",
                                  hasHTMLTags(nextUpTask.notes) && "[&_s]:line-through [&_strike]:line-through",
                                  hasHTMLTags(nextUpTask.notes) && "[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_mark]:rounded",
                                  hasHTMLTags(nextUpTask.notes) && "[&_ul]:list-disc [&_ul]:ml-3 [&_ul]:my-0.5 [&_ul]:space-y-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_ol]:list-decimal [&_ol]:ml-3 [&_ol]:my-0.5 [&_ol]:space-y-1",
                                  hasHTMLTags(nextUpTask.notes) && "[&_li]:ml-1 [&_li]:leading-relaxed",
                                  hasHTMLTags(nextUpTask.notes) && "[&_p]:my-1 [&_p]:leading-relaxed [&_p]:block [&_p:empty]:hidden",
                                  hasHTMLTags(nextUpTask.notes) && "[&_p+p]:mt-2",
                                  hasHTMLTags(nextUpTask.notes) && "[&_code]:bg-muted [&_code]:dark:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:inline-block"
                                )}
                                {...(hasHTMLTags(nextUpTask.notes) 
                                  ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(nextUpTask.notes) } }
                                  : { children: nextUpTask.notes }
                                )}
                              />
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
        )
      )}

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        initialDate={getDateString(today)}
      />
      </div>
    </>
  );
}
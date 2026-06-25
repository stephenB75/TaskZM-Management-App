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
import { cn, prepareTaskForDialog, hasHTMLTags, sanitizeHTML, getDateString, getTaskWithOccurrenceSubtasks, parseCalendarEventTime, parseChronologicalTimeSource, isSeriesBaseTask, hasSeriesOccurrenceForDate, dedupeTasksForDay, compareTasksByScheduledTimeOnDay, getTaskSortTimeOnDay, getCalendarEventSortTimeOnDay, compareChronologicalItemsOnDay } from "../lib/utils";
import { isDateInRecurrence } from "../lib/recurrence";
import { toast } from "../lib/toast-wrapper";
import { playTaskCompleteSound } from "../lib/toast-sound";
import type { Task } from "../types";
import { UI_GRADIENT_COLORS, UI_TODAY_AGENDA_STATUS_COLORS } from "../lib/ui-colors";
import { TASK_CALCULATION_CONSTANTS } from "../lib/task-calculation-constants";
import { TASK_CARD_HEIGHT_CONFIG, TASK_CARD_CALCULATIONS, TASK_CARD_LAYOUT_METRICS, TASK_CARD_TIMELINE, TASK_CARD_PRIORITY_COLORS, TODAY_AGENDA_PRIORITY_INDICATOR_BG } from "../lib/task-card-constants";
import { TODAY_AGENDA_TEXT, TODAY_AGENDA_EVENT_ACCENT_HEX } from "../lib/today-agenda-constants";
import {
  resolveTodayAgendaLayoutMode,
  getTodayAgendaCompactRowHeightPx,
  formatTodayAgendaMinutesLabel,
  getTodayAgendaNextUpInsetPx,
  type TodayAgendaLayoutMode,
} from "../lib/today-agenda-layout";
import { HEADER_HEIGHT, TIMELINE_PADDING, VIEWPORT_BREAKPOINTS, MOBILE_SPACING, Z_INDEX, COMPONENT_DIMENSIONS, HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE, NAV_BAR_HEIGHT, NAV_BAR_SCROLL_BUFFER_REM, HEADER_DESCRIPTION_SIZE, HEADER_DESCRIPTION_MARGIN_TOP, HEADER_DATE_SIZE, HEADER_DATE_SIZE_MOBILE, HEADER_DATE_NUMBER_SIZE, HEADER_DATE_NUMBER_SIZE_MOBILE, HEADER_DATE_MARGIN_TOP, MOBILE_PADDING_BOTTOM, DESKTOP_PADDING_TOP, TODAY_AGENDA_MIN_HEIGHT, HEADER_GAP_SMALL, HEADER_GAP_LARGE, PANEL_EMPTY_STATE_PADDING_Y, EMPTY_STATE_ICON_SIZE_SMALL, EMPTY_STATE_ICON_INNER_SIZE, EMPTY_STATE_MARGIN_BOTTOM_SMALL, EMPTY_STATE_PADDING_X, ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_XS, CONFETTI_RESET_DELAY_MS, TODAY_AGENDA_TIMELINE, getTodayAgendaTimelineBlockHeightPx } from "../lib/layout-constants";
import { TEXT_SIZES } from "../lib/text-size-constants";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { KANBAN_MOBILE } from "../lib/kanban-constants";
import { getTaskMinutes } from "../lib/daily-hours-utils";
import { logger } from "../lib/logger";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED, RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS, RECURRENCE_SERIES_OCCURRENCE_SEPARATOR, MINUTES_PER_HOUR, MILLISECONDS_PER_MINUTE } from "../lib/business-constants";

interface TodayAgendaViewProps {
  hideHeader?: boolean;
}

export function TodayAgendaView({
  hideHeader = false,
}: TodayAgendaViewProps = {}) {
  const { tasks, isLoading } = useTasks();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
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
  // Ref for the current-time indicator line so we can scroll it into view once on mount
  const currentTimeIndicatorRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToCurrentTimeRef = useRef(false);
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

  // Current time indicator is display-only; it must never call updateTask or modify task.scheduledDate.
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

  // Get today's date (stable per calendar day so useCalendarEvents gets a stable range and doesn't refetch every render)
  const todayDateString = getDateString(new Date());
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [todayDateString]);
  
  const todayString = todayDateString;
  const filteredToday = Array.isArray(tasks) ? tasks.filter((task) => {
    // Defensive check: ensure task is valid
    if (!task || typeof task !== 'object') {
      return false;
    }
    try {
      // Exclude _subtasks_ occurrence records: they are merged into the base/completed task via getTaskWithOccurrenceSubtasks, not shown as separate cards (prevents duplicate on Today)
      if (task.id.includes(RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS)) {
        return false;
      }
      // Check if task matches today (either exact match or recurrence pattern)
      if (!isDateInRecurrence(task, today)) return false;
      // Show base only when no occurrence for today; hide base when an occurrence exists (no duplicate).
      if (isSeriesBaseTask(task) && hasSeriesOccurrenceForDate(tasks, task.id, todayDateString)) return false;
      // Second line of defense: if this task's id is a base (no __) and an occurrence exists for today, hide it. Catches base when recurrence was stripped after load/sync.
      if (!task.id.includes(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR) && hasSeriesOccurrenceForDate(tasks, task.id, todayDateString)) return false;
      // Avoid duplicate: if this is a base recurring task and we have a completed occurrence for today, show only the completed occurrence
      if (task.recurrence && task.recurrence.type !== 'none') {
        const completedOccurrenceId = `${task.id}${RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED}${todayDateString}`;
        if (tasks.some((t) => t.id === completedOccurrenceId)) return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking date in recurrence:', error, task);
      return false;
    }
  }) : [];
  const allTodayTasks = dedupeTasksForDay(filteredToday, todayDateString);

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
        return compareTasksByScheduledTimeOnDay(a, b, today);
      } catch (error) {
        console.error('Error sorting tasks:', error, a, b);
        return 0;
      }
    });
  }, [incompleteTasks, today]);

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

  // Update state when events change, filtering by local date (use parseCalendarEventTime for consistent UTC/local handling with API)
  useEffect(() => {
    const filteredEvents = todayCalendarEventsData.filter((event) => {
      if (!event?.start) return false;
      try {
        const eventDate = parseCalendarEventTime(event.start);
        if (isNaN(eventDate.getTime())) return false;
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
    const eventIdsRepresentedByTasks = new Set(
      todayTasks
        .map((t) => (t as Task & { calendar_event_id?: string | null }).calendar_event_id)
        .filter((id): id is string => !!id)
    );

    // Add tasks with sort time normalized to today (time-of-day only; recurring base dates differ)
    for (const task of todayTasks) {
      items.push({
        type: 'task',
        task,
        sortTime: getTaskSortTimeOnDay(today, task),
      });
    }

    // Add calendar events (skip if a task already represents this event to avoid duplicate at same time)
    const seenEventIds = new Set<string>();
    for (const event of todayCalendarEvents) {
      if (eventIdsRepresentedByTasks.has(event.id)) continue;
      if (seenEventIds.has(event.id)) continue;
      seenEventIds.add(event.id);
      items.push({
        type: 'event',
        event,
        sortTime: getCalendarEventSortTimeOnDay(today, event.start),
      });
    }
    
    // Chronological order: earliest first; items without time go to end.
    // When a task and a calendar event have the same time, use stable order: events first, then tasks, then by id.
    items.sort((a, b) => {
      const idA = a.type === 'task' && a.task ? a.task.id : a.type === 'event' && a.event ? a.event.id : '';
      const idB = b.type === 'task' && b.task ? b.task.id : b.type === 'event' && b.event ? b.event.id : '';
      return compareChronologicalItemsOnDay(a.sortTime, b.sortTime, idA, idB);
    });
    
    return items;
  }, [todayTasks, todayCalendarEvents, today]);

  /** Timeline blocks (7AM–12AM). Hybrid layout: compact list when sparse, duration blocks when dense/overlapping. */
  const { timelineBlocks, unscheduledItems, timelineLayoutHeightPx, layoutMode } = useMemo(() => {
    const startHour = TODAY_AGENDA_TIMELINE.startHour;
    const totalMinutes = TODAY_AGENDA_TIMELINE.totalMinutes;
    const pxPerMinute = TODAY_AGENDA_TIMELINE.pxPerMinute;
    const blockGapPx = TODAY_AGENDA_TIMELINE.blockGapPx;
    type Block = { item: CombinedItem; naturalTopPx: number; topPx: number; heightPx: number; actualStartMins: number; actualDurationMins: number; actualEndMins: number };
    const blocks: Block[] = [];
    const unscheduled: CombinedItem[] = [];
    for (const item of combinedItems) {
      if (item.type === 'task' && item.task) {
        if (!item.task.scheduledDate) {
          unscheduled.push(item);
          continue;
        }
        const start = parseChronologicalTimeSource(item.task.scheduledDate);
        if (isNaN(start.getTime())) {
          unscheduled.push(item);
          continue;
        }
        const startMins = start.getHours() * MINUTES_PER_HOUR + start.getMinutes() - startHour * MINUTES_PER_HOUR;
        if (startMins < 0 || startMins >= totalMinutes) {
          unscheduled.push(item);
          continue;
        }
        const durationMins =
          typeof item.task.estimatedTime === 'number' && item.task.estimatedTime > 0
            ? item.task.estimatedTime
            : getTaskMinutes(item.task, { useCachedAIAnalysis: true });
        const heightPx = getTodayAgendaTimelineBlockHeightPx(durationMins);
        const naturalTopPx = Math.round(startMins * pxPerMinute);
        const actualEndMins = startMins + durationMins;
        blocks.push({ item, naturalTopPx, topPx: naturalTopPx, heightPx, actualStartMins: startMins, actualDurationMins: durationMins, actualEndMins });
      } else if (item.type === 'event' && item.event) {
        const start = parseCalendarEventTime(item.event.start);
        const end = parseCalendarEventTime(item.event.end);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          unscheduled.push(item);
          continue;
        }
        const startMins = start.getHours() * MINUTES_PER_HOUR + start.getMinutes() - startHour * MINUTES_PER_HOUR;
        const durationMins = Math.max(1, Math.round((end.getTime() - start.getTime()) / MILLISECONDS_PER_MINUTE));
        if (startMins < 0 || startMins >= totalMinutes) {
          unscheduled.push(item);
          continue;
        }
        const heightPx = getTodayAgendaTimelineBlockHeightPx(durationMins);
        const naturalTopPx = Math.round(startMins * pxPerMinute);
        const actualEndMins = startMins + durationMins;
        blocks.push({ item, naturalTopPx, topPx: naturalTopPx, heightPx, actualStartMins: startMins, actualDurationMins: durationMins, actualEndMins });
      }
    }
    blocks.sort((a, b) => {
      if (a.actualStartMins !== b.actualStartMins) return a.actualStartMins - b.actualStartMins;
      const keyA = a.item.type === 'task' && a.item.task ? a.item.task.id : a.item.type === 'event' && a.item.event ? a.item.event.id : '';
      const keyB = b.item.type === 'task' && b.item.task ? b.item.task.id : b.item.type === 'event' && b.item.event ? b.item.event.id : '';
      return keyA.localeCompare(keyB);
    });

    // Drop duplicate task/event blocks (stale calendar sync can emit the same event twice → stacked cards + double labels)
    const dedupedBlocks: typeof blocks = [];
    const seenBlockKeys = new Set<string>();
    for (const block of blocks) {
      const blockKey =
        block.item.type === 'task' && block.item.task
          ? `task:${block.item.task.id}`
          : block.item.type === 'event' && block.item.event
            ? `event:${block.item.event.id}`
            : `block:${block.actualStartMins}:${dedupedBlocks.length}`;
      if (seenBlockKeys.has(blockKey)) continue;
      seenBlockKeys.add(blockKey);
      dedupedBlocks.push(block);
    }

    const resolvedLayoutMode: TodayAgendaLayoutMode = hideHeader
      ? 'compactList'
      : resolveTodayAgendaLayoutMode(dedupedBlocks);

    if (resolvedLayoutMode === 'compactList') {
      const listGapPx = TODAY_AGENDA_TIMELINE.compactListItemGapPx;
      let y = 0;
      for (const block of dedupedBlocks) {
        block.heightPx = getTodayAgendaCompactRowHeightPx(block.actualDurationMins);
        block.topPx = y;
        y += block.heightPx + listGapPx;
      }
      const layoutHeightPx = dedupedBlocks.length > 0 ? y - listGapPx : 0;
      return { timelineBlocks: dedupedBlocks, unscheduledItems: unscheduled, timelineLayoutHeightPx: layoutHeightPx, layoutMode: resolvedLayoutMode };
    }

    // Duration blocks: stack same-time or overlapping items vertically
    const placed: Block[] = [];
    for (const block of dedupedBlocks) {
      let topPx = block.naturalTopPx;
      for (const prev of placed) {
        const sameStart = block.actualStartMins === prev.actualStartMins;
        const timeOverlap =
          block.actualStartMins < prev.actualEndMins && block.actualEndMins > prev.actualStartMins;
        if (!sameStart && !timeOverlap) continue;
        const prevBottom = prev.topPx + prev.heightPx + blockGapPx;
        if (topPx < prevBottom) topPx = prevBottom;
      }
      block.topPx = topPx;
      placed.push(block);
    }
    const baseTimelineHeightPx = totalMinutes * pxPerMinute;
    const maxBlockBottomPx = dedupedBlocks.length > 0 ? Math.max(...dedupedBlocks.map((b) => b.topPx + b.heightPx)) : 0;
    const layoutHeightPx = Math.max(baseTimelineHeightPx, maxBlockBottomPx + blockGapPx);
    return { timelineBlocks: dedupedBlocks, unscheduledItems: unscheduled, timelineLayoutHeightPx: layoutHeightPx, layoutMode: resolvedLayoutMode };
  }, [combinedItems, getTaskMinutes, hideHeader]);

  /** Base timeline height (px) for 7 AM–12 AM scale. */
  const timelineHeightPx = TODAY_AGENDA_TIMELINE.totalMinutes * TODAY_AGENDA_TIMELINE.pxPerMinute;

  /** Current time position (px from top) for the "now" line. Display-only; does not move or change any task times. */
  const currentTimeTopPx = useMemo(() => {
    const now = new Date();
    const mins = now.getHours() * MINUTES_PER_HOUR + now.getMinutes() - TODAY_AGENDA_TIMELINE.startHour * MINUTES_PER_HOUR;
    if (mins < 0 || mins >= TODAY_AGENDA_TIMELINE.totalMinutes) return null;
    return Math.round(mins * TODAY_AGENDA_TIMELINE.pxPerMinute);
  }, [currentTime]);

  // Scroll to current time once when the timeline is shown so the "now" line is in view; user can still scroll freely afterward (must run after currentTimeTopPx and combinedItems are defined)
  useEffect(() => {
    if (currentTimeTopPx == null || hasScrolledToCurrentTimeRef.current) return;
    const run = () => {
      if (!currentTimeIndicatorRef.current) return;
      hasScrolledToCurrentTimeRef.current = true;
      currentTimeIndicatorRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
    };
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => cancelAnimationFrame(id);
  }, [currentTimeTopPx, combinedItems.length]);

  // Single column; timeline extends vertically to fit stacked blocks. When scheduling a task, use findNextAvailableSlot (e.g. in DragDropContext or TaskDialog) so the assigned time does not overlap.

  // Find the next uncompleted scheduled task on the timeline (next up)
  const nextUpTaskId = useMemo(() => {
    const nowOnToday = new Date(today);
    nowOnToday.setHours(
      currentTime.getHours(),
      currentTime.getMinutes(),
      currentTime.getSeconds(),
      currentTime.getMilliseconds(),
    );
    const nowMs = nowOnToday.getTime();

    const timelineTasks = timelineBlocks
      .filter((block) => block.item.type === 'task' && block.item.task && block.item.task.status !== 'done')
      .map((block) => ({
        task: block.item.task!,
        sortTime: getTaskSortTimeOnDay(today, block.item.task!),
      }))
      .filter((entry) => entry.sortTime !== Number.MAX_SAFE_INTEGER)
      .sort((a, b) => a.sortTime - b.sortTime);

    if (timelineTasks.length === 0) return null;

    const upcoming = timelineTasks.find((entry) => entry.sortTime >= nowMs);
    return upcoming?.task.id ?? timelineTasks[0]?.task.id ?? null;
  }, [timelineBlocks, today, currentTime]);

  const timelineTaskMatchesNextUp = useCallback(
    (task: Task | undefined, targetId: string | null): boolean => {
      if (!task?.id || !targetId) return false;
      if (task.id === targetId) return true;
      const baseTarget = targetId.split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR)[0];
      const baseTask = task.id.split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR)[0];
      return baseTask === baseTarget;
    },
    [],
  );

  /** Timeline blocks with Next Up inset applied for layout/render (avoids overlap in compact list). */
  const displayTimelineBlocks = useMemo(() => {
    const nextUpInsetPx = getTodayAgendaNextUpInsetPx();
    const isNextUpBlock = (item: CombinedItem) =>
      item.type === 'task' && item.task && timelineTaskMatchesNextUp(item.task, nextUpTaskId);

    if (layoutMode === 'compactList') {
      const listGapPx = TODAY_AGENDA_TIMELINE.compactListItemGapPx;
      let y = 0;
      return timelineBlocks.map((block) => {
        const cardTopInsetPx = isNextUpBlock(block.item) ? nextUpInsetPx : 0;
        const displayTopPx = y;
        const displayHeightPx = block.heightPx;
        y += block.heightPx + listGapPx;
        return { ...block, displayTopPx, displayHeightPx, cardTopInsetPx };
      });
    }

    return timelineBlocks.map((block) => {
      const cardTopInsetPx = isNextUpBlock(block.item) ? nextUpInsetPx : 0;
      return {
        ...block,
        displayTopPx: block.topPx,
        displayHeightPx: block.heightPx,
        cardTopInsetPx,
      };
    });
  }, [timelineBlocks, layoutMode, nextUpTaskId, timelineTaskMatchesNextUp]);

  const displayTimelineLayoutHeightPx = useMemo(() => {
    if (displayTimelineBlocks.length === 0) return timelineLayoutHeightPx;
    const maxBottom = Math.max(
      ...displayTimelineBlocks.map((block) => block.displayTopPx + block.displayHeightPx),
    );
    return Math.max(timelineLayoutHeightPx, maxBottom + TODAY_AGENDA_TIMELINE.blockGapPx);
  }, [displayTimelineBlocks, timelineLayoutHeightPx]);

  // Gaps between blocks; connector line from timeline to block when stacked so time stays aligned. Task times are never changed by this view or by drop-for-overlap.

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

  // Handle task completion - play sound and trigger confetti at card position (or center if no element)
  const handleTaskComplete = useCallback((originElement?: HTMLElement | null) => {
    playTaskCompleteSound();
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
      const date = parseChronologicalTimeSource(task.scheduledDate);
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
      const date = parseCalendarEventTime(isoStart);
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
    const key = priority && priority in TODAY_AGENDA_PRIORITY_INDICATOR_BG ? priority : 'default';
    return TODAY_AGENDA_PRIORITY_INDICATOR_BG[key as keyof typeof TODAY_AGENDA_PRIORITY_INDICATOR_BG];
  };

  const getTimelineBlockAccentColor = useCallback((item: CombinedItem): string => {
    if (item.type === 'task' && item.task) {
      return TASK_CARD_PRIORITY_COLORS[item.task.priority]?.line ?? TASK_CARD_PRIORITY_COLORS.default.line;
    }
    if (item.type === 'event' && item.event?.calendarColor) {
      return item.event.calendarColor;
    }
    return TODAY_AGENDA_EVENT_ACCENT_HEX;
  }, []);

  /** Hybrid timeline: compact list (sparse) or duration blocks (dense) with spine, dots, and hour grid. */
  const agendaListRows = useMemo(
    () => {
      const {
        startHour,
        endHour,
        columnWidth,
        pxPerMinute,
        totalMinutes,
        columnGapPx,
        cardPaddingRightPx,
        blocksColumnPaddingLeftPx,
        currentTimeLineHeightPx,
        labelIntervalMinutes,
        spineWidthPx,
        spineDotSizePx,
        hourGridLineOpacity,
        timeLabelLineHeightPx,
        timeLabelMinSeparationPx,
      } = TODAY_AGENDA_TIMELINE;

      const isCompactList = layoutMode === 'compactList';
      const spineColor = isDark ? 'rgba(148,163,184,0.45)' : 'rgba(148,163,184,0.35)';

      const getBlockCardTopPx = (block: (typeof displayTimelineBlocks)[number]) =>
        block.displayTopPx;

      /** Dot center sits on the card top edge (not centered in the time-label row). */
      const getBlockDotTopPx = (block: (typeof displayTimelineBlocks)[number]) =>
        getBlockCardTopPx(block) - spineDotSizePx / 2;

      const hourlyLabels: { minutesFromStart: number; label: string }[] = [];
      if (!isCompactList) {
        for (let m = 0; m <= totalMinutes; m += labelIntervalMinutes) {
          const h = startHour + Math.floor(m / MINUTES_PER_HOUR);
          const min = m % MINUTES_PER_HOUR;
          const isMidnight = h === endHour && min === 0;
          hourlyLabels.push({
            minutesFromStart: m,
            label: isMidnight
              ? TODAY_AGENDA_TEXT.timelineMidnightLabel
              : formatTodayAgendaMinutesLabel(m),
          });
        }
      }

      const renderTimelineBlock = (
        block: (typeof displayTimelineBlocks)[number],
      ) => {
        const { item, displayTopPx, displayHeightPx, cardTopInsetPx, heightPx, actualDurationMins } = block;
        const key =
          item.type === 'task' && item.task
            ? `t-${item.task.id}`
            : item.type === 'event' && item.event
              ? `e-${item.event.id}`
              : `b-${displayTopPx}`;
        const compactTimeline = actualDurationMins < TODAY_AGENDA_TIMELINE.shortItemThresholdMinutes;
        const isNextUpTask =
          item.type === 'task' && item.task && timelineTaskMatchesNextUp(item.task, nextUpTaskId);
        const cardAreaHeightPx = Math.max(1, heightPx);

        return (
          <div
            key={key}
            className="absolute left-0 right-0 flex flex-col"
            style={{
              top: displayTopPx,
              height: displayHeightPx,
              minHeight: isCompactList ? undefined : TODAY_AGENDA_TIMELINE.minTimelineBlockHeightPx,
              zIndex: isNextUpTask ? Z_INDEX.TIMELINE_BLOCK + 1 : Z_INDEX.TIMELINE_BLOCK,
              overflow: 'visible',
            }}
          >
            {isNextUpTask && (
              <div
                className="absolute left-0 right-0 flex items-end pointer-events-none"
                style={{
                  top: -cardTopInsetPx,
                  height: cardTopInsetPx,
                  paddingLeft: TODAY_AGENDA_TIMELINE.blocksColumnPaddingLeftPx,
                }}
                data-next-up-badge="true"
              >
                <span className="text-xs font-bold tracking-wide px-1.5 py-0.5 rounded bg-primary text-primary-foreground inline-block pointer-events-auto">
                  {TODAY_AGENDA_TEXT.nextUp.toUpperCase()}
                </span>
              </div>
            )}
            {item.type === 'task' && item.task ? (
              <div data-task-id={item.task.id} className="relative w-full flex-1 min-h-0" style={{ height: cardAreaHeightPx }}>
                <DraggableTaskCard
                  task={getTaskWithOccurrenceSubtasks(item.task, todayString, tasks)}
                  onClick={() => item.task && handleTaskClick(item.task)}
                  droppableId="today-agenda"
                  occurrenceDate={todayString}
                  isNextUp={false}
                  onComplete={handleTaskComplete}
                  timelineBlockHeightPx={cardAreaHeightPx}
                  compactTimeline={compactTimeline}
                  hideTimelineTime
                  hideTimelineAccent
                  durationMinutes={actualDurationMins}
                />
              </div>
            ) : item.type === 'event' && item.event ? (
              <div data-event-id={item.event.id} className="relative w-full flex-1 min-h-0" style={{ height: cardAreaHeightPx }}>
                <CalendarEventCard
                  title={item.event.title}
                  start={item.event.start}
                  end={item.event.end}
                  location={item.event.location}
                  provider={item.event.provider}
                  calendarColor={item.event.calendarColor}
                  isRecurring={item.event.isRecurring}
                  variant="timeline"
                  compactTimeline={compactTimeline}
                />
              </div>
            ) : null}
          </div>
        );
      };

      const nextUpHeadroomPx =
        displayTimelineBlocks.length > 0 && displayTimelineBlocks[0].cardTopInsetPx > 0
          ? displayTimelineBlocks[0].cardTopInsetPx
          : 0;
      const timelineContentHeightPx = displayTimelineLayoutHeightPx + nextUpHeadroomPx;

      return (
        <div
          className="flex flex-col w-full relative"
          style={{ zIndex: Z_INDEX.TIMELINE_CONTAINER }}
          data-agenda-timeline="v6"
        >
          <div
            className="flex w-full items-stretch"
            style={{
              minHeight: timelineContentHeightPx,
              height: timelineContentHeightPx,
              paddingTop: nextUpHeadroomPx,
            }}
          >
            {/* Left rail: spine, per-item or hourly labels, start dots */}
            <div
              className="flex-shrink-0 relative"
              style={{
                width: columnWidth,
                height: timelineContentHeightPx - nextUpHeadroomPx,
                zIndex: Z_INDEX.TIMELINE_LABELS_AND_NEXT_UP,
              }}
            >
              {/* Vertical spine */}
              <div
                className="absolute top-0 bottom-0"
                style={{
                  right: 0,
                  width: spineWidthPx,
                  backgroundColor: spineColor,
                  borderRadius: spineWidthPx,
                }}
                aria-hidden
              />

              {(() => {
                let prevLabelBottom = -Infinity;
                let prevLabelStartMins: number | null = null;
                return displayTimelineBlocks.map((block) => {
                  const blockKey =
                    block.item.type === 'task' && block.item.task
                      ? block.item.task.id
                      : block.item.type === 'event' && block.item.event
                        ? block.item.event.id
                        : String(block.displayTopPx);
                  const cardTopPx = getBlockCardTopPx(block);
                  const showTimeLabel =
                    prevLabelStartMins == null || block.actualStartMins !== prevLabelStartMins;
                  let labelTop = cardTopPx;
                  if (
                    showTimeLabel &&
                    !isCompactList &&
                    labelTop < prevLabelBottom + timeLabelMinSeparationPx - timeLabelLineHeightPx
                  ) {
                    labelTop = prevLabelBottom + timeLabelMinSeparationPx;
                  }
                  if (showTimeLabel) {
                    prevLabelBottom = labelTop + timeLabelLineHeightPx;
                    prevLabelStartMins = block.actualStartMins;
                  }
                  if (!showTimeLabel) {
                    return null;
                  }
                  return (
                    <div
                      key={`time-${blockKey}`}
                      className="absolute left-0 pr-2 text-right flex items-start"
                      style={{
                        top: labelTop,
                        width: `calc(100% - ${spineWidthPx + 4}px)`,
                        height: timeLabelLineHeightPx,
                      }}
                    >
                      <span
                        className="text-xs text-muted-foreground whitespace-nowrap tabular-nums block w-full"
                        style={{ lineHeight: `${timeLabelLineHeightPx}px` }}
                      >
                        {formatTodayAgendaMinutesLabel(block.actualStartMins)}
                      </span>
                    </div>
                  );
                });
              })()}

              {/* Start dots on spine — aligned with card top edge */}
              {displayTimelineBlocks.map((block) => {
                const dotColor = getTimelineBlockAccentColor(block.item);
                const dotKey =
                  block.item.type === 'task' && block.item.task
                    ? `dot-t-${block.item.task.id}`
                    : block.item.type === 'event' && block.item.event
                      ? `dot-e-${block.item.event.id}`
                      : `dot-${block.displayTopPx}`;
                const dotTop = getBlockDotTopPx(block);
                return (
                  <div
                    key={dotKey}
                    className="absolute rounded-full z-[2]"
                    style={{
                      top: dotTop,
                      right: -(spineDotSizePx / 2) + spineWidthPx / 2,
                      width: spineDotSizePx,
                      height: spineDotSizePx,
                      backgroundColor: dotColor,
                      boxShadow: isDark ? '0 0 0 2px rgba(30,30,40,0.9)' : '0 0 0 2px rgba(255,255,255,0.95)',
                    }}
                    aria-hidden
                  />
                );
              })}

              {/* Current time dot on spine (duration mode) */}
              {!isCompactList && currentTimeTopPx != null && (
                <div
                  className="absolute rounded-full z-[3] bg-primary"
                  style={{
                    top: currentTimeTopPx - spineDotSizePx / 2,
                    right: -(spineDotSizePx / 2) + spineWidthPx / 2,
                    width: spineDotSizePx,
                    height: spineDotSizePx,
                    boxShadow: '0 0 0 2px hsl(var(--primary) / 0.25)',
                  }}
                  aria-hidden
                />
              )}
            </div>

            {/* Blocks column */}
            <div
              className="flex-1 min-w-0 relative"
              style={{
                marginLeft: columnGapPx,
                paddingLeft: blocksColumnPaddingLeftPx,
                paddingRight: cardPaddingRightPx,
                height: timelineContentHeightPx - nextUpHeadroomPx,
                overflow: 'visible',
              }}
            >
              {/* Hour grid (duration mode only) */}
              {!isCompactList &&
                hourlyLabels.map(({ minutesFromStart }) => {
                  const topPx = Math.round(minutesFromStart * pxPerMinute);
                  return (
                    <div
                      key={`grid-${minutesFromStart}`}
                      className="absolute left-0 right-0 border-t border-border pointer-events-none"
                      style={{
                        top: topPx,
                        opacity: hourGridLineOpacity,
                        zIndex: Z_INDEX.TIMELINE_LINE,
                      }}
                      aria-hidden
                    />
                  );
                })}

              {!isCompactList && currentTimeTopPx != null && (
                <div
                  ref={currentTimeIndicatorRef}
                  className="absolute left-0 right-0 rounded-full bg-primary/80"
                  style={{
                    top: currentTimeTopPx,
                    height: currentTimeLineHeightPx,
                    zIndex: Z_INDEX.TIME_INDICATOR,
                  }}
                  aria-hidden
                />
              )}

              {displayTimelineBlocks.map(renderTimelineBlock)}
            </div>
          </div>

          {/* Unscheduled: no time or outside 7AM–12AM */}
          {unscheduledItems.length > 0 && (
            <div
              className="flex flex-col w-full mt-4 pt-4 border-t border-border"
              style={{ gap: TODAY_AGENDA_TIMELINE.itemGapPx }}
            >
              <span className="text-xs font-medium text-muted-foreground mb-1">No time slot</span>
              {unscheduledItems.map((item, index) => {
                const timeLabel =
                  item.type === 'task' && item.task
                    ? getTaskTime(item.task)
                    : item.type === 'event' && item.event
                      ? getEventTime(item.event.start)
                      : '';
                const isNextUp =
                  item.type === 'task' &&
                  item.task &&
                  timelineTaskMatchesNextUp(item.task, nextUpTaskId);
                const key =
                  item.type === 'task' && item.task
                    ? `u-t-${item.task.id}`
                    : item.type === 'event' && item.event
                      ? `u-e-${item.event.id}`
                      : `u-${index}`;
                const timelinePaddingTop =
                  TODAY_AGENDA_TIMELINE.rowPaddingTopPx +
                  (isNextUp ? TODAY_AGENDA_TIMELINE.nextUpBadgeOffsetPx : 0);
                return (
                  <div key={key} className="flex w-full items-start" style={{ gap: TODAY_AGENDA_TIMELINE.columnGapPx }}>
                    <div
                      className="flex-shrink-0"
                      style={{ width: TODAY_AGENDA_TIMELINE.columnWidth, paddingTop: timelinePaddingTop }}
                    >
                      <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        {timeLabel || '—'}
                      </span>
                    </div>
                    <div
                      className="flex-1 min-w-0 w-full"
                      style={{
                        paddingTop: TODAY_AGENDA_TIMELINE.rowPaddingTopPx,
                        paddingRight: TODAY_AGENDA_TIMELINE.cardPaddingRightPx,
                      }}
                    >
                      {item.type === 'task' && item.task ? (
                        <div data-task-id={item.task.id} className="w-full">
                          <DraggableTaskCard
                            task={getTaskWithOccurrenceSubtasks(item.task, todayString, tasks)}
                            onClick={() => item.task && handleTaskClick(item.task)}
                            droppableId="today-agenda"
                            occurrenceDate={todayString}
                            isNextUp={item.task.id === nextUpTaskId}
                            onComplete={handleTaskComplete}
                          />
                        </div>
                      ) : item.type === 'event' && item.event ? (
                        <div data-event-id={item.event.id} className="w-full">
                          <CalendarEventCard
                            title={item.event.title}
                            start={item.event.start}
                            end={item.event.end}
                            location={item.event.location}
                            provider={item.event.provider}
                            calendarColor={item.event.calendarColor}
                            isRecurring={item.event.isRecurring}
                            variant="timeline"
                          />
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
    [
      displayTimelineBlocks,
      displayTimelineLayoutHeightPx,
      unscheduledItems,
      timelineLayoutHeightPx,
      layoutMode,
      currentTimeTopPx,
      nextUpTaskId,
      todayString,
      tasks,
      isDark,
      getTimelineBlockAccentColor,
      timelineTaskMatchesNextUp,
    ],
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
          shouldUseMobileLayout ? "w-full" : "h-full min-h-0 min-h-full", // min-h-full so background fills panel in Edge/others when content is short
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
                ? TODAY_AGENDA_TEXT.dropPlaceholderWithEmoji
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
          <div className="w-full max-w-full min-w-0 overflow-x-hidden relative flex-1 min-h-0">
            <div 
              ref={timelineContainerRef}
              className="px-5 w-full max-w-full min-w-0 relative box-border"
              style={{
                paddingTop: shouldUseMobileLayout
                  ? 0 // No top padding on mobile - header spacer in App.tsx handles spacing
                  : DESKTOP_PADDING_TOP,
                paddingBottom: shouldUseMobileLayout
                  ? `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})` // Full nav bar height + safe area + extra buffer
                  : undefined,
                // Ensure transparent background to show parent gradient
                backgroundColor: 'transparent',
                background: 'transparent',
              } as React.CSSProperties}
            >
            {isLoading && combinedItems.length === 0 ? (
              <div
                className={cn(
                  `flex flex-col items-center justify-center text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none`,
                )}
                style={{
                  paddingTop: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingBottom: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingLeft: EMPTY_STATE_PADDING_X,
                  paddingRight: EMPTY_STATE_PADDING_X,
                }}
              >
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground mt-3">Loading tasks…</p>
              </div>
            ) : combinedItems.length === 0 ? (
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
                  {isOver ? TODAY_AGENDA_TEXT.dropPlaceholder : TODAY_AGENDA_TEXT.emptyState.noTasks}
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
                  paddingTop: shouldUseMobileLayout
                    ? `${Math.max(TIMELINE_PADDING.mobile, TIMELINE_PADDING.minMobilePadding)}px` 
                    : DESKTOP_PADDING_TOP,
                  paddingBottom: shouldUseMobileLayout
                    ? KANBAN_MOBILE.bottomPaddingCalc
                    : `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`,
                }}
              >
              {isLoading && combinedItems.length === 0 ? (
                <div
                  className={cn(
                    `flex flex-col items-center justify-center text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none`,
                  )}
                  style={{
                    paddingTop: PANEL_EMPTY_STATE_PADDING_Y,
                    paddingBottom: PANEL_EMPTY_STATE_PADDING_Y,
                    paddingLeft: EMPTY_STATE_PADDING_X,
                    paddingRight: EMPTY_STATE_PADDING_X,
                  }}
                >
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground mt-3">Loading tasks…</p>
                </div>
              ) : combinedItems.length === 0 ? (
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
                  {isOver ? TODAY_AGENDA_TEXT.dropPlaceholder : TODAY_AGENDA_TEXT.emptyState.noTasks}
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
        // Use shouldUseMobileLayout so mobile always gets the scrollable task list (not a stale window check)
        !shouldUseMobileLayout ? (
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
          {isLoading && combinedItems.length === 0 ? (
            <div className={cn(
              `flex flex-col items-center justify-center py-12 text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none`,
            )}>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Loading tasks…</p>
            </div>
          ) : combinedItems.length === 0 ? (
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
                {isOver ? TODAY_AGENDA_TEXT.dropPlaceholder : TODAY_AGENDA_TEXT.emptyState.noTasks}
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
            {isLoading && combinedItems.length === 0 ? (
              <div
                className={cn(
                  `flex flex-col items-center justify-center text-center ${COMPONENT_DIMENSIONS.todayAgenda.emptyStateMinHeight} pointer-events-none`,
                )}
                style={{
                  paddingTop: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingBottom: PANEL_EMPTY_STATE_PADDING_Y,
                  paddingLeft: EMPTY_STATE_PADDING_X,
                  paddingRight: EMPTY_STATE_PADDING_X,
                }}
              >
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground mt-3">Loading tasks…</p>
              </div>
            ) : combinedItems.length === 0 ? (
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
                  {isOver ? TODAY_AGENDA_TEXT.dropPlaceholder : TODAY_AGENDA_TEXT.emptyState.noTasks}
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
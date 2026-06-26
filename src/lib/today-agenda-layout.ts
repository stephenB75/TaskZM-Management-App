/**
 * Today Agenda hybrid timeline layout — compact list vs duration-proportional blocks.
 */

import { MINUTES_PER_HOUR } from './business-constants';
import { TODAY_AGENDA_TIMELINE, getTodayAgendaTimelineBlockHeightPx } from './layout-constants';

export type TodayAgendaLayoutMode = 'compactList' | 'durationBlocks';

export interface TodayAgendaTimelineBlockInput {
  actualStartMins: number;
  actualEndMins: number;
}

export function blocksHaveTimeOverlap(blocks: TodayAgendaTimelineBlockInput[]): boolean {
  if (blocks.length < 2) return false;
  const sorted = [...blocks].sort((a, b) => a.actualStartMins - b.actualStartMins);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (a.actualStartMins < b.actualEndMins && a.actualEndMins > b.actualStartMins) {
        return true;
      }
      if (b.actualStartMins >= a.actualEndMins) break;
    }
  }
  return false;
}

export function minGapBetweenConsecutiveBlocks(blocks: TodayAgendaTimelineBlockInput[]): number {
  if (blocks.length < 2) return Number.MAX_SAFE_INTEGER;
  const sorted = [...blocks].sort((a, b) => a.actualStartMins - b.actualStartMins);
  let minGap = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].actualStartMins - sorted[i].actualEndMins;
    minGap = Math.min(minGap, gap);
  }
  return minGap;
}

/** Sparse days → compact list; overlaps or clustered items → duration blocks. */
export function resolveTodayAgendaLayoutMode(blocks: TodayAgendaTimelineBlockInput[]): TodayAgendaLayoutMode {
  if (blocks.length === 0) return 'compactList';
  if (blocksHaveTimeOverlap(blocks)) return 'durationBlocks';
  const minGap = minGapBetweenConsecutiveBlocks(blocks);
  if (minGap >= TODAY_AGENDA_TIMELINE.layoutProximityThresholdMinutes) {
    return 'compactList';
  }
  return 'durationBlocks';
}

/** Row height when stacking items in compact list mode (content-sized, not time-scale gaps). */
export function getTodayAgendaCompactRowHeightPx(durationMinutes: number, _isEvent = false): number {
  const {
    shortItemThresholdMinutes,
    shortTaskComfortableBlockHeightPx,
    taskRowHeightPx,
  } = TODAY_AGENDA_TIMELINE;

  if (durationMinutes < shortItemThresholdMinutes) {
    return shortTaskComfortableBlockHeightPx;
  }
  if (durationMinutes >= MINUTES_PER_HOUR) {
    return Math.max(taskRowHeightPx, getTodayAgendaTimelineBlockHeightPx(durationMinutes));
  }
  return getTodayAgendaTimelineBlockHeightPx(durationMinutes);
}

/** Unique key for a timeline row — includes start so recurring events with the same id still render. */
export function getTodayAgendaTimelineBlockKey(
  item: {
    type: 'task' | 'event';
    task?: { id: string };
    event?: { id: string; start: string };
  },
  actualStartMins: number,
): string {
  if (item.type === 'task' && item.task) {
    return `task:${item.task.id}:${actualStartMins}`;
  }
  if (item.type === 'event' && item.event) {
    return `event:${item.event.id}:${item.event.start}`;
  }
  return `block:${actualStartMins}`;
}

/** Unique key for deduping calendar events in the combined list (same id, different occurrence). */
export function getTodayAgendaCalendarEventOccurrenceKey(event: { id: string; start: string }): string {
  return `${event.id}:${event.start}`;
}

/** Minutes from timeline start (7 AM) for a local datetime; null if invalid. */
export function getTodayAgendaMinutesFromTimelineStart(
  date: Date,
  startHour: number = TODAY_AGENDA_TIMELINE.startHour,
): number | null {
  if (isNaN(date.getTime())) return null;
  return date.getHours() * MINUTES_PER_HOUR + date.getMinutes() - startHour * MINUTES_PER_HOUR;
}

export function isTodayAgendaMinutesInTimelineRange(
  minutesFromStart: number,
  totalMinutes: number = TODAY_AGENDA_TIMELINE.totalMinutes,
): boolean {
  return minutesFromStart >= 0 && minutesFromStart < totalMinutes;
}

/** Total vertical space (px) reserved above a Next Up card (badge sits in the inter-card gap). */
export function getTodayAgendaNextUpInsetPx(): number {
  const { nextUpBadgeHeightPx, nextUpBadgeGapAboveBlockPx } = TODAY_AGENDA_TIMELINE;
  return nextUpBadgeHeightPx + nextUpBadgeGapAboveBlockPx;
}

/** Visible minute range for duration-block mode (avoids full 7 AM–midnight scroll when items cluster). */
export function getTodayAgendaDurationViewportMins(
  blocks: TodayAgendaTimelineBlockInput[],
  totalMinutes: number = TODAY_AGENDA_TIMELINE.totalMinutes,
): { viewStartMins: number; viewEndMins: number } {
  const { labelIntervalMinutes, timelineContentPaddingMinutes } = TODAY_AGENDA_TIMELINE;
  if (blocks.length === 0) {
    return { viewStartMins: 0, viewEndMins: totalMinutes };
  }
  const minStart = Math.min(...blocks.map((b) => b.actualStartMins));
  const maxEnd = Math.max(...blocks.map((b) => b.actualEndMins));
  const paddedStart = Math.max(0, minStart - timelineContentPaddingMinutes);
  const paddedEnd = Math.min(totalMinutes, maxEnd + timelineContentPaddingMinutes);
  const viewStartMins = Math.floor(paddedStart / labelIntervalMinutes) * labelIntervalMinutes;
  let viewEndMins = Math.ceil(paddedEnd / labelIntervalMinutes) * labelIntervalMinutes;
  viewEndMins = Math.max(viewEndMins, viewStartMins + labelIntervalMinutes);
  return { viewStartMins, viewEndMins: Math.min(viewEndMins, totalMinutes) };
}

/** Format minutes-from-range-start as "7:00 AM" label. */
export function formatTodayAgendaMinutesLabel(minutesFromStart: number): string {
  const { startHour, endHour } = TODAY_AGENDA_TIMELINE;
  const totalMins = startHour * MINUTES_PER_HOUR + minutesFromStart;
  const h = Math.floor(totalMins / MINUTES_PER_HOUR);
  const min = totalMins % MINUTES_PER_HOUR;
  if (h === endHour && min === 0) return '12:00 AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${min.toString().padStart(2, '0')} ${ampm}`;
}

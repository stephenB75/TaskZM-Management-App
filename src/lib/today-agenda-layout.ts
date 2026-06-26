/**
 * Today Agenda hybrid timeline layout — compact list vs duration-proportional blocks.
 */

import { MINUTES_PER_HOUR } from './business-constants';
import {
  TODAY_AGENDA_TIMELINE,
  getTodayAgendaTimelineBlockHeightPx,
} from './layout-constants';

/** Timeline slot height (px) — exact duration on the time scale. */
export function getTodayAgendaTimelineSlotHeightPx(durationMinutes: number): number {
  return getTodayAgendaTimelineBlockHeightPx(durationMinutes);
}

/** Estimated card height (px) — at least the time slot; grows to fit full agenda card content. */
export function getTodayAgendaTimelineCardHeightPx(
  durationMinutes: number,
  options?: { isEvent?: boolean },
): number {
  const slotHeightPx = getTodayAgendaTimelineSlotHeightPx(durationMinutes);
  const { timelineTaskCardMinHeightPx, timelineEventCardMinHeightPx } = TODAY_AGENDA_TIMELINE;
  const comfortableMinPx = options?.isEvent
    ? timelineEventCardMinHeightPx
    : timelineTaskCardMinHeightPx;
  return Math.max(slotHeightPx, comfortableMinPx);
}

/** Visual height of a block row (card may extend below its time slot for short items). */
export function getTodayAgendaBlockVisualExtentPx(block: {
  slotHeightPx: number;
  cardHeightPx: number;
}): number {
  return Math.max(block.slotHeightPx, block.cardHeightPx);
}

/** True when two blocks' scheduled times overlap. */
export function todayAgendaBlocksTimeOverlap(
  a: { actualStartMins: number; actualEndMins: number },
  b: { actualStartMins: number; actualEndMins: number },
): boolean {
  return a.actualStartMins < b.actualEndMins && a.actualEndMins > b.actualStartMins;
}

/**
 * Stack overlapping blocks vertically (full width). Timestamps/dots stay at scheduled time on the rail.
 */
export function resolveTodayAgendaDurationBlockTops<
  T extends {
    naturalTopPx: number;
    topPx: number;
    slotHeightPx: number;
    cardHeightPx: number;
    actualStartMins: number;
    actualEndMins: number;
  },
>(blocks: T[], blockGapPx: number): void {
  const placed: T[] = [];
  for (const block of blocks) {
    let topPx = block.naturalTopPx;
    for (const prev of placed) {
      const prevExtentPx = getTodayAgendaBlockVisualExtentPx(prev);
      const prevVisualBottomPx = prev.topPx + prevExtentPx + blockGapPx;
      const timeOverlap = todayAgendaBlocksTimeOverlap(block, prev);
      const wouldVisualOverlap = topPx < prev.topPx + prevExtentPx;
      if ((timeOverlap || wouldVisualOverlap) && topPx < prevVisualBottomPx) {
        topPx = prevVisualBottomPx;
      }
    }
    block.topPx = topPx;
    placed.push(block);
  }
}

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
export function getTodayAgendaCompactRowHeightPx(durationMinutes: number, isEvent = false): number {
  const {
    timelineTaskCardMinHeightPx,
    timelineEventCardMinHeightPx,
    taskRowHeightPx,
  } = TODAY_AGENDA_TIMELINE;
  const comfortableMinPx = isEvent ? timelineEventCardMinHeightPx : timelineTaskCardMinHeightPx;
  const slotHeightPx = getTodayAgendaTimelineBlockHeightPx(durationMinutes);
  if (durationMinutes >= MINUTES_PER_HOUR) {
    return Math.max(comfortableMinPx, taskRowHeightPx, slotHeightPx);
  }
  return Math.max(comfortableMinPx, slotHeightPx);
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

/** True when a time falls on a fixed interval label tick (e.g. :00 or :30). */
export function isTodayAgendaOnLabelInterval(
  minutesFromStart: number,
  intervalMinutes: number = TODAY_AGENDA_TIMELINE.labelIntervalMinutes,
): boolean {
  return minutesFromStart % intervalMinutes === 0;
}

/** Build interval label ticks for the visible timeline viewport. */
export function getTodayAgendaIntervalLabels(
  viewStartMins: number,
  viewEndMins: number,
): { minutesFromStart: number; label: string; isHour: boolean }[] {
  const { labelIntervalMinutes } = TODAY_AGENDA_TIMELINE;
  const labels: { minutesFromStart: number; label: string; isHour: boolean }[] = [];
  for (let m = viewStartMins; m <= viewEndMins; m += labelIntervalMinutes) {
    labels.push({
      minutesFromStart: m,
      label: formatTodayAgendaMinutesLabel(m),
      isHour: m % MINUTES_PER_HOUR === 0,
    });
  }
  return labels;
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

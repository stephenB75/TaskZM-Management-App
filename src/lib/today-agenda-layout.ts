/**
 * Today Agenda hybrid timeline layout — compact list vs duration-proportional blocks.
 */

import { MINUTES_PER_HOUR } from './business-constants';
import {
  TODAY_AGENDA_TIMELINE,
  getTodayAgendaTimelineBlockHeightPx,
} from './layout-constants';

export type TodayAgendaLayoutMode = 'compactList' | 'durationBlocks';

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

/** Top (px) on the visible timeline for a minute value. */
export function getTodayAgendaScheduledTopPx(
  minutesFromRangeStart: number,
  viewStartMins: number,
  pxPerMinute: number = TODAY_AGENDA_TIMELINE.pxPerMinute,
): number {
  return Math.round((minutesFromRangeStart - viewStartMins) * pxPerMinute);
}

/** Duration slot height (px) from scheduled start/end — matches grid lines exactly. */
export function getTodayAgendaBlockScheduledSlotHeightPx(
  block: { actualStartMins: number; actualEndMins: number },
  viewStartMins: number,
  pxPerMinute: number = TODAY_AGENDA_TIMELINE.pxPerMinute,
): number {
  const startPx = getTodayAgendaScheduledTopPx(block.actualStartMins, viewStartMins, pxPerMinute);
  const endPx = getTodayAgendaScheduledTopPx(block.actualEndMins, viewStartMins, pxPerMinute);
  return Math.max(1, endPx - startPx);
}

/** True when a block was pushed below its natural grid start (overlapping schedule). */
export function isTodayAgendaBlockStacked(block: {
  displayTopPx: number;
  scheduledStartTopPx: number;
}): boolean {
  return block.displayTopPx > block.scheduledStartTopPx + 1;
}

export interface TodayAgendaBlockRailLabelPositions {
  startTopPx: number;
  endTopPx: number;
  slotHeightPx: number;
}

/** Rail label positions pinned to the duration slot (grid when unstacked, row when stacked). */
export function getTodayAgendaBlockRailLabelPositions(
  block: {
    displayTopPx: number;
    scheduledStartTopPx: number;
    scheduledEndTopPx: number;
    scheduledSlotHeightPx: number;
  },
  lineHeightPx: number = TODAY_AGENDA_TIMELINE.timeLabelLineHeightPx,
): TodayAgendaBlockRailLabelPositions {
  const stacked = isTodayAgendaBlockStacked(block);
  const slotHeightPx = block.scheduledSlotHeightPx;
  const startTopPx = stacked ? block.displayTopPx : block.scheduledStartTopPx;
  const slotEndTopPx = startTopPx + slotHeightPx;
  return {
    startTopPx,
    endTopPx: slotEndTopPx - lineHeightPx,
    slotHeightPx,
  };
}

/** Top (px) of a block's scheduled start on the card row (stacked position). */
export function getTodayAgendaBlockSlotStartTopPx(block: { displayTopPx: number }): number {
  return block.displayTopPx;
}

/** Top (px) of a block's scheduled end on the card row (start + duration slot height). */
export function getTodayAgendaBlockSlotEndTopPx(block: {
  displayTopPx: number;
  slotHeightPx: number;
}): number {
  return block.displayTopPx + block.slotHeightPx;
}

/** True when a grid minute is covered by a block's scheduled range (use per-item labels instead). */
export function isTodayAgendaMinuteOccupiedByScheduledBlock(
  minutesFromStart: number,
  blocks: { actualStartMins: number; actualEndMins: number }[],
): boolean {
  return blocks.some(
    (block) =>
      minutesFromStart === block.actualStartMins ||
      minutesFromStart === block.actualEndMins ||
      (minutesFromStart > block.actualStartMins && minutesFromStart < block.actualEndMins),
  );
}

/** Minimum slot height (px) before start and end labels are shown separately. */
export function getTodayAgendaCombinedSlotLabelMaxHeightPx(
  lineHeightPx: number = TODAY_AGENDA_TIMELINE.timeLabelLineHeightPx,
  minSeparationPx: number = TODAY_AGENDA_TIMELINE.timeLabelMinSeparationPx,
): number {
  return 2 * lineHeightPx + minSeparationPx;
}

export interface TodayAgendaRailLabelSpec {
  id: string;
  topPx: number;
  text: string;
  kind: 'start' | 'end';
}

/** Build start/end rail labels pinned to the duration slot (grid-accurate end position). */
export function buildTodayAgendaBlockRailLabels(
  block: {
    displayTopPx: number;
    scheduledStartTopPx: number;
    scheduledEndTopPx: number;
    scheduledSlotHeightPx: number;
    actualStartMins: number;
    actualEndMins: number;
  },
  blockKey: string,
  formatLabel: (minutesFromStart: number) => string,
  lineHeightPx: number,
): TodayAgendaRailLabelSpec[] {
  const { startTopPx, endTopPx } = getTodayAgendaBlockRailLabelPositions(block, lineHeightPx);
  const startLabel = formatLabel(block.actualStartMins);
  const endLabel = formatLabel(block.actualEndMins);

  const labels: TodayAgendaRailLabelSpec[] = [
    {
      id: `start-${blockKey}`,
      topPx: startTopPx,
      text: startLabel,
      kind: 'start',
    },
  ];

  if (endLabel !== startLabel && endTopPx >= startTopPx + lineHeightPx) {
    labels.push({
      id: `end-${blockKey}`,
      topPx: endTopPx,
      text: endLabel,
      kind: 'end',
    });
  }

  return labels;
}

/** Full timeline content height — blocks, overflow cards, rail labels, and viewport floor. */
export function getTodayAgendaDisplayLayoutHeightPx<
  T extends {
    displayTopPx: number;
    scheduledSlotHeightPx: number;
    cardHeightPx: number;
    scheduledStartTopPx: number;
    scheduledEndTopPx: number;
    actualStartMins: number;
    actualEndMins: number;
  },
>(
  blocks: T[],
  options: {
    timelineLayoutHeightPx: number;
    timelineViewStartMins: number;
    timelineViewEndMins: number;
    layoutMode: TodayAgendaLayoutMode;
    blockGapPx: number;
    lineHeightPx: number;
    formatLabel: (minutesFromStart: number) => string;
    getBlockKey: (block: T) => string;
  },
): number {
  const { pxPerMinute } = TODAY_AGENDA_TIMELINE;
  const viewportHeightPx = Math.round(
    (options.timelineViewEndMins - options.timelineViewStartMins) * pxPerMinute,
  );

  let maxBottomPx = 0;
  for (const block of blocks) {
    const blockExtentPx =
      options.layoutMode === 'compactList'
        ? block.cardHeightPx
        : Math.max(block.scheduledSlotHeightPx, block.cardHeightPx);
    maxBottomPx = Math.max(maxBottomPx, block.displayTopPx + blockExtentPx);

    if (options.layoutMode === 'durationBlocks') {
      const blockKey = options.getBlockKey(block);
      for (const label of buildTodayAgendaBlockRailLabels(
        block,
        blockKey,
        options.formatLabel,
        options.lineHeightPx,
      )) {
        maxBottomPx = Math.max(maxBottomPx, label.topPx + options.lineHeightPx);
      }
    }
  }

  return Math.max(
    options.timelineLayoutHeightPx,
    viewportHeightPx,
    maxBottomPx + options.blockGapPx,
  );
}

/**
 * Stack blocks only when scheduled times overlap; otherwise keep grid positions.
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
      if (!todayAgendaBlocksTimeOverlap(block, prev)) continue;
      const prevExtentPx = getTodayAgendaBlockVisualExtentPx(prev);
      const prevVisualBottomPx = prev.topPx + prevExtentPx + blockGapPx;
      if (topPx < prevVisualBottomPx) {
        topPx = prevVisualBottomPx;
      }
    }
    block.topPx = topPx;
    placed.push(block);
  }
}

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

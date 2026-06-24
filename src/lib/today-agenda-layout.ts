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
export function getTodayAgendaCompactRowHeightPx(durationMinutes: number, isEvent: boolean): number {
  const {
    microEventBlockHeightPx,
    shortItemThresholdMinutes,
    shortTaskComfortableBlockHeightPx,
    taskRowHeightPx,
  } = TODAY_AGENDA_TIMELINE;

  if (isEvent && durationMinutes < shortItemThresholdMinutes) {
    return microEventBlockHeightPx;
  }
  if (durationMinutes < shortItemThresholdMinutes) {
    return shortTaskComfortableBlockHeightPx;
  }
  if (!isEvent && durationMinutes >= MINUTES_PER_HOUR) {
    return Math.max(taskRowHeightPx, getTodayAgendaTimelineBlockHeightPx(durationMinutes, { isEvent: false }));
  }
  return getTodayAgendaTimelineBlockHeightPx(durationMinutes, { isEvent });
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

import { MOBILE_HOME_SECTION_GAP } from './layout-constants';
import { TIMING_CONSTANTS } from './timing-constants';

function editingScroller(taskId: string): HTMLElement | null {
  const card = document.getElementById(`home-task-${taskId}`);
  const scroller = card?.closest('.overflow-y-auto');
  return scroller instanceof HTMLElement ? scroller : null;
}

/** Keep the opened task in the band above the mobile sheet. */
export function revealTaskAboveDialog(taskId: string) {
  const started = performance.now();
  const limit = TIMING_CONSTANTS.tour.advanceExtra.dialogMs * TIMING_CONSTANTS.tour.targetWait.defaultMultiplier;

  const tick = () => {
    const card = document.getElementById(`home-task-${taskId}`);
    const sheet = document.querySelector('[data-slot="dialog-content"]');
    const scroller = editingScroller(taskId);
    const sheetReady = sheet instanceof HTMLElement && getComputedStyle(sheet).bottom !== 'auto' && sheet.getBoundingClientRect().height > 0;
    if (!card || !scroller || !sheetReady || !(sheet instanceof HTMLElement)) {
      if (performance.now() - started < limit) window.requestAnimationFrame(tick);
      return;
    }
    scroller.style.paddingBottom = `${sheet.getBoundingClientRect().height}px`;
    const gap = Number.parseFloat(MOBILE_HOME_SECTION_GAP) * 16;
    const place = () => {
      const overlap = card.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top + gap;
      if (overlap > 0) scroller.scrollTop += overlap;
    };
    place();
    window.setTimeout(place, TIMING_CONSTANTS.tour.advanceExtra.dialogMs);
  };

  window.requestAnimationFrame(tick);
}

export function clearEditingScrollPad(taskId: string) {
  const scroller = editingScroller(taskId);
  if (scroller) scroller.style.paddingBottom = '';
}

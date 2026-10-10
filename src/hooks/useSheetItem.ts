import { useCallback, useEffect, useRef, useState } from 'react';
import { DIALOG_MOBILE_SHEET_SLIDE_MS } from '../lib/layout-constants';

/**
 * Holds the item shown in a sheet and keeps it mounted until the slide-down
 * finishes, so closing animates instead of vanishing.
 */
export function useSheetItem<T>() {
  const [item, setItem] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: T) => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setItem(next);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setItem(null), DIALOG_MOBILE_SHEET_SLIDE_MS);
  }, []);

  useEffect(() => () => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
  }, []);

  return { item, open, show, close };
}

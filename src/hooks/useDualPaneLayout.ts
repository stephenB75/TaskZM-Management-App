import { useEffect, useState } from 'react';
import { FOLDABLE_LAYOUT } from '../lib/layout-constants';

function matches(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return (
    window.matchMedia(FOLDABLE_LAYOUT.dualPaneQuery).matches ||
    window.matchMedia(FOLDABLE_LAYOUT.twoSegmentQuery).matches
  );
}

/** True when the mobile layout has room for two panes (unfolded foldable, spanned dual-screen, tablet portrait). */
export function useDualPaneLayout(): boolean {
  const [dualPane, setDualPane] = useState(matches);

  useEffect(() => {
    if (!window.matchMedia) return;
    const queries = [FOLDABLE_LAYOUT.dualPaneQuery, FOLDABLE_LAYOUT.twoSegmentQuery].map((q) => window.matchMedia(q));
    const update = () => setDualPane(matches());
    queries.forEach((mq) => mq.addEventListener?.('change', update));
    update();
    return () => queries.forEach((mq) => mq.removeEventListener?.('change', update));
  }, []);

  return dualPane;
}

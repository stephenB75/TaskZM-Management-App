import { useState, useEffect } from 'react';
import { useOrientation } from './useOrientation';
import { VIEWPORT_BREAKPOINTS } from '../lib/layout-constants';

/**
 * Hook to determine if the device should use mobile layout
 * 
 * Rules:
 * - Mobile devices (< 768px): Always use mobile layout
 * - Tablets (768px - 1279px): Use mobile layout in both portrait and landscape
 * - Desktop (1280px+): Use desktop layout
 * 
 * This ensures tablets get a one-column mobile viewport experience
 * regardless of orientation, while true desktop devices get the full layout.
 */
export function useMobileLayout(): boolean {
  const orientation = useOrientation();
  const [shouldUseMobileLayout, setShouldUseMobileLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const width = window.innerWidth;
    // Mobile: always use mobile layout
    if (width < VIEWPORT_BREAKPOINTS.mobile) {
      return true;
    }
    // Tablets: use mobile layout in both portrait and landscape
    if (width >= VIEWPORT_BREAKPOINTS.mobile && width < VIEWPORT_BREAKPOINTS.desktop) {
      return true;
    }
    // Desktop: use desktop layout
    return false;
  });

  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      // Mobile: always use mobile layout
      if (width < VIEWPORT_BREAKPOINTS.mobile) {
        setShouldUseMobileLayout(true);
        return;
      }
      // Tablets: use mobile layout in both portrait and landscape
      if (width >= VIEWPORT_BREAKPOINTS.mobile && width < VIEWPORT_BREAKPOINTS.desktop) {
        setShouldUseMobileLayout(true);
        return;
      }
      // Desktop: use desktop layout
      setShouldUseMobileLayout(false);
    };

    // Initial check
    updateLayout();

    // Listen for resize and orientation changes
    window.addEventListener('resize', updateLayout);
    window.addEventListener('orientationchange', updateLayout);

    return () => {
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('orientationchange', updateLayout);
    };
  }, [orientation]); // Re-check when orientation changes

  return shouldUseMobileLayout;
}

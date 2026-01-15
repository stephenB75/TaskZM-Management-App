import { useState, useEffect } from 'react';
import { useOrientation } from './useOrientation';
import { VIEWPORT_BREAKPOINTS } from '../lib/layout-constants';

/**
 * Hook to determine if the device should use mobile layout
 * 
 * Rules:
 * - Mobile phones (< 768px): Always use mobile layout (one-column)
 * - Tablets/iPad (768px - 1023px): Use mobile layout (one-column) in both portrait and landscape
 * - Laptops and small monitors (1024px - 1279px): Use desktop layout (multi-column)
 * - Desktop (1280px+): Use desktop layout (multi-column)
 * 
 * This ensures tablets get a one-column mobile viewport experience
 * while laptops and small monitors get the full desktop layout.
 */
export function useMobileLayout(): boolean {
  const orientation = useOrientation();
  const [shouldUseMobileLayout, setShouldUseMobileLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const width = window.innerWidth;
    // Mobile phones: always use mobile layout
    if (width < VIEWPORT_BREAKPOINTS.mobile) {
      return true;
    }
    // Tablets/iPad: use mobile layout in both portrait and landscape
    if (width >= VIEWPORT_BREAKPOINTS.mobile && width < VIEWPORT_BREAKPOINTS.tablet) {
      return true;
    }
    // Laptops, small monitors, and desktop: use desktop layout
    return false;
  });

  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      // Mobile phones: always use mobile layout
      if (width < VIEWPORT_BREAKPOINTS.mobile) {
        setShouldUseMobileLayout(true);
        return;
      }
      // Tablets/iPad: use mobile layout in both portrait and landscape
      if (width >= VIEWPORT_BREAKPOINTS.mobile && width < VIEWPORT_BREAKPOINTS.tablet) {
        setShouldUseMobileLayout(true);
        return;
      }
      // Laptops, small monitors, and desktop: use desktop layout
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

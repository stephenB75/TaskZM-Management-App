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
    let resizeTimeoutId: NodeJS.Timeout;
    const RESIZE_DEBOUNCE_MS = 150; // Debounce resize to reduce forced reflows

    const updateLayout = () => {
      // Use requestAnimationFrame to batch layout reads
      requestAnimationFrame(() => {
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
      });
    };

    const debouncedUpdateLayout = () => {
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = setTimeout(updateLayout, RESIZE_DEBOUNCE_MS);
    };

    // Initial check
    updateLayout();

    // Listen for resize and orientation changes with debouncing
    window.addEventListener('resize', debouncedUpdateLayout, { passive: true });
    window.addEventListener('orientationchange', updateLayout);

    return () => {
      window.removeEventListener('resize', debouncedUpdateLayout);
      window.removeEventListener('orientationchange', updateLayout);
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, [orientation]); // Re-check when orientation changes

  return shouldUseMobileLayout;
}

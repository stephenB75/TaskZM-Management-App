import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

/**
 * Hook to detect and track device orientation changes
 * Works for both mobile devices and desktop window resizing
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() => {
    if (typeof window === 'undefined') return 'portrait';
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  });

  useEffect(() => {
    // Use matchMedia for orientation detection (avoids forced reflows from reading window dimensions)
    const mediaQuery = window.matchMedia('(orientation: portrait)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? 'portrait' : 'landscape');
    };

    // Set initial orientation from media query (avoids reading window dimensions)
    setOrientation(mediaQuery.matches ? 'portrait' : 'landscape');

    // Modern browsers - use matchMedia instead of resize events to avoid forced reflows
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleMediaChange);
    }

    // Fallback: Only use resize/orientationchange if matchMedia is not available
    // This is rare, but provides compatibility
    let resizeTimeoutId: NodeJS.Timeout;
    const RESIZE_DEBOUNCE_MS = 150;
    
    const updateOrientationFallback = () => {
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = setTimeout(() => {
        // Use requestAnimationFrame to batch layout reads
        requestAnimationFrame(() => {
          setOrientation(
            window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
          );
        });
      }, RESIZE_DEBOUNCE_MS);
    };

    // Only add fallback listeners if matchMedia is not fully supported
    if (!mediaQuery.addEventListener && !mediaQuery.addListener) {
      window.addEventListener('resize', updateOrientationFallback, { passive: true });
      window.addEventListener('orientationchange', updateOrientationFallback);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleMediaChange);
      }
      if (!mediaQuery.addEventListener && !mediaQuery.addListener) {
        window.removeEventListener('resize', updateOrientationFallback);
        window.removeEventListener('orientationchange', updateOrientationFallback);
      }
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []);

  return orientation;
}

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
    const updateOrientation = () => {
      setOrientation(
        window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
      );
    };

    // Initial check
    updateOrientation();

    // Listen for resize events (works for both mobile orientation changes and desktop window resizing)
    window.addEventListener('resize', updateOrientation);

    // Listen for orientation change events (mobile devices)
    window.addEventListener('orientationchange', updateOrientation);

    // Use matchMedia for more reliable orientation detection
    const mediaQuery = window.matchMedia('(orientation: portrait)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? 'portrait' : 'landscape');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleMediaChange);
    }

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  return orientation;
}

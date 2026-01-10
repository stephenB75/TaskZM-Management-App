import * as React from "react";
import { VIEWPORT_BREAKPOINTS } from "../../lib/layout-constants";

// Tablet breakpoints: 768px - 1279px (includes iPad Pro at 1024px)
// iPad Pro in portrait is 1024px, so we extend to 1279px to include it
const TABLET_MIN = VIEWPORT_BREAKPOINTS.mobile; // 768px
const TABLET_MAX = VIEWPORT_BREAKPOINTS.desktop - 1; // 1279px (just before desktop breakpoint)

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth;
      // Tablet range: 768px - 1279px (includes iPad, iPad Pro, and small monitors)
      setIsTablet(width >= TABLET_MIN && width < VIEWPORT_BREAKPOINTS.desktop);
    };

    checkTablet();
    window.addEventListener("resize", checkTablet);
    // Also listen for orientation changes
    window.addEventListener("orientationchange", checkTablet);
    
    return () => {
      window.removeEventListener("resize", checkTablet);
      window.removeEventListener("orientationchange", checkTablet);
    };
  }, []);

  return !!isTablet;
}


import * as React from "react";

// Tablet breakpoints: 768px - 1023px (between mobile and desktop)
const TABLET_MIN = 768;
const TABLET_MAX = 1023;

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth;
      setIsTablet(width >= TABLET_MIN && width <= TABLET_MAX);
    };

    checkTablet();
    window.addEventListener("resize", checkTablet);
    return () => window.removeEventListener("resize", checkTablet);
  }, []);

  return !!isTablet;
}


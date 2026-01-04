"use client";

import { useTheme } from "../../contexts/ThemeContext";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { useEffect, useState } from "react";
import { TOAST_DURATION_DEFAULT_MS } from "../../lib/layout-constants";

const Toaster = ({ ...props }: ToasterProps) => {
  const { actualTheme } = useTheme();
  const theme = actualTheme === 'dark' ? 'dark' : 'light';
  const [position, setPosition] = useState<ToasterProps["position"]>("bottom-right");

  useEffect(() => {
    // Ensure window is available (client-side only)
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      try {
        // Check if mobile (screen width < mobile breakpoint)
        if (window.innerWidth < VIEWPORT_BREAKPOINTS.mobile) {
          setPosition("top-center");
        } else {
          setPosition("bottom-right");
        }
      } catch (error) {
        // Fallback to default position if check fails
        console.error('Error checking mobile size:', error);
      }
    };

    // Check on mount
    checkMobile();

    // Listen for resize events
    window.addEventListener("resize", checkMobile);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener("resize", checkMobile);
      }
    };
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={TOAST_DURATION_DEFAULT_MS}
      visibleToasts={3}
      expand={true}
      position={position}
      richColors={true}
      closeButton={true}
      toastOptions={{
        // Ensure consistent styling and behavior
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)',
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

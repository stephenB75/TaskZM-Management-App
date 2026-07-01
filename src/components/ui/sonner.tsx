"use client";

import { useTheme } from "../../contexts/ThemeContext";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { TOAST_DURATION_DEFAULT_MS, VIEWPORT_BREAKPOINTS, Z_INDEX } from "../../lib/layout-constants";
import { AGENDA_LIST_CARD } from "../../lib/agenda-list-card-constants";
import { TOAST_LAYOUT } from "../../lib/toast-constants";
import { getPlatform } from "../../lib/platform";
import { useMobileLayout } from "../../hooks/useMobileLayout";

const Toaster = ({ ...props }: ToasterProps) => {
  const { actualTheme } = useTheme();
  const theme = actualTheme === 'dark' ? 'dark' : 'light';
  const shouldUseMobileLayout = useMobileLayout();
  const platform = useMemo(() => getPlatform(), []);
  const useTopCenter = shouldUseMobileLayout || (platform.isNative && platform.isIOS);
  const [position, setPosition] = useState<ToasterProps["position"]>(
    useTopCenter ? "top-center" : "bottom-right",
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkPosition = () => {
      try {
        const nativeIos = getPlatform().isNative && getPlatform().isIOS;
        if (window.innerWidth < VIEWPORT_BREAKPOINTS.mobile || nativeIos) {
          setPosition("top-center");
        } else {
          setPosition("bottom-right");
        }
      } catch (error) {
        console.error('Error checking toast position:', error);
      }
    };

    checkPosition();
    window.addEventListener("resize", checkPosition);
    return () => {
      window.removeEventListener("resize", checkPosition);
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
      richColors={false}
      closeButton={true}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:rounded-2xl group-[.toaster]:border group-[.toaster]:border-border/50 group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-sm',
          title: 'group-[.toast]:font-semibold group-[.toast]:text-foreground',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:rounded-full group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:rounded-full group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton:
            'group-[.toast]:rounded-full group-[.toast]:border-border/50 group-[.toast]:bg-card/90',
          success:
            'group-[.toast]:border-emerald-200/60 group-[.toast]:bg-emerald-50/90 dark:group-[.toast]:border-emerald-900/40 dark:group-[.toast]:bg-emerald-950/80',
          error:
            'group-[.toast]:border-red-200/60 group-[.toast]:bg-red-50/90 dark:group-[.toast]:border-red-900/40 dark:group-[.toast]:bg-red-950/80',
          warning:
            'group-[.toast]:border-amber-200/60 group-[.toast]:bg-amber-50/90 dark:group-[.toast]:border-amber-900/40 dark:group-[.toast]:bg-amber-950/80',
          info:
            'group-[.toast]:border-primary/20 group-[.toast]:bg-primary/5 dark:group-[.toast]:border-primary/30 dark:group-[.toast]:bg-primary/10',
        },
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)',
          boxShadow: AGENDA_LIST_CARD.shadow,
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--toast-top-offset": TOAST_LAYOUT.topWithSafeArea,
          "--toast-gap": `${TOAST_LAYOUT.toastGapPx}px`,
          zIndex: Z_INDEX.TOAST,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

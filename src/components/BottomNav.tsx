import React from "react";
import {
  Inbox,
  Settings,
  Calendar,
  CalendarDays,
} from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import { useTasks } from "../contexts/TaskContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  NAV_BAR_HEIGHT,
  NAV_BAR_PADDING_TOP,
  NAV_BAR_PADDING_BOTTOM,
  NAV_BAR_BUTTON_PADDING_TOP,
  NAV_BAR_BUTTON_PADDING_BOTTOM,
  NAV_BAR_ICON_SIZE,
  NAV_BAR_ICON_MARGIN_TOP_ACTIVE,
  NAV_BAR_ICON_MARGIN_TOP_INACTIVE,
  NAV_BAR_INDICATOR_WIDTH,
  NAV_BAR_INDICATOR_HEIGHT,
  NAV_BAR_INDICATOR_TOP,
  NAV_BAR_INDICATOR_MARGIN_LEFT,
  NAV_BAR_LABEL_TEXT_SIZE,
  NAV_BAR_LABEL_MARGIN_TOP,
  NAV_BAR_BADGE_SIZE,
  NAV_BAR_BADGE_TEXT_SIZE,
  NAV_BAR_BADGE_BORDER_WIDTH,
  NAV_BAR_BADGE_TOP_OFFSET,
  NAV_BAR_BADGE_RIGHT_OFFSET,
  NAV_BAR_SYNC_INDICATOR_HEIGHT,
  NAV_BAR_HORIZONTAL_PADDING,
  NAV_BAR_ACTIVE_SCALE,
  NAV_BAR_INITIAL_Y_OFFSET,
  NAV_BAR_ANIMATION_DURATION,
  NAV_BAR_ANIMATION_STIFFNESS,
  NAV_BAR_ANIMATION_DAMPING,
  NAV_BAR_HAPTIC_DURATION,
  NAV_BAR_BUTTON_TRANSITION_DURATION,
  NAV_BAR_SHADOW_OPACITY_LIGHT,
  NAV_BAR_SHADOW_OPACITY_DARK,
  NAV_BAR_SHADOW_BLUR_LARGE,
  NAV_BAR_SHADOW_BLUR_SMALL,
  NAV_BAR_SHADOW_OFFSET_Y_LARGE,
  NAV_BAR_SHADOW_OFFSET_Y_SMALL,
} from "../lib/layout-constants";
import {
  COLOR_PRIMARY,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_LILAC,
  COLOR_BADGE_RED,
  getColorWithOpacity,
} from "../lib/color-theme";

interface BottomNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
  mobileView?: "today" | "week";
  onMobileViewChange?: (view: "today" | "week") => void;
  unscheduledCount?: number;
}

export function BottomNav({
  currentView,
  onViewChange,
  mobileView = "today",
  onMobileViewChange,
  unscheduledCount = 0,
}: BottomNavProps) {
  const { isSyncing } = useTasks();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const isDashboard = currentView === "dashboard";

  // Haptic feedback for modern mobile devices
  const triggerHaptic = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(NAV_BAR_HAPTIC_DURATION);
    }
  };

  const navItems = [
    {
      id: "today",
      label: "Today",
      icon: Calendar,
      onClick: () => {
        triggerHaptic();
        onViewChange("today");
      },
      active: currentView === "today",
    },
    {
      id: "week",
      label: "Week",
      icon: CalendarDays,
      onClick: () => {
        triggerHaptic();
        if (currentView !== "dashboard") {
          onViewChange("dashboard");
        }
        onMobileViewChange?.("week");
      },
      active: isDashboard && mobileView === "week",
    },
    {
      id: "inbox",
      label: "Inbox",
      icon: Inbox,
      onClick: () => {
        triggerHaptic();
        onViewChange("inbox");
      },
      active: currentView === "inbox",
      badge: unscheduledCount,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      onClick: () => {
        triggerHaptic();
        onViewChange("settings");
      },
      active: currentView === "settings",
    },
  ];

  return (
    <motion.nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-primary/10 dark:border-gray-700/50 shadow-2xl overflow-visible"
      initial={{ y: NAV_BAR_INITIAL_Y_OFFSET }}
      animate={{ y: 0 }}
      transition={{ duration: NAV_BAR_ANIMATION_DURATION, ease: "easeOut" }}
      style={{
        boxShadow: isDark
          ? `0 ${NAV_BAR_SHADOW_OFFSET_Y_LARGE}px ${NAV_BAR_SHADOW_BLUR_LARGE}px ${getColorWithOpacity('#000000', 0.3)}, 0 ${NAV_BAR_SHADOW_OFFSET_Y_SMALL}px ${NAV_BAR_SHADOW_BLUR_SMALL}px ${getColorWithOpacity('#000000', 0.2)}`
          : `0 ${NAV_BAR_SHADOW_OFFSET_Y_LARGE}px ${NAV_BAR_SHADOW_BLUR_LARGE}px ${getColorWithOpacity(COLOR_PRIMARY, NAV_BAR_SHADOW_OPACITY_LIGHT)}, 0 ${NAV_BAR_SHADOW_OFFSET_Y_SMALL}px ${NAV_BAR_SHADOW_BLUR_SMALL}px ${getColorWithOpacity(COLOR_PRIMARY, NAV_BAR_SHADOW_OPACITY_DARK)}`,
      }}
    >
      {/* Subtle sync indicator at top */}
      {isSyncing && (
        <div 
          className="absolute top-0 left-0 right-0 animate-pulse" 
          style={{ 
            height: NAV_BAR_SYNC_INDICATOR_HEIGHT,
            background: `linear-gradient(to right, ${COLOR_PASTEL_MINT}, ${COLOR_PASTEL_SKY}, ${COLOR_PASTEL_LILAC})`
          }}
        />
      )}

      <div 
        className="flex items-center justify-evenly overflow-visible" 
        style={{ 
          paddingTop: NAV_BAR_PADDING_TOP,
          paddingBottom: `calc(${NAV_BAR_PADDING_BOTTOM} + env(safe-area-inset-bottom, 0px))`,
          paddingLeft: NAV_BAR_HORIZONTAL_PADDING,
          paddingRight: NAV_BAR_HORIZONTAL_PADDING,
          height: `${NAV_BAR_HEIGHT}px`,
          minHeight: `${NAV_BAR_HEIGHT}px`
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                "flex flex-col items-center justify-center flex-1 rounded-xl relative overflow-visible",
                "touch-manipulation transition-transform ease-out",
                item.active && "text-primary dark:text-primary-foreground",
                !item.active &&
                  "text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-gray-200",
              )}
              style={{
                paddingTop: NAV_BAR_BUTTON_PADDING_TOP,
                paddingBottom: NAV_BAR_BUTTON_PADDING_BOTTOM,
                paddingLeft: NAV_BAR_HORIZONTAL_PADDING,
                paddingRight: NAV_BAR_HORIZONTAL_PADDING,
                transitionDuration: `${NAV_BAR_BUTTON_TRANSITION_DURATION}ms`,
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = `scale(${NAV_BAR_ACTIVE_SCALE})`;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = `scale(${NAV_BAR_ACTIVE_SCALE})`;
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {/* Icon - 30% bigger (w-6 h-6 -> w-8 h-8) */}
              <div className="relative flex items-center justify-center" style={{ marginTop: item.active ? NAV_BAR_ICON_MARGIN_TOP_ACTIVE : NAV_BAR_ICON_MARGIN_TOP_INACTIVE }}>
                {/* Active indicator - centered above icon */}
                {item.active && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute bg-primary rounded-full z-0"
                    style={{
                      width: NAV_BAR_INDICATOR_WIDTH,
                      height: NAV_BAR_INDICATOR_HEIGHT,
                      top: NAV_BAR_INDICATOR_TOP,
                      left: '50%',
                      marginLeft: NAV_BAR_INDICATOR_MARGIN_LEFT,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: NAV_BAR_ANIMATION_STIFFNESS,
                      damping: NAV_BAR_ANIMATION_DAMPING,
                    }}
                  />
                )}
                <Icon 
                  className="relative z-10" 
                  style={{ width: NAV_BAR_ICON_SIZE, height: NAV_BAR_ICON_SIZE }}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span 
                    className="absolute text-white font-bold rounded-full flex items-center justify-center border-white" 
                    style={{ 
                      backgroundColor: COLOR_BADGE_RED,
                      fontSize: NAV_BAR_BADGE_TEXT_SIZE,
                      width: NAV_BAR_BADGE_SIZE,
                      height: NAV_BAR_BADGE_SIZE,
                      borderWidth: NAV_BAR_BADGE_BORDER_WIDTH,
                      top: NAV_BAR_BADGE_TOP_OFFSET,
                      right: NAV_BAR_BADGE_RIGHT_OFFSET,
                    }}
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span 
                className={cn(
                  "font-medium leading-tight",
                  item.active 
                    ? "text-primary dark:text-primary-foreground" 
                    : "text-muted-foreground dark:text-gray-400"
                )} 
                style={{ fontSize: NAV_BAR_LABEL_TEXT_SIZE, marginTop: NAV_BAR_LABEL_MARGIN_TOP }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
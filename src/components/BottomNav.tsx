import React from "react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { motion } from "motion/react";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import { useTasks } from "../contexts/TaskContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  NAV_BAR_HEIGHT_WITH_SAFE_AREA,
  NAV_BAR_ICON_SIZE,
  NAV_BAR_ICON_SLOT_SIZE,
  NAV_BAR_ICON_LABEL_GAP,
  NAV_BAR_LABEL_LINE_HEIGHT,
  NAV_BAR_INDICATOR_WIDTH,
  NAV_BAR_INDICATOR_HEIGHT,
  NAV_BAR_LABEL_TEXT_SIZE,
  NAV_BAR_BADGE_SIZE,
  NAV_BAR_BADGE_TEXT_SIZE,
  NAV_BAR_BADGE_BORDER_WIDTH,
  NAV_BAR_BADGE_TOP_OFFSET,
  NAV_BAR_BADGE_RIGHT_OFFSET,
  NAV_BAR_SYNC_INDICATOR_HEIGHT,
  NAV_BAR_HORIZONTAL_PADDING_LEFT,
  NAV_BAR_HORIZONTAL_PADDING_RIGHT,
  NAV_BAR_PADDING_TOP,
  NAV_BAR_PADDING_BOTTOM,
  NAV_BAR_TAB_COUNT,
  NAV_BAR_ACTIVE_SCALE,
  NAV_BAR_INITIAL_Y_OFFSET,
  NAV_BAR_ANIMATION_DURATION,
  NAV_BAR_HAPTIC_DURATION,
  NAV_BAR_BUTTON_TRANSITION_DURATION,
  NAV_BAR_SHADOW_OPACITY_LIGHT,
  NAV_BAR_SHADOW_OPACITY_DARK,
  NAV_BAR_SHADOW_BLUR_LARGE,
  NAV_BAR_SHADOW_BLUR_SMALL,
  NAV_BAR_SHADOW_OFFSET_Y_LARGE,
  NAV_BAR_SHADOW_OFFSET_Y_SMALL,
  Z_INDEX,
} from "../lib/layout-constants";
import { NAVIGATION_UI_TEXT } from "../lib/navigation-constants";
import { COLOR_TEXT_WHITE } from "../lib/color-theme";
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
  /** Called before any nav tap (e.g. dismiss onboarding tour overlay). */
  onNavInteraction?: () => void;
  /** Single handler for Week tab — sets dashboard + week view together. */
  onWeekPress?: () => void;
  /** When true, ignore nav taps so the guided tour is not interrupted. */
  tourActive?: boolean;
  unscheduledCount?: number;
  upcomingAndDueNowCount?: number;
}

export function BottomNav({
  currentView,
  onViewChange,
  mobileView = "today",
  onMobileViewChange,
  onNavInteraction,
  onWeekPress,
  tourActive = false,
  unscheduledCount = 0,
  upcomingAndDueNowCount = 0,
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
      label: NAVIGATION_UI_TEXT.today,
      iconName: "calendar",
      onClick: () => {
        if (tourActive) return;
        triggerHaptic();
        onNavInteraction?.();
        onViewChange("today");
      },
      active: currentView === "today",
      badge:
        currentView !== "today" && upcomingAndDueNowCount > 0
          ? upcomingAndDueNowCount
          : undefined,
    },
    {
      id: "week",
      label: NAVIGATION_UI_TEXT.week,
      iconName: "calendar-days",
      onClick: () => {
        if (tourActive) return;
        triggerHaptic();
        onNavInteraction?.();
        if (onWeekPress) {
          onWeekPress();
          return;
        }
        if (currentView !== "dashboard") {
          onViewChange("dashboard");
        }
        onMobileViewChange?.("week");
      },
      active: isDashboard && mobileView === "week",
    },
    {
      id: "inbox",
      label: NAVIGATION_UI_TEXT.inbox,
      iconName: "inbox",
      onClick: () => {
        if (tourActive) return;
        triggerHaptic();
        onNavInteraction?.();
        onViewChange("inbox");
      },
      active: currentView === "inbox",
      badge: unscheduledCount,
    },
    {
      id: "settings",
      label: NAVIGATION_UI_TEXT.settings,
      iconName: "settings",
      onClick: () => {
        if (tourActive) return;
        triggerHaptic();
        onNavInteraction?.();
        onViewChange("settings");
      },
      active: currentView === "settings",
    },
  ];

  return (
    <motion.nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-primary/10 dark:border-gray-700/50 shadow-2xl overflow-visible"
      initial={{ y: NAV_BAR_INITIAL_Y_OFFSET }}
      animate={{ y: 0 }}
      transition={{ duration: NAV_BAR_ANIMATION_DURATION, ease: "easeOut" }}
      style={{
        zIndex: Z_INDEX.NAV_BAR,
        paddingLeft: NAV_BAR_HORIZONTAL_PADDING_LEFT,
        paddingRight: NAV_BAR_HORIZONTAL_PADDING_RIGHT,
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
        className="relative grid w-full overflow-visible bg-white dark:bg-gray-900"
        data-tour="bottom-nav"
        style={{
          gridTemplateColumns: `repeat(${NAV_BAR_TAB_COUNT}, minmax(0, 1fr))`,
          height: NAV_BAR_HEIGHT_WITH_SAFE_AREA,
          boxSizing: 'border-box',
          paddingTop: NAV_BAR_PADDING_TOP,
          paddingBottom: NAV_BAR_PADDING_BOTTOM,
          alignItems: 'center',
          justifyItems: 'center',
        }}
      >
        {navItems.map((item) => {
          return (
            <button
              key={item.id}
              data-tour={`bottom-nav-${item.id}`}
              onClick={item.onClick}
              className={cn(
                "relative flex h-full w-full min-w-0 max-w-full flex-col items-center justify-center overflow-visible rounded-xl",
                "touch-manipulation transition-transform ease-out",
                item.active && "text-primary dark:text-primary-foreground",
                !item.active &&
                  "text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-gray-200",
              )}
              style={{
                gap: NAV_BAR_ICON_LABEL_GAP,
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
              {item.active && (
                <div
                  className="absolute z-0 rounded-full bg-primary"
                  style={{
                    width: NAV_BAR_INDICATOR_WIDTH,
                    height: NAV_BAR_INDICATOR_HEIGHT,
                    top: NAV_BAR_PADDING_TOP,
                    left: 0,
                    right: 0,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                  }}
                />
              )}

              <div
                className="relative flex shrink-0 items-center justify-center"
                style={{
                  width: NAV_BAR_ICON_SLOT_SIZE,
                  height: NAV_BAR_ICON_SLOT_SIZE,
                }}
              >
                <Icon 
                  name={item.iconName}
                  size={NAV_BAR_ICON_SIZE}
                  weight={item.active ? "fill" : "regular"}
                  className="relative z-10" 
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span 
                    className="absolute font-bold rounded-full flex items-center justify-center border-white z-30 shadow-lg"
                    style={{ 
                      color: COLOR_TEXT_WHITE,
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

              <span 
                className={cn(
                  "w-full min-w-0 shrink-0 truncate text-center font-medium",
                  item.active 
                    ? "text-primary dark:text-primary-foreground" 
                    : "text-muted-foreground dark:text-gray-400"
                )} 
                style={{
                  fontSize: NAV_BAR_LABEL_TEXT_SIZE,
                  lineHeight: NAV_BAR_LABEL_LINE_HEIGHT,
                }}
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
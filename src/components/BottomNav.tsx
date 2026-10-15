import React from "react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { useTasks } from "../contexts/TaskContext";
import {
  NAV_BAR_HEIGHT,
  NAV_BAR_LAYOUT_VERSION,
  NAV_BAR_ICON_SIZE,
  NAV_BAR_ICON_SLOT_SIZE,
  NAV_BAR_ICON_LABEL_GAP,
  NAV_BAR_LABEL_LINE_HEIGHT,
  NAV_BAR_TAB_TOP_INSET,
  NAV_BAR_LABEL_TEXT_SIZE,
  NAV_BAR_BADGE_SIZE,
  NAV_BAR_BADGE_TEXT_SIZE,
  NAV_BAR_BADGE_BORDER_WIDTH,
  NAV_BAR_BADGE_TOP_OFFSET,
  NAV_BAR_BADGE_RIGHT_OFFSET,
  NAV_BAR_SYNC_INDICATOR_HEIGHT,
  NAV_BAR_HORIZONTAL_PADDING_LEFT,
  NAV_BAR_HORIZONTAL_PADDING_RIGHT,
  NAV_BAR_SAFE_AREA_BOTTOM,
  NAV_BAR_PADDING_TOP,
  NAV_BAR_TAB_COUNT,
  NAV_BAR_ACTIVE_SCALE,
  NAV_BAR_INITIAL_Y_OFFSET,
  NAV_BAR_ANIMATION_DURATION,
  NAV_BAR_BUTTON_TRANSITION_DURATION,
  Z_INDEX,
} from "../lib/layout-constants";
import { NAVIGATION_UI_TEXT } from "../lib/navigation-constants";
import { COLOR_TEXT_WHITE } from "../lib/color-theme";
import { triggerSelectionHaptic } from "../lib/native-haptics";
import { BADGE_DISPLAY_MAX } from "../lib/notification-constants";
import {
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_LILAC,
  COLOR_BADGE_RED,
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
  const isDashboard = currentView === "dashboard";

  const triggerHaptic = () => {
    void triggerSelectionHaptic();
  };

  const navItems = [
    {
      id: "today",
      label: NAVIGATION_UI_TEXT.timeline,
      iconName: "list-checks",
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
      label: NAVIGATION_UI_TEXT.calendar,
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
      id: "ai",
      label: NAVIGATION_UI_TEXT.aiPlan,
      iconName: "magic-wand",
      onClick: () => {
        if (tourActive) return;
        triggerHaptic();
        onNavInteraction?.();
        onViewChange("ai");
      },
      active: currentView === "ai",
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
  ];

  return (
    <motion.nav
      className="native-hide-with-keyboard lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border overflow-visible transition-transform duration-200 ease-out"
      initial={{ y: NAV_BAR_INITIAL_Y_OFFSET }}
      animate={{ y: 0 }}
      transition={{ duration: NAV_BAR_ANIMATION_DURATION, ease: "easeOut" }}
      style={{
        zIndex: Z_INDEX.NAV_BAR,
        paddingLeft: NAV_BAR_HORIZONTAL_PADDING_LEFT,
        paddingRight: NAV_BAR_HORIZONTAL_PADDING_RIGHT,
        paddingTop: NAV_BAR_PADDING_TOP,
        paddingBottom: NAV_BAR_SAFE_AREA_BOTTOM,
        boxSizing: 'border-box',
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
        className="relative grid w-full overflow-visible bg-card"
        data-tour="bottom-nav"
        data-nav-layout={NAV_BAR_LAYOUT_VERSION}
        style={{
          gridTemplateColumns: `repeat(${NAV_BAR_TAB_COUNT}, minmax(0, 1fr))`,
          height: `${NAV_BAR_HEIGHT}px`,
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
                item.active && "text-pop-lime-ink",
                !item.active && "text-muted-foreground",
              )}
              style={{
                gap: NAV_BAR_ICON_LABEL_GAP,
                paddingTop: NAV_BAR_TAB_TOP_INSET,
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
              <div
                className="relative flex shrink-0 items-center justify-center overflow-visible"
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
                    {item.badge > BADGE_DISPLAY_MAX ? `${BADGE_DISPLAY_MAX}+` : item.badge}
                  </span>
                )}
              </div>

              <span 
                className={cn(
                  "relative z-10 w-full min-w-0 shrink-0 truncate text-center font-semibold",
                  item.active
                    ? "text-pop-lime-ink"
                    : "text-muted-foreground"
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

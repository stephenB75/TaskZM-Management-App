import React from "react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import { COMPONENT_DIMENSIONS, MOBILE_HOME_SECTION_GAP, NAV_BAR_HEIGHT, NAV_BAR_PADDING_TOP, PLANNER_LAYOUT, SHEET_SAFE_AREA, SIDEBAR_WIDTH, SIDEBAR_Z_INDEX } from "../lib/layout-constants";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useTheme } from "../contexts/ThemeContext";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { NAVIGATION_UI_TEXT } from "../lib/navigation-constants";
import { triggerSelectionHaptic } from "../lib/native-haptics";
import { BADGE_DISPLAY_MAX } from "../lib/notification-constants";
import taskzmLogoBlack from "../assets/Taskzm_Logo_BLK-removebg.png";  // Black logo for light mode
import taskzmLogoGray from "../assets/taskzm-logo-gray.png";  // Gray logo for dark mode
import RAIL_BRAND_MARK_SRC from "../assets/taskzm-mark.png";

const RAIL_ADD_TASK_LABEL = "Add task";
/** Rail items from this index on (folders, team, …) sit below a divider. */
const RAIL_SECONDARY_START = 4;

interface AppSidebarProps {
  currentView: string;
  /** Desktop planner layout: week (three columns) or month (calendar spans the rail's width). */
  calendarMode?: 'week' | 'month';
  onViewChange: (view: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  unscheduledCount?: number;
  upcomingAndDueNowCount?: number;
}

export function AppSidebar({
  currentView,
  calendarMode = 'week',
  onViewChange,
  open,
  onOpenChange,
  unscheduledCount = 0,
  upcomingAndDueNowCount = 0,
}: AppSidebarProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const { tasks } = useTasks();
  const { teamMembers } = useTeam();
  const { hasFeature } = useSubscription();
  const { unreadCount: badgeCount } = useNotifications();
  const shouldUseMobileLayout = useMobileLayout(); // Use mobile layout for tablets too
  const completedCount = tasks.filter(
    (t: { status: string }) => t.status === "done",
  ).length;

  // Count team members with unread notifications (accepted invites that haven't been viewed)
  const teamNotificationCount = teamMembers.filter(
    (m: { hasUnreadNotification?: boolean; inviteStatus?: string }) =>
      m.hasUnreadNotification && m.inviteStatus === "accepted",
  ).length;

  const menuItems = [
    {
      id: "today",
      label: shouldUseMobileLayout ? NAVIGATION_UI_TEXT.timeline : NAVIGATION_UI_TEXT.week,
      iconName: shouldUseMobileLayout ? "list-checks" : "calendar-week",
      badge:
        currentView !== "today" && upcomingAndDueNowCount > 0
          ? upcomingAndDueNowCount
          : undefined,
      mobileHidden: true,
    },
    {
      id: "dashboard",
      label: NAVIGATION_UI_TEXT.calendar,
      iconName: "calendar-days",
      mobileHidden: true,
    },
    {
      id: "notifications",
      label: NAVIGATION_UI_TEXT.notifications,
      iconName: "bell",
      badge: badgeCount,
      mobileHidden: true,
    },
    {
      id: "inbox",
      label: NAVIGATION_UI_TEXT.inbox,
      iconName: "inbox",
      badge: unscheduledCount,
      mobileHidden: true,
    },
    {
      id: "folders",
      label: NAVIGATION_UI_TEXT.folders,
      iconName: "folder",
    },
    {
      id: "team",
      label: NAVIGATION_UI_TEXT.team,
      iconName: "users",
      badge: teamNotificationCount,
      pro: !hasFeature("teamFeatures"),
    },
    {
      id: "analytics",
      label: NAVIGATION_UI_TEXT.analytics,
      iconName: "bar-chart",
      pro: !hasFeature("analytics"),
    },
    { id: "archive", label: NAVIGATION_UI_TEXT.archive, iconName: "archive" },
    { id: "settings", label: NAVIGATION_UI_TEXT.settings, iconName: "settings" },
  ];

  const mobileSidebarContent = (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{
        padding: MOBILE_HOME_SECTION_GAP,
        paddingTop: `calc(${MOBILE_HOME_SECTION_GAP} + ${SHEET_SAFE_AREA.top})`,
        paddingBottom: `calc(${MOBILE_HOME_SECTION_GAP} + ${NAV_BAR_PADDING_TOP} + ${NAV_BAR_HEIGHT}px)`,
      }}
    >
      <div className="mb-2 flex shrink-0 flex-col items-center gap-1">
        <img
          src={isDark ? taskzmLogoGray : taskzmLogoBlack}
          alt="TaskZM Logo"
          className="object-contain"
          style={{
            width: 'auto',
            maxWidth: COMPONENT_DIMENSIONS.sidebar.logoMaxWidth,
            height: 'auto',
            display: 'block',
          }}
        />
        <p className="text-sm text-muted-foreground text-center">
          Auto-Scheduled Tasks
        </p>
      </div>

      {/* Navigation */}
      <div className="flex min-h-0 flex-1 flex-col justify-start gap-2 overflow-y-auto pt-4">
        {menuItems
          .filter((item) => !('mobileHidden' in item && item.mobileHidden))
          .map((item) => {
            return (
              <Button
                key={item.id}
                variant={
                  currentView === item.id ? "secondary" : "ghost"
                }
                className={cn(
                  "w-full justify-start rounded-xl transition-all relative",
                  currentView === item.id &&
                    "bg-primary text-primary-foreground",
                )}
                onClick={() => {
                  void triggerSelectionHaptic();
                  onViewChange(item.id);
                  onOpenChange?.(false);
                }}
              >
                <Icon 
                  name={item.iconName} 
                  size={16} 
                  weight={currentView === item.id ? "fill" : "duotone"}
                  className="mr-2"
                />
                {item.label}
                {item.pro && (
                  <Badge
                    variant="secondary"
                    className="ml-auto bg-foreground text-background text-[10px] px-1.5 py-0"
                  >
                    PRO
                  </Badge>
                )}
                {item.badge !== undefined &&
                  item.badge > 0 &&
                  !item.pro && (
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-white/50 dark:bg-card/50"
                    >
                      {item.badge}
                    </Badge>
                  )}
              </Button>
            );
          })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop icon rail */}
      {!shouldUseMobileLayout && (
        <nav
          className="planner-rail relative flex-shrink-0"
          data-tour="sidebar"
          aria-label={NAVIGATION_UI_TEXT.dashboard}
          style={{ zIndex: SIDEBAR_Z_INDEX, width: SIDEBAR_WIDTH }}
        >
          <img
            src={RAIL_BRAND_MARK_SRC}
            alt="TaskZM"
            className="object-contain"
            style={{ width: PLANNER_LAYOUT.railLogoPx, height: PLANNER_LAYOUT.railLogoPx, marginBottom: PLANNER_LAYOUT.sectionGapPx }}
          />
          <button
            type="button"
            className="planner-rail-btn planner-rail-brand"
            aria-label={RAIL_ADD_TASK_LABEL}
            onClick={() => {
              void triggerSelectionHaptic();
              window.dispatchEvent(new CustomEvent('taskzm-add-task'));
            }}
          >
            <Icon name="plus" size={PLANNER_LAYOUT.railIconPx} weight="bold" className="taskzm-nav-icon" />
            <span className="planner-rail-label">{RAIL_ADD_TASK_LABEL}</span>
          </button>
          {menuItems.map((item, index) => {
            const plannerItemActive =
              item.id === "today" ? calendarMode === "week" : item.id === "dashboard" ? calendarMode === "month" : false;
            const active = currentView === "today" && (item.id === "today" || item.id === "dashboard")
              ? plannerItemActive
              : currentView === item.id;
            const badge = item.badge !== undefined && item.badge > 0 && !item.pro ? item.badge : 0;
            return (
              <React.Fragment key={item.id}>
                {index === RAIL_SECONDARY_START ? <span className="planner-rail-divider" aria-hidden /> : null}
                {item.id === "settings" ? <span className="flex-1" aria-hidden /> : null}
                <button
                  type="button"
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  data-tour={`sidebar-${item.id}`}
                  data-active={active ? "true" : undefined}
                  data-alert={item.id === "notifications" && badge > 0 ? "true" : undefined}
                  className="planner-rail-btn taskzm-bell"
                  onClick={() => {
                    void triggerSelectionHaptic();
                    onViewChange(item.id);
                  }}
                >
                  <Icon name={item.iconName} size={PLANNER_LAYOUT.railIconPx} weight={active ? "fill" : "regular"} className="taskzm-nav-icon" />
                  {badge > 0 ? (
                    <span className="planner-rail-badge">{badge > BADGE_DISPLAY_MAX ? `${BADGE_DISPLAY_MAX}+` : badge}</span>
                  ) : null}
                  <span className="planner-rail-label">
                    {item.label}
                    {item.pro ? " · PRO" : ""}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Mobile/Tablet Sidebar - Sheet overlay (shown on mobile and tablets < 1280px) */}
      {shouldUseMobileLayout && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="left"
            className="taskzm-sidebar-sheet w-64 p-0"
          >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
            <SheetDescription>
              Access different views and settings
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col h-full">
            {mobileSidebarContent}
          </div>
        </SheetContent>
      </Sheet>
      )}
    </>
  );
}
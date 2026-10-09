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
import { COMPONENT_DIMENSIONS, MOBILE_HOME_SECTION_GAP, SIDEBAR_WIDTH, SIDEBAR_Z_INDEX } from "../lib/layout-constants";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useTheme } from "../contexts/ThemeContext";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { NAVIGATION_UI_TEXT } from "../lib/navigation-constants";
import taskzmLogoBlack from "../assets/Taskzm_Logo_BLK-removebg.png";  // Black logo for light mode
import taskzmLogoGray from "../assets/taskzm-logo-gray.png";  // Gray logo for dark mode

interface AppSidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  unscheduledCount?: number;
  upcomingAndDueNowCount?: number;
}

export function AppSidebar({
  currentView,
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
  const { badgeCount } = useNotifications();
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
      label: NAVIGATION_UI_TEXT.home,
      iconName: "calendar",
      badge:
        currentView !== "today" && upcomingAndDueNowCount > 0
          ? upcomingAndDueNowCount
          : undefined,
    },
    {
      id: "dashboard",
      label: NAVIGATION_UI_TEXT.week,
      iconName: "kanban",
    },
    {
      id: "notifications",
      label: NAVIGATION_UI_TEXT.notifications,
      iconName: "bell",
      badge: badgeCount,
    },
    {
      id: "inbox",
      label: NAVIGATION_UI_TEXT.inbox,
      iconName: "inbox",
      badge: unscheduledCount,
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
    <div className="p-4 flex flex-col h-full">
      {/* Header */}
      <div className="mb-6 flex flex-col items-center gap-1.5">
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
          AI-Powered Tasks
        </p>
      </div>

      {/* Navigation */}
      <div className="space-y-2 flex-1">
        {menuItems
          .filter((item) => !('desktopOnly' in item && item.desktopOnly)) // Mobile sidebar excludes desktop-only items
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
                    className="ml-auto bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE] text-primary-foreground text-[10px] px-1.5 py-0"
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
      {/* Desktop Icon Navbar - Only visible on desktop (>= 1280px) */}
      {!shouldUseMobileLayout && (
        <div
          className="relative flex border-r border-border bg-white dark:bg-gray-900 flex-col h-full flex-shrink-0 overflow-y-auto"
          data-tour="sidebar"
          style={{ zIndex: SIDEBAR_Z_INDEX, width: SIDEBAR_WIDTH }}
        >
          <div className="flex flex-col gap-1 p-3">
            <img
              src={isDark ? taskzmLogoGray : taskzmLogoBlack}
              alt="TaskZM"
              className="object-contain"
              style={{
                width: 'auto',
                maxWidth: COMPONENT_DIMENSIONS.sidebar.logoMaxWidth,
                height: 'auto',
                display: 'block',
                marginBottom: MOBILE_HOME_SECTION_GAP,
              }}
            />
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                data-tour={`sidebar-${item.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-3 text-left",
                  currentView === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={() => onViewChange(item.id)}
              >
                <Icon
                  name={item.iconName}
                  size={20}
                  weight={currentView === item.id ? "fill" : "duotone"}
                />
                <span className="text-sm font-medium">{item.label}</span>
                {item.pro && (
                  <Badge variant="secondary" className="ml-auto">
                    PRO
                  </Badge>
                )}
                {item.badge !== undefined && item.badge > 0 && !item.pro && (
                  <Badge variant="secondary" className="ml-auto">
                    {item.badge > 9 ? "9+" : item.badge}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile/Tablet Sidebar - Sheet overlay (shown on mobile and tablets < 1280px) */}
      {shouldUseMobileLayout && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="left"
            className="w-64 p-0"
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
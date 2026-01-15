import React from "react";
import {
  LayoutDashboard,
  Inbox,
  Settings,
  Archive,
  CalendarDays,
  BarChart3,
  Users,
  Lock,
  Folder,
  Bell,
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import { COMPONENT_DIMENSIONS } from "../lib/layout-constants";
import { useTasks } from "../contexts/TaskContext";
import { useTeam } from "../contexts/TeamContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useTheme } from "../contexts/ThemeContext";
import { useMobileLayout } from "../hooks/useMobileLayout";
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
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      badge: badgeCount,
    },
    { 
      id: "today", 
      label: "Today Agenda", 
      icon: CalendarDays,
      badge: upcomingAndDueNowCount > 0 ? upcomingAndDueNowCount : undefined,
    },
    {
      id: "inbox",
      label: "Inbox",
      icon: Inbox,
      badge: unscheduledCount,
    },
    {
      id: "folders",
      label: "Folders",
      icon: Folder,
    },
    {
      id: "team",
      label: "Team",
      icon: Users,
      badge: teamNotificationCount,
      pro: !hasFeature("teamFeatures"),
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
      pro: !hasFeature("analytics"),
    },
    { id: "archive", label: "Archive", icon: Archive },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const iconNavContent = (
    <TooltipProvider delayDuration={0}>
      <div
        className="flex flex-col items-center py-4 gap-2"
        data-tour="sidebar"
      >
        {menuItems
          .map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <motion.button
                      type="button"
                      className={cn(
                        "w-12 h-12 rounded-xl transition-all relative flex items-center justify-center",
                        "bg-transparent border-none cursor-pointer",
                        currentView === item.id
                          ? "text-primary"
                          : "text-muted-foreground hover:text-primary",
                      )}
                      onClick={() => onViewChange(item.id)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <Icon className="w-5 h-5" />
                      {item.pro && (
                        <Lock className="w-3 h-3 absolute top-1 right-1 text-[#D4C5F9]" />
                      )}
                    </motion.button>
                    {item.badge !== undefined &&
                      item.badge > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-[10px] rounded-full"
                        >
                          {item.badge > 9 ? "9+" : item.badge}
                        </Badge>
                      )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>
                    {item.label}{" "}
                    {item.badge !== undefined && item.badge > 0
                      ? `(${item.badge})`
                      : ""}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
      </div>
    </TooltipProvider>
  );

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
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={
                  currentView === item.id ? "secondary" : "ghost"
                }
                className={cn(
                  "w-full justify-start rounded-xl transition-all relative",
                  currentView === item.id &&
                    "bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7] text-primary shadow-sm",
                )}
                onClick={() => {
                  onViewChange(item.id);
                  onOpenChange?.(false);
                }}
              >
                <Icon className="w-4 h-4 mr-2" />
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
        <div className="flex w-16 border-r border-primary/20 bg-gradient-to-b from-[#F3F0F9] via-[#E6D5F0] to-[#D4C5F9] dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex-col h-full">
          {iconNavContent}
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
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
  const isDashboard = currentView === "dashboard";

  // Haptic feedback for modern mobile devices
  const triggerHaptic = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(10); // Very subtle vibration
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-primary/10 shadow-2xl overflow-visible"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        boxShadow:
          "0 -4px 24px rgba(155, 135, 232, 0.08), 0 -2px 8px rgba(155, 135, 232, 0.04)",
      }}
    >
      {/* Subtle sync indicator at top */}
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#B4E4CE] via-[#C9E4F7] to-[#D4C5F9] animate-pulse" />
      )}

      <div 
        className="flex items-center justify-evenly px-1 overflow-visible" 
        style={{ 
          paddingTop: '0.5rem',
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
          minHeight: '64px'
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                "flex flex-col items-center justify-center flex-1 px-1 rounded-xl transition-all relative overflow-visible",
                "active:scale-95 touch-manipulation",
                item.active && "text-primary",
                !item.active &&
                  "text-muted-foreground hover:text-foreground",
              )}
              style={{
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem'
              }}
            >
              {/* Active indicator - positioned at top */}
              {item.active && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute w-10 h-1.5 bg-primary rounded-full"
                  style={{
                    top: '0.25rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                />
              )}
              
              {/* Icon */}
              <div className="relative flex items-center justify-center mb-1">
                <Icon className="w-6 h-6" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className="text-[8px] font-medium leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
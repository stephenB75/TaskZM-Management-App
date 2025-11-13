import React from "react";
import { Cloud, CloudOff, RefreshCw, Menu, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { useTasks } from "../contexts/TaskContext";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { cn } from "../lib/utils";
import logoImage from "../assets/taskzm-logo.png";

interface AppHeaderProps {
  title: string | React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  hideDesktopLogo?: boolean;
  onBack?: () => void;
  panelOpen?: boolean; // Indicates if a side panel is open (for desktop layout adjustment)
}

export function AppHeader({
  title,
  description,
  actions,
  hideDesktopLogo = false,
  onBack,
  panelOpen = false,
}: AppHeaderProps) {
  const { isSyncing, lastSync, workspaceId } = useTasks();
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  
  // Calculate left position: sidebar (64px) + panel (440px when open)
  const sidebarWidth = 64; // w-16 = 64px
  const panelWidth = 440;
  const headerLeft = panelOpen ? sidebarWidth + panelWidth : sidebarWidth;

  return (
    <>
      {/* Mobile Header - Fixed at top */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-sm px-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Back Button (if onBack provided) or Menu Button */}
            {onBack ? (
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-8 w-8 p-0"
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-8 w-8 p-0"
                onClick={toggleSidebar}
              >
                <Menu className="w-4 h-4" />
              </Button>
            )}

            {/* Title - Shows view title on mobile only */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent">
                {typeof title === 'string' ? title : title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Custom Actions */}
            <div className="flex items-center gap-1.5">
              {actions}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Header - Fixed at top, shifts when panel is open */}
      <motion.div 
        className="hidden md:block fixed top-0 right-0 z-40 border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-sm px-6 py-4"
        animate={{ 
          left: `${headerLeft}px`
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Back Button (if onBack provided) + Logo + Title/Description */}
          <div
            className={cn(
              "flex items-center min-w-0 flex-1",
              hideDesktopLogo ? "gap-3" : "gap-4",
            )}
          >
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 flex-shrink-0 -ml-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {!hideDesktopLogo && (
              <img
                src={logoImage}
                alt="TaskZM Logo"
                className="h-10 w-auto flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground uppercase tracking-wide text-sm">
                {typeof title === 'string' ? title : title}
              </h2>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          {/* Right side: Actions (switch + buttons) */}
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
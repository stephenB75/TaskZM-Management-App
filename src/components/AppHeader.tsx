import React, { useMemo } from "react";
import { Cloud, CloudOff, RefreshCw, Menu, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { useTasks } from "../contexts/TaskContext";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { 
  SIDEBAR_WIDTH, 
  PANEL_WIDTH, 
  HEADER_HEIGHT, 
  getMainHeaderLeft, 
  getMainHeaderWidth,
  HEADER_PADDING_X_MOBILE,
  HEADER_PADDING_Y_MOBILE,
  HEADER_PADDING_X_DESKTOP,
  HEADER_PADDING_Y_DESKTOP,
  HEADER_ICON_SIZE_SMALL,
  HEADER_BUTTON_SIZE,
  HEADER_LOGO_HEIGHT,
  HEADER_TITLE_SIZE_MOBILE,
  HEADER_TITLE_SIZE_DESKTOP,
  HEADER_DESCRIPTION_SIZE,
  HEADER_DESCRIPTION_MARGIN_TOP,
  HEADER_GAP_SMALL,
  HEADER_GAP_MEDIUM,
  HEADER_GAP_LARGE,
  HEADER_GAP_XLARGE,
  HEADER_Z_INDEX,
  HEADER_BACKGROUND_OPACITY,
  HEADER_ANIMATION_DAMPING,
  HEADER_ANIMATION_STIFFNESS,
  HEADER_BACKGROUND_LIGHT_COLOR,
  HEADER_BORDER_COLOR,
} from "../lib/layout-constants";
import {
  COLOR_GRADIENT_START,
  COLOR_GRADIENT_MID,
  COLOR_GRADIENT_END,
  getColorWithOpacity,
} from "../lib/color-theme";
import logoImage from "../assets/taskzm-logo.png";

interface AppHeaderProps {
  title: string | React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  hideDesktopLogo?: boolean;
  onBack?: () => void;
  panelOpen?: boolean; // Indicates if a side panel is open (for desktop layout adjustment)
  isSidePanelHeader?: boolean; // Indicates if this is a side panel header (positioned at panel start)
  panelKey?: string | number; // Key to track panel transitions for proper animation
}

export function AppHeader({
  title,
  description,
  actions,
  hideDesktopLogo = false,
  onBack,
  panelOpen = false,
  isSidePanelHeader = false,
  panelKey,
}: AppHeaderProps) {
  const { isSyncing, lastSync, workspaceId } = useTasks();
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  
  // Calculate left position and width using layout constants
  // - Side panel headers: positioned at sidebar width - start of panel
  // - Main header when panel open: sidebar + panel width
  // - Main header when panel closed: sidebar width only
  const headerLeft = useMemo(() => {
    if (isSidePanelHeader) {
      return SIDEBAR_WIDTH; // Side panel headers at start of panel
    }
    // Main header shifts when panel opens/closes - matches week view animation
    return getMainHeaderLeft(panelOpen);
  }, [isSidePanelHeader, panelOpen]);
  
  // Calculate header width to properly resize during panel transitions
  const headerWidth = useMemo(() => {
    if (isSidePanelHeader) {
      return undefined; // Side panel headers don't need width calculation
    }
    // Main header should span from left position to right edge
    return getMainHeaderWidth(panelOpen);
  }, [isSidePanelHeader, panelOpen]);

  return (
    <>
      {/* Mobile Header - Fixed at top */}
      <div 
        className="md:hidden fixed top-0 left-0 right-0 border-b backdrop-blur-lg shadow-sm dark:bg-gray-900/95"
        style={{
          zIndex: HEADER_Z_INDEX,
          backgroundColor: getColorWithOpacity(HEADER_BACKGROUND_LIGHT_COLOR, HEADER_BACKGROUND_OPACITY),
          borderColor: HEADER_BORDER_COLOR,
          paddingLeft: HEADER_PADDING_X_MOBILE,
          paddingRight: HEADER_PADDING_X_MOBILE,
          paddingTop: HEADER_PADDING_Y_MOBILE,
          paddingBottom: HEADER_PADDING_Y_MOBILE,
        }}
      >
        <div className="flex items-center justify-between" style={{ gap: HEADER_GAP_MEDIUM }}>
          <div className="flex items-center min-w-0 flex-1" style={{ gap: HEADER_GAP_MEDIUM }}>
            {/* Back Button (if onBack provided) or Menu Button */}
            {onBack ? (
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 p-0"
                style={{ height: HEADER_BUTTON_SIZE, width: HEADER_BUTTON_SIZE }}
                onClick={onBack}
              >
                <ArrowLeft style={{ width: HEADER_ICON_SIZE_SMALL, height: HEADER_ICON_SIZE_SMALL }} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 p-0"
                style={{ height: HEADER_BUTTON_SIZE, width: HEADER_BUTTON_SIZE }}
                onClick={toggleSidebar}
              >
                <Menu style={{ width: HEADER_ICON_SIZE_SMALL, height: HEADER_ICON_SIZE_SMALL }} />
              </Button>
            )}

            {/* Title - Shows view title on mobile only */}
            <div className="flex-1 min-w-0">
              <h1 
                className="font-bold bg-clip-text text-transparent"
                style={{
                  fontSize: HEADER_TITLE_SIZE_MOBILE,
                  backgroundImage: `linear-gradient(to right, ${COLOR_GRADIENT_START}, ${COLOR_GRADIENT_MID}, ${COLOR_GRADIENT_END})`,
                }}
              >
                {typeof title === 'string' ? title : title}
              </h1>
            </div>
          </div>

          <div className="flex items-center flex-shrink-0" style={{ gap: HEADER_GAP_SMALL }}>
            {/* Custom Actions */}
            <div className="flex items-center" style={{ gap: HEADER_GAP_SMALL }}>
              {actions}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Header - Side panel headers are relative, main header is fixed */}
      {isSidePanelHeader ? (
        // Side panel header - relative positioning, slides with panel, with fade animation
        <motion.div 
          className="hidden lg:block relative border-b backdrop-blur-lg shadow-sm flex-shrink-0 dark:bg-gray-900/95"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.3,
            ease: "easeOut",
            delay: 0.1
          }}
          style={{ 
            zIndex: HEADER_Z_INDEX,
            backgroundColor: getColorWithOpacity(HEADER_BACKGROUND_LIGHT_COLOR, HEADER_BACKGROUND_OPACITY),
            borderColor: HEADER_BORDER_COLOR,
            paddingLeft: HEADER_PADDING_X_DESKTOP,
            paddingRight: HEADER_PADDING_X_DESKTOP,
            paddingTop: HEADER_PADDING_Y_DESKTOP,
            paddingBottom: HEADER_PADDING_Y_DESKTOP,
            minHeight: `${HEADER_HEIGHT}px`, 
            height: `${HEADER_HEIGHT}px` 
          }}
        >
          <motion.div 
            className="flex items-center justify-between" 
            style={{ gap: HEADER_GAP_XLARGE }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            {/* Left side: Back Button (if onBack provided) + Logo + Title/Description */}
            <motion.div
              className="flex items-center min-w-0 flex-1"
              style={{ gap: hideDesktopLogo ? HEADER_GAP_LARGE : HEADER_GAP_XLARGE }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="flex-shrink-0 -ml-2"
                  style={{ height: HEADER_BUTTON_SIZE, width: HEADER_BUTTON_SIZE }}
                >
                  <ArrowLeft style={{ width: HEADER_ICON_SIZE_SMALL, height: HEADER_ICON_SIZE_SMALL }} />
                </Button>
              )}
              {!hideDesktopLogo && (
                <motion.img
                  src={logoImage}
                  alt="TaskZM Logo"
                  className="w-auto flex-shrink-0"
                  style={{ height: HEADER_LOGO_HEIGHT }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                />
              )}
              <motion.div 
                className="min-w-0"
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <h2 
                  className="font-semibold text-foreground uppercase tracking-wide"
                  style={{ fontSize: HEADER_TITLE_SIZE_DESKTOP }}
                >
                  {typeof title === 'string' ? title : title}
                </h2>
                {description && (
                  <p 
                    className="text-muted-foreground"
                    style={{ 
                      fontSize: HEADER_DESCRIPTION_SIZE,
                      marginTop: HEADER_DESCRIPTION_MARGIN_TOP,
                    }}
                  >
                    {description}
                  </p>
                )}
              </motion.div>
            </motion.div>
            {/* Right side: Actions (switch + buttons) */}
            {actions && (
              <motion.div 
                className="flex items-center flex-shrink-0" 
                style={{ gap: HEADER_GAP_MEDIUM }}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                {actions}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      ) : (
        // Main header - fixed positioning, shifts when panel is open (matches dashboard layout animation)
        // Uses same spring animation as week view/kanban to stay in sync
        <motion.div 
          className="hidden lg:block fixed top-0 border-b backdrop-blur-lg shadow-sm overflow-hidden dark:bg-gray-900/95"
          initial={false}
          animate={{
            left: `${headerLeft}px`,
            width: headerWidth,
          }}
          transition={{ 
            type: 'spring', 
            damping: HEADER_ANIMATION_DAMPING, 
            stiffness: HEADER_ANIMATION_STIFFNESS
          }}
          style={{ 
            zIndex: HEADER_Z_INDEX,
            backgroundColor: getColorWithOpacity(HEADER_BACKGROUND_LIGHT_COLOR, HEADER_BACKGROUND_OPACITY),
            borderColor: HEADER_BORDER_COLOR,
            paddingLeft: HEADER_PADDING_X_DESKTOP,
            paddingRight: HEADER_PADDING_X_DESKTOP,
            paddingTop: HEADER_PADDING_Y_DESKTOP,
            paddingBottom: HEADER_PADDING_Y_DESKTOP,
            minHeight: `${HEADER_HEIGHT}px`, 
            height: `${HEADER_HEIGHT}px`,
            right: 0,
          }}
        >
          {/* Static container for logo and title - prevents them from animating with the header */}
          <div 
            className="flex items-center justify-between"
            style={{ 
              gap: HEADER_GAP_XLARGE,
              height: '100%',
            }}
          >
            {/* Left side: Back Button (if onBack provided) + Logo + Title/Description - No animation on these elements */}
            <div
              className="flex items-center min-w-0 flex-1"
              style={{ gap: hideDesktopLogo ? HEADER_GAP_LARGE : HEADER_GAP_XLARGE }}
            >
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="flex-shrink-0 -ml-2"
                  style={{ height: HEADER_BUTTON_SIZE, width: HEADER_BUTTON_SIZE }}
                >
                  <ArrowLeft style={{ width: HEADER_ICON_SIZE_SMALL, height: HEADER_ICON_SIZE_SMALL }} />
                </Button>
              )}
              {!hideDesktopLogo && (
                <img
                  src={logoImage}
                  alt="TaskZM Logo"
                  className="w-auto flex-shrink-0"
                  style={{ height: HEADER_LOGO_HEIGHT }}
                />
              )}
              <div className="min-w-0">
                <h2 
                  className="font-semibold text-foreground uppercase tracking-wide"
                  style={{ fontSize: HEADER_TITLE_SIZE_DESKTOP }}
                >
                  {typeof title === 'string' ? title : title}
                </h2>
                {description && (
                  <p 
                    className="text-muted-foreground"
                    style={{ 
                      fontSize: HEADER_DESCRIPTION_SIZE,
                      marginTop: HEADER_DESCRIPTION_MARGIN_TOP,
                    }}
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>
            {/* Right side: Actions (switch + buttons) */}
            {actions && (
              <div className="flex items-center flex-shrink-0" style={{ gap: HEADER_GAP_MEDIUM }}>
                {actions}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
}
import React, { useState, useEffect, useRef } from "react";
import { Cloud, CloudOff, RefreshCw, Menu, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { useTasks } from "../contexts/TaskContext";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useTheme } from "../contexts/ThemeContext";
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
  HEADER_LOGO_HEIGHT_DESKTOP,
  HEADER_TITLE_SIZE_MOBILE,
  HEADER_TITLE_SIZE_DESKTOP,
  HEADER_DESCRIPTION_SIZE,
  HEADER_DESCRIPTION_MARGIN_TOP,
  HEADER_GAP_SMALL,
  HEADER_GAP_MEDIUM,
  HEADER_GAP_LARGE,
  HEADER_GAP_XLARGE,
  HEADER_SIDE_PANEL_PADDING_X,
  HEADER_SIDE_PANEL_GAP_MAIN,
  HEADER_SIDE_PANEL_GAP_LEFT,
  HEADER_SIDE_PANEL_GAP_RIGHT,
  HEADER_Z_INDEX,
  HEADER_BACKGROUND_OPACITY,
  HEADER_ANIMATION_DAMPING,
  HEADER_ANIMATION_STIFFNESS,
  HEADER_BACKGROUND_LIGHT_COLOR,
  HEADER_BACKGROUND_DARK_COLOR,
  HEADER_BORDER_COLOR,
  HEADER_BUTTON_NEGATIVE_MARGIN_LEFT,
  HEADER_SIDE_PANEL_ANIMATION_DURATION,
  HEADER_SIDE_PANEL_ANIMATION_DELAY_INITIAL,
  HEADER_SIDE_PANEL_ANIMATION_DELAY_CONTENT,
  HEADER_SIDE_PANEL_ANIMATION_DELAY_LEFT,
  HEADER_SIDE_PANEL_ANIMATION_DELAY_LOGO,
  HEADER_SIDE_PANEL_ANIMATION_DELAY_TITLE,
  HEADER_SIDE_PANEL_ANIMATION_DELAY_RIGHT,
  HEADER_SIDE_PANEL_ANIMATION_Y_OFFSET,
  HEADER_SIDE_PANEL_ANIMATION_X_OFFSET_LEFT,
  HEADER_SIDE_PANEL_ANIMATION_X_OFFSET_TITLE,
  HEADER_SIDE_PANEL_ANIMATION_X_OFFSET_RIGHT,
  HEADER_SIDE_PANEL_ANIMATION_SCALE_INITIAL,
  HEADER_SIDE_PANEL_ANIMATION_EASE,
  HEADER_MOBILE_SAFE_AREA_SPACER,
} from "../lib/layout-constants";
import {
  COLOR_GRADIENT_START,
  COLOR_GRADIENT_MID,
  COLOR_GRADIENT_END,
  getColorWithOpacity,
} from "../lib/color-theme";
import { cn } from "../lib/utils";
import logoImageColor from "../assets/Taskzm_Logo_BLK-removebg.png"; // Black logo version

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
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // Use state to force re-render when panelOpen, panelKey, or theme changes
  // This ensures the header position and theme updates immediately
  const [headerUpdateKey, setHeaderUpdateKey] = useState(0);
  const prevPanelKeyRef = useRef(panelKey);
  const prevPanelOpenRef = useRef(panelOpen);
  const prevThemeRef = useRef(actualTheme);
  
  // Update state immediately when panelOpen changes to force re-render
  useEffect(() => {
    if (prevPanelOpenRef.current !== panelOpen) {
      setHeaderUpdateKey(prev => prev + 1);
      prevPanelOpenRef.current = panelOpen;
    }
  }, [panelOpen]);
  
  // Also update when panelKey changes (even if panelOpen stays the same)
  // This ensures header re-renders when switching between panels
  useEffect(() => {
    if (prevPanelKeyRef.current !== panelKey) {
      setHeaderUpdateKey(prev => prev + 1);
      prevPanelKeyRef.current = panelKey;
    }
  }, [panelKey]);
  
  // Update when theme changes to force immediate re-render with new colors
  useEffect(() => {
    if (prevThemeRef.current !== actualTheme) {
      setHeaderUpdateKey(prev => prev + 1);
      prevThemeRef.current = actualTheme;
    }
  }, [actualTheme]);
  
  // Calculate left position and width using layout constants
  // - Side panel headers: positioned at sidebar width - start of panel
  // - Main header when panel open: sidebar + panel width
  // - Main header when panel closed: sidebar width only
  // Use panelOpen prop directly (not currentPanelOpen) to ensure we always have the latest value
  // The key prop and headerUpdateKey ensure React re-renders when needed
  const headerLeft = isSidePanelHeader 
    ? SIDEBAR_WIDTH // Side panel headers at start of panel
    : getMainHeaderLeft(panelOpen); // Main header shifts instantly when panel opens/closes

  // Calculate header width to properly resize during panel transitions
  const headerWidth = isSidePanelHeader 
    ? undefined // Side panel headers don't need width calculation
    : getMainHeaderWidth(panelOpen); // Main header should span from left position to right edge

  return (
    <>
      {/* Mobile Header - Fixed at top (always shown on mobile) */}
      <div 
        key={`mobile-header-${actualTheme}`}
        className="md:hidden fixed left-0 right-0 border-b backdrop-blur-lg shadow-sm"
        style={{
          position: 'fixed', // Explicitly set position to ensure it's fixed
          top: 0, // Start at top of viewport - no gap above
          left: 0,
          right: 0,
          margin: 0, // Ensure no margin creates gap above
          zIndex: HEADER_Z_INDEX,
          backgroundColor: isDark 
            ? getColorWithOpacity(HEADER_BACKGROUND_DARK_COLOR, HEADER_BACKGROUND_OPACITY)
            : getColorWithOpacity(HEADER_BACKGROUND_LIGHT_COLOR, HEADER_BACKGROUND_OPACITY),
          borderColor: HEADER_BORDER_COLOR,
          paddingLeft: HEADER_PADDING_X_MOBILE,
          paddingRight: HEADER_PADDING_X_MOBILE,
          // Add safe area inset to top padding to account for notched devices
          // Header extends into safe area, content is pushed down below notch
          paddingTop: `calc(${HEADER_PADDING_Y_MOBILE} + env(safe-area-inset-top, 0px))`,
          paddingBottom: HEADER_PADDING_Y_MOBILE,
          // Height includes safe area inset at top so header fills entire space including safe area
          minHeight: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`,
          height: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`,
          maxHeight: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`, // Prevent header from growing beyond set height
          boxSizing: 'border-box', // Include border in height calculation
          overflow: 'hidden', // Prevent content overflow
          transition: 'none', // Disable transitions for instant theme updates
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
      {/* Desktop/Tablet Header - Side panel headers are relative, main header is fixed */}
      {isSidePanelHeader ? (
        // Side panel header - relative positioning, slides with panel, with fade animation
        <motion.div 
          className="hidden md:block relative border-b backdrop-blur-lg shadow-sm flex-shrink-0"
          initial={{ opacity: 0, y: HEADER_SIDE_PANEL_ANIMATION_Y_OFFSET }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: HEADER_SIDE_PANEL_ANIMATION_DURATION,
            ease: HEADER_SIDE_PANEL_ANIMATION_EASE,
            delay: HEADER_SIDE_PANEL_ANIMATION_DELAY_INITIAL
          }}
          style={{ 
            zIndex: HEADER_Z_INDEX,
            backgroundColor: isDark 
              ? getColorWithOpacity(HEADER_BACKGROUND_DARK_COLOR, HEADER_BACKGROUND_OPACITY)
              : getColorWithOpacity(HEADER_BACKGROUND_LIGHT_COLOR, HEADER_BACKGROUND_OPACITY),
            borderColor: HEADER_BORDER_COLOR,
            paddingLeft: HEADER_SIDE_PANEL_PADDING_X,
            paddingRight: HEADER_SIDE_PANEL_PADDING_X,
            paddingTop: HEADER_PADDING_Y_DESKTOP,
            paddingBottom: HEADER_PADDING_Y_DESKTOP,
            minHeight: `${HEADER_HEIGHT}px`, 
            height: `${HEADER_HEIGHT}px`,
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <motion.div 
            className="flex items-center justify-between" 
            style={{ gap: HEADER_SIDE_PANEL_GAP_MAIN }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: HEADER_SIDE_PANEL_ANIMATION_DURATION + 0.1, delay: HEADER_SIDE_PANEL_ANIMATION_DELAY_CONTENT }}
          >
            {/* Left side: Back Button (if onBack provided) + Logo + Title/Description */}
            <motion.div
              className="flex items-center min-w-0 flex-1"
              style={{ gap: HEADER_SIDE_PANEL_GAP_LEFT }}
              initial={{ opacity: 0, x: HEADER_SIDE_PANEL_ANIMATION_X_OFFSET_LEFT }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: HEADER_SIDE_PANEL_ANIMATION_DURATION, delay: HEADER_SIDE_PANEL_ANIMATION_DELAY_LEFT }}
            >
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="flex-shrink-0"
                  style={{ 
                    height: HEADER_BUTTON_SIZE, 
                    width: HEADER_BUTTON_SIZE,
                    marginLeft: HEADER_BUTTON_NEGATIVE_MARGIN_LEFT
                  }}
                >
                  <ArrowLeft style={{ width: HEADER_ICON_SIZE_SMALL, height: HEADER_ICON_SIZE_SMALL }} />
                </Button>
              )}
              {!hideDesktopLogo && (
                <motion.img
                  src={logoImageColor}
                  alt="TaskZM Logo"
                  className={cn(
                    "w-auto flex-shrink-0",
                    isDark && "dark-logo-filter"
                  )}
                  style={{ 
                    height: HEADER_LOGO_HEIGHT,
                    backgroundColor: 'transparent',
                  }}
                  initial={{ opacity: 0, scale: HEADER_SIDE_PANEL_ANIMATION_SCALE_INITIAL }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: HEADER_SIDE_PANEL_ANIMATION_DURATION, delay: HEADER_SIDE_PANEL_ANIMATION_DELAY_LOGO }}
                />
              )}
              <motion.div 
                className="min-w-0"
                initial={{ opacity: 0, x: HEADER_SIDE_PANEL_ANIMATION_X_OFFSET_TITLE }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: HEADER_SIDE_PANEL_ANIMATION_DURATION, delay: HEADER_SIDE_PANEL_ANIMATION_DELAY_TITLE }}
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
                style={{ gap: HEADER_SIDE_PANEL_GAP_RIGHT }}
                initial={{ opacity: 0, x: HEADER_SIDE_PANEL_ANIMATION_X_OFFSET_RIGHT }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: HEADER_SIDE_PANEL_ANIMATION_DURATION, delay: HEADER_SIDE_PANEL_ANIMATION_DELAY_RIGHT }}
              >
                {actions}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      ) : (
        // Main header - fixed positioning, shifts instantly when panel opens/closes (no animation)
        // Follows week view code sequence - responds to panel push/retract without animation
        // Use key prop based on panelOpen prop, panelKey, and updateKey to force re-render when panel state changes
        // Include panelOpen in key to ensure React unmounts/remounts when state changes
        <div 
          key={`main-header-${String(panelOpen)}-${String(panelKey || 'default')}-${actualTheme}-${headerUpdateKey}`}
          className="hidden md:block fixed top-0 border-b backdrop-blur-lg shadow-sm overflow-hidden"
          style={{ 
            zIndex: HEADER_Z_INDEX,
            backgroundColor: isDark 
              ? getColorWithOpacity(HEADER_BACKGROUND_DARK_COLOR, HEADER_BACKGROUND_OPACITY)
              : getColorWithOpacity(HEADER_BACKGROUND_LIGHT_COLOR, HEADER_BACKGROUND_OPACITY),
            backgroundImage: isDark
              ? 'linear-gradient(90deg, rgba(31,41,55,0.92) 0%, rgba(17,24,39,0.9) 50%, rgba(31,41,55,0.92) 100%)'
              : 'linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(248,244,255,0.94) 50%, rgba(255,255,255,0.96) 100%)',
            borderColor: HEADER_BORDER_COLOR,
            paddingLeft: HEADER_PADDING_X_DESKTOP,
            paddingRight: HEADER_PADDING_X_DESKTOP,
            paddingTop: HEADER_PADDING_Y_DESKTOP,
            paddingBottom: HEADER_PADDING_Y_DESKTOP,
            minHeight: `${HEADER_HEIGHT}px`, 
            height: `${HEADER_HEIGHT}px`,
            left: `${headerLeft}px`,
            width: headerWidth,
            right: 0,
            // Explicitly disable any CSS transitions to ensure instant updates
            transition: 'none',
            willChange: 'left, width, background-color', // Include background-color for theme changes
          }}
        >
          {/* Static container for logo and title - no animations */}
          <div 
            className="flex items-center justify-between h-full"
            style={{ 
              gap: HEADER_GAP_XLARGE,
            }}
          >
            {/* Left side: Back Button (if onBack provided) + Logo + Title/Description - No animations */}
            <div
              className="flex items-center min-w-0 flex-1"
              style={{ gap: hideDesktopLogo ? HEADER_GAP_LARGE : HEADER_GAP_XLARGE }}
            >
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="flex-shrink-0"
                  style={{ 
                    height: HEADER_BUTTON_SIZE, 
                    width: HEADER_BUTTON_SIZE,
                    marginLeft: HEADER_BUTTON_NEGATIVE_MARGIN_LEFT
                  }}
                >
                  <ArrowLeft style={{ width: HEADER_ICON_SIZE_SMALL, height: HEADER_ICON_SIZE_SMALL }} />
                </Button>
              )}
              {!hideDesktopLogo && (
                <img
                  src={logoImageColor}
                  alt="TaskZM Logo"
                  className={cn(
                    "w-auto flex-shrink-0 object-contain self-center",
                    isDark && "dark-logo-filter"
                  )}
                  style={{ 
                    height: HEADER_LOGO_HEIGHT_DESKTOP,
                    maxHeight: '100%',
                    backgroundColor: 'transparent',
                    display: 'block',
                  }}
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
        </div>
      )}
    </>
  );
}
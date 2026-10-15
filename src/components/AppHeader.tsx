import React, { useState, useEffect } from "react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
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
  HEADER_HEIGHT, 
  getMainHeaderLeft, 
  HEADER_PADDING_X_MOBILE,
  HEADER_PADDING_Y_MOBILE,
  HEADER_PADDING_X_DESKTOP,
  HEADER_PADDING_Y_DESKTOP,
  HEADER_CONTENT_PADDING_LEFT_MOBILE,
  HEADER_CONTENT_PADDING_LEFT_DESKTOP,
  HEADER_ICON_SIZE_SMALL,
  HEADER_ICON_SIZE_SMALL_SCREEN,
  HEADER_ICON_SIZE_BUTTON_SMALL,
  HEADER_ICON_SIZE_BUTTON_DESKTOP,
  HEADER_ICON_MARGIN_SMALL,
  HEADER_ICON_MARGIN_DESKTOP,
  HEADER_BUTTON_SIZE,
  HEADER_BUTTON_SIZE_SMALL_SCREEN,
  HEADER_BUTTON_PADDING_X_SMALL,
  HEADER_BUTTON_PADDING_Y_SMALL,
  HEADER_BUTTON_TEXT_SIZE_SMALL,
  HEADER_BUTTON_SCALE_SMALL,
  HEADER_MIN_WIDTH_SMALL,
  HEADER_MIN_WIDTH_DESKTOP,
  HEADER_LOGO_HEIGHT,
  HEADER_LOGO_HEIGHT_DESKTOP,
  HEADER_LOGO_SCALE,
  HEADER_LOGO_SPACE_RATIO,
  HEADER_LOGO_DISPLAY_OPACITY,
  HEADER_BORDER_BOTTOM,
  HEADER_TITLE_SIZE_MOBILE,
  HEADER_TITLE_SIZE_DESKTOP,
  HEADER_TITLE_SIZE_SMALL_SCREEN,
  HEADER_DESCRIPTION_SIZE,
  HEADER_DESCRIPTION_SIZE_SMALL_SCREEN,
  HEADER_DESCRIPTION_MARGIN_TOP,
  HEADER_GAP_SMALL,
  HEADER_GAP_MEDIUM,
  HEADER_GAP_LARGE,
  HEADER_GAP_XLARGE,
  HEADER_GAP_XSMALL,
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
  HEADER_SIDE_PANEL_ANIMATION_DURATION_CONTENT,
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
  DESKTOP_SIDE_PANEL_SPRING_ENTER,
  DESKTOP_SIDE_PANEL_EXIT_SECONDS,
  DESKTOP_SIDE_PANEL_EXIT_EASE,
  HEADER_MOBILE_SAFE_AREA_SPACER,
  VIEWPORT_BREAKPOINTS,
  HEADER_BACKDROP_BLUR_CLASS,
} from "../lib/layout-constants";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { useOrientation } from "../hooks/useOrientation";
import { getColorWithOpacity, COLOR_TEXT_WHITE, COLOR_BADGE_RED } from "../lib/color-theme";
import { NAV_BAR_BADGE_SIZE, NAV_BAR_BADGE_TEXT_SIZE } from "../lib/layout-constants";
import { NAVIGATION_UI_TEXT } from "../lib/navigation-constants";
import { NOTIFICATIONS_SHEET_OPEN_EVENT, BADGE_DISPLAY_MAX } from "../lib/notification-constants";
import { triggerSelectionHaptic } from "../lib/native-haptics";
import { useNotifications } from "../contexts/NotificationContext";
import { cn } from "../lib/utils";
import logoImageBlack from "../assets/Taskzm_Logo_BLK-removebg.png"; // Black logo version
import logoImageGray from "../assets/taskzm-logo-gray.png"; // Gray logo version for dark mode

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
  const { badgeCount } = useNotifications();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const shouldUseMobileLayout = useMobileLayout(); // Determine if device should use mobile layout (includes tablets)
  const orientation = useOrientation(); // Detect landscape/portrait orientation
  const isLandscape = orientation === 'landscape';
  
  // Detect laptop/small screen (1024px - 1279px) and small desktop (1280px - 1439px) for responsive logo sizing
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isSmallMonitor, setIsSmallMonitor] = useState(false);
  const [isSmallDesktop, setIsSmallDesktop] = useState(false);
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsSmallScreen(width >= VIEWPORT_BREAKPOINTS.tablet && width < VIEWPORT_BREAKPOINTS.desktop);
      setIsSmallMonitor(width >= VIEWPORT_BREAKPOINTS.tablet && width < VIEWPORT_BREAKPOINTS.desktop);
      // Small desktop: 1280px - 1439px (tablet/laptop/smaller screens view - slightly smaller logo)
      setIsSmallDesktop(width >= VIEWPORT_BREAKPOINTS.desktop && width < VIEWPORT_BREAKPOINTS.largeDesktop);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  // Logo scale: laptop (1024-1279), laptop landscape, small desktop (1280-largeDesktop-1), full desktop (largeDesktop+)
  const logoScale = isSmallMonitor && isLandscape ? HEADER_LOGO_SCALE.laptopLandscape : isSmallMonitor ? HEADER_LOGO_SCALE.laptop : isSmallDesktop ? HEADER_LOGO_SCALE.smallDesktop : HEADER_LOGO_SCALE.desktop;

  const headerLeft = isSidePanelHeader 
    ? SIDEBAR_WIDTH
    : getMainHeaderLeft(panelOpen);

  const headerSurfaceStyle: React.CSSProperties = {
    backgroundColor: isDark
      ? getColorWithOpacity(HEADER_BACKGROUND_DARK_COLOR, HEADER_BACKGROUND_OPACITY)
      : getColorWithOpacity(HEADER_BACKGROUND_LIGHT_COLOR, HEADER_BACKGROUND_OPACITY),
    borderColor: HEADER_BORDER_COLOR,
  };

  const mobileHeaderIconStyle: React.CSSProperties = {
    width: HEADER_BUTTON_SIZE,
    height: HEADER_BUTTON_SIZE,
    minWidth: HEADER_BUTTON_SIZE,
    minHeight: HEADER_BUTTON_SIZE,
    padding: 0,
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
  };

  return (
    <>
      {/* Mobile/Tablet Header - Fixed at top (shown on mobile and tablets < 1280px) */}
      <div 
        key={`mobile-header-${actualTheme}`}
        className={shouldUseMobileLayout ? cn("fixed left-0 right-0 border-b", HEADER_BACKDROP_BLUR_CLASS) : "hidden"}
        style={{
          position: 'fixed', // Explicitly set position to ensure it's fixed
          top: 0, // Start at top of viewport - no gap above
          left: 0,
          right: 0,
          margin: 0, // Ensure no margin creates gap above
          zIndex: HEADER_Z_INDEX,
          ...headerSurfaceStyle,
          paddingLeft: '0', // No left padding - header extends to left browser edge
          paddingRight: HEADER_PADDING_X_MOBILE, // Keep original right padding
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
        <div className="flex items-center justify-between" style={{ gap: HEADER_GAP_MEDIUM, paddingLeft: HEADER_CONTENT_PADDING_LEFT_MOBILE }}>
          <div className="flex items-center min-w-0 flex-1" style={{ gap: HEADER_GAP_MEDIUM }}>
            {/* Back Button (if onBack provided) or Menu Button */}
            <button
              type="button"
              aria-label={onBack ? 'Back' : 'Open menu'}
              className="inline-flex flex-shrink-0 items-center justify-center bg-transparent text-foreground"
              style={mobileHeaderIconStyle}
              onClick={() => {
                void triggerSelectionHaptic();
                (onBack ?? toggleSidebar)();
              }}
            >
              <Icon name={onBack ? 'arrow-left' : 'menu'} size={HEADER_ICON_SIZE_BUTTON_DESKTOP} />
            </button>

            {/* Title - contextual; compact when description is shown */}
            <div className="flex-1 min-w-0">
              <h1
                className="font-semibold text-foreground normal-case tracking-normal leading-tight truncate"
                style={{ fontSize: HEADER_TITLE_SIZE_MOBILE }}
              >
                {typeof title === 'string' ? title : title}
              </h1>
              {description && (
                <p
                  className="text-muted-foreground normal-case tracking-normal font-medium"
                  style={{
                    fontSize: HEADER_DESCRIPTION_SIZE_SMALL_SCREEN,
                    marginTop: 2,
                    lineHeight: 1.2,
                  }}
                >
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center flex-shrink-0" style={{ gap: HEADER_GAP_MEDIUM }}>
            <button
              type="button"
              aria-label="Add task"
              onClick={() => window.dispatchEvent(new CustomEvent('taskzm-add-task'))}
              className="inline-flex items-center justify-center bg-transparent font-semibold text-foreground"
              style={mobileHeaderIconStyle}
            >
              <Icon name="plus" size={HEADER_ICON_SIZE_BUTTON_DESKTOP} />
            </button>
            <button
              type="button"
              aria-label={NAVIGATION_UI_TEXT.notifications}
              data-tour="header-notifications"
              onClick={() => {
                void triggerSelectionHaptic();
                window.dispatchEvent(new CustomEvent(NOTIFICATIONS_SHEET_OPEN_EVENT));
              }}
              data-alert={badgeCount > 0 ? "true" : undefined}
              className="taskzm-bell relative inline-flex items-center justify-center bg-transparent text-foreground"
              style={mobileHeaderIconStyle}
            >
              <Icon name="bell" size={HEADER_ICON_SIZE_BUTTON_DESKTOP} />
              {badgeCount > 0 && (
                <span
                  className="absolute flex items-center justify-center rounded-full font-bold"
                  style={{
                    color: COLOR_TEXT_WHITE,
                    backgroundColor: COLOR_BADGE_RED,
                    fontSize: NAV_BAR_BADGE_TEXT_SIZE,
                    width: NAV_BAR_BADGE_SIZE,
                    height: NAV_BAR_BADGE_SIZE,
                    top: 0,
                    right: 0,
                  }}
                >
                  {badgeCount > BADGE_DISPLAY_MAX ? `${BADGE_DISPLAY_MAX}+` : badgeCount}
                </span>
              )}
            </button>
            {shouldUseMobileLayout && actions ? (
              <div className="contents">{actions}</div>
            ) : null}
          </div>
        </div>
      </div>
      {/* Desktop Header - Side panel headers are relative, main header is fixed (only shown on desktop >= 1280px) */}
      {isSidePanelHeader ? (
        // Side panel header - relative positioning, slides with panel, with fade animation
        <motion.div 
          className={shouldUseMobileLayout ? "hidden" : cn("relative border-b flex-shrink-0", HEADER_BACKDROP_BLUR_CLASS)}
          initial={{ opacity: 0, y: HEADER_SIDE_PANEL_ANIMATION_Y_OFFSET }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: HEADER_SIDE_PANEL_ANIMATION_DURATION,
            ease: HEADER_SIDE_PANEL_ANIMATION_EASE,
            delay: HEADER_SIDE_PANEL_ANIMATION_DELAY_INITIAL
          }}
          style={{ 
            zIndex: HEADER_Z_INDEX,
            ...headerSurfaceStyle,
            // No horizontal padding - header extends to panel edge
            paddingLeft: '0',
            paddingRight: '0',
            paddingTop: isSmallMonitor && isLandscape ? '0.375rem' : HEADER_PADDING_Y_DESKTOP,
            paddingBottom: isSmallMonitor && isLandscape ? '0.375rem' : HEADER_PADDING_Y_DESKTOP,
            minHeight: `${HEADER_HEIGHT}px`, 
            height: `${HEADER_HEIGHT}px`,
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <motion.div 
            className="flex items-center justify-between" 
            style={{ gap: HEADER_SIDE_PANEL_GAP_MAIN, paddingLeft: isSmallMonitor && isLandscape ? '0.75rem' : HEADER_SIDE_PANEL_PADDING_X, paddingRight: isSmallMonitor && isLandscape ? '0.75rem' : HEADER_SIDE_PANEL_PADDING_X }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: HEADER_SIDE_PANEL_ANIMATION_DURATION_CONTENT, delay: HEADER_SIDE_PANEL_ANIMATION_DELAY_CONTENT }}
          >
            {/* Left side: Back Button (if onBack provided) + Logo + Title/Description */}
            <motion.div
              className="flex items-center min-w-0 flex-1"
              style={{ 
                gap: isSmallMonitor && isLandscape 
                  ? HEADER_GAP_SMALL 
                  : HEADER_SIDE_PANEL_GAP_LEFT,
                flexShrink: 1, // Allow container to shrink
                minWidth: 0, // Allow flex items to shrink below content size
              }}
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
                    // Responsive button size: smaller for small monitors
                    height: isSmallMonitor ? HEADER_BUTTON_SIZE_SMALL_SCREEN : HEADER_BUTTON_SIZE, 
                    width: isSmallMonitor ? HEADER_BUTTON_SIZE_SMALL_SCREEN : HEADER_BUTTON_SIZE,
                    marginLeft: HEADER_BUTTON_NEGATIVE_MARGIN_LEFT
                  }}
                >
                  <Icon 
                    name="arrow-left" 
                    size={isSmallMonitor ? HEADER_ICON_SIZE_SMALL_SCREEN : HEADER_ICON_SIZE_SMALL} 
                  />
                </Button>
              )}
              {!hideDesktopLogo && (
                <motion.img
                  src={isDark ? logoImageGray : logoImageBlack}
                  alt="TaskZM Logo"
                  className="object-contain"
                  style={{ 
                    // Responsive logo: tablet/laptop/small desktop use HEADER_LOGO_SCALE
                    height: `calc(${HEADER_LOGO_HEIGHT} * ${logoScale})`,
                    maxWidth: `${Math.round(150 * logoScale)}px`,
                    width: 'auto',
                    backgroundColor: 'transparent',
                    flexShrink: 1,
                    minWidth: 0,
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
                  style={{ 
                    // Responsive title size: smaller for small monitors
                    fontSize: isSmallMonitor ? HEADER_TITLE_SIZE_SMALL_SCREEN : HEADER_TITLE_SIZE_DESKTOP 
                  }}
                >
                  {typeof title === 'string' ? title : title}
                </h2>
                {description && (
                  <p 
                    className="text-muted-foreground"
                    style={{ 
                      // Responsive description size: smaller for small monitors
                      fontSize: isSmallMonitor ? HEADER_DESCRIPTION_SIZE_SMALL_SCREEN : HEADER_DESCRIPTION_SIZE,
                      marginTop: HEADER_DESCRIPTION_MARGIN_TOP,
                    }}
                  >
                    {description}
                  </p>
                )}
              </motion.div>
            </motion.div>
            {/* Right side: Actions (switch + buttons) — side panel headers only */}
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
        <motion.div 
          key={`main-header-${actualTheme}`}
          className={shouldUseMobileLayout ? "hidden" : cn("fixed top-0 border-b overflow-hidden", HEADER_BACKDROP_BLUR_CLASS)}
          animate={{ left: headerLeft }}
          transition={
            panelOpen
              ? DESKTOP_SIDE_PANEL_SPRING_ENTER
              : { duration: DESKTOP_SIDE_PANEL_EXIT_SECONDS, ease: DESKTOP_SIDE_PANEL_EXIT_EASE }
          }
          style={{ 
            zIndex: HEADER_Z_INDEX,
            ...headerSurfaceStyle,
            backgroundImage: 'none',
            paddingLeft: '0',
            paddingRight: isSmallMonitor && isLandscape ? '1rem' : (isSmallMonitor ? '1.25rem' : HEADER_PADDING_X_DESKTOP),
            paddingTop: isSmallMonitor && isLandscape ? '0.375rem' : (isSmallMonitor ? HEADER_PADDING_Y_DESKTOP : HEADER_PADDING_Y_DESKTOP),
            paddingBottom: isSmallMonitor && isLandscape ? '0.375rem' : (isSmallMonitor ? HEADER_PADDING_Y_DESKTOP : HEADER_PADDING_Y_DESKTOP),
            minHeight: `${HEADER_HEIGHT}px`, 
            height: `${HEADER_HEIGHT}px`,
            right: 0,
            willChange: 'left',
          }}
        >
          {/* Static container for logo and title - no animations */}
          <div 
            className="flex h-full items-center"
            style={{
              paddingLeft: isSmallMonitor && isLandscape ? '1rem' : (isSmallMonitor ? '1.25rem' : HEADER_CONTENT_PADDING_LEFT_DESKTOP), // Left side internal spacing only 
              // Responsive gap: smaller for small monitors and landscape
              gap: isSmallMonitor && isLandscape 
                ? HEADER_GAP_XSMALL 
                : (isSmallMonitor 
                  ? HEADER_GAP_SMALL 
                  : HEADER_GAP_LARGE),
              justifyContent: 'space-between',
            }}
          >
            {/* Left side: logo (brand mark only — no duplicate text) */}
            <div
              className="flex items-center min-w-0"
              style={{ 
                gap: hideDesktopLogo 
                  ? (isSmallMonitor && isLandscape 
                      ? HEADER_GAP_SMALL 
                      : (isSmallMonitor 
                        ? HEADER_GAP_MEDIUM 
                        : HEADER_GAP_LARGE))
                  : (isSmallMonitor && isLandscape 
                      ? HEADER_GAP_SMALL 
                      : HEADER_GAP_MEDIUM),
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="flex-shrink-0"
                  style={{ 
                    // Responsive button size: smaller for small monitors
                    height: isSmallMonitor ? HEADER_BUTTON_SIZE_SMALL_SCREEN : HEADER_BUTTON_SIZE, 
                    width: isSmallMonitor ? HEADER_BUTTON_SIZE_SMALL_SCREEN : HEADER_BUTTON_SIZE,
                    marginLeft: HEADER_BUTTON_NEGATIVE_MARGIN_LEFT
                  }}
                >
                  <Icon 
                    name="arrow-left" 
                    size={isSmallMonitor ? HEADER_ICON_SIZE_SMALL_SCREEN : HEADER_ICON_SIZE_SMALL} 
                  />
                </Button>
              )}
              {!hideDesktopLogo && (
                <img
                  key={`header-logo-${isDark ? 'dark' : 'light'}`}
                  src={isDark ? logoImageGray : logoImageBlack}
                  alt="TaskZM Logo"
                  className="object-contain self-center"
                  style={{ 
                    // Responsive logo: tablet/laptop/small desktop use HEADER_LOGO_SCALE (shifts with header when panel open)
                    height: `calc(${HEADER_LOGO_HEIGHT_DESKTOP} * ${logoScale})`,
                    maxHeight: `calc(${HEADER_HEIGHT}px - ${HEADER_PADDING_Y_DESKTOP} - ${HEADER_PADDING_Y_DESKTOP} - ${HEADER_BORDER_BOTTOM}px)`,
                    maxWidth: `${Math.round(160 * logoScale)}px`,
                    width: 'auto',
                    backgroundColor: 'transparent',
                    display: 'block',
                    objectFit: 'contain',
                    flexShrink: 0,
                    minWidth: 0,
                    transition: 'none',
                    opacity: HEADER_LOGO_DISPLAY_OPACITY,
                  }}
                />
              )}
            </div>
            {/* Right side: Actions (desktop layout only — avoid duplicate data-tour nodes in DOM) */}
            {!shouldUseMobileLayout && (
              <div 
                className="flex items-center min-w-0"
                data-tour-header-actions="desktop"
                style={{ 
                  gap: isSmallMonitor && isLandscape 
                    ? HEADER_GAP_XSMALL 
                    : (isSmallMonitor 
                      ? HEADER_GAP_XSMALL 
                      : HEADER_GAP_MEDIUM),
                  justifyContent: 'flex-end',
                  flexShrink: 1,
                  flexBasis: 'auto',
                  minWidth: 0,
                }}
              >
                <button
                  type="button"
                  aria-label="Add task"
                  onClick={() => window.dispatchEvent(new CustomEvent('taskzm-add-task'))}
                  className="inline-flex items-center bg-transparent font-semibold text-foreground"
                  style={{
                    minHeight: HEADER_BUTTON_SIZE,
                    border: 'none',
                    paddingTop: HEADER_BUTTON_PADDING_Y_SMALL,
                    paddingBottom: HEADER_BUTTON_PADDING_Y_SMALL,
                    paddingLeft: HEADER_BUTTON_PADDING_X_SMALL,
                    paddingRight: HEADER_BUTTON_PADDING_X_SMALL,
                  }}
                >
                  <Icon name="plus" size={HEADER_ICON_SIZE_BUTTON_DESKTOP} />
                </button>
                <button
                  type="button"
                  aria-label={NAVIGATION_UI_TEXT.ai}
                  onClick={() => window.dispatchEvent(new CustomEvent('taskzm-open-ai'))}
                  className="inline-flex items-center bg-transparent font-semibold text-primary"
                  style={{
                    minHeight: HEADER_BUTTON_SIZE,
                    border: 'none',
                    paddingTop: HEADER_BUTTON_PADDING_Y_SMALL,
                    paddingBottom: HEADER_BUTTON_PADDING_Y_SMALL,
                    paddingLeft: HEADER_BUTTON_PADDING_X_SMALL,
                    paddingRight: HEADER_BUTTON_PADDING_X_SMALL,
                    gap: HEADER_GAP_XSMALL,
                  }}
                >
                  {NAVIGATION_UI_TEXT.ai}
                </button>
                {actions}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
}
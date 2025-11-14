/**
 * Layout constants for consistent spacing and sizing across the application
 * These values are used by the header, panels, and dashboard components
 */

// Sidebar width (matches Tailwind w-16 = 64px)
export const SIDEBAR_WIDTH = 64;

// Side panel width (matches panel animation width in App.tsx)
export const PANEL_WIDTH = 440;

// Header height (matches header minHeight/height in AppHeader.tsx and padding in App.tsx)
export const HEADER_HEIGHT = 73;

// Calculate main header left position when panel is open
export const getMainHeaderLeft = (panelOpen: boolean): number => {
  return panelOpen ? SIDEBAR_WIDTH + PANEL_WIDTH : SIDEBAR_WIDTH;
};

// Calculate main header width
export const getMainHeaderWidth = (panelOpen: boolean): string => {
  const left = getMainHeaderLeft(panelOpen);
  return `calc(100% - ${left}px)`;
};

// Bottom Navigation Bar constants
export const NAV_BAR_HEIGHT = 70; // minHeight in pixels (increased to accommodate lower positioning)
export const NAV_BAR_PADDING_TOP = '0.5rem'; // Reduced top padding to move content down
export const NAV_BAR_PADDING_BOTTOM = '1rem'; // Increased bottom padding to push content down
export const NAV_BAR_BUTTON_PADDING_TOP = '0.25rem'; // Reduced button top padding
export const NAV_BAR_BUTTON_PADDING_BOTTOM = '0.5rem'; // Increased button bottom padding
export const NAV_BAR_ICON_SIZE = '2rem'; // w-8 h-8 = 2rem
export const NAV_BAR_ICON_MARGIN_TOP_ACTIVE = '0.25rem'; // Reduced to move icons down
export const NAV_BAR_ICON_MARGIN_TOP_INACTIVE = '0.25rem'; // Reduced to move icons down
export const NAV_BAR_INDICATOR_WIDTH = '2rem';
export const NAV_BAR_INDICATOR_TOP = '-0.5rem'; // Keep indicator above icon
export const NAV_BAR_INDICATOR_MARGIN_LEFT = '-1rem';
export const NAV_BAR_LABEL_TEXT_SIZE = '11px';
export const NAV_BAR_LABEL_MARGIN_TOP = '0.25rem';
export const NAV_BAR_BADGE_SIZE = '1rem'; // w-4 h-4 = 1rem
export const NAV_BAR_BADGE_TEXT_SIZE = '8px';
export const NAV_BAR_BADGE_BORDER_WIDTH = '2px';
export const NAV_BAR_ANIMATION_DURATION = 0.3;
export const NAV_BAR_ANIMATION_STIFFNESS = 500;
export const NAV_BAR_ANIMATION_DAMPING = 30;
export const NAV_BAR_HAPTIC_DURATION = 10; // milliseconds


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
export const NAV_BAR_HEIGHT = 112; // Increased by 30% from 86px to 112px (30% increase: 86 * 1.3 = 111.8, rounded to 112)
export const NAV_BAR_PADDING_TOP = '0.625rem'; // Slightly increased to accommodate indicator above icon
export const NAV_BAR_PADDING_BOTTOM = '0.5rem'; // Balanced bottom padding (safe area handled separately)
export const NAV_BAR_BUTTON_PADDING_TOP = '0.25rem'; // Reduced button top padding to fit components
export const NAV_BAR_BUTTON_PADDING_BOTTOM = '0.25rem'; // Reduced button bottom padding to fit components
export const NAV_BAR_ICON_SIZE = '2rem'; // w-8 h-8 = 2rem
export const NAV_BAR_ICON_MARGIN_TOP_ACTIVE = '0.3rem'; // 15% of icon size (2rem * 0.15 = 0.3rem) - moved down by 15%
export const NAV_BAR_ICON_MARGIN_TOP_INACTIVE = '0.3rem'; // 15% of icon size (2rem * 0.15 = 0.3rem) - moved down by 15%
export const NAV_BAR_INDICATOR_WIDTH = '2rem';
export const NAV_BAR_INDICATOR_TOP = '-0.5rem'; // Keep indicator above icon
export const NAV_BAR_INDICATOR_MARGIN_LEFT = '-1rem';
export const NAV_BAR_LABEL_TEXT_SIZE = '11px';
export const NAV_BAR_LABEL_MARGIN_TOP = '0.125rem'; // Reduced margin for tighter spacing
export const NAV_BAR_BADGE_SIZE = '1rem'; // w-4 h-4 = 1rem
export const NAV_BAR_BADGE_TEXT_SIZE = '8px';
export const NAV_BAR_BADGE_BORDER_WIDTH = '2px';
export const NAV_BAR_BADGE_TOP_OFFSET = '-0.25rem'; // -top-1 = -0.25rem
export const NAV_BAR_BADGE_RIGHT_OFFSET = '-0.25rem'; // -right-1 = -0.25rem
export const NAV_BAR_INDICATOR_HEIGHT = '0.375rem'; // h-1.5 = 0.375rem
export const NAV_BAR_SYNC_INDICATOR_HEIGHT = '0.125rem'; // h-0.5 = 0.125rem
export const NAV_BAR_HORIZONTAL_PADDING = '0.25rem'; // px-1 = 0.25rem
export const NAV_BAR_ACTIVE_SCALE = 0.95; // scale-95 = 0.95
export const NAV_BAR_INITIAL_Y_OFFSET = 100; // Initial animation offset in pixels
export const NAV_BAR_ANIMATION_DURATION = 0.3;
export const NAV_BAR_ANIMATION_STIFFNESS = 500;
export const NAV_BAR_ANIMATION_DAMPING = 30;
export const NAV_BAR_HAPTIC_DURATION = 10; // milliseconds

// Panel constants (for side panels like Team, Folders, etc.)
export const PANEL_PADDING = '1rem'; // p-4 = 1rem
export const PANEL_PADDING_TOP = '1rem'; // pt-4 = 1rem
export const PANEL_PADDING_BOTTOM = '1rem'; // pb-4 = 1rem
export const PANEL_PADDING_LEFT = '1rem'; // pl-4 = 1rem
export const PANEL_PADDING_RIGHT = '1rem'; // pr-4 = 1rem
export const PANEL_PADDING_TOP_MOBILE = '1.5rem'; // pt-6 = 1.5rem
export const PANEL_PADDING_TOP_DESKTOP = '1rem'; // lg:pt-4 = 1rem
export const PANEL_CONTENT_SPACING = '0.75rem'; // space-y-3 = 0.75rem
export const PANEL_SECTION_SPACING = '1rem'; // space-y-4 = 1rem
export const PANEL_FIELD_SPACING = '0.5rem'; // space-y-2 = 0.5rem
export const PANEL_GAP_SMALL = '0.375rem'; // gap-1.5 = 0.375rem
export const PANEL_GAP_MEDIUM = '0.5rem'; // gap-2 = 0.5rem
export const PANEL_GAP_LARGE = '0.75rem'; // gap-3 = 0.75rem

// Team Panel specific constants
export const TEAM_PANEL_AVATAR_SIZE = '3rem'; // w-12 h-12 = 3rem
export const TEAM_PANEL_AVATAR_BORDER_WIDTH = '2px'; // border-2 = 2px
export const TEAM_PANEL_ICON_SIZE_SMALL = '0.75rem'; // w-3 h-3 = 0.75rem
export const TEAM_PANEL_ICON_SIZE_MEDIUM = '1rem'; // w-4 h-4 = 1rem
export const TEAM_PANEL_ICON_SIZE_LARGE = '3rem'; // w-12 h-12 = 3rem
export const TEAM_PANEL_BUTTON_SIZE = '2rem'; // h-8 w-8 = 2rem
export const TEAM_PANEL_BUTTON_SIZE_SMALL = '1.75rem'; // h-7 w-7 = 1.75rem
export const TEAM_PANEL_DROPDOWN_WIDTH = '12rem'; // w-48 = 12rem
export const TEAM_PANEL_ROLE_BORDER_WIDTH = '0.25rem'; // w-1 = 0.25rem
export const TEAM_PANEL_NOTIFICATION_BADGE_SIZE = '0.5rem'; // w-2 h-2 = 0.5rem
export const TEAM_PANEL_NOTIFICATION_DOT_SIZE = '0.75rem'; // w-3 h-3 = 0.75rem
export const TEAM_PANEL_NOTIFICATION_DOT_BORDER_WIDTH = '2px'; // border-2 = 2px
export const TEAM_PANEL_CARD_PADDING = '1rem'; // p-4 = 1rem
export const TEAM_PANEL_CARD_PADDING_LEFT = '1.25rem'; // pl-5 = 1.25rem
export const TEAM_PANEL_SEARCH_ICON_SIZE = '1rem'; // w-4 h-4 = 1rem
export const TEAM_PANEL_EMPTY_STATE_ICON_SIZE = '3rem'; // w-12 h-12 = 3rem
export const TEAM_PANEL_MOBILE_HEADER_SPACER = '64px'; // h-[64px] = 64px
export const TEAM_PANEL_BOTTOM_PADDING_MOBILE = 'calc(6rem + env(safe-area-inset-bottom, 0px))';
export const TEAM_PANEL_DROPDOWN_Z_INDEX = 9999; // z-[9999]
export const TEAM_PANEL_NOTIFICATION_Z_INDEX = 20; // z-20
export const TEAM_PANEL_DROPDOWN_TRIGGER_Z_INDEX = 50; // z-50
export const TEAM_PANEL_TEXT_SIZE_SMALL = '0.75rem'; // text-xs = 0.75rem
export const TEAM_PANEL_TEXT_SIZE_MEDIUM = '0.875rem'; // text-sm = 0.875rem
export const TEAM_PANEL_MARGIN_BOTTOM_SMALL = '0.25rem'; // mb-1 = 0.25rem
export const TEAM_PANEL_MARGIN_BOTTOM_MEDIUM = '0.5rem'; // mb-2 = 0.5rem
export const TEAM_PANEL_MARGIN_BOTTOM_LARGE = '0.75rem'; // mb-3 = 0.75rem
export const TEAM_PANEL_MARGIN_BOTTOM_XLARGE = '1rem'; // mb-4 = 1rem
export const TEAM_PANEL_MARGIN_TOP_SMALL = '0.5rem'; // mt-2 = 0.5rem
export const TEAM_PANEL_MARGIN_RIGHT_SMALL = '0.25rem'; // mr-1 = 0.25rem
export const TEAM_PANEL_MARGIN_RIGHT_MEDIUM = '0.5rem'; // mr-2 = 0.5rem
export const TEAM_PANEL_TEXTAREA_MIN_HEIGHT = '120px'; // min-h-[120px] = 120px
export const TEAM_PANEL_TEXTAREA_ROWS = 6;

// Workspace constants (for workspace creation, loading, and management)
export const WORKSPACE_MAX_RETRIES = 3; // Maximum number of retry attempts for workspace loading
export const WORKSPACE_RETRY_DELAY_BASE_MS = 1000; // Base delay in milliseconds for exponential backoff (1 second)
export const WORKSPACE_TOAST_DURATION_MS = 5000; // Toast notification duration in milliseconds (5 seconds)
export const WORKSPACE_NAME_FALLBACK = 'User'; // Fallback name when user name is not available
export const WORKSPACE_NAME_SUFFIX = "'s Workspace"; // Suffix appended to user name for workspace name
export const WORKSPACE_SYNC_INTERVAL_MS = 300000; // Auto-sync interval in milliseconds (5 minutes)

// Settings Panel constants
export const SETTINGS_PANEL_MOBILE_HEADER_SPACER = '64px'; // h-[64px] = 64px
export const SETTINGS_PANEL_BOTTOM_PADDING_MOBILE = 'calc(6rem + env(safe-area-inset-bottom, 0px))';
export const SETTINGS_PANEL_PADDING_TOP = '1rem'; // pt-4 = 1rem
export const SETTINGS_PANEL_CONTAINER_PADDING_SMALL = '1rem'; // p-4 = 1rem
export const SETTINGS_PANEL_CONTAINER_PADDING_MEDIUM = '1.5rem'; // sm:p-6 = 1.5rem
export const SETTINGS_PANEL_CONTAINER_PADDING_LARGE = '2rem'; // md:p-8 = 2rem
export const SETTINGS_PANEL_MAX_WIDTH = '42rem'; // max-w-2xl = 42rem
export const SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X = '1rem'; // px-4 = 1rem
export const SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_SMALL = '0.5rem'; // py-2 = 0.5rem
export const SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_DESKTOP = '0'; // md:py-0 = 0
export const SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y = '0.5rem'; // my-2 = 0.5rem (mobile)
export const SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y_MEDIUM = '0.375rem'; // sm:my-1.5 = 0.375rem
export const SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y_DESKTOP = '1rem'; // Increased spacing for desktop view (md:my-4 = 1rem)
export const SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y = '1rem'; // py-4 = 1rem
export const SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM = '1rem'; // pb-4 = 1rem
export const SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP = '0.5rem'; // pt-2 = 0.5rem
export const SETTINGS_PANEL_ACCORDION_CONTENT_SPACING = '1rem'; // space-y-4 = 1rem
export const SETTINGS_PANEL_ICON_SIZE_SMALL = '0.75rem'; // w-3 h-3 = 0.75rem
export const SETTINGS_PANEL_ICON_SIZE_MEDIUM = '1rem'; // w-4 h-4 = 1rem
export const SETTINGS_PANEL_ICON_SIZE_LARGE = '1.25rem'; // w-5 h-5 = 1.25rem
export const SETTINGS_PANEL_ICON_SIZE_XLARGE = '2rem'; // w-8 h-8 = 2rem
export const SETTINGS_PANEL_ICON_SIZE_EXTRA_SMALL = '0.875rem'; // w-3.5 h-3.5 = 0.875rem
export const SETTINGS_PANEL_AVATAR_SIZE = '4rem'; // w-16 h-16 = 4rem
export const SETTINGS_PANEL_INPUT_HEIGHT = '2.25rem'; // h-9 = 2.25rem
export const SETTINGS_PANEL_BADGE_HEIGHT = '1rem'; // h-4 = 1rem
export const SETTINGS_PANEL_GAP_SMALL = '0.5rem'; // gap-2 = 0.5rem
export const SETTINGS_PANEL_GAP_MEDIUM = '0.75rem'; // gap-3 = 0.75rem
export const SETTINGS_PANEL_GAP_LARGE = '1rem'; // gap-4 = 1rem
export const SETTINGS_PANEL_SPACING_XSMALL = '0.25rem'; // space-y-1 = 0.25rem
export const SETTINGS_PANEL_SPACING_SMALL = '0.5rem'; // space-y-2 = 0.5rem
export const SETTINGS_PANEL_SPACING_MEDIUM = '0.75rem'; // space-y-3 = 0.75rem
export const SETTINGS_PANEL_SPACING_LARGE = '1rem'; // space-y-4 = 1rem
export const SETTINGS_PANEL_TEXT_SIZE_XSMALL = '0.625rem'; // text-[10px] = 0.625rem
export const SETTINGS_PANEL_TEXT_SIZE_SMALL = '0.75rem'; // text-xs = 0.75rem
export const SETTINGS_PANEL_TEXT_SIZE_MEDIUM = '0.875rem'; // text-sm = 0.875rem
export const SETTINGS_PANEL_MARGIN_TOP_XSMALL = '0.125rem'; // mt-0.5 = 0.125rem
export const SETTINGS_PANEL_MARGIN_TOP_SMALL = '0.25rem'; // mt-1 = 0.25rem
export const SETTINGS_PANEL_MARGIN_BOTTOM_SMALL = '0.25rem'; // mb-1 = 0.25rem
export const SETTINGS_PANEL_MARGIN_BOTTOM_MEDIUM = '0.75rem'; // mb-3 = 0.75rem
export const SETTINGS_PANEL_MARGIN_RIGHT_SMALL = '0.5rem'; // mr-2 = 0.5rem
export const SETTINGS_PANEL_MARGIN_RIGHT_XSMALL = '0.25rem'; // mr-1 = 0.25rem
export const SETTINGS_PANEL_MARGIN_LEFT_SMALL = '0.5rem'; // ml-2 = 0.5rem
export const SETTINGS_PANEL_PADDING_SMALL = '0.625rem'; // p-2.5 = 0.625rem
export const SETTINGS_PANEL_PADDING_MEDIUM = '0.75rem'; // p-3 = 0.75rem
export const SETTINGS_PANEL_PADDING_LARGE = '1rem'; // p-4 = 1rem
export const SETTINGS_PANEL_PADDING_Y_SMALL = '0.25rem'; // py-1 = 0.25rem
export const SETTINGS_PANEL_TOAST_DURATION_MS = 5000; // Toast duration in milliseconds (5 seconds)
export const SETTINGS_PANEL_TIMEOUT_DELAY_MS = 100; // Timeout delay in milliseconds (100ms)


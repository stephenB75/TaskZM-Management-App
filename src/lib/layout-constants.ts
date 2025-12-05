/**
 * Layout constants for consistent spacing and sizing across the application
 * These values are used by the header, panels, and dashboard components
 */

// Sidebar width (matches Tailwind w-16 = 64px)
export const SIDEBAR_WIDTH = 64;

// Side panel width (matches panel animation width in App.tsx)
export const PANEL_WIDTH = 440;
export const PANEL_WIDTH_TABLET = 360; // Narrower for tablets
export const PANEL_WIDTH_SMALL_MONITOR = 400; // Slightly narrower for small monitors

// Header height (matches header minHeight/height in AppHeader.tsx and padding in App.tsx)
export const HEADER_HEIGHT = 73;

// Header-specific constants
export const HEADER_PADDING_X_MOBILE = '0.75rem'; // px-3 = 0.75rem (12px)
export const HEADER_PADDING_Y_MOBILE = '1rem'; // py-4 = 1rem (16px)
export const HEADER_PADDING_X_DESKTOP = '1.5rem'; // px-6 = 1.5rem (24px)
export const HEADER_PADDING_Y_DESKTOP = '1rem'; // py-4 = 1rem (16px)
export const HEADER_ICON_SIZE_SMALL = '1rem'; // w-4 h-4 = 1rem (16px)
export const HEADER_BUTTON_SIZE = '2rem'; // h-8 w-8 = 2rem (32px)
export const HEADER_LOGO_HEIGHT = '2.5rem'; // h-10 = 2.5rem (40px)
export const HEADER_TITLE_SIZE_MOBILE = '1.25rem'; // text-xl = 1.25rem (20px)
export const HEADER_TITLE_SIZE_DESKTOP = '0.875rem'; // text-sm = 0.875rem (14px)
export const HEADER_DESCRIPTION_SIZE = '0.75rem'; // text-xs = 0.75rem (12px)
export const HEADER_DESCRIPTION_MARGIN_TOP = '0.125rem'; // mt-0.5 = 0.125rem (2px)
export const HEADER_GAP_SMALL = '0.375rem'; // gap-1.5 = 0.375rem (6px)
export const HEADER_GAP_MEDIUM = '0.5rem'; // gap-2 = 0.5rem (8px)
export const HEADER_GAP_LARGE = '0.75rem'; // gap-3 = 0.75rem (12px)
export const HEADER_GAP_XLARGE = '1rem'; // gap-4 = 1rem (16px)
export const HEADER_Z_INDEX = 40; // z-40 = 40
export const HEADER_BACKGROUND_OPACITY = 0.95; // bg-white/95 = 95% opacity
export const HEADER_BACKGROUND_LIGHT_COLOR = '#FFFFFF';
export const HEADER_BACKGROUND_DARK_COLOR = 'rgba(17, 24, 39, 0.95)';
export const HEADER_BORDER_COLOR = 'rgba(148, 163, 184, 0.2)';
export const HEADER_ANIMATION_DAMPING = 30; // Spring animation damping
export const HEADER_ANIMATION_STIFFNESS = 300; // Spring animation stiffness
export const HEADER_BUTTON_NEGATIVE_MARGIN_LEFT = '-0.5rem'; // -ml-2 = -0.5rem
export const HEADER_SIDE_PANEL_ANIMATION_DURATION = 0.3; // Side panel header fade animation duration
export const HEADER_SIDE_PANEL_ANIMATION_DELAY_INITIAL = 0.1; // Initial delay for side panel header
export const HEADER_SIDE_PANEL_ANIMATION_DELAY_CONTENT = 0.15; // Delay for content fade in
export const HEADER_SIDE_PANEL_ANIMATION_DELAY_LEFT = 0.2; // Delay for left side elements
export const HEADER_SIDE_PANEL_ANIMATION_DELAY_LOGO = 0.25; // Delay for logo animation
export const HEADER_SIDE_PANEL_ANIMATION_DELAY_TITLE = 0.3; // Delay for title animation
export const HEADER_SIDE_PANEL_ANIMATION_DELAY_RIGHT = 0.2; // Delay for right side elements
export const HEADER_SIDE_PANEL_ANIMATION_Y_OFFSET = -10; // Initial Y offset for side panel header
export const HEADER_SIDE_PANEL_ANIMATION_X_OFFSET_LEFT = -10; // X offset for left side elements
export const HEADER_SIDE_PANEL_ANIMATION_X_OFFSET_TITLE = -5; // X offset for title
export const HEADER_SIDE_PANEL_ANIMATION_X_OFFSET_RIGHT = 10; // X offset for right side elements
export const HEADER_SIDE_PANEL_ANIMATION_SCALE_INITIAL = 0.9; // Initial scale for logo
export const HEADER_SIDE_PANEL_ANIMATION_EASE = 'easeOut'; // Easing function for side panel animations
export const HEADER_MOBILE_SPACER_HEIGHT = '1.75rem'; // h-7 = 1.75rem (28px) - spacer for mobile header
export const HEADER_MOBILE_SPACER_HEIGHT_PX = 28; // h-7 = 28px - for calculations
// Spacer that accounts for header height and safe-area inset
// Header uses box-sizing: border-box, so HEADER_HEIGHT includes the border
// Add a buffer (4px) to account for any rounding, line-height issues, or border rendering
export const HEADER_MOBILE_SAFE_AREA_SPACER = `calc(${HEADER_HEIGHT}px + 4px + env(safe-area-inset-top, 0px))`; // Header height (including border) + buffer + safe area

// Viewport Breakpoints (matching Tailwind defaults)
export const VIEWPORT_BREAKPOINTS = {
  mobile: 768, // md breakpoint
  tablet: 1024, // lg breakpoint
  desktop: 1280, // xl breakpoint
} as const;

// Timeline Constants
export const TIMELINE_PADDING = {
  mobile: 27.6, // Timeline padding on mobile
  desktop: 16, // Timeline padding on desktop
} as const;

// Mobile Text Sizes (increased by 1 point for better readability)
export const MOBILE_TEXT_SIZES = {
  xsmall: 11, // text-[11px] (was 10px)
  small: 12, // text-[12px] (was 11px)
  base: 13, // text-[13px] (was 12px)
} as const;

// Mobile Spacing
export const MOBILE_SPACING = {
  contentPadding: {
    x: {
      mobile: 16, // px-4 = 16px
      tablet: 24, // sm:px-6 = 24px
    },
    y: {
      top: {
        mobile: 8, // pt-2 = 8px
        tablet: 16, // sm:pt-4 = 16px
      },
      bottom: {
        mobile: 24, // pb-6 = 24px
        tablet: 32, // sm:pb-8 = 32px
      },
    },
  },
  emptyStateMinHeight: 200, // min-h-[200px] = 200px
} as const;

// Calculate panel width based on viewport
export const getPanelWidth = (): number => {
  if (typeof window === 'undefined') return PANEL_WIDTH;
  const width = window.innerWidth;
  if (width >= 768 && width < 1024) {
    return PANEL_WIDTH_TABLET;
  } else if (width >= 1024 && width < 1280) {
    return PANEL_WIDTH_SMALL_MONITOR;
  }
  return PANEL_WIDTH;
};

// Calculate main header left position when panel is open
export const getMainHeaderLeft = (panelOpen: boolean): number => {
  const panelWidth = getPanelWidth();
  return panelOpen ? SIDEBAR_WIDTH + panelWidth : SIDEBAR_WIDTH;
};

// Calculate main header width
export const getMainHeaderWidth = (panelOpen: boolean): string => {
  const left = getMainHeaderLeft(panelOpen);
  return `calc(100% - ${left}px)`;
};

// Bottom Navigation Bar constants
export const NAV_BAR_HEIGHT = 112; // Increased by 30% from 86px to 112px (30% increase: 86 * 1.3 = 111.8, rounded to 112)
export const NAV_BAR_PADDING_TOP = '0.5rem'; // Balanced top padding
export const NAV_BAR_PADDING_BOTTOM = '0.5rem'; // Balanced bottom padding (safe area handled separately)
export const NAV_BAR_BUTTON_PADDING_TOP = '0.375rem'; // Button top padding
export const NAV_BAR_BUTTON_PADDING_BOTTOM = '0.375rem'; // Button bottom padding
export const NAV_BAR_ICON_SIZE = '2rem'; // w-8 h-8 = 2rem
export const NAV_BAR_ICON_MARGIN_TOP_ACTIVE = '2.25rem'; // Center icons vertically within nav bar
export const NAV_BAR_ICON_MARGIN_TOP_INACTIVE = '2.25rem'; // Center icons vertically within nav bar
export const NAV_BAR_INDICATOR_WIDTH = '2rem';
export const NAV_BAR_INDICATOR_TOP = '-0.5rem'; // Keep indicator above icon (moves with icon)
export const NAV_BAR_INDICATOR_MARGIN_LEFT = '-1rem';
export const NAV_BAR_LABEL_TEXT_SIZE = '11px';
export const NAV_BAR_LABEL_MARGIN_TOP = '0.375rem'; // Increased margin for better spacing between icon and label
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
export const NAV_BAR_BUTTON_TRANSITION_DURATION = 100; // milliseconds (duration-100 = 100ms)
export const NAV_BAR_SHADOW_OPACITY_LIGHT = 0.08; // Shadow opacity for lighter shadow
export const NAV_BAR_SHADOW_OPACITY_DARK = 0.04; // Shadow opacity for darker shadow
export const NAV_BAR_SHADOW_BLUR_LARGE = 24; // Large blur radius in pixels
export const NAV_BAR_SHADOW_BLUR_SMALL = 8; // Small blur radius in pixels
export const NAV_BAR_SHADOW_OFFSET_Y_LARGE = -4; // Large vertical offset in pixels
export const NAV_BAR_SHADOW_OFFSET_Y_SMALL = -2; // Small vertical offset in pixels

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
export const TEAM_PANEL_MOBILE_HEADER_SPACER = '10px'; // h-[10px]
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
export const TEAM_PANEL_BADGE_PADDING_X = '0.5rem'; // px-2 = 0.5rem
export const TEAM_PANEL_BADGE_PADDING_Y = '0.125rem'; // py-0.5 = 0.125rem
export const TEAM_PANEL_TEXTAREA_PADDING_X = '0.75rem'; // px-3 = 0.75rem
export const TEAM_PANEL_TEXTAREA_PADDING_Y = '0.5rem'; // py-2 = 0.5rem
export const TEAM_PANEL_SEARCH_CLEAR_BUTTON_RIGHT = '0.25rem'; // right-1 = 0.25rem
export const TEAM_PANEL_CONTENT_PADDING_TOP_OFFSET = '0.5rem'; // Additional padding top offset

// Folder Panel specific constants
export const FOLDER_PANEL_MOBILE_HEADER_SPACER = '10px'; // h-[10px]
export const FOLDER_PANEL_SEARCH_PADDING_TOP = '1.25rem'; // pt-5 = 1.25rem
export const FOLDER_PANEL_SEARCH_PADDING_BOTTOM = '0.75rem'; // pb-3 = 0.75rem
export const FOLDER_PANEL_SEARCH_PADDING_TOP_DESKTOP = '1rem'; // lg:pt-4 = 1rem
export const FOLDER_PANEL_CONTENT_PADDING_TOP = '1.25rem'; // pt-5 = 1.25rem
export const FOLDER_PANEL_CONTENT_PADDING_TOP_DESKTOP = '1rem'; // lg:pt-4 = 1rem
export const FOLDER_PANEL_EMPTY_STATE_PADDING_Y = '3rem'; // py-12 = 3rem
export const FOLDER_PANEL_EMPTY_STATE_ICON_SIZE = '3rem'; // w-12 h-12 = 3rem
export const FOLDER_PANEL_EMPTY_STATE_ICON_MARGIN_BOTTOM = '0.75rem'; // mb-3 = 0.75rem
export const FOLDER_PANEL_CARD_HEADER_PADDING_BOTTOM = '0.75rem'; // pb-3 = 0.75rem
export const FOLDER_PANEL_CARD_HEADER_PADDING_TOP = '1rem'; // pt-4 = 1rem
export const FOLDER_PANEL_CARD_HEADER_PADDING_LEFT = '1.25rem'; // pl-5 = 1.25rem
export const FOLDER_PANEL_CARD_CONTENT_PADDING_BOTTOM = '1rem'; // pb-4 = 1rem
export const FOLDER_PANEL_CARD_CONTENT_PADDING_LEFT = '1.25rem'; // pl-5 = 1.25rem
export const FOLDER_PANEL_FOLDER_ICON_SIZE = '2.5rem'; // w-10 h-10 = 2.5rem
export const FOLDER_PANEL_FOLDER_ICON_INNER_SIZE = '1.25rem'; // w-5 h-5 = 1.25rem
export const FOLDER_PANEL_BUTTON_SIZE = '2rem'; // h-8 w-8 = 2rem
export const FOLDER_PANEL_BUTTON_SIZE_SMALL = '1.75rem'; // h-7 w-7 = 1.75rem
export const FOLDER_PANEL_DROPDOWN_WIDTH = '12rem'; // w-48 = 12rem
export const FOLDER_PANEL_DROPDOWN_Z_INDEX = 9999; // z-[9999]
export const FOLDER_PANEL_COLOR_PICKER_SIZE = '2rem'; // w-8 h-8 = 2rem
export const FOLDER_PANEL_SEARCH_ICON_LEFT = '0.75rem'; // left-3 = 0.75rem
export const FOLDER_PANEL_SEARCH_INPUT_PADDING_LEFT = '2.25rem'; // pl-9 = 2.25rem
export const FOLDER_PANEL_SEARCH_CLEAR_BUTTON_RIGHT = '0.25rem'; // right-1 = 0.25rem
export const FOLDER_PANEL_CARD_TITLE_MARGIN_BOTTOM = '0.25rem'; // mb-1 = 0.25rem
export const FOLDER_PANEL_BADGE_PADDING_X = '0.5rem'; // px-2 = 0.5rem
export const FOLDER_PANEL_BADGE_PADDING_Y = '0.125rem'; // py-0.5 = 0.125rem
export const FOLDER_PANEL_BADGE_TEXT_SIZE = '0.75rem'; // text-xs = 0.75rem
export const FOLDER_PANEL_TEXT_SIZE_MEDIUM = '1rem'; // text-base = 1rem (16px)
export const FOLDER_PANEL_ICON_SIZE_SMALL = '1rem'; // w-4 h-4 = 1rem
export const FOLDER_PANEL_ICON_MARGIN_RIGHT = '0.5rem'; // mr-2 = 0.5rem
export const FOLDER_PANEL_DIALOG_MAX_WIDTH = '28rem'; // sm:max-w-md = 28rem
export const FOLDER_PANEL_DIALOG_CONTENT_SPACING = '1rem'; // space-y-4 = 1rem
export const FOLDER_PANEL_DIALOG_FIELD_SPACING = '0.5rem'; // space-y-2 = 0.5rem
export const FOLDER_PANEL_DIALOG_PADDING_Y = '1rem'; // py-4 = 1rem
export const FOLDER_PANEL_COLOR_PICKER_GAP = '0.5rem'; // gap-2 = 0.5rem

// Common Panel Constants (for both Folder and Team panels)
export const PANEL_DROPDOWN_TIMEOUT_DELAY_MS = 150; // Timeout delay for dropdown menu actions (150ms)
export const PANEL_SEARCH_BAR_PADDING_TOP = '1rem'; // pt-4 = 1rem
export const PANEL_SEARCH_BAR_PADDING_BOTTOM = '0.75rem'; // pb-3 = 0.75rem
export const PANEL_SEARCH_ICON_POSITION_LEFT = '0.75rem'; // left-3 = 0.75rem
export const PANEL_SEARCH_INPUT_PADDING_LEFT = '2.25rem'; // pl-9 = 2.25rem
export const PANEL_EMPTY_STATE_PADDING_Y = '3rem'; // py-12 = 3rem
export const PANEL_EMPTY_STATE_TEXT_SIZE = '0.875rem'; // text-sm = 0.875rem

// Workspace constants (for workspace creation, loading, and management)
export const WORKSPACE_MAX_RETRIES = 3; // Maximum number of retry attempts for workspace loading
export const WORKSPACE_RETRY_DELAY_BASE_MS = 1000; // Base delay in milliseconds for exponential backoff (1 second)
export const WORKSPACE_TOAST_DURATION_MS = 5000; // Toast notification duration in milliseconds (5 seconds)
export const WORKSPACE_NAME_FALLBACK = 'User'; // Fallback name when user name is not available
export const WORKSPACE_NAME_SUFFIX = "'s Workspace"; // Suffix appended to user name for workspace name
export const WORKSPACE_SYNC_INTERVAL_MS = 600000; // Default auto-sync interval in milliseconds (10 minutes) - DEPRECATED: Use ACTIVE/IDLE intervals
export const WORKSPACE_SYNC_INTERVAL_ACTIVE_MS = 30000; // Active sync interval (30 seconds) when user is actively using the app - reduced for better cross-device sync
export const WORKSPACE_SYNC_INTERVAL_IDLE_MS = 120000; // Idle sync interval (2 minutes) when user is inactive - reduced for better cross-device sync
export const WORKSPACE_SYNC_INTERVAL_MAX_MS = 300000; // Maximum auto-sync backoff interval (5 minutes) to avoid hammering Supabase
export const WORKSPACE_SYNC_NO_CHANGE_THRESHOLD = 3; // Number of consecutive no-change syncs before increasing interval
export const WORKSPACE_ACTIVITY_TIMEOUT_MS = 120000; // Timeout to consider user inactive (2 minutes) - reduced to switch to idle faster
export const WORKSPACE_NETWORK_ERROR_THRESHOLD = 2; // Number of consecutive network errors before backing off
export const WORKSPACE_NETWORK_ERROR_BACKOFF_BASE_MS = 60000; // Base backoff time for network errors (1 minute)
export const WORKSPACE_NETWORK_ERROR_BACKOFF_MAX_MS = 600000; // Maximum backoff time for network errors (10 minutes)

// Settings Panel constants
export const SETTINGS_PANEL_MOBILE_HEADER_SPACER = '10px'; // h-[10px]
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
export const SETTINGS_PANEL_START_TOUR_ICON_SIZE = '0.8rem'; // 20% smaller than standard medium icon
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
export const SETTINGS_PANEL_START_TOUR_BUTTON_HEIGHT = '1.6rem'; // 20% smaller than default h-8 (2rem)
export const SETTINGS_PANEL_START_TOUR_BUTTON_PADDING_X = '0.6rem'; // 20% smaller than default px-3 (0.75rem)
export const SETTINGS_PANEL_START_TOUR_BUTTON_GAP = '0.4rem'; // 20% smaller than default 0.5rem gap
export const SETTINGS_PANEL_START_TOUR_FONT_SIZE = '0.7rem'; // Slightly smaller text for compact button
export const SETTINGS_PANEL_TOAST_DURATION_MS = 5000; // Toast duration in milliseconds (5 seconds)
export const SETTINGS_PANEL_TIMEOUT_DELAY_MS = 100; // Timeout delay in milliseconds (100ms)

// App Icon and Theme Colors
export const APP_THEME_COLOR_PRIMARY = '#9B87E8'; // TaskZM purple/lavender (primary theme color)
export const APP_THEME_COLOR_SECONDARY = '#9D87C3'; // TaskZM purple/lavender (secondary theme color for manifest)
export const APP_BACKGROUND_COLOR = '#F5F3FF'; // TaskZM light purple background
export const APP_TEXT_FALLBACK_COLOR = '#7B68EE'; // Text fallback color for loading screen

// Toast Notification Durations (in milliseconds)
export const TOAST_DURATION_DEFAULT_MS = 6000; // Default toast duration (6 seconds)
export const TOAST_DURATION_SHORT_MS = 3000; // Short toast duration (3 seconds)
export const TOAST_DURATION_MEDIUM_MS = 4000; // Medium toast duration (4 seconds)
export const TOAST_DURATION_LONG_MS = 5000; // Long toast duration (5 seconds)
export const TOAST_DURATION_EXTRA_LONG_MS = 10000; // Extra long toast duration (10 seconds)

// App Metadata
export const APP_TITLE = 'TaskZM - A neurodivergent-friendly task management application with AI-assisted planning.';
export const APP_DESCRIPTION = 'TaskZM - A neurodivergent-friendly task management application with AI-assisted planning.';
export const APP_SHORT_NAME = 'TaskZM';
export const APP_FULL_NAME = 'TaskZM - Neurodivergent-Friendly Task Manager';

// Z-Index Constants
export const Z_INDEX = {
  SELECT_CONTENT: 200, // z-[200] - Used in TaskDialog SelectContent (13 instances)
  BADGE: 3, // z-[3] - Used in DraggableTodayAgendaTask for badge
  TIMELINE_LINE: 1, // z-[1] - Used in DraggableTodayAgendaTask for timeline line
  DROPDOWN: 9999, // z-[9999] - Used in Team/Folder panels dropdowns
  CONFETTI: 9999, // z-[9999] - Used in Confetti component
  APP_TOUR: 10000, // z-[10000] - Used in AppTour overlay
  DROP_ZONE: 100, // z-100 - Used in TodayAgendaView for drop zone overlay
  TIME_INDICATOR: 50, // z-50 - Used in TodayAgendaView for current time indicator
  DRAG_DROP: 99999, // z-99999 - Used in DragDropContext for drag overlay
  NAVIGATION_MENU: 1, // z-[1] - Used in navigation-menu component
} as const;

// Max Height Constants
export const MAX_HEIGHT = {
  SELECT: 60, // max-h-60 - Used in TaskDialog for SelectContent
} as const;

// Dialog Dimensions
export const DIALOG_DIMENSIONS = {
  taskDialog: {
    maxWidth: 'max-w-3xl lg:max-w-4xl',
    maxHeight: 'max-h-[90vh]',
    width: 'w-[95vw] sm:w-full',
    className: 'max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col w-[95vw] sm:w-full',
  },
  pricingDialog: {
    maxWidth: 'max-w-[95vw] sm:max-w-[90vw] md:max-w-[850px]',
    maxHeight: 'max-h-[95vh]',
    className: 'max-w-[95vw] sm:max-w-[90vw] md:max-w-[850px] max-h-[95vh] overflow-y-auto p-0 md:p-0',
  },
  aiRecommendation: {
    maxWidth: 'max-w-2xl',
    maxHeight: 'max-h-[80vh]',
    scrollArea: 'max-h-[50vh]',
    className: 'max-w-2xl max-h-[80vh]',
  },
} as const;

// Component Dimensions
export const COMPONENT_DIMENSIONS = {
  settingsPanel: {
    logoWidth: 'w-[120px]',
  },
  notificationsPanel: {
    selectWidth: 'w-full sm:w-[180px]',
  },
  taskDialog: {
    minWidth: {
      small: 'min-w-[70px]',
      medium: 'sm:min-w-[90px]',
      combined: 'min-w-[70px] sm:min-w-[90px]',
    },
    buttonMinWidth: 'min-w-[140px]',
  },
  todayAgenda: {
    dropZoneMinHeight: 'min-h-[400px]',
    emptyStateMinHeight: 'min-h-[300px]',
  },
  appTour: {
    imageMaxHeight: {
      mobile: 'max-h-[400px]',
      tablet: 'sm:max-h-[500px]',
      desktop: 'md:max-h-[600px]',
      combined: 'max-h-[400px] sm:max-h-[500px] md:max-h-[600px]',
    },
  },
  aiRecommendation: {
    containerHeight: 'h-[calc(100vh-8rem)]',
  },
} as const;

// Toggle Switch Dimensions
export const TOGGLE_SWITCH_DIMENSIONS = {
  container: {
    width: 48, // w-12 = 48px
    height: 20, // Reduced from 28px to 20px for better thumb fit
  },
  thumb: {
    width: 14, // Slightly smaller for better padding within 20px container
    height: 14, // Circular thumb - same as width
  },
  thumbOffset: {
    // Calculate offsets: container width (48px) - thumb width (14px) - padding (2px) = 32px for checked
    // For unchecked: 2px padding from left edge
    // For checked: container width - thumb width - right padding = 48 - 14 - 2 = 32px
    unchecked: 2, // 2px padding from left edge
    checked: 32, // 32px from left (48px - 14px - 2px) for right-aligned when checked
  },
  icon: {
    size: 16, // w-4 h-4 = 16px
    sizeClass: 'w-4 h-4', // Tailwind class for icon size
  },
} as const;

// Toggle Switch Spacing
export const TOGGLE_SWITCH_SPACING = {
  container: {
    padding: {
      horizontal: 12, // px-3 = 12px
      vertical: 6, // py-1.5 = 6px
      all: 12, // p-3 = 12px
      horizontalClass: 'px-3', // Tailwind class for horizontal padding
      verticalClass: 'py-1.5', // Tailwind class for vertical padding
      allClass: 'p-3', // Tailwind class for all padding
    },
    gap: 8, // gap-2 = 8px
    gapClass: 'gap-2', // Tailwind class for gap
    margin: {
      switch: 4, // mx-1 = 4px
      switchClass: 'mx-1', // Tailwind class for switch margin
    },
  },
} as const;

// Toggle Switch Text Sizes
export const TOGGLE_SWITCH_TEXT_SIZES = {
  label: {
    small: 'text-xs', // 12px
    medium: 'text-sm', // 14px
  },
} as const;

// Toggle Switch Animations
export const TOGGLE_SWITCH_ANIMATIONS = {
  duration: 200, // duration-200 = 200ms
  durationClass: 'duration-200', // Tailwind class
} as const;

// Toggle Switch Visual Effects
export const TOGGLE_SWITCH_EFFECTS = {
  shadow: {
    md: 'shadow-md', // Medium shadow for thumb
  },
  opacity: {
    disabled: 50, // opacity-50 = 50%
    disabledClass: 'opacity-50', // Tailwind class
  },
  focusRing: {
    width: 2, // ring-2 = 2px
    widthClass: 'ring-2', // Tailwind class
    offset: 2, // ring-offset-2 = 2px
    offsetClass: 'ring-offset-2', // Tailwind class
  },
} as const;


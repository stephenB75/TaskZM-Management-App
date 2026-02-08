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

// Mobile header spacer height - accounts for header height + safe area
// Header: height 73px (border-box includes: 16px padding-top + content + 16px padding-bottom + 1px border-bottom)
// With border-box, the 73px is the total height including padding and border
// Spacer must match this exactly so content starts underneath the header
// Then add safe area inset for notched devices
// IMPORTANT: This spacer is INSIDE the scrollable container and pushes content down
export const HEADER_MOBILE_SPACER_HEIGHT = 73; // Matches header height exactly (73px total with border-box) - must be exact to prevent content from being hidden
export const HEADER_MOBILE_SAFE_AREA_SPACER = `calc(${HEADER_MOBILE_SPACER_HEIGHT}px + env(safe-area-inset-top, 0px))`; // 73px + safe area

// Header-specific constants
export const HEADER_PADDING_X_MOBILE = '0.75rem'; // px-3 = 0.75rem (12px) - right padding only
export const HEADER_PADDING_Y_MOBILE = '1rem'; // py-4 = 1rem (16px)
export const HEADER_PADDING_X_DESKTOP = '0.5rem'; // px-2 = 0.5rem (8px) - right padding only
export const HEADER_PADDING_Y_DESKTOP = '0.5rem'; // py-2 = 0.5rem (8px)
// Internal content padding for left side only (applied to inner container)
export const HEADER_CONTENT_PADDING_LEFT_MOBILE = '0.75rem'; // px-3 = 0.75rem (12px) - left side internal spacing
export const HEADER_CONTENT_PADDING_LEFT_DESKTOP = '1rem'; // px-4 = 1rem (16px) - left side internal spacing
export const HEADER_ICON_SIZE_SMALL = '1rem'; // w-4 h-4 = 1rem (16px)
export const HEADER_BUTTON_SIZE = '2rem'; // h-8 w-8 = 2rem (32px)
export const HEADER_BUTTON_SIZE_SMALL_SCREEN = '1.75rem'; // h-7 w-7 = 1.75rem (28px) - for laptops and small screens
export const HEADER_ICON_SIZE_SMALL_SCREEN = '0.875rem'; // w-3.5 h-3.5 = 0.875rem (14px) - for laptops and small screens
export const HEADER_ICON_SIZE_BUTTON_SMALL = '1rem'; // 1rem (16px) - for button icons on small screens (increased for better visibility)
export const HEADER_ICON_SIZE_BUTTON_DESKTOP = '1.25rem'; // 1.25rem (20px) - for button icons on desktop (increased for better visibility)
// Common icon sizes (numeric values for Phosphor Icons)
export const ICON_SIZE_XS = 12; // Extra small icons
export const ICON_SIZE_SM = 14; // Small icons
export const ICON_SIZE_MD = 16; // Medium icons
export const ICON_SIZE_LG = 20; // Large icons
export const ICON_SIZE_XL = 24; // Extra large icons (default)
export const ICON_SIZE_2XL = 32; // 2X large icons
export const ICON_SIZE_3XL = 48; // 3X large icons
export const ICON_SIZE_4XL = 64; // 4X large icons
export const HEADER_ICON_MARGIN_SMALL = '0.1875rem'; // mr-0.75 = 0.1875rem (3px) - margin for icons on small screens (reduced from 0.25rem)
export const HEADER_ICON_MARGIN_DESKTOP = '0.25rem'; // mr-1 = 0.25rem (4px) - margin for icons on desktop (reduced from 0.375rem)
export const HEADER_BUTTON_PADDING_X_SMALL = '0.25rem'; // px-1 = 0.25rem (4px) - horizontal padding for buttons on small screens (reduced from 0.375rem)
export const HEADER_BUTTON_PADDING_X_DESKTOP = '0.375rem'; // px-1.5 = 0.375rem (6px) - horizontal padding for buttons on desktop (reduced from 0.5rem)
export const HEADER_BUTTON_PADDING_Y_SMALL = '0.125rem'; // py-0.5 = 0.125rem (2px) - vertical padding for buttons on small screens (reduced for pill shape)
export const HEADER_BUTTON_PADDING_Y_DESKTOP = '0.1875rem'; // py-0.75 = 0.1875rem (3px) - vertical padding for buttons on desktop (reduced for pill shape)
// Pill-shaped button padding (wider horizontal, reduced vertical for pill shape)
export const HEADER_BUTTON_PILL_PADDING_X_SMALL = '0.5rem'; // px-2 = 0.5rem (8px) - horizontal padding for pill-shaped buttons on small screens
export const HEADER_BUTTON_PILL_PADDING_X_DESKTOP = '0.75rem'; // px-3 = 0.75rem (12px) - horizontal padding for pill-shaped buttons on desktop
export const HEADER_BUTTON_LINE_HEIGHT = 1.2; // Line height for button text alignment
export const HEADER_TEXT_MARGIN_NONE = '0'; // No margin for text elements
export const HEADER_BUTTON_BORDER_RADIUS = '9999px'; // Fully rounded pill shape
export const HEADER_BUTTON_TEXT_SIZE_SMALL = '0.625rem'; // ~text-xs = 0.625rem (10px) - text size for buttons on small screens (reduced from 0.6875rem)
export const HEADER_BUTTON_TEXT_SIZE_DESKTOP = '0.6875rem'; // ~text-xs = 0.6875rem (11px) - text size for buttons on desktop (reduced from 0.75rem)
export const HEADER_BUTTON_SCALE_SMALL = 0.8; // scale-80 = 0.8 - scale factor for buttons on small screens (reduced from 0.85)
export const HEADER_BUTTON_SCALE_DESKTOP = 0.85; // scale-85 = 0.85 - scale factor for buttons on desktop (reduced from 0.9)
export const HEADER_MIN_WIDTH_DESKTOP = '200px'; // min-w-[200px] = 200px - minimum width for header content on desktop
export const HEADER_MIN_WIDTH_SMALL = '200px'; // min-w-[200px] = 200px - minimum width for header content on small screens
// Calculate logo height to fit within header
// Header height: 73px
// Desktop padding: 0.5rem (8px) top + 0.5rem (8px) bottom = 16px
// Border: 1px bottom
// Available space: 73px - 16px - 1px = 56px
// Use 80% of available space for comfortable fit: 56px * 0.8 = 44.8px ≈ 2.8rem
// Mobile padding: 1rem (16px) top + 1rem (16px) bottom = 32px
// Mobile available space: 73px - 32px - 1px = 40px
// Use 80% of available space: 40px * 0.8 = 32px = 2rem

// Logo height calculation constants
export const HEADER_LOGO_SPACE_RATIO = 0.8; // Use 80% of available header space for logo
export const HEADER_BORDER_BOTTOM = 1; // Border bottom in pixels

// Helper function to convert rem to pixels
const remToPx = (rem: string): number => {
  return parseFloat(rem.replace('rem', '')) * 16;
};

// Helper function to convert pixels to rem
const pxToRem = (px: number): string => {
  return `${px / 16}rem`;
};

// Calculate logo height to fit within header
// Available space = header height - padding top - padding bottom - border
const calculateLogoHeight = (headerHeight: number, paddingTop: string, paddingBottom: string): string => {
  const paddingTopPx = remToPx(paddingTop);
  const paddingBottomPx = remToPx(paddingBottom);
  const availableSpace = headerHeight - paddingTopPx - paddingBottomPx - HEADER_BORDER_BOTTOM;
  const logoHeightPx = availableSpace * HEADER_LOGO_SPACE_RATIO;
  return pxToRem(logoHeightPx);
};

export const HEADER_LOGO_HEIGHT_MOBILE = calculateLogoHeight(HEADER_HEIGHT, HEADER_PADDING_Y_MOBILE, HEADER_PADDING_Y_MOBILE);
export const HEADER_LOGO_HEIGHT_DESKTOP = calculateLogoHeight(HEADER_HEIGHT, HEADER_PADDING_Y_DESKTOP, HEADER_PADDING_Y_DESKTOP);

// Keep HEADER_LOGO_HEIGHT for backward compatibility (defaults to mobile)
export const HEADER_LOGO_HEIGHT = HEADER_LOGO_HEIGHT_MOBILE;

// Header logo scale by viewport (desktop header only: >= 1024px)
// Laptop/small monitor (1024-1279): smaller logo; small desktop (1280-1439): slightly smaller; desktop (1440+): full
export const HEADER_LOGO_SCALE = {
  laptop: 0.85,           // 1024-1279px
  laptopLandscape: 0.75,   // 1024-1279px landscape
  smallDesktop: 0.92,     // 1280-1439px
  desktop: 1,             // 1440px+
} as const;
export const HEADER_TITLE_SIZE_MOBILE = '1.25rem'; // text-xl = 1.25rem (20px)
export const HEADER_TITLE_SIZE_DESKTOP = '0.875rem'; // text-sm = 0.875rem (14px)
export const HEADER_TITLE_SIZE_SMALL_SCREEN = '0.8125rem'; // ~text-xs = 0.8125rem (13px) - for laptops and small screens
export const HEADER_DESCRIPTION_SIZE = '0.75rem'; // text-xs = 0.75rem (12px)
export const HEADER_DESCRIPTION_SIZE_SMALL_SCREEN = '0.6875rem'; // ~text-xs = 0.6875rem (11px) - for laptops and small screens
export const HEADER_DESCRIPTION_MARGIN_TOP = '0.125rem'; // mt-0.5 = 0.125rem (2px)
export const HEADER_DATE_SIZE = '1.25rem'; // text-xl = 1.25rem (20px) - Large, bold date display (desktop)
export const HEADER_DATE_SIZE_MOBILE = '0.875rem'; // text-sm = 0.875rem (14px) - Smaller date display for mobile
export const HEADER_DATE_NUMBER_SIZE = '1.5rem'; // text-2xl = 1.5rem (24px) - Large, bold number display (desktop)
export const HEADER_DATE_NUMBER_SIZE_MOBILE = '1.125rem'; // text-lg = 1.125rem (18px) - Smaller number display for mobile
export const HEADER_DATE_MARGIN_TOP = '0'; // No margin - Minimal spacing between day name and number
export const HEADER_GAP_SMALL = '0.375rem'; // gap-1.5 = 0.375rem (6px)
export const HEADER_GAP_XSMALL = '0.25rem'; // gap-1 = 0.25rem (4px) - for compact button spacing
export const HEADER_GAP_MEDIUM = '0.5rem'; // gap-2 = 0.5rem (8px)
export const HEADER_GAP_LARGE = '0.75rem'; // gap-3 = 0.75rem (12px)
export const HEADER_GAP_XLARGE = '1rem'; // gap-4 = 1rem (16px)

// Side panel header spacing (more compact for narrower panels)
export const HEADER_SIDE_PANEL_PADDING_X = '1rem'; // px-4 = 1rem (16px) - reduced from 1.5rem for better fit
export const HEADER_SIDE_PANEL_GAP_MAIN = '0.75rem'; // gap-3 = 0.75rem (12px) - reduced from 1rem
export const HEADER_SIDE_PANEL_GAP_LEFT = '0.625rem'; // ~gap-2.5 = 0.625rem (10px) - reduced from 0.75rem/1rem
export const HEADER_SIDE_PANEL_GAP_RIGHT = '0.375rem'; // gap-1.5 = 0.375rem (6px) - reduced from 0.5rem
export const HEADER_Z_INDEX = 40; // z-40 = 40
export const HEADER_BACKGROUND_OPACITY = 0.95; // bg-white/95 = 95% opacity
export const HEADER_BACKGROUND_LIGHT_COLOR = '#FFFFFF';
export const HEADER_BACKGROUND_DARK_COLOR = 'rgba(17, 24, 39, 0.95)';
export const HEADER_BORDER_COLOR = 'rgba(148, 163, 184, 0.2)';

// Header background gradient constants
// Dark mode gradient: gray-800 to gray-900 and back
export const HEADER_GRADIENT_DARK_START = 'rgba(31, 41, 55, 0.92)'; // gray-800 with opacity
export const HEADER_GRADIENT_DARK_MID = 'rgba(17, 24, 39, 0.9)'; // gray-900 with opacity
export const HEADER_GRADIENT_DARK_END = 'rgba(31, 41, 55, 0.92)'; // gray-800 with opacity

// Light mode gradient: white to light purple and back
export const HEADER_GRADIENT_LIGHT_START = 'rgba(255, 255, 255, 0.96)'; // white with opacity
export const HEADER_GRADIENT_LIGHT_MID = 'rgba(248, 244, 255, 0.94)'; // light purple with opacity
export const HEADER_GRADIENT_LIGHT_END = 'rgba(255, 255, 255, 0.96)'; // white with opacity

// Helper function to generate header gradient
export const getHeaderGradient = (isDark: boolean): string => {
  if (isDark) {
    return `linear-gradient(90deg, ${HEADER_GRADIENT_DARK_START} 0%, ${HEADER_GRADIENT_DARK_MID} 50%, ${HEADER_GRADIENT_DARK_END} 100%)`;
  }
  return `linear-gradient(90deg, ${HEADER_GRADIENT_LIGHT_START} 0%, ${HEADER_GRADIENT_LIGHT_MID} 50%, ${HEADER_GRADIENT_LIGHT_END} 100%)`;
};
export const HEADER_ANIMATION_DAMPING = 50; // Spring animation damping (higher = slower, less bouncy)
export const HEADER_ANIMATION_STIFFNESS = 150; // Spring animation stiffness (lower = slower, less rigid)
export const HEADER_BUTTON_NEGATIVE_MARGIN_LEFT = '-0.5rem'; // -ml-2 = -0.5rem
export const HEADER_SIDE_PANEL_ANIMATION_DURATION = 0.3; // Side panel header fade animation duration
export const HEADER_SIDE_PANEL_ANIMATION_DURATION_CONTENT = 0.4; // Content fade animation duration (duration + 0.1 for slightly longer fade)
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

// Main header transition constants (matches panel spring animation: damping: 30, stiffness: 300)
// Spring animation with these values typically takes ~350-400ms
export const HEADER_MAIN_TRANSITION_DURATION = 0.35; // seconds - matches panel spring animation duration
export const HEADER_MAIN_TRANSITION_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'; // Easing function matching spring animation feel

// Viewport Breakpoints (matching Tailwind defaults)
export const VIEWPORT_BREAKPOINTS = {
  mobile: 768, // md breakpoint - below this is mobile phones
  tablet: 1024, // lg breakpoint - iPad Pro portrait width
  desktop: 1280, // xl breakpoint - standard desktop
  largeDesktop: 1440, // 2xl - full-size logo and layout (small desktop: 1280-1439)
  // Mobile phones: < 768px (use mobile layout - one-column)
  // Tablets/iPad: 768px - 1023px (use mobile layout - one-column)
  // Laptops and small monitors: 1024px - 1279px (use desktop layout - multi-column)
  // Desktop: 1280px and above (use desktop layout - multi-column)
} as const;

// Timeline Constants
export const TIMELINE_PADDING = {
  mobile: 27.6, // Timeline padding on mobile
  desktop: 16, // Timeline padding on desktop
  minMobilePadding: 8, // Minimum padding for mobile (8px) - ensures spacing between header and first item
} as const;

// Today Agenda minimum height for drop zone accessibility
export const TODAY_AGENDA_MIN_HEIGHT = 400; // Minimum height in pixels to ensure drop zone is always accessible
export const TODAY_AGENDA_CONTENT_MIN_HEIGHT = 'calc(100% + 1px)'; // Minimum height to ensure content extends beyond viewport for scrolling
/** Today Agenda timeline: vertical time scale 7:00 AM–12:00 AM; task cards represent time blocks by duration. */
export const TODAY_AGENDA_TIMELINE = {
  /** Time range: start hour (7 = 7:00 AM), end hour (24 = 12:00 AM midnight). */
  startHour: 7,
  endHour: 24,
  /** Interval (minutes) between timeline labels (60 = hourly: 7:00 AM, 8:00 AM, …, 12:00 AM). */
  labelIntervalMinutes: 60,
  /** Start of timeline in minutes from range start (always 0 = 7:00 AM). */
  startOffsetMinutes: 0,
  /** Total minutes in range: (24 - 7) * 60 = 1020. */
  totalMinutes: (24 - 7) * 60,
  /** Pixels per minute so task height = duration (e.g. 2h → 120 * pxPerMinute). */
  pxPerMinute: 3,
  /** Minimum task block height (px) when duration is very short. */
  minBlockHeightPx: 48,
  columnWidth: '1in',
  dotSizePx: 10,
  lineMinWidthPx: 28,
  rowPaddingTopPx: 2,
  columnGapPx: 8,
  rowGapPx: 4,
  /** Minimum gap (px) between consecutive timeline blocks so they don’t touch. */
  blockGapPx: 8,
  /** Gap (px) between consecutive agenda items when using list fallback (e.g. no time). */
  itemGapPx: 12,
  /** Estimated height (px) for calendar event cards when computing cumulative spacing (+20% for larger container). */
  eventCardHeightPx: 106,
  /** Offset (px) from row top to card top when item shows Next Up badge (badge height + mb-2). Used so timeline time aligns with card top. */
  nextUpBadgeOffsetPx: 26,
  /** Height (px) of the Next Up badge when rendered above the block (Today Agenda). */
  nextUpBadgeHeightPx: 22,
  /** Gap (px) between the bottom of the Next Up badge and the top of the task block. */
  nextUpBadgeGapAboveBlockPx: 4,
  /** Offset (px) from card top to first content line (priority/tab row). Card padding-top + tab margin-top ≈ 14px. Applied so timeline dot aligns with card content, not card edge. */
  cardContentTopOffsetPx: 14,
  /** Compact row height (px) when agenda shows only tab + headline (list layout or min block). */
  taskRowHeightPx: 72,
  /** Tab bar height (px) for compact agenda row. */
  tabHeightPx: 34,
  /** Horizontal padding (px) for Today Agenda card content (left). */
  cardPaddingLeftPx: 10,
  /** Horizontal padding (px) for Today Agenda card content (right) – enough so tab/headline aren’t cut off. */
  cardPaddingRightPx: 28,
  /** Vertical padding (px) at bottom of Today Agenda card so title doesn't touch block edge. */
  cardPaddingBottomPx: 8,
  /** Horizontal padding (px) for Today Agenda tab bar. */
  tabPaddingPx: 10,
  /** Vertical padding (px) for Today Agenda tab bar. */
  tabPaddingVerticalPx: 5,
  /** Horizontal inset (px) from block edges so tab doesn’t touch sides. */
  tabBlockInsetPx: 8,
  /** Width (px) of the task tab area; timeline line extends from dot to this point (right side of tab). */
  tabAreaWidthPx: 44,
  /** Opacity for task block background tint (0–1). Full block height shows reserved time. */
  blockTintOpacity: 0.1,
  /** Width (px) of left-edge accent bar on task blocks. */
  blockAccentWidthPx: 4,
  /** Height (px) of the current-time indicator line. */
  currentTimeLineHeightPx: 2,
  /** Padding left (px) for the timeline blocks column (matches pl-2). */
  blocksColumnPaddingLeftPx: 8,
} as const;
export const TODAY_AGENDA_TIMELINE_COLUMN_WIDTH = TODAY_AGENDA_TIMELINE.columnWidth;

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
        mobile: 4, // pt-1 = 4px - small buffer after AppHeader spacer
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

// Droppable column (Kanban) - minimum height so drop zone is always accessible when empty
export const DROPPABLE_COLUMN_MIN_HEIGHT_PX = 200;

// Calculate panel width based on viewport and orientation
export const getPanelWidth = (): number => {
  if (typeof window === 'undefined') return PANEL_WIDTH;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;
  
  // Tablet range: 768px - 1279px (includes iPad, iPad Pro, and small monitors)
  if (width >= 768 && width < 1280) {
    // In landscape, tablets have more horizontal space, so use small monitor width
    if (isLandscape && width >= 1024) {
      return PANEL_WIDTH_SMALL_MONITOR;
    }
    // Portrait tablets use narrower panel
    return PANEL_WIDTH_TABLET;
  }
  // Desktop: 1280px and above
  return PANEL_WIDTH;
};

// Calculate main header left position when panel is open
// When panel is open, shift header right so logo stays visible (not under the panel)
export const getMainHeaderLeft = (panelOpen: boolean): number => {
  if (!panelOpen) return SIDEBAR_WIDTH;
  return SIDEBAR_WIDTH + getPanelWidth();
};

// Calculate main header width
// Header always spans from sidebar to right edge (panel overlays on top)
export const getMainHeaderWidth = (panelOpen: boolean): string => {
  const left = getMainHeaderLeft(panelOpen);
  // Always span full width from left position to right edge
  return `calc(100% - ${left}px)`;
};

// Bottom Navigation Bar constants
export const NAV_BAR_HEIGHT = 112; // Increased by 30% from 86px to 112px (30% increase: 86 * 1.3 = 111.8, rounded to 112)
export const NAV_BAR_SPACER_HEIGHT = 65; // Spacer height - optimized to match actual visible nav bar content area (reduces excessive spacing)
export const NAV_BAR_BOTTOM_PADDING_MOBILE = `calc(${NAV_BAR_SPACER_HEIGHT}px + env(safe-area-inset-bottom, 0px))`; // 65px + safe area - use this constant instead of hardcoding
export const NAV_BAR_SCROLL_BUFFER = 16; // Extra buffer padding (1rem = 16px) to ensure last item is fully visible when scrolling past nav bar
export const NAV_BAR_SCROLL_BUFFER_REM = '1rem'; // Extra buffer padding in rem units for CSS calc
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
export const PANEL_FIELD_SPACING = '0.75rem'; // space-y-3 = 0.75rem (between fields in panels)
export const PANEL_GAP_SMALL = '0.5rem'; // gap-2 = 0.5rem
export const PANEL_GAP_MEDIUM = '0.75rem'; // gap-3 = 0.75rem
export const PANEL_GAP_LARGE = '1rem'; // gap-4 = 1rem

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
export const TEAM_PANEL_BOTTOM_PADDING_MOBILE = NAV_BAR_BOTTOM_PADDING_MOBILE; // Uses nav bar spacer height constant
export const TEAM_PANEL_DROPDOWN_Z_INDEX = 9999; // z-[9999]
export const TEAM_PANEL_NOTIFICATION_Z_INDEX = 20; // z-20
export const TEAM_PANEL_DROPDOWN_TRIGGER_Z_INDEX = 50; // z-50
export const TEAM_PANEL_TEXT_SIZE_SMALL = '0.75rem'; // text-xs = 0.75rem
export const TEAM_PANEL_TEXT_SIZE_MEDIUM = '0.875rem'; // text-sm = 0.875rem
export const TEAM_PANEL_TEXT_SIZE_XS = '0.75rem'; // text-xs = 0.75rem (12px) - for small inline text
export const TEAM_PANEL_MARGIN_BOTTOM_SMALL = '0.25rem'; // mb-1 = 0.25rem
export const TEAM_PANEL_MARGIN_BOTTOM_MEDIUM = '0.5rem'; // mb-2 = 0.5rem
export const TEAM_PANEL_MARGIN_BOTTOM_LARGE = '0.75rem'; // mb-3 = 0.75rem
export const TEAM_PANEL_MARGIN_BOTTOM_XLARGE = '1rem'; // mb-4 = 1rem
export const TEAM_PANEL_MARGIN_TOP_SMALL = '0.5rem'; // mt-2 = 0.5rem
export const TEAM_PANEL_MARGIN_RIGHT_SMALL = '0.25rem'; // mr-1 = 0.25rem
export const TEAM_PANEL_MARGIN_RIGHT_MEDIUM = '0.5rem'; // mr-2 = 0.5rem
export const TEAM_PANEL_MARGIN_LEFT_SMALL = '0.25rem'; // ml-1 = 0.25rem
export const TEAM_PANEL_MARGIN_LEFT_MEDIUM = '0.5rem'; // ml-2 = 0.5rem
export const TEAM_PANEL_TEXTAREA_MIN_HEIGHT = '120px'; // min-h-[120px] = 120px
export const TEAM_PANEL_TEXTAREA_ROWS = 6;
export const TEAM_PANEL_BADGE_PADDING_X = '0.5rem'; // px-2 = 0.5rem
export const TEAM_PANEL_BADGE_PADDING_Y = '0.125rem'; // py-0.5 = 0.125rem
export const TEAM_PANEL_TEXTAREA_PADDING_X = '0.75rem'; // px-3 = 0.75rem
export const TEAM_PANEL_TEXTAREA_PADDING_Y = '0.5rem'; // py-2 = 0.5rem
export const TEAM_PANEL_SELECT_ITEM_PADDING_Y = '0.625rem'; // py-2.5 = 0.625rem (10px) - increased padding for better touch targets
export const TEAM_PANEL_SEARCH_CLEAR_BUTTON_RIGHT = '0.25rem'; // right-1 = 0.25rem
export const TEAM_PANEL_CONTENT_PADDING_TOP_OFFSET = '0.5rem'; // Additional padding top offset
export const TEAM_PANEL_CARD_BORDER_RADIUS_BOTTOM = '0.5rem'; // Border radius for bottom corners (rounded-lg equivalent)
export const TEAM_PANEL_CARD_BORDER_RADIUS_TOP = '0'; // No border radius for top corners (90 degree angles)
export const TEAM_PANEL_CARD_BACKGROUND_HEIGHT = '4px'; // Height of the gradient background bar
export const TEAM_PANEL_NOTIFICATION_BADGE_TOP = '0.5rem'; // top-2 = 0.5rem (8px)
export const TEAM_PANEL_NOTIFICATION_BADGE_RIGHT = '0.5rem'; // right-2 = 0.5rem (8px)
export const TEAM_PANEL_NOTIFICATION_DOT_BOTTOM_OFFSET = '-0.125rem'; // Negative offset for notification dot positioning
export const TEAM_PANEL_NOTIFICATION_DOT_RIGHT_OFFSET = '-0.125rem'; // Negative offset for notification dot positioning
export const TEAM_PANEL_PROFILE_BANNER_HEIGHT = '80px'; // Height of profile card banner
export const TEAM_PANEL_PROFILE_AVATAR_SIZE = '80px'; // Size of profile avatar (overlapping banner)
export const TEAM_PANEL_PROFILE_AVATAR_FONT_SIZE = '24px'; // Font size for profile avatar initials
export const TEAM_PANEL_PROFILE_AVATAR_OVERLAP_OFFSET = '-2.5rem'; // Negative margin to overlap avatar with banner (-mt-10)

// Compact Team Card Constants (for showing multiple team members)
export const TEAM_PANEL_COMPACT_BANNER_HEIGHT = '48px'; // Height of compact card banner
export const TEAM_PANEL_COMPACT_AVATAR_SIZE = '48px'; // Size of compact card avatar
export const TEAM_PANEL_COMPACT_AVATAR_FONT_SIZE = '16px'; // Font size for compact avatar initials
export const TEAM_PANEL_COMPACT_AVATAR_OVERLAP_OFFSET = '-1.5rem'; // Negative margin to overlap avatar with banner
export const TEAM_PANEL_OTHER_MEMBERS_AVATAR_SIZE = '24px'; // Size of other team members' avatars
export const TEAM_PANEL_OTHER_MEMBERS_AVATAR_FONT_SIZE = '10px'; // Font size for other members' avatar initials
export const TEAM_PANEL_OTHER_MEMBERS_GAP = '-0.5rem'; // Negative gap for overlapping avatars
export const TEAM_PANEL_OTHER_MEMBERS_MAX_VISIBLE = 3; // Maximum number of other members to show as avatars

// Vertical Profile Layout Constants
export const TEAM_PANEL_VERTICAL_AVATAR_SIZE = '120px'; // Size of vertical profile avatar
export const TEAM_PANEL_VERTICAL_NAME_SIZE = '1.125rem'; // text-lg = 1.125rem (18px)
export const TEAM_PANEL_VERTICAL_ROLE_SIZE = '0.875rem'; // text-sm = 0.875rem (14px)
export const TEAM_PANEL_VERTICAL_EMAIL_SIZE = '0.75rem'; // text-xs = 0.75rem (12px) - smaller for email to fit on one line
export const TEAM_PANEL_VERTICAL_SOCIAL_ICON_SIZE = '1.25rem'; // Size of social media icons
export const TEAM_PANEL_VERTICAL_SPACING = '0.75rem'; // gap-3 = 0.75rem (12px) between elements
export const TEAM_PANEL_VERTICAL_PADDING = '1.5rem'; // p-6 = 1.5rem (24px) card padding

// Team Panel Grid Layout Constants
export const TEAM_PANEL_GRID_COLUMNS = 2; // Number of columns for team member cards
export const TEAM_PANEL_GRID_GAP = '0.75rem'; // gap-3 = 0.75rem (12px) between grid items

// Team Management Constants
export const TEAM_MAX_MEMBERS = 8; // Maximum team members per team
export const TEAM_PANEL_TAB_HEIGHT = '2.5rem'; // Height for team tabs
export const TEAM_PANEL_TAB_PADDING = '0.75rem'; // Padding for team tabs
export const TEAM_PANEL_HEADER_ICON_GAP = '1rem'; // gap-4 = 1rem (16px) - increased spacing between header icons for better mobile touch targets

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
export const PANEL_DROPDOWN_MENU_TRIGGER_SELECTOR = '[data-slot="dropdown-menu-trigger"]'; // CSS selector for dropdown menu trigger element
export const PANEL_DROPDOWN_MENU_TRIGGER_DATA_SLOT = 'dropdown-menu-trigger'; // data-slot attribute value for dropdown menu trigger element
export const PANEL_SEARCH_BAR_PADDING_TOP = '1rem'; // pt-4 = 1rem
export const PANEL_SEARCH_BAR_PADDING_BOTTOM = '0.75rem'; // pb-3 = 0.75rem
export const PANEL_SEARCH_ICON_POSITION_LEFT = '0.75rem'; // left-3 = 0.75rem
export const PANEL_SEARCH_INPUT_PADDING_LEFT = '2.25rem'; // pl-9 = 2.25rem
export const PANEL_EMPTY_STATE_PADDING_Y = '3rem'; // py-12 = 3rem
export const PANEL_EMPTY_STATE_PADDING_Y_LARGE = '4rem'; // py-16 = 4rem (64px) - for larger empty states like Inbox
export const PANEL_EMPTY_STATE_TEXT_SIZE = '0.875rem'; // text-sm = 0.875rem
// Empty state icon sizes
export const EMPTY_STATE_ICON_SIZE_SMALL = '3rem'; // w-12 h-12 = 3rem (48px) - for Today Agenda
export const EMPTY_STATE_ICON_SIZE_LARGE = '6rem'; // w-24 h-24 = 6rem (96px) - for Inbox
export const EMPTY_STATE_ICON_INNER_SIZE = '1.5rem'; // w-6 h-6 = 1.5rem (24px) - inner icon size
// Empty state spacing
export const EMPTY_STATE_MARGIN_BOTTOM_SMALL = '0.75rem'; // mb-3 = 0.75rem (12px)
export const EMPTY_STATE_MARGIN_BOTTOM_LARGE = '1.5rem'; // mb-6 = 1.5rem (24px)
export const EMPTY_STATE_PADDING_X = '1rem'; // px-4 = 1rem (16px)
// Inbox checkbox sizes for responsive layouts
export const INBOX_CHECKBOX_SIZE_MOBILE = '20px'; // w-5 h-5 = 20px - increased for better mobile touch target (minimum 20px recommended)
export const INBOX_CHECKBOX_SIZE_SMALL_MONITOR = '16px'; // w-4 h-4 = 16px - small monitor checkbox
export const INBOX_CHECKBOX_SIZE_LANDSCAPE = '20px'; // w-5 h-5 = 20px - increased for better touch target in landscape mode
export const INBOX_CHECKBOX_SIZE_DESKTOP = '16px'; // w-4 h-4 = 16px - desktop checkbox

// Task Dialog Create Subtask checkbox: smaller, responsive (mobile / tablet / laptop)
export const TASK_DIALOG_SUBTASK_CHECKBOX_SIZE = {
  mobile: '18px',   // < 768px - touch-friendly, not as large as 20px
  tablet: '16px',   // 768–1023px
  laptop: '14px',   // 1024px+ - compact for dialog
} as const;

// Checkbox check icon sizes (proportional to checkbox size)
export const CHECKBOX_CHECK_ICON_SIZE = 12; // w-3 = 12px - standard check icon size for 16px checkbox
export const CHECKBOX_CHECK_ICON_SIZE_MOBILE = 14; // w-3.5 = 14px - check icon size for 20px mobile checkbox
// Inbox card shadow for mobile/tablet layout
export const INBOX_CARD_SHADOW_MOBILE = '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.12)';

// Archive Panel Sizes
export const ARCHIVE_CHECKBOX_SIZE = '12px'; // w-3 h-3 = 12px - compact checkbox for archive panel (desktop)
export const ARCHIVE_CHECKBOX_SIZE_MOBILE = '20px'; // w-5 h-5 = 20px - larger checkbox for mobile touch target
export const ARCHIVE_CHECKMARK_CONTAINER_SIZE = '1.25rem'; // w-5 h-5 = 1.25rem (20px) - checkmark icon container
export const ARCHIVE_CHECKMARK_ICON_SIZE = '0.75rem'; // w-3 h-3 = 0.75rem (12px) - checkmark icon
export const ARCHIVE_TITLE_TEXT_SIZE = '0.8125rem'; // text-[13px] = 0.8125rem (13px) - task title text size
export const ARCHIVE_ASSIGNEE_TEXT_SIZE = '0.625rem'; // text-[10px] = 0.625rem (10px) - assignee name text size
export const ARCHIVE_ASSIGNEE_AVATAR_SIZE = '0.875rem'; // w-3.5 h-3.5 = 0.875rem (14px) - assignee avatar size
export const ARCHIVE_ASSIGNEE_INITIALS_SIZE = '0.4375rem'; // text-[7px] = 0.4375rem (7px) - assignee initials text size // Custom shadow for better mobile blending

// Workspace constants (for workspace creation, loading, and management)
export const WORKSPACE_MAX_RETRIES = 3; // Maximum number of retry attempts for workspace loading
export const WORKSPACE_RETRY_DELAY_BASE_MS = 500; // Base delay in milliseconds for exponential backoff (reduced from 1000ms to 500ms for faster loading)
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
export const SETTINGS_PANEL_BOTTOM_PADDING_MOBILE = NAV_BAR_BOTTOM_PADDING_MOBILE; // Uses nav bar spacer height constant
export const SETTINGS_PANEL_PADDING_TOP = '1rem'; // pt-4 = 1rem
export const SETTINGS_PANEL_CONTAINER_PADDING_SMALL = '1rem'; // p-4 = 1rem
export const SETTINGS_PANEL_CONTAINER_PADDING_MEDIUM = '1.5rem'; // sm:p-6 = 1.5rem
export const SETTINGS_PANEL_CONTAINER_PADDING_LARGE = '2rem'; // md:p-8 = 2rem
export const SETTINGS_PANEL_MAX_WIDTH = '42rem'; // max-w-2xl = 42rem
export const SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X = '1rem'; // px-4 = 1rem
export const SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_SMALL = '1rem'; // py-4 = 1rem (breathing room per section)
export const SETTINGS_PANEL_ACCORDION_ITEM_PADDING_Y_DESKTOP = '1rem'; // md:py-4
export const SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y = '1.5rem'; // my-6 = 1.5rem (clear separation between accordion sections)
export const SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y_MEDIUM = '1.25rem'; // sm:my-5 = 1.25rem
export const SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y_DESKTOP = '1.5rem'; // md:my-6 = 1.5rem
export const SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y = '1.25rem'; // py-5 = 1.25rem (comfortable tap/click area)
export const SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_BOTTOM = '1.5rem'; // pb-6 = 1.5rem
export const SETTINGS_PANEL_ACCORDION_CONTENT_PADDING_TOP = '1.25rem'; // pt-5 = 1.25rem (clear gap below trigger)
export const SETTINGS_PANEL_ACCORDION_CONTENT_SPACING = '1.5rem'; // gap between content blocks = 1.5rem
export const SETTINGS_PANEL_SEPARATOR_MARGIN_Y = '1.25rem'; // my-5 = 1.25rem (space above/below separators within sections)
export const SETTINGS_PANEL_ICON_SIZE_SMALL = '0.75rem'; // w-3 h-3 = 0.75rem
export const SETTINGS_PANEL_ICON_SIZE_MEDIUM = '1rem'; // w-4 h-4 = 1rem
export const SETTINGS_PANEL_ICON_SIZE_LARGE = '1.25rem'; // w-5 h-5 = 1.25rem
export const SETTINGS_PANEL_ICON_SIZE_XLARGE = '2rem'; // w-8 h-8 = 2rem
export const SETTINGS_PANEL_ICON_SIZE_EXTRA_SMALL = '0.875rem'; // w-3.5 h-3.5 = 0.875rem
export const SETTINGS_PANEL_ACCORDION_ICON_SIZE = '1.75rem'; // Larger icon size for accordion triggers
export const SETTINGS_PANEL_EDIT_BUTTON_SIZE = '2rem'; // w-8 h-8 = 2rem (32px) - size for edit avatar button
export const SETTINGS_PANEL_START_TOUR_ICON_SIZE = '0.8rem'; // 20% smaller than standard medium icon
export const SETTINGS_PANEL_AVATAR_SIZE = '4rem'; // w-16 h-16 = 4rem
export const SETTINGS_PANEL_INPUT_HEIGHT = '2.25rem'; // h-9 = 2.25rem
export const SETTINGS_PANEL_BADGE_HEIGHT = '1rem'; // h-4 = 1rem
export const SETTINGS_PANEL_BADGE_PADDING_LEFT = '0.375rem'; // padding-left: 0.375rem (6px)
export const SETTINGS_PANEL_BADGE_PADDING_RIGHT = '0.375rem'; // padding-right: 0.375rem (6px)
export const SETTINGS_PANEL_BADGE_PADDING_TOP = '0'; // padding-top: 0
export const SETTINGS_PANEL_BADGE_PADDING_BOTTOM = '0'; // padding-bottom: 0
export const SETTINGS_PANEL_GAP_SMALL = '0.5rem'; // gap-2 = 0.5rem
export const SETTINGS_PANEL_GAP_MEDIUM = '0.75rem'; // gap-3 = 0.75rem
export const SETTINGS_PANEL_GAP_LARGE = '1rem'; // gap-4 = 1rem
export const SETTINGS_PANEL_GAP_XSMALL = '0.375rem'; // gap-1.5 = 0.375rem
export const SETTINGS_PANEL_SPACING_XSMALL = '0.25rem'; // space-y-1 = 0.25rem
export const SETTINGS_PANEL_SPACING_EXTRA_SMALL = '0.375rem'; // space-y-1.5 = 0.375rem
export const SETTINGS_PANEL_SPACING_SMALL = '0.875rem'; // space-y-3.5 = 0.875rem (between related items)
export const SETTINGS_PANEL_SPACING_EXTRA_LARGE = '0.875rem'; // space-y-3.5 = 0.875rem
export const SETTINGS_PANEL_SPACING_MEDIUM = '1.25rem'; // space-y-5 = 1.25rem (between form rows)
export const SETTINGS_PANEL_SPACING_LARGE = '1.5rem'; // space-y-6 = 1.5rem (between subsections)
export const SETTINGS_PANEL_SPACING_XLARGE = '2rem'; // space-y-8 = 2rem (major section breaks)
export const SETTINGS_PANEL_TEXT_SIZE_XSMALL = '0.625rem'; // text-[10px] = 0.625rem
export const SETTINGS_PANEL_TEXT_SIZE_SMALL = '0.75rem'; // text-xs = 0.75rem
export const SETTINGS_PANEL_TEXT_SIZE_MEDIUM = '0.875rem'; // text-sm = 0.875rem
export const SETTINGS_PANEL_MARGIN_TOP_XSMALL = '0.125rem'; // mt-0.5 = 0.125rem
export const SETTINGS_PANEL_MARGIN_TOP_EXTRA_SMALL = '0.375rem'; // mt-1.5 = 0.375rem
export const SETTINGS_PANEL_MARGIN_TOP_SMALL = '0.5rem'; // mt-2 = 0.5rem
export const SETTINGS_PANEL_MARGIN_TOP_MEDIUM_SMALL = '0.75rem'; // mt-3 = 0.75rem
export const SETTINGS_PANEL_MARGIN_BOTTOM_SMALL = '0.5rem'; // mb-2 = 0.5rem (after labels/blocks)
export const SETTINGS_PANEL_MARGIN_BOTTOM_MEDIUM = '1rem'; // mb-4 = 1rem
export const SETTINGS_PANEL_MARGIN_BOTTOM_LARGE = '1.25rem'; // mb-5 = 1.25rem
export const SETTINGS_PANEL_MARGIN_TOP_MEDIUM = '1rem'; // mt-4 = 1rem
export const SETTINGS_PANEL_MARGIN_TOP_LARGE = '1.25rem'; // mt-5 = 1.25rem
export const SETTINGS_PANEL_MARGIN_RIGHT_SMALL = '0.5rem'; // mr-2 = 0.5rem
export const SETTINGS_PANEL_MARGIN_RIGHT_XSMALL = '0.25rem'; // mr-1 = 0.25rem
export const SETTINGS_PANEL_MARGIN_LEFT_XSMALL = '0.25rem'; // ml-1 = 0.25rem
export const SETTINGS_PANEL_MARGIN_LEFT_SMALL = '0.5rem'; // ml-2 = 0.5rem
export const SETTINGS_PANEL_MARGIN_LEFT_MEDIUM = '1rem'; // ml-4 = 1rem
export const SETTINGS_PANEL_MARGIN_LEFT_NONE = '0'; // margin-left: 0px
export const SETTINGS_PANEL_MARGIN_RIGHT_NONE = '0'; // margin-right: 0px
export const SETTINGS_PANEL_PADDING = '1rem'; // Base padding = 1rem (16px) - default padding for dialogs and sections
export const SETTINGS_PANEL_PADDING_SMALL = '0.625rem'; // p-2.5 = 0.625rem
export const SETTINGS_PANEL_PADDING_MEDIUM = '0.75rem'; // p-3 = 0.75rem
export const SETTINGS_PANEL_PADDING_LARGE = '1rem'; // p-4 = 1rem
export const SETTINGS_PANEL_PADDING_XSMALL = '0.375rem'; // p-1.5 = 0.375rem
export const SETTINGS_PANEL_PADDING_LEFT_AI_SECTION = '1rem'; // padding-left: 16px (1rem) - reduced for wider column
export const SETTINGS_PANEL_PADDING_RIGHT_AI_SECTION = '1rem'; // padding-right: 16px (1rem) - reduced for wider column
export const SETTINGS_PANEL_PADDING_Y_SMALL = '0.25rem'; // py-1 = 0.25rem
export const SETTINGS_PANEL_ROW_PADDING_Y = '0.75rem'; // vertical padding per form row (e.g. switch rows) for clearer separation
export const SETTINGS_PANEL_PADDING_Y_EXTRA_SMALL = '0.125rem'; // py-0.5 = 0.125rem
export const SETTINGS_PANEL_PADDING_TOP_EXTRA_SMALL = '0.375rem'; // pt-1.5 = 0.375rem
export const SETTINGS_PANEL_PADDING_RIGHT_SMALL = '0.5rem'; // pr-2 = 0.5rem
export const SETTINGS_PANEL_LINE_HEIGHT_AI_DESCRIPTION = '22px'; // line-height: 22px - reduced for smaller text
export const SETTINGS_PANEL_AVATAR_FONT_SIZE = '1.6rem'; // fontSize: 1.6rem for large avatar
export const SETTINGS_PANEL_GAP_NONE = '0'; // gap: 0px
export const SETTINGS_PANEL_POSITION_STATIC = 'static'; // position: static
export const MOBILE_PADDING_BOTTOM = '2rem'; // padding-bottom: 2rem for mobile views
export const DESKTOP_PADDING_TOP = '3rem'; // padding-top: 3rem for desktop views
// Mobile scroll container padding to ensure content is not hidden by fixed header when scrolling up
// Header height already includes safe area inset in its padding, so we match that total height
export const MOBILE_SCROLL_CONTAINER_PADDING_TOP = `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`; // Header height + safe area for top padding on scroll container (matches header's actual height)
export const SETTINGS_PANEL_AVATAR_SIZE_VALUE = '2rem'; // width/height: 2rem for avatar
export const SETTINGS_PANEL_START_TOUR_BUTTON_HEIGHT = '1.6rem'; // 20% smaller than default h-8 (2rem)
export const SETTINGS_PANEL_START_TOUR_BUTTON_PADDING_X = '0.6rem'; // 20% smaller than default px-3 (0.75rem)
export const SETTINGS_PANEL_START_TOUR_BUTTON_GAP = '0.4rem'; // 20% smaller than default 0.5rem gap
export const SETTINGS_PANEL_START_TOUR_FONT_SIZE = '0.7rem'; // Slightly smaller text for compact button
export const SETTINGS_PANEL_TOAST_DURATION_MS = 5000; // Toast duration in milliseconds (5 seconds)
export const SETTINGS_PANEL_TIMEOUT_DELAY_MS = 100; // Timeout delay in milliseconds (100ms)
export const CONFETTI_RESET_DELAY_MS = 100; // Delay before resetting confetti state after onComplete (100ms)
export const SETTINGS_PANEL_PROFILE_BANNER_HEIGHT = '100px'; // Height of profile card banner
export const SETTINGS_PANEL_PROFILE_AVATAR_SIZE = '96px'; // Size of profile avatar (overlapping banner)
export const SETTINGS_PANEL_PROFILE_AVATAR_FONT_SIZE = '32px'; // Font size for profile avatar initials
export const SETTINGS_PANEL_PROFILE_CONTENT_PADDING_X = '1rem'; // px-4 = 1rem (16px)
export const SETTINGS_PANEL_PROFILE_CONTENT_PADDING_BOTTOM = '1rem'; // pb-4 = 1rem (16px)
export const SETTINGS_PANEL_PROFILE_CONTENT_PADDING_TOP = '0.5rem'; // pt-2 = 0.5rem (8px)
export const SETTINGS_PANEL_PROFILE_NAME_SIZE = '1.25rem'; // text-xl = 1.25rem (20px)
export const SETTINGS_PANEL_PROFILE_ICON_SIZE = 20; // Icon size for sparkles badge (20px)
export const SETTINGS_PANEL_PROFILE_EMAIL_ICON_SIZE = 14; // Icon size for email icon (14px)
export const SETTINGS_PANEL_PROFILE_AVATAR_OVERLAP_OFFSET = '-3.5rem'; // Negative margin to overlap avatar with banner (-mt-14)

// App Icon and Theme Colors
export const APP_THEME_COLOR_PRIMARY = '#9B87E8'; // TaskZM purple/lavender (primary theme color)
export const APP_THEME_COLOR_SECONDARY = '#9D87C3'; // TaskZM purple/lavender (secondary theme color for manifest)
export const APP_BACKGROUND_COLOR = '#F5F3FF'; // TaskZM light purple background
export const APP_TEXT_FALLBACK_COLOR = '#7B68EE'; // Text fallback color for loading screen

// Splash Screen Logo Path Constants
export const SPLASH_SCREEN_LOGO_PATHS = {
  primary: '/taskzm-logo.png',
  relative: './taskzm-logo.png',
  relativeNoSlash: 'taskzm-logo.png',
} as const;

// Splash Screen Text Constants
export const SPLASH_SCREEN_TEXT = {
  logoAlt: 'TaskZM Logo',
  loadingMessage: 'Loading TaskZM...',
  fallbackText: 'TaskZM',
} as const;

// Loading screen gradient (lavender → light; same on mobile/desktop, dark uses gray)
export const LOADING_SCREEN_GRADIENT_CLASS =
  'bg-gradient-to-br from-[#EFE9FA] via-[#EAE4F6] to-[#E3DCF1] md:from-[#FAF9FC] md:via-[#F9F7FD] md:to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950';

// Main app background gradient (light gray; used by main layout, month calendar, invite page)
export const MAIN_BG_GRADIENT_CLASS =
  'bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950';

// React Loading Screen Constants
export const REACT_LOADING_SCREEN = {
  zIndex: 999999, // z-index for React loading screen overlay
  spinner: {
    outer: {
      animationDuration: '1s',
    },
    inner: {
      animationDuration: '1.5s',
      animationDirection: 'reverse' as const,
    },
  },
  dots: {
    animationDelays: {
      first: '0ms',
      second: '150ms',
      third: '300ms',
    },
  },
} as const;

// Loading Screen Constants
// Base values for loading screen logo (responsive sizing)
const LOADING_SCREEN_LOGO_BASE_HEIGHT_MOBILE = '2.5rem'; // h-10 = 2.5rem (40px) - Base mobile logo height (reduced from 4rem)
const LOADING_SCREEN_LOGO_BASE_HEIGHT_TABLET = '3.5rem'; // h-14 = 3.5rem (56px) - Base tablet logo height
const LOADING_SCREEN_LOGO_BASE_HEIGHT_DESKTOP = '5rem'; // h-20 = 5rem (80px) - Base desktop logo height
const LOADING_SCREEN_LOGO_BASE_MAX_WIDTH = 220; // Base max width in px
// Size increase multiplier (2.5x = 250% increase for better visibility without being too large on mobile)
const LOADING_SCREEN_LOGO_SIZE_INCREASE_MULTIPLIER = 2.5;

export const LOADING_SCREEN_LOGO = {
  // Base sizes (for reference)
  baseHeight: {
    mobile: LOADING_SCREEN_LOGO_BASE_HEIGHT_MOBILE,
    tablet: LOADING_SCREEN_LOGO_BASE_HEIGHT_TABLET,
    desktop: LOADING_SCREEN_LOGO_BASE_HEIGHT_DESKTOP,
  },
  baseMaxWidth: LOADING_SCREEN_LOGO_BASE_MAX_WIDTH,
  sizeIncreaseMultiplier: LOADING_SCREEN_LOGO_SIZE_INCREASE_MULTIPLIER,
  // Calculate responsive sizes: base * sizeIncreaseMultiplier
  height: {
    mobile: (() => {
      const baseValue = parseFloat(LOADING_SCREEN_LOGO_BASE_HEIGHT_MOBILE);
      const increasedValue = baseValue * LOADING_SCREEN_LOGO_SIZE_INCREASE_MULTIPLIER;
      return `${increasedValue}rem`; // 2.5 * 2.5 = 6.25rem (100px)
    })(),
    tablet: (() => {
      const baseValue = parseFloat(LOADING_SCREEN_LOGO_BASE_HEIGHT_TABLET);
      const increasedValue = baseValue * LOADING_SCREEN_LOGO_SIZE_INCREASE_MULTIPLIER;
      return `${increasedValue}rem`; // 3.5 * 2.5 = 8.75rem (140px)
    })(),
    desktop: (() => {
      const baseValue = parseFloat(LOADING_SCREEN_LOGO_BASE_HEIGHT_DESKTOP);
      const increasedValue = baseValue * LOADING_SCREEN_LOGO_SIZE_INCREASE_MULTIPLIER;
      return `${increasedValue}rem`; // 5 * 2.5 = 12.5rem (200px)
    })(),
  },
  maxWidth: {
    mobile: (() => {
      const increasedValue = LOADING_SCREEN_LOGO_BASE_MAX_WIDTH * LOADING_SCREEN_LOGO_SIZE_INCREASE_MULTIPLIER * 0.7; // 70% for mobile
      return `${increasedValue}px`; // 220 * 2.5 * 0.7 = 385px
    })(),
    tablet: (() => {
      const increasedValue = LOADING_SCREEN_LOGO_BASE_MAX_WIDTH * LOADING_SCREEN_LOGO_SIZE_INCREASE_MULTIPLIER * 0.85; // 85% for tablet
      return `${increasedValue}px`; // 220 * 2.5 * 0.85 = 467.5px
    })(),
    desktop: (() => {
      const increasedValue = LOADING_SCREEN_LOGO_BASE_MAX_WIDTH * LOADING_SCREEN_LOGO_SIZE_INCREASE_MULTIPLIER;
      return `${increasedValue}px`; // 220 * 2.5 = 550px
    })(),
  },
} as const;

// Toast Notification Durations (in milliseconds)
export const TOAST_DURATION_DEFAULT_MS = 6000; // Default toast duration (6 seconds)
export const TOAST_DURATION_SHORT_MS = 3000; // Short toast duration (3 seconds)
export const TOAST_DURATION_MEDIUM_MS = 4000; // Medium toast duration (4 seconds)
export const TOAST_DURATION_LONG_MS = 5000; // Long toast duration (5 seconds)
export const TOAST_DURATION_EXTRA_LONG_MS = 10000; // Extra long toast duration (10 seconds)

// App Metadata
export const APP_TITLE = 'TaskZM - GTD in its simplest form.';
export const APP_DESCRIPTION = 'TaskZM - GTD in its simplest form. A neurodivergent-friendly task management application with AI-assisted planning.';
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
  TOUR_HIGHLIGHT: 9998, // z-index for tour highlighted elements (below tour overlay)
  DROP_ZONE: 100, // z-100 - Used in TodayAgendaView for drop zone overlay
  TIME_INDICATOR: 50, // z-50 - Used in TodayAgendaView for current time indicator
  /** Today Agenda: timestamp connector line (from dot to task tab) drawn in front of blocks. */
  TIMELINE_STAMP_LINE: 20,
  /** Today Agenda: timeline column container. */
  TIMELINE_CONTAINER: 10,
  DIALOG: 50, // z-50 - Used in Dialog overlay and content
  TOAST: 9990, // z-9990 - In-app toasts above dialogs and in-dialog dropdowns (SELECT_CONTENT 200) so messages are always visible
  DRAG_DROP: 99999, // z-99999 - Used in DragDropContext for drag overlay
  NAVIGATION_MENU: 1, // z-[1] - Used in navigation-menu component
  SPLASH_SCREEN: 999999, // z-999999 - Used in index.html for initial splash screen (must be highest)
  SPLASH_HIDDEN: -1, // z--1 - Used when splash screen is hidden
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

// Auth Screen Constants
export const AUTH_SCREEN = {
  mobile: {
    padding: {
      horizontal: '1rem', // px-4 = 1rem (16px) - comfortable side padding
      vertical: '0.25rem', // py-1 = 0.25rem (4px) - reduced top padding to move dialog up
      bottom: '1.5rem', // pb-6 = 1.5rem (24px) - increased bottom padding to prevent touching screen
    },
    logo: {
      width: '180px', // w-[180px] - increased by 50% from 120px (120 * 1.5 = 180)
      maxWidth: '90%', // max-w-[90%] - ensure logo doesn't exceed viewport
    },
    card: {
      maxWidth: '100%', // Full width on mobile
      maxHeight: 'calc(100vh - 12rem)', // Account for logo (~3rem) + padding (1.5rem) + bottom margin (7.5rem) - increased bottom space
      padding: {
        horizontal: '1rem', // px-4 = 1rem (16px)
        vertical: '0.5rem', // py-2 = 0.5rem (8px) - reduced for smaller dialog
      },
      contentPadding: {
        bottom: '0.75rem', // pb-3 = 0.75rem (12px) - reduced bottom padding
        top: '0.5rem', // pt-2 = 0.5rem (8px) - reduced top padding
      },
      headerPadding: {
        top: '0.75rem', // pt-3 = 0.75rem (12px) - reduced top padding
        bottom: '0.5rem', // pb-2 = 0.5rem (8px) - reduced bottom padding
      },
    },
    button: {
      height: '2.5rem', // h-10 = 2.5rem (40px) - standard mobile touch target
      fontSize: '0.875rem', // text-sm = 0.875rem (14px)
    },
    spacing: {
      brandingMarginBottom: '1rem', // mb-4 = 1rem (16px) - spacing below branding section
      logoMarginBottom: '0.75rem', // mb-3 = 0.75rem (12px) - spacing below logo
      badgeMarginBottom: '1rem', // mb-4 = 1rem (16px) - spacing below badge (increased for better separation)
      taglineMarginTop: '0.75rem', // mt-3 = 0.75rem (12px) - spacing above tagline
      formSpacing: '0.625rem', // space-y-2.5 = 0.625rem (10px) - reduced form spacing
      cardHeaderSpacing: '0.375rem', // space-y-1.5 = 0.375rem (6px) - reduced header spacing
    },
  },
  tablet: {
    padding: {
      horizontal: '1.5rem', // px-6 = 1.5rem (24px)
      vertical: '0.5rem', // py-2 = 0.5rem (8px) - further reduced to move dialog up
      bottom: '2rem', // pb-8 = 2rem (32px) - increased bottom padding to prevent touching screen
    },
    logo: {
      width: '270px', // w-[270px] - increased by 50% from 180px (180 * 1.5 = 270)
      maxWidth: '100%',
    },
    card: {
      maxWidth: '28rem', // max-w-md = 28rem (448px) - comfortable width for tablets
      maxHeight: 'calc(100vh - 14rem)', // Account for logo (~4rem) + padding (2rem) + bottom margin (8rem) - increased bottom space
      contentPadding: {
        bottom: '1rem', // pb-4 = 1rem (16px) - reduced bottom padding
        top: '0.75rem', // pt-3 = 0.75rem (12px) - reduced top padding
      },
      headerPadding: {
        top: '1rem', // pt-4 = 1rem (16px) - reduced top padding
        bottom: '0.75rem', // pb-3 = 0.75rem (12px) - reduced bottom padding
      },
    },
    spacing: {
      brandingMarginBottom: '1.25rem', // mb-5 = 1.25rem (20px) - spacing below branding section
      logoMarginBottom: '1rem', // mb-4 = 1rem (16px) - spacing below logo
      badgeMarginBottom: '1.25rem', // mb-5 = 1.25rem (20px) - spacing below badge (increased for better separation)
      taglineMarginTop: '1rem', // mt-4 = 1rem (16px) - spacing above tagline
    },
  },
  desktop: {
    padding: {
      horizontal: '1.5rem', // px-6 = 1.5rem (24px)
      vertical: '0.75rem', // py-3 = 0.75rem (12px) - further reduced to move dialog up
      bottom: '2rem', // pb-8 = 2rem (32px) - increased bottom padding to prevent touching screen
    },
    logo: {
      width: '330px', // w-[330px] - increased by 50% from 220px (220 * 1.5 = 330)
    },
    card: {
      maxWidth: '28rem', // max-w-md = 28rem (448px) - standard dialog width
      maxHeight: 'calc(100vh - 14rem)', // Account for logo (~4rem) + padding (2rem) + bottom margin (8rem) - increased bottom space
      contentPadding: {
        bottom: '1rem', // pb-4 = 1rem (16px) - reduced bottom padding
        top: '0.75rem', // pt-3 = 0.75rem (12px) - reduced top padding
      },
      headerPadding: {
        top: '1rem', // pt-4 = 1rem (16px) - reduced top padding
        bottom: '0.75rem', // pb-3 = 0.75rem (12px) - reduced bottom padding
      },
    },
    spacing: {
      brandingMarginBottom: '1rem', // mb-4 = 1rem (16px) - spacing below branding section
      logoMarginBottom: '0.75rem', // mb-3 = 0.75rem (12px) - spacing below logo
      badgeMarginBottom: '1rem', // mb-4 = 1rem (16px) - spacing below badge (increased for better separation)
      taglineMarginTop: '0.75rem', // mt-3 = 0.75rem (12px) - spacing above tagline
      formSpacing: '0.625rem', // space-y-2.5 = 0.625rem (10px) - reduced form spacing
      cardHeaderSpacing: '0.375rem', // space-y-1.5 = 0.375rem (6px) - reduced header spacing
    },
  },
} as const;

// Dialog Close Button Constants
export const DIALOG_CLOSE_BUTTON = {
  mobile: {
    size: '1.5rem', // w-6 h-6 = 1.5rem (24px) - smaller for mobile
    iconSize: '1rem', // w-4 h-4 = 1rem (16px) - standard size
    top: '0.5rem', // top-2 = 0.5rem (8px)
    right: '0.5rem', // right-2 = 0.5rem (8px)
    padding: '0', // No padding - just the icon
  },
  desktop: {
    size: '2rem', // w-8 h-8 = 2rem (32px)
    iconSize: '1rem', // w-4 h-4 = 1rem (16px)
    top: '1rem', // top-4 = 1rem (16px)
    right: '1rem', // right-4 = 1rem (16px)
  },
} as const;

// Component Dimensions
export const COMPONENT_DIMENSIONS = {
  settingsPanel: {
    logoWidth: 'w-[337.5px]', // Logo width for about section - increased by 50% from 225px (225 * 1.5 = 337.5)
    logoWidthMobile: 'w-[262.5px]', // Smaller logo for mobile devices - increased by 50% from 175px (175 * 1.5 = 262.5)
  },
  sidebar: {
    logoMaxWidth: '10rem', // Maximum width for sidebar logo (160px = 10rem)
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
    assignee: {
      avatarSize: '1.5rem', // w-6 h-6 = 1.5rem (24px) - assignee avatar size
      textSize: '0.875rem', // text-sm = 0.875rem (14px) - assignee name text size
      gap: '0.5rem', // gap-2 = 0.5rem (8px) - gap between avatar and name
    },
    footer: {
      padding: {
        horizontal: '1.75rem', // px-7 = 1.75rem (28px) - increased from 1.5rem (24px)
        bottom: 'calc(1.5rem + 1rem)', // 1.5rem (24px) + 1rem (16px) = 40px total
        top: {
          mobile: '1rem', // pt-4 = 1rem (16px)
          tablet: '1.25rem', // sm:pt-5 = 1.25rem (20px)
          desktop: '1.5rem', // md:pt-6 = 1.5rem (24px)
        },
      },
      margin: {
        horizontal: '0', // No horizontal margin (changed from -1.5rem)
        bottom: '-1.5rem', // Negative margin to extend to dialog bottom
      },
      lineHeight: '1.625rem', // 26px - line-height for footer content
      gap: {
        mobile: '0.75rem', // gap-3 = 0.75rem (12px)
        tablet: '1rem', // sm:gap-4 = 1rem (16px)
      },
      button: {
        height: '2.5rem', // h-10 = 2.5rem (40px)
        padding: {
          horizontal: {
            small: '1rem', // px-4 = 1rem (16px)
            medium: '1.25rem', // px-5 = 1.25rem (20px)
          },
        },
        gap: {
          mobile: '0.5rem', // gap-2 = 0.5rem (8px)
          tablet: '0.75rem', // sm:gap-3 = 0.75rem (12px)
          icon: {
            mobile: '0.375rem', // gap-1.5 = 0.375rem (6px)
            tablet: '0.5rem', // sm:gap-2 = 0.5rem (8px)
          },
        },
      },
    },
    aiButton: {
      height: '1.75rem', // h-7 = 1.75rem (28px)
      paddingX: '0.5rem', // px-2 = 0.5rem (8px)
      textSize: '0.75rem', // text-xs = 0.75rem (12px)
      iconSize: '0.75rem', // w-3 h-3 = 0.75rem (12px)
    },
    descriptionTextarea: {
      rows: 3, // rows={3} - initial visible rows (using constant value for consistency)
      placeholder: 'Add a description... (Editable - AI Action Plan updates automatically as you type)', // Placeholder text (using constant string for consistency)
      focusClassName: 'focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary', // Focus styles for description textarea (using constant classes for consistency)
      maxHeight: 2000, // Maximum height in pixels (increased to allow unlimited text with scrolling) - using constant value for consistency
      // No character limit - standard practice is to allow unlimited text with proper wrapping
      // Text will wrap naturally and scroll if content exceeds max height
    },
  },
  todayAgenda: {
    dropZoneMinHeight: 'min-h-[400px]',
    emptyStateMinHeight: 'min-h-[300px]',
  },
  /** Month calendar: scale when a day is expanded (desktop) so full month remains visible */
  monthCalendarExpandedScale: 0.82,
  inboxHeader: {
    button: {
      borderRadius: '9999px', // Pill shape (rounded-full equivalent)
      paddingX: {
        mobile: '0.75rem', // px-3 = 0.75rem (12px) - increased for better text fit
        tablet: '0.875rem', // sm:px-3.5 = 0.875rem (14px)
        desktop: '0.5rem', // px-2 = 0.5rem (8px) - reduced to prevent overlap with headline
      },
      paddingY: {
        mobile: '0.375rem', // py-1.5 = 0.375rem (6px) - ensures pill shape
        tablet: '0.375rem', // py-1.5 = 0.375rem (6px)
        desktop: '0.25rem', // py-1 = 0.25rem (4px) - reduced to prevent overlap with headline
      },
      textSize: {
        mobile: '0.625rem', // text-[10px] = 0.625rem (10px)
        desktop: '0.5625rem', // text-[9px] = 0.5625rem (9px) - reduced to prevent overlap
      },
      iconSize: {
        mobile: '0.75rem', // w-3 h-3 = 0.75rem (12px)
        tablet: '0.875rem', // sm:w-3.5 sm:h-3.5 = 0.875rem (14px)
        desktop: '0.5rem', // w-2 h-2 = 0.5rem (8px) - reduced to prevent overlap
      },
      iconMargin: {
        mobile: '0.25rem', // mr-1 = 0.25rem (4px) - spacing between icon and text
        desktop: '0.1875rem', // mr-0.75 = 0.1875rem (3px) - reduced spacing for compact buttons
      },
    },
  },
  appTour: {
    imageMaxHeight: {
      mobile: 'max-h-[400px]',
      tablet: 'sm:max-h-[500px]',
      desktop: 'md:max-h-[600px]',
      combined: 'max-h-[400px] sm:max-h-[500px] md:max-h-[600px]',
    },
  },
} as const;

// Tour-specific constants
export const TOUR_CONSTANTS = {
  // Tour card dimensions
  cardWidth: 384, // w-96 = 384px - Tour card width on desktop
  cardPadding: {
    mobile: '1rem', // p-4 = 1rem (16px)
    desktop: '1rem', // p-4 = 1rem (16px)
  },
  // Spotlight effect
  spotlightPadding: 12, // px - Padding around highlighted element for spotlight cutout
  scrollOffset: 200, // px - Scroll offset to account for tour card on desktop
  // Overlay opacity
  overlayOpacity: {
    light: 0.50, // bg-black/50
    dark: 0.60, // bg-black/60
  },
  cardOpacity: 0.95, // bg-card/95 - Tour card background opacity
  // Animation values
  animation: {
    initialScale: 0.95,
    initialY: 20, // px - Initial Y offset for card animation
    initialYReverse: -20, // px - Reverse Y offset for card animation
  },
  aiRecommendation: {
    containerHeight: 'h-[calc(100vh-8rem)]',
  },
  // Tour styling
  tooltip: {
    borderRadius: 12, // px - Border radius for tooltip
    padding: 20, // px - Padding inside tooltip
  },
  button: {
    fontSize: 14, // px - Font size for buttons
    fontWeight: 600, // Font weight for buttons
    padding: '10px 20px', // Button padding
    borderRadius: 8, // px - Border radius for buttons
    marginRight: 10, // px - Margin right for back button
  },
  spotlight: {
    borderRadius: 8, // px - Border radius for spotlight highlight
    padding: 8, // px - Padding around highlighted element
  },
  scroll: {
    offset: 100, // px - Scroll offset when navigating to elements
  },
  // Tour colors
  colors: {
    primary: APP_THEME_COLOR_PRIMARY, // Primary theme color
    text: {
      light: '#1f2937', // Dark gray for light mode text
      dark: '#ffffff', // White for dark mode text
    },
    background: {
      light: '#ffffff', // White for light mode background
      dark: '#1f2937', // Dark gray for dark mode background
    },
    overlay: {
      light: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black for light mode overlay
      dark: 'rgba(0, 0, 0, 0.7)', // More opaque black for dark mode overlay
    },
    arrow: {
      light: '#ffffff', // White arrow for light mode
      dark: '#1f2937', // Dark gray arrow for dark mode
    },
    muted: {
      light: '#6b7280', // Gray for light mode muted text
      dark: '#9ca3af', // Light gray for dark mode muted text
    },
  },
  // Tour locale strings
  locale: {
    back: 'Back',
    close: 'Close',
    last: 'Get Started! 🎉',
    next: 'Next',
    skip: 'Skip',
  },
  // Tour panel names
  panels: {
    today: 'today',
    inbox: 'inbox',
    ai: 'ai',
  },
  // Tour view modes
  viewModes: {
    month: 'month',
    week: 'week',
    dashboard: 'dashboard',
  },
  // Tour step indices (for panel closing logic)
  stepIndices: {
    closeTodayPanel: 3, // Close Today Agenda panel after step 2 (index 3)
    closeInboxPanel: 5, // Close Inbox panel after step 4 (index 5)
    switchToWeekView: 8, // Switch back to week view (step 8, index 8)
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


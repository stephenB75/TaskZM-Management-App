/**
 * Kanban View Constants
 * Centralized configuration for week/kanban view styling, colors, dimensions, and calculations
 */

import { DEFAULT_WEEKDAY_WORK_START } from './business-constants';
import { DROPPABLE_COLUMN_MIN_HEIGHT_PX, NAV_BAR_BOTTOM_PADDING_MOBILE } from './layout-constants';
import { 
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_PINK,
  COLOR_PASTEL_YELLOW,
} from './color-theme';

// Helper to parse time string to hour
const parseTimeToHour = (timeStr: string): number => {
  const [hours] = timeStr.split(':').map(Number);
  return hours;
};

// Helper function to darken a color for gradient variations
const darkenColor = (hex: string, factor: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.floor((num >> 16) * factor));
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * factor));
  const b = Math.max(0, Math.floor((num & 0x0000FF) * factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Helper function to lighten a color for gradient variations
const lightenColor = (hex: string, factor: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * (1 - factor)));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * (1 - factor)));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * (1 - factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Day Column Colors - Using pastel color constants (NO HARDCODE)
export const KANBAN_DAY_COLORS = {
  monday: {
    header: {
      from: COLOR_PASTEL_MINT, // Mint green pastel
      via: darkenColor(COLOR_PASTEL_MINT, 0.9), // Slightly darker for gradient
      to: darkenColor(COLOR_PASTEL_MINT, 0.85), // Darker for gradient end
      border: darkenColor(COLOR_PASTEL_MINT, 0.65), // Border color
      opacity: 85, // Solid pastel color at 85% opacity (increased for better visibility)
      borderOpacity: 30,
    },
    background: COLOR_PASTEL_MINT,
    backgroundOpacity: 35, // Increased from 20% to 35% for better color visibility
  },
  tuesday: {
    header: {
      from: COLOR_PASTEL_SKY, // Sky blue pastel
      via: darkenColor(COLOR_PASTEL_SKY, 0.9), // Slightly darker for gradient
      to: darkenColor(COLOR_PASTEL_SKY, 0.85), // Darker for gradient end
      border: darkenColor(COLOR_PASTEL_SKY, 0.65), // Border color
      opacity: 70, // Solid pastel color at 70% opacity (no gradient)
      borderOpacity: 30,
    },
    background: COLOR_PASTEL_SKY,
    backgroundOpacity: 20,
  },
  wednesday: {
    header: {
      from: COLOR_PASTEL_LAVENDER, // Lavender pastel
      via: darkenColor(COLOR_PASTEL_LAVENDER, 0.9), // Slightly darker for gradient
      to: darkenColor(COLOR_PASTEL_LAVENDER, 0.85), // Darker for gradient end
      border: darkenColor(COLOR_PASTEL_LAVENDER, 0.65), // Border color
      opacity: 70, // Solid pastel color at 70% opacity (no gradient)
      borderOpacity: 30,
    },
    background: COLOR_PASTEL_LAVENDER,
    backgroundOpacity: 20,
  },
  thursday: {
    header: {
      from: COLOR_PASTEL_PEACH, // Peach pastel
      via: darkenColor(COLOR_PASTEL_PEACH, 0.9), // Slightly darker for gradient
      to: darkenColor(COLOR_PASTEL_PEACH, 0.85), // Darker for gradient end
      border: darkenColor(COLOR_PASTEL_PEACH, 0.65), // Border color
      opacity: 70, // Solid pastel color at 70% opacity (no gradient)
      borderOpacity: 30,
    },
    background: COLOR_PASTEL_PEACH,
    backgroundOpacity: 20,
  },
  friday: {
    header: {
      from: COLOR_PASTEL_LILAC, // Lilac pastel
      via: darkenColor(COLOR_PASTEL_LILAC, 0.9), // Slightly darker for gradient
      to: darkenColor(COLOR_PASTEL_LILAC, 0.85), // Darker for gradient end
      border: darkenColor(COLOR_PASTEL_LILAC, 0.65), // Border color
      opacity: 70, // Solid pastel color at 70% opacity (no gradient)
      borderOpacity: 30,
    },
    background: COLOR_PASTEL_LILAC,
    backgroundOpacity: 20,
  },
  saturday: {
    header: {
      from: COLOR_PASTEL_PINK, // Pink pastel
      via: darkenColor(COLOR_PASTEL_PINK, 0.9), // Slightly darker for gradient
      to: darkenColor(COLOR_PASTEL_PINK, 0.85), // Darker for gradient end
      border: darkenColor(COLOR_PASTEL_PINK, 0.65), // Border color
      opacity: 70, // Solid pastel color at 70% opacity (no gradient)
      borderOpacity: 30,
    },
    background: COLOR_PASTEL_PINK,
    backgroundOpacity: 20,
  },
  sunday: {
    header: {
      from: COLOR_PASTEL_YELLOW, // Yellow pastel
      via: darkenColor(COLOR_PASTEL_YELLOW, 0.9), // Slightly darker for gradient
      to: darkenColor(COLOR_PASTEL_YELLOW, 0.85), // Darker for gradient end
      border: darkenColor(COLOR_PASTEL_YELLOW, 0.65), // Border color
      opacity: 70, // Solid pastel color at 70% opacity (no gradient)
      borderOpacity: 30,
    },
    background: COLOR_PASTEL_YELLOW,
    backgroundOpacity: 20,
  },
  weekend: {
    from: COLOR_PASTEL_LAVENDER, // Use lavender for weekend
    to: darkenColor(COLOR_PASTEL_LAVENDER, 0.98), // Slightly darker variant
    opacity: 70, // Increased from 50% to 70% for better color visibility
  },
  today: {
    ring: '#7B68EE',
    ringOpacity: 40,
    text: '#7B68EE',
    // Enhanced styling for highlighted today column - full pastel color at 100% opacity, no frame/border
    headerOpacity: 100, // Full opacity for maximum visibility
    viaOpacity: 100, // Full opacity for via color
    borderOpacity: 90, // More prominent border opacity (90% vs standard 30%) - deeper, more visible border (not used when noBorder is true)
    borderWidth: '3px', // Thicker border for today (increased from 2px to 3px) (not used when noBorder is true)
    darkModeBackgroundOpacity: 0.50, // 50% opacity for dark mode background - deeper, more visible color (increased from 40%)
    shadowOpacity: 0.45, // 45% opacity for shadow - more prominent shadow (increased from 35%) (not used when noBorder is true)
    // Color darkening factor for today column - set to 1.0 to use full pastel color (no darkening)
    colorDarkeningFactor: 1.0, // Use full pastel color at 100% (1.0 = 100% of original brightness, no darkening)
    // Dark mode ring opacity enhancement
    darkModeRingOpacityIncrease: 30, // Increase ring opacity by 30 for deeper appearance in dark mode (increased from 25) (not used when noBorder is true)
    // Ring and shadow styling for additional visual prominence (not used when noBorder is true)
    ringWidth: 2, // Ring width in pixels
    ringOpacityLight: 70, // Ring opacity in light mode (70% for better visibility, increased from 60%)
    shadowIntensity: 'lg', // Shadow intensity level
    shadowBlur: '8px', // Shadow blur radius
    shadowSpread: '2px', // Shadow spread radius
    // No border/frame styling - clean gradient only
    noBorder: true, // Remove border/frame for today column (clean gradient only)
    borderWidthNone: '0', // CSS value for no border width
    borderColorTransparent: 'transparent', // CSS value for transparent border
    boxShadowNone: 'none', // CSS value for no box shadow
    // Horizontal line indicator above tab for current day
    indicatorLine: {
      height: '6px', // Height of the horizontal line (doubled for visibility)
      widthPercent: 50, // Width as percentage of column (50% = half width)
      marginBottom: '4px', // Space between line and tab
      borderRadius: '2px', // Border radius for rounded corners
      color: '#7B68EE', // Solid lavender color for the indicator line (matches ring and text colors)
    },
  },
  // Standard opacity values for non-highlighted columns (reduced so current day stands out when scrolling)
  standard: {
    viaOpacity: 70, // Standard via opacity for non-today days
    nonTodayHeaderOpacity: 48, // Header/tab opacity for non-today columns (reduced so today column appears brighter)
  },
  // Column background gradient settings - gradient of column tab color
  columnGradient: {
    startOpacity: 45, // Starting opacity for today column (full visibility when scrolling)
    endOpacity: 0, // Ending opacity (fades to white/transparent)
    darkModeStartOpacity: 20, // Starting opacity for today column in dark mode
    darkModeEndOpacity: 2, // Ending opacity for dark mode gradient
    // Reduced opacity for non-today columns so current day stands out when scrolling vertically
    nonTodayStartOpacity: 26, // Non-today column gradient start (light mode)
    nonTodayDarkModeStartOpacity: 11, // Non-today column gradient start (dark mode)
  },
  // Full column wrapper tint (entire column height) so today is visibly brighter when scrolling vertically
  columnWrapper: {
    todayOpacity: 32, // Today column full-height tint (light mode) – clearly brighter
    todayDarkOpacity: 22, // Today column full-height tint (dark mode)
    nonTodayOpacity: 8, // Non-today column tint (light mode) – muted so today pops
    nonTodayDarkOpacity: 5, // Non-today column tint (dark mode)
  },
} as const;

// Background Gradients
export const KANBAN_BACKGROUND_GRADIENTS = {
  mobile: {
    from: '#E4E0EF',
    to: '#DCD6EB',
  },
  desktop: {
    from: 'rgba(128, 128, 128, 0.20)', // 20% gray at the top
    via: 'rgba(200, 200, 200, 0.15)', // Light gray in the middle
    to: '#FFFFFF', // White at the bottom
  },
  dark: {
    from: '#1F2937', // gray-800
    via: '#111827', // gray-900
    to: '#1F2937', // gray-800
  },
} as const;

// Column Dimensions - wider columns so task titles and content are less truncated
export const KANBAN_COLUMN_DIMENSIONS = {
  width: {
    mobile: 360, // px - wider for mobile single column
    tablet: 320, // px - wider for tablets
    desktop: 440, // px - wider for standard desktop (was 386)
    smallMonitor: 400, // px - wider for small monitors (1024px-1280px)
  },
  gap: {
    mobile: 4, // gap-1 = 4px
    tablet: 6, // gap-1.5 = 6px
    desktop: 8, // gap-2 = 8px
  },
  /** Vertical gap (px) between task/event cards in a column. */
  cardsGapPx: 0,
  padding: {
    mobile: 8, // p-2 = 8px
    tablet: 10, // p-2.5 = 10px
    desktop: 12, // p-3 = 12px
  },
  headerPadding: {
    mobile: 6, // p-1.5 = 6px
    tablet: 8, // p-2 = 8px
  },
  contentPadding: {
    mobile: 8, // p-2 = 8px
    tablet: 12, // p-3 = 12px
  },
  cardsContainerMaxWidth: {
    // Max width for cards container: wider cards, minimal gap from column border when centered
    mobile: '98%', // ~1% gap each side
    desktop: '98%',
  },
  // Horizontal margin so cards container is centered and doesn't touch column border
  cardsContainerMargin: '0 auto',
  borderRadius: 16, // rounded-2xl = 16px
} as const;

// Animation Constants
export const KANBAN_ANIMATION = {
  duration: 0.4, // seconds
  delay: 0.2, // seconds - delay before animation starts
  ease: 'easeOut', // Animation easing function
  totalDuration: 0.6, // Total animation time (duration + delay) in seconds
  delayPerColumn: 0.06, // seconds per column index
  easing: [0.25, 0.8, 0.25, 1] as [number, number, number, number],
  transformTransition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  initialY: 20, // px
} as const;

// Zoom Constants
export const KANBAN_ZOOM = {
  minScale: 0.75, // Keep columns readable without shifting layout drastically
  maxScale: 1.0,
  padding: 60, // px total (30px top + 30px bottom)
  resizeDebounce: 100, // ms
  calculateDelay: 200, // ms
  idleCallbackTimeoutMs: 100, // ms - requestIdleCallback timeout for measurement
} as const;

// Scroll Constants
export const KANBAN_SCROLL = {
  speedMultiplier: 0.8,
  initialScrollDelay: 300, // ms - Delay to wait for zoom calculation and column rendering to complete
  zoomBufferMs: 200, // Extra ms after calculateDelay before scroll-to-next-day (ensures zoom applied)
} as const;

// Time Constants
export const KANBAN_TIME = {
  defaultHour: parseTimeToHour(DEFAULT_WEEKDAY_WORK_START), // Default work start time for new tasks
  daysPerWeek: 7,
  /** Scheduling / fetch horizon (e.g. AI scheduler); kanban desktop shows one week (daysPerWeek) */
  daysInWeek: 14,
} as const;

/** Desktop kanban: fit exactly one week in the horizontal viewport */
export const KANBAN_VIEWPORT_WEEK = {
  /** Minimum width per day column before horizontal overflow is allowed */
  minColumnWidthPx: 128,
} as const;

// Mobile View Constants
export const KANBAN_MOBILE = {
  padding: {
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
        mobile: 112, // Match nav bar height (112px)
        tablet: 24, // sm:pb-6 = 24px
      },
    },
  },
  bottomPaddingCalc: NAV_BAR_BOTTOM_PADDING_MOBILE, // Uses nav bar spacer height constant
  indicator: {
    width: 4, // w-1 = 4px
    height: {
      mobile: 20, // h-5 = 20px
      tablet: 24, // sm:h-6 = 24px
    },
  },
  button: {
    height: {
      mobile: 28, // h-7 = 28px
      tablet: 32, // sm:h-8 = 32px
    },
    padding: {
      mobile: 12, // px-3 = 12px
      tablet: 12, // sm:px-3 = 12px
    },
    iconSize: {
      mobile: 14, // w-3.5 h-3.5 = 14px
      tablet: 14, // sm:w-3.5 sm:h-3.5 = 14px
    },
  },
  emptyState: {
    icon: {
      size: {
        mobile: 48, // w-12 h-12 = 48px
        tablet: 64, // sm:w-16 sm:h-16 = 64px
      },
    },
    padding: {
      y: {
        mobile: 48, // py-12 = 48px
        tablet: 80, // sm:py-20 = 80px
      },
    },
  },
} as const;

// Desktop View Constants
export const KANBAN_DESKTOP = {
  emptyState: {
    icon: {
      size: 48, // w-12 h-12 = 48px
    },
    padding: {
      y: 48, // py-12 = 48px
    },
  },
  header: {
    button: {
      size: 24, // h-6 w-6 = 24px
      iconSize: 12, // w-3 h-3 = 12px
    },
  },
} as const;

// Text Sizes
export const KANBAN_TEXT_SIZES = {
  dayIndicator: {
    mobile: 10, // text-[10px]
    tablet: 12, // sm:text-xs = 12px
  },
  dayName: {
    mobile: 12, // text-xs = 12px
    tablet: 14, // sm:text-sm = 14px
  },
  emptyState: {
    mobile: 12, // text-xs = 12px
    tablet: 14, // sm:text-sm = 14px
  },
  button: {
    mobile: 12, // text-xs = 12px
    tablet: 14, // sm:text-sm = 14px
  },
  weekLabel: {
    mobile: 17, // WEEK ONE / WEEK TWO label (20% larger base)
    desktop: 18, // sm and up
  },
} as const;

/** Compact week-group strip above each 7-day block in desktop kanban */
export const KANBAN_WEEK_GROUP_HEADER = {
  paddingY: 6,
  paddingX: 8,
  gap: 8,
  badge: {
    fontSizePx: 10,
    paddingX: 8,
    paddingY: 2,
    letterSpacingEm: 0.06,
    borderRadiusPx: 999,
  },
  dateRange: {
    fontSizePx: 11,
    fontWeight: 500,
  },
  hairlineHeightPx: 1,
  transition: {
    widthPx: 10,
    lineOpacity: 0.35,
    dotSizePx: 4,
    verticalPaddingPx: 12,
    minLineHeightPx: 40,
  },
  columnHeader: {
    dotSizeTodayPx: 10,
    paddingX: 10,
    paddingY: 10,
    fontSizePx: 14,
    fontSizeSmPx: 15,
    dateFontSizePx: 17,
    dateFontSizeSmPx: 18,
    headerGradient: {
      viaOpacityScale: 0.92,
      toOpacityScale: 0.85,
    },
    todayIndicator: {
      heightPx: 3,
      widthScale: 0.6,
      opacity: 0.85,
    },
  },
} as const;

/** Desktop kanban column block height (equal columns, viewport-aware) */
export const KANBAN_COLUMN_HEIGHT = {
  /** Fallback week-group header height when not yet measured */
  weekGroupHeaderFallbackPx: 42,
  /** gap-2 between week label row and day columns */
  weekHeaderToColumnsGapPx: 8,
  /** Today indicator strip above a column (margin + line) */
  todayIndicatorChromePx:
    parseInt(KANBAN_DAY_COLORS.today.indicatorLine.marginBottom, 10)
    + KANBAN_WEEK_GROUP_HEADER.columnHeader.todayIndicator.heightPx,
  /** Day column card header row (padding + label) */
  columnHeaderFallbackPx:
    KANBAN_WEEK_GROUP_HEADER.columnHeader.paddingY * 2 + 28,
  /** Minimum row height for day columns when viewport is not yet measured */
  minRowHeightPx:
    DROPPABLE_COLUMN_MIN_HEIGHT_PX + KANBAN_WEEK_GROUP_HEADER.columnHeader.paddingY * 2 + 28,
  measureDebounceMs: 100,
} as const;

export const KANBAN_WEEK_GROUP_LABELS = ['Week 1', 'Week 2'] as const;

/** Format a 7-day block date range for the kanban week-group header */
export function formatKanbanWeekGroupDateRange(startDate: Date, endDate: Date): string {
  const monthDay: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = startDate.toLocaleDateString('en-US', monthDay);
  const endStr = endDate.toLocaleDateString('en-US', {
    ...monthDay,
    ...(startDate.getFullYear() !== endDate.getFullYear() ? { year: 'numeric' as const } : {}),
  });
  return `${startStr} – ${endStr}`;
}

// Spacing
export const KANBAN_SPACING = {
  taskGap: 8, // space-y-2 = 8px
  headerMargin: {
    mobile: 2, // mb-0.5 = 2px
    tablet: 4, // sm:mb-1 = 4px
  },
  emptyStateMargin: {
    icon: 12, // mb-3 = 12px
    text: 12, // mb-3 = 12px
  },
  contentBottomPadding: {
    mobile: 24, // pb-6 = 24px
    tablet: 32, // sm:pb-8 = 32px
  },
} as const;


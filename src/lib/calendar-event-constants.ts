/**
 * Calendar Event Constants
 * 
 * Centralized constants for CalendarEventCard component styling and dimensions
 */

// Font Sizes
export const CALENDAR_EVENT_FONT_SIZES = {
  providerLabel: '0.625rem', // text-[10px] = 10px = 0.625rem
  time: '0.625rem', // text-[10px] = 10px = 0.625rem
  duration: '0.5625rem', // text-[9px] = 9px = 0.5625rem
  location: '0.625rem', // text-[10px] = 10px = 0.625rem
  title: '0.875rem', // text-sm = 14px = 0.875rem
} as const;

// Component Dimensions
export const CALENDAR_EVENT_DIMENSIONS = {
  verticalLine: {
    width: '4px', // w-1 = 4px (matches task card priority line width)
    minHeight: '40px', // Minimum height for vertical accent line
    leftOffset: {
      mobile: 8, // px-2 = 0.5rem = 8px - aligns with task card text start position (px-2)
      desktop: 8, // px-2 = 0.5rem = 8px - task card headline always uses px-2 regardless of container padding
    },
  },
  contentPadding: {
    left: {
      mobile: 20, // 8px (vertical line position from container edge) + 4px (vertical line width) + 8px (gap) = 20px left padding for content alignment
      desktop: 20, // Same calculation - vertical line is always 8px from container edge, regardless of container padding (px-2 or px-3)
    },
    /** Kanban variant: match task card horizontal padding (px-2 / px-3). Left = gap after vertical line so total from card edge matches task card. */
    kanban: {
      left: { mobile: 4, desktop: 8 },   // 4px (line) + left = 8px mobile / 12px desktop
      right: { mobile: 8, desktop: 12 },  // same as task card px-2 / px-3
    },
  },
  icon: {
    calendar: 12, // Calendar icon size
    clock: 12, // Clock icon size
    mapPin: 12, // Map pin icon size
    repeat: 16, // Repeat icon size for recurring events - increased for better visibility
  },
  height: {
    base: 48, // Minimum height in pixels
    perHour: 40, // Additional height per hour
    max: 160, // Maximum height in pixels
  },
} as const;

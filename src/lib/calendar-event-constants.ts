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
    leftOffset: 8, // px-2 = 0.5rem = 8px - aligns with task card text start position
  },
  contentPadding: {
    left: 20, // 8px (task card text start) + 4px (vertical line width) + 8px (gap) = 20px left padding for content alignment with task cards
  },
  icon: {
    calendar: 12, // Calendar icon size
    clock: 12, // Clock icon size
    mapPin: 12, // Map pin icon size
    repeat: 10, // Repeat icon size for recurring events
  },
  height: {
    base: 48, // Minimum height in pixels
    perHour: 40, // Additional height per hour
    max: 160, // Maximum height in pixels
  },
} as const;

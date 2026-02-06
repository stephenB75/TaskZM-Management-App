/**
 * Calendar Event Constants
 * 
 * Centralized constants for CalendarEventCard component styling and dimensions
 */

// Font Sizes (larger for readability)
export const CALENDAR_EVENT_FONT_SIZES = {
  providerLabel: '0.75rem',   // 12px
  time: '0.75rem',            // 12px
  duration: '0.6875rem',     // 11px
  location: '0.75rem',       // 12px
  title: '1rem',             // 16px
} as const;

// Component Dimensions (increased to accommodate larger text and icons)
export const CALENDAR_EVENT_DIMENSIONS = {
  verticalLine: {
    width: '4px', // w-1 = 4px (matches task card priority line width)
    minHeight: '56px', // Minimum height for vertical accent line
    leftOffset: {
      mobile: 8, // px-2 - aligns with task card text start position
      desktop: 8,
    },
  },
  contentPadding: {
    left: {
      mobile: 20,
      desktop: 20,
    },
    kanban: {
      left: { mobile: 4, desktop: 8 },
      right: { mobile: 8, desktop: 12 },
    },
  },
  icon: {
    calendar: 16, // Larger for visibility
    clock: 16,
    mapPin: 16,
    repeat: 20, // Recurring indicator
  },
  height: {
    base: 64,   // Minimum height in pixels (was 48)
    perHour: 52, // Additional height per hour (was 40)
    max: 220,   // Maximum height in pixels (was 160)
  },
} as const;

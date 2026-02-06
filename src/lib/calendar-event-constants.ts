/**
 * Calendar Event Constants
 * 
 * Centralized constants for CalendarEventCard component styling and dimensions
 */

// Font Sizes (+20% for larger container contents)
export const CALENDAR_EVENT_FONT_SIZES = {
  providerLabel: '0.9rem',    // ~14.4px (was 12px)
  time: '0.9rem',            // ~14.4px
  duration: '0.825rem',      // ~13.2px (was 11px)
  location: '0.9rem',        // ~14.4px
  title: '1.2rem',           // 19.2px (was 16px)
} as const;

// Component Dimensions (+20% for larger container and contents)
export const CALENDAR_EVENT_DIMENSIONS = {
  verticalLine: {
    width: '4px',
    minHeight: '68px', // +20% from 56px
    leftOffset: {
      mobile: 8,
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
    calendar: 19, // +20% from 16
    clock: 19,
    mapPin: 19,
    repeat: 24,   // +20% from 20
  },
  height: {
    base: 77,     // +20% from 64 (min height so contents fit)
    perHour: 62,  // +20% from 52
    max: 264,     // +20% from 220
  },
} as const;

/**
 * Task Calculation Constants
 * Centralized magic numbers for task-related calculations (badge widths, heights, drag-drop, etc.)
 */

// Badge Calculation Constants
export const TASK_CALCULATION_CONSTANTS = {
  badge: {
    averageWidth: 60, // px - average badge width for wrapping calculations
    widths: {
      time: 60, // px
      priority: 50, // px
      tag: 60, // px
      duration: 40, // px
      tracking: 80, // px
    },
    availableWidth: {
      mobile: 240, // px - available width on mobile for badge wrapping
      desktop: 360, // px - available width on desktop for badge wrapping
    },
  },
  
  // Description Calculation Constants
  description: {
    charsPerLine: 50, // Average characters per line for height estimation
    lineHeight: 16, // px - line height for 12px font
    minHeight: 64, // px - minimum height for 4 lines
    padding: 6, // px - bottom padding (mb-1.5)
  },
  
  // Height Calculation Constants
  height: {
    baseShort: {
      mobile: 72, // px
      desktop: 60, // px
    },
    baseLong: 140, // px - base height for long tasks (>= 60 mins)
    minMedium: 80, // px - minimum height for medium tasks (45-59 mins)
  },
  
  // Default Duration
  defaultDurationMinutes: 30, // minutes - default task duration
  
  // Drag and Drop Constants
  dragDrop: {
    activationDistance: 8, // px - activation distance for drag
    defaultHour: 9, // Default hour for scheduling
    hourMin: 8, // Minimum hour for scheduling
    hourMax: 23, // Maximum hour for scheduling
  },
  
  // Time Conflict Constants
  timeConflict: {
    maxHour: 23,
    maxMinute: 0,
  },
} as const;


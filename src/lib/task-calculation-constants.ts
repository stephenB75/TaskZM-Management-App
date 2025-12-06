/**
 * Task Calculation Constants
 * Centralized magic numbers for task-related calculations (badge widths, heights, drag-drop, etc.)
 */

import { DEFAULT_WEEKDAY_WORK_START, AI_SCHEDULER_MAX_END_HOUR } from './business-constants';

// Helper to parse time string to hour
const parseTimeToHour = (timeStr: string): number => {
  const [hours] = timeStr.split(':').map(Number);
  return hours;
};

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
    activationDistance: 10, // px - activation distance for drag (increased for easier initiation)
    defaultHour: parseTimeToHour(DEFAULT_WEEKDAY_WORK_START), // Default work start hour for scheduling
    hourMin: 8, // Minimum hour for scheduling
    hourMax: AI_SCHEDULER_MAX_END_HOUR, // Maximum hour for scheduling (from business-constants)
  },
  
  // Time Conflict Constants
  timeConflict: {
    maxHour: AI_SCHEDULER_MAX_END_HOUR, // Maximum hour (from business-constants)
    maxMinute: 0,
  },
} as const;


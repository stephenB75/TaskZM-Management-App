/**
 * Task Card Constants
 * Centralized configuration for task card styling, colors, sizes, and text
 */

// Priority Colors (for priority line and badges)
export const TASK_CARD_PRIORITY_COLORS = {
  urgent: {
    line: '#EF4444', // Red
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  high: {
    line: '#F97316', // Orange
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  medium: {
    line: '#3B82F6', // Blue
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  low: {
    line: '#9CA3AF', // Grey
    badge: 'bg-gray-50 text-gray-700 border-gray-200',
  },
  default: {
    line: '#E5E7EB',
    badge: 'bg-gray-50 text-gray-600 border-gray-200',
  },
} as const;

// Tag Colors
export const TASK_CARD_TAG_COLORS = {
  background: '#EBF5FB',
  text: '#1565C0',
} as const;

// Primary Theme Colors (for tracking badges, etc.)
export const TASK_CARD_THEME_COLORS = {
  primary: '#7B68EE',
  primaryLight: '#9B87E8',
  gradient: {
    from: '#7B68EE',
    to: '#9B87E8',
  },
} as const;

// Font Sizes
export const TASK_CARD_FONT_SIZES = {
  time: {
    mobile: 'text-[9px]',
    desktop: 'text-[10px]',
  },
  priority: {
    mobile: 'text-[9px]',
    desktop: 'text-[10px]',
  },
  tag: {
    mobile: 'text-[9px]',
    desktop: 'text-[10px]',
  },
  duration: {
    mobile: 'text-[10px]',
    desktop: 'text-[11px]',
  },
  title: {
    mobile: 'text-sm',
    desktop: 'text-base',
  },
  description: 'text-[10px]',
  tracking: {
    mobile: 'text-[7px]',
    desktop: 'text-[8px]',
  },
  trackedTime: {
    mobile: 'text-[8px]',
    desktop: 'text-[9px]',
  },
  subtask: {
    mobile: 'text-[9px]',
    desktop: 'text-[10px]',
  },
  assignedUser: {
    mobile: 'text-[8px]',
    desktop: 'text-[9px]',
  },
  assignedUserName: {
    mobile: 'text-[9px]',
    desktop: 'text-[10px]',
  },
} as const;

// Icon Sizes
export const TASK_CARD_ICON_SIZES = {
  clock: {
    mobile: 'w-2.5 h-2.5',
    desktop: 'w-3 h-3',
  },
  repeat: {
    mobile: 'w-3 h-3',
    desktop: 'w-3.5 h-3.5',
  },
  timer: {
    mobile: 'w-2 h-2',
    desktop: 'w-2.5 h-2.5',
  },
  timerLarge: {
    mobile: 'w-2.5 h-2.5',
    desktop: 'w-3 h-3',
  },
  checkbox: {
    mobile: 'w-3.5 h-3.5',
    desktop: 'w-4 h-4',
  },
  subtask: {
    mobile: 'w-2 h-2',
    desktop: 'w-2.5 h-2.5',
  },
  assignedUser: {
    mobile: 'w-3 h-3',
    desktop: 'w-4 h-4',
  },
} as const;

// Badge Sizes
export const TASK_CARD_BADGE_SIZES = {
  priority: {
    mobile: 'text-[9px] px-1 py-0 h-[16px]',
    desktop: 'text-[10px] px-1.5 py-0 h-[18px]',
  },
  tag: {
    mobile: 'text-[9px] px-1 py-0 h-[16px]',
    desktop: 'text-[10px] px-1.5 py-0 h-[18px]',
  },
  tracking: {
    mobile: 'px-1 py-0.5 gap-0.5 text-[7px]',
    desktop: 'px-1.5 py-0.5 gap-1 text-[8px]',
  },
} as const;

// Card Height Configuration
export const TASK_CARD_HEIGHT_CONFIG = {
  maxHeight: 600,
  defaultDuration: 30, // minutes
  thresholds: {
    short: 45, // minutes
    long: 60, // minutes
  },
  baseHeights: {
    short: {
      base: 80,
      withTracking: 114,
      withAssigned: 114,
      withBoth: 126,
      mobileBase: 108,
    },
    medium: {
      min: 100,
    },
    long: {
      base: 160,
    },
  },
  scalingFactors: {
    short: 0.9,
    medium: 1.2,
    long: 2.0,
  },
  heightMultiplier: 1.247, // For timeline view
} as const;

// Padding and Spacing
export const TASK_CARD_SPACING = {
  padding: {
    mobile: 'px-2 py-1.5',
    desktop: 'md:px-3 md:py-2.5',
  },
  spaceY: {
    mobile: 'space-y-1',
    desktop: 'md:space-y-1.5',
  },
  title: {
    mobile: 'gap-1 px-1 mb-1',
    desktop: 'gap-1.5 px-1 mb-1',
  },
  description: 'px-1.5 py-1 mt-0.5 mb-3',
  bottomPadding: {
    mobile: {
      standard: 'pb-6',
      withComponents: 'pb-8',
      compact: 'pb-2',
    },
    desktop: {
      standard: 'md:pb-8',
      compact: 'md:pb-2.5',
    },
  },
  longTask: {
    mobile: 'py-2.5 pb-10 space-y-2',
    desktop: 'md:py-3.5 md:pb-12 md:space-y-2.5',
  },
  compact: {
    mobile: 'py-1 space-y-1',
    desktop: 'md:py-2 md:space-y-1',
  },
} as const;

// Text Content
export const TASK_CARD_TEXT = {
  tracking: 'Tracking...',
  tracked: 'tracked',
  nextUp: 'NEXT UP',
  moreSubtasks: (count: number) => `+${count} more`,
  moreAssigned: (count: number) => `+${count} more`,
  moreSubtasksFull: (count: number) => `+${count} more subtasks`,
} as const;

// Dropdown Menu Text
export const TASK_CARD_MENU_TEXT = {
  edit: 'Edit',
  markAsTodo: 'Mark as Todo',
  markAsDone: 'Mark as Done',
  delete: 'Delete',
} as const;

// Shadow Values
export const TASK_CARD_SHADOWS = {
  mobile: 'shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.12)]',
  desktop: 'shadow-lg',
  hover: 'hover:shadow-xl',
} as const;

// Border Colors
export const TASK_CARD_BORDERS = {
  mobile: 'border-gray-300/80',
  desktop: 'md:border-gray-300/90',
  hover: 'hover:border-gray-400/90',
} as const;

// Background Colors
export const TASK_CARD_BACKGROUNDS = {
  mobile: 'bg-white',
  desktop: 'bg-white/60 backdrop-blur-sm',
  hover: 'hover:bg-white/80',
} as const;

// Width Values
export const TASK_CARD_WIDTHS = {
  dragging: 'w-[280px]',
  normal: 'w-full',
} as const;

// Line Clamp Values
export const TASK_CARD_LINE_CLAMP = {
  title: 'line-clamp-2',
  description: {
    oneHour: 'line-clamp-2',
    longer: 'line-clamp-4',
  },
} as const;


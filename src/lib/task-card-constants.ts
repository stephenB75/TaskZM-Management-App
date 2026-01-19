/**
 * Task Card Constants
 * Centralized configuration for task card styling, colors, sizes, and text
 */

import { 
  COLOR_PRIMARY, 
  COLOR_BACKGROUND_WHITE, 
  COLOR_BACKGROUND_DARK_COLOR,
  COLOR_BACKGROUND_GRAY,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_WHITE,
  COLOR_BORDER_LIGHT,
  COLOR_BORDER_MEDIUM,
  COLOR_SUCCESS,
  COLOR_WARNING,
  COLOR_PASTEL_SAGE,
  COLOR_PASTEL_SAGE_BORDER,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_PINK,
  COLOR_PASTEL_YELLOW,
  COLOR_PASTEL_MINT,
  getColorWithOpacity,
} from './color-theme';
import { KANBAN_DAY_COLORS } from './kanban-constants';

// Priority Colors (for priority line and badges) - Improved contrast for dark mode
export const TASK_CARD_PRIORITY_COLORS = {
  urgent: {
    line: '#EF4444', // Red
    badge: 'bg-red-50 dark:bg-red-900/70 text-red-700 dark:text-red-100 border-red-200 dark:border-red-700',
  },
  high: {
    line: '#F97316', // Orange
    badge: 'bg-orange-50 dark:bg-orange-900/70 text-orange-700 dark:text-orange-100 border-orange-200 dark:border-orange-700',
  },
  medium: {
    line: '#3B82F6', // Blue
    badge: 'bg-blue-50 dark:bg-blue-900/70 text-blue-700 dark:text-blue-100 border-blue-200 dark:border-blue-700',
  },
  low: {
    line: '#9CA3AF', // Grey
    badge: 'bg-gray-50 dark:bg-gray-700/70 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600',
  },
  default: {
    line: '#E5E7EB',
    badge: 'bg-gray-50 dark:bg-gray-700/70 text-gray-600 dark:text-gray-200 border-gray-200 dark:border-gray-600',
  },
} as const;

// Tag Colors
export const TASK_CARD_TAG_COLORS = {
  background: {
    light: '#EBF5FB',
    dark: 'rgba(59, 130, 246, 0.2)', // blue-500 with 20% opacity for dark mode
  },
  text: {
    light: '#1565C0',
    dark: '#60A5FA', // blue-400 for dark mode
  },
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

// Font Sizes (increased by 10%)
export const TASK_CARD_FONT_SIZES = {
  time: {
    mobile: 'text-[10px]', // 9px * 1.1 = 9.9px ≈ 10px
    desktop: 'text-[11px]', // 10px * 1.1 = 11px
  },
  priority: {
    mobile: 'text-[10px]', // 9px * 1.1 = 9.9px ≈ 10px
    desktop: 'text-[11px]', // 10px * 1.1 = 11px
  },
  tag: {
    mobile: 'text-[10px]', // 9px * 1.1 = 9.9px ≈ 10px
    desktop: 'text-[11px]', // 10px * 1.1 = 11px
  },
  duration: {
    mobile: 'text-[11px]', // 10px * 1.1 = 11px
    desktop: 'text-[12px]', // 11px * 1.1 = 12.1px ≈ 12px
  },
  title: {
    mobile: 'text-[15px]', // text-sm (14px) * 1.1 = 15.4px ≈ 15px
    desktop: 'text-[18px]', // text-base (16px) * 1.1 = 17.6px ≈ 18px
  },
  description: 'text-[13px]', // 12px * 1.1 = 13.2px ≈ 13px
  tracking: {
    mobile: 'text-[8px]', // 7px * 1.1 = 7.7px ≈ 8px
    desktop: 'text-[9px]', // 8px * 1.1 = 8.8px ≈ 9px
  },
  trackedTime: {
    mobile: 'text-[9px]', // 8px * 1.1 = 8.8px ≈ 9px
    desktop: 'text-[10px]', // 9px * 1.1 = 9.9px ≈ 10px
  },
  subtask: {
    mobile: 'text-[10px]', // 9px * 1.1 = 9.9px ≈ 10px
    desktop: 'text-[11px]', // 10px * 1.1 = 11px
  },
  assignedUser: {
    mobile: 'text-[9px]', // 8px * 1.1 = 8.8px ≈ 9px
    desktop: 'text-[10px]', // 9px * 1.1 = 9.9px ≈ 10px
  },
  assignedUserName: {
    mobile: 'text-[10px]', // 9px * 1.1 = 9.9px ≈ 10px
    desktop: 'text-[11px]', // 10px * 1.1 = 11px
  },
} as const;

// Icon Sizes (numeric pixel values for Icon component)
// Tailwind: w-2 = 0.5rem = 8px, w-2.5 = 0.625rem = 10px, w-3 = 0.75rem = 12px, w-3.5 = 0.875rem = 14px, w-4 = 1rem = 16px
export const TASK_CARD_ICON_SIZES = {
  clock: {
    mobile: 10, // w-2.5 = 10px
    desktop: 12, // w-3 = 12px
  },
  repeat: {
    mobile: 12, // w-3 = 12px
    desktop: 14, // w-3.5 = 14px
  },
  timer: {
    mobile: 8, // w-2 = 8px
    desktop: 10, // w-2.5 = 10px
  },
  timerLarge: {
    mobile: 10, // w-2.5 = 10px
    desktop: 12, // w-3 = 12px
  },
  checkbox: {
    mobile: 14, // w-3.5 = 14px
    desktop: 16, // w-4 = 16px
  },
  subtask: {
    mobile: 8, // w-2 = 8px
    desktop: 10, // w-2.5 = 10px
  },
  assignedUser: {
    mobile: 12, // w-3 = 12px
    desktop: 16, // w-4 = 16px
  },
} as const;

// Badge Sizes (font sizes increased by 10%)
export const TASK_CARD_BADGE_SIZES = {
  priority: {
    mobile: 'text-[10px] px-1 py-0 h-[16px]', // 9px * 1.1 = 9.9px ≈ 10px
    desktop: 'text-[11px] px-1.5 py-0 h-[18px]', // 10px * 1.1 = 11px
  },
  tag: {
    mobile: 'text-[10px] px-1 py-0 h-[16px]', // 9px * 1.1 = 9.9px ≈ 10px
    desktop: 'text-[11px] px-1.5 py-0 h-[18px]', // 10px * 1.1 = 11px
  },
  tracking: {
    mobile: 'px-1 py-0.5 gap-0.5 text-[8px]', // 7px * 1.1 = 7.7px ≈ 8px
    desktop: 'px-1.5 py-0.5 gap-1 text-[9px]', // 8px * 1.1 = 8.8px ≈ 9px
  },
} as const;

// Standard Task Card Heights by Duration
export const TASK_CARD_STANDARD_HEIGHTS = {
  at15mins: 100, // 15 minutes = 100px
  at25mins: 160, // 25 minutes = 160px
  at30mins: 220, // 30 minutes = 220px
  at45mins: 300, // 45 minutes = 300px
  at60mins: 380, // 60 minutes = 380px
  at80mins: 430, // 80 minutes = 430px
  at120mins: 500, // 120 minutes = 500px
} as const;

// Card Height Configuration
export const TASK_CARD_HEIGHT_CONFIG = {
  maxHeight: 550, // Capped at 550px
  defaultDuration: 30, // minutes
  thresholds: {
    short: 45, // minutes
    long: 60, // minutes
  },
  baseHeights: {
    short: {
      base: 80, // Minimum height for short tasks (35-44 mins)
      veryShort: 72, // Base height for very short tasks (15 mins) - increased from 56px for better visibility
      // Height increments: +20px for each 15-minute interval from 15 to 45 mins
      // 15-29 mins: 72px, 30-35 mins: 92px (very short - includes 35 mins for auto-adjust), 36-39 mins: 112px, 40-44 mins: 132px
      incrementPer15Mins: 20, // 20px increment per 15-minute interval
      withTracking: 90, // With tracking badge
      withAssigned: 90, // With assigned users
      withBoth: 100, // With both components
      compact: 72, // Compact minimum for very short tasks - increased from 56px
      // Transition heights for scaling
      transitionToMedium: 132, // Height at 45 mins (max for short tasks with increments)
    },
    medium: {
      min: 120, // Minimum height for medium tasks
      compact: 120, // Compact minimum
      // Transition heights for scaling
      transitionFromShort: 120, // Height at 45 mins (start of medium range)
      transitionToLong: 170, // Height at 60 mins (max for medium tasks)
    },
  long: {
    base: 200, // Base height for long tasks (60 mins)
    baseWithComponents: 200, // Base height for 1-hour tasks
    incrementPerHour: 200, // Legacy - kept for backward compatibility
    // Standard base heights by duration - scale from 200px to 500px
    at60mins: 200, // 60 mins - start of long range
    at90mins: 275, // 90 mins - interpolated
    at120mins: 350, // 120 mins - interpolated
    at150mins: 425, // 150 mins - interpolated
    at180mins: 500, // 180 mins - max base height
    beyond180mins: 500, // >180 mins - cap at 500px base
    minHeight: 200, // Minimum height for long tasks (60 mins)
    maxHeightAfterAdjustment: 550, // Maximum height after auto-adjustment (capped at 550px)
    // Duration thresholds for height selection
    durationThresholds: {
      at90mins: 90, // minutes
      at120mins: 120, // minutes
      at150mins: 150, // minutes
      at180mins: 180, // minutes
    },
  },
  },
  scalingFactors: {
    short: 0.9,
    medium: 1.2,
    long: 2.0, // Legacy - kept for backward compatibility, but using incrementPerHour instead
  },
  heightMultiplier: 1.247, // For timeline view
  // Component height adjustments
  componentHeights: {
    badgeWrap: 24, // Extra height if badges wrap (one line height)
    assignedUsers: {
      base: 20, // Avatar + name height
      spacing: {
        standard: 20, // Standard spacing
        reduced: 16, // Reduced spacing when description has mb-0
      },
    },
    pomodoroTimer: 40, // Height for pomodoro timer (long tasks only)
    trackedTime: 24, // Height for tracked time display (medium and long tasks)
    description: {
      bottomPadding: {
        standard: 6, // mb-1.5 = 6px when subtasks present or no assigned users
        noGap: 0, // mb-0 when assigned users follow directly
      },
    },
    subtask: {
      itemHeight: 14, // Height per subtask item
      spacing: {
        mobile: 2, // space-y-0.5 = 2px on mobile
        desktop: 4, // space-y-1 = 4px on desktop
      },
      topSpacing: 6, // Top spacing when description is present
    },
  },
} as const;

export const TASK_CARD_LAYOUT_METRICS = {
  pixelsPerMinute:
    TASK_CARD_HEIGHT_CONFIG.baseHeights.long.at60mins /
    TASK_CARD_HEIGHT_CONFIG.thresholds.long, // 200px / 60 mins ≈ 3.33px per minute
  minGapPx: 0, // No minimum gap - tasks stack directly on top of each other for minimal spacing
  timelineTaskSpacing: 20, // Fixed spacing between tasks in timeline view (20px)
  timelineScrollOffset: 200, // Scroll offset for timeline view (200px)
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
  description: 'px-1.5 py-1 mt-0.5 mb-1.5',
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
    mobile: 'py-2.5 pb-8 space-y-1.5',
    desktop: 'md:py-3 md:pb-8 md:space-y-1.5',
  },
  compact: {
    mobile: 'py-1 space-y-1',
    desktop: 'md:py-2 md:space-y-1',
  },
  // Task type specific padding
  short: {
    mobile: 'px-2 py-1 pb-1',
    desktop: 'md:px-3 md:py-1.5 md:pb-1.5',
  },
  medium: {
    mobile: {
      standard: 'px-2 py-1.5 pb-2',
      withComponents: 'px-2 py-1.5 pb-3',
    },
    desktop: {
      standard: 'md:px-3 md:py-2.5 md:pb-2',
      withComponents: 'md:px-3 md:py-2.5 md:pb-4',
    },
  },
  long: {
    mobile: {
      standard: 'px-2 py-2 pb-2',
      withComponents: 'px-2 py-2 pb-2', // Reduced from pb-3 to pb-2 (8px) since assigned users are absolutely positioned
    },
    desktop: {
      standard: 'md:px-3 md:py-2 md:pb-2',
      withComponents: 'md:px-3 md:py-2 md:pb-2', // Reduced from pb-4 to pb-2 (8px) since assigned users are absolutely positioned
    },
  },
  fallback: {
    mobile: 'px-2 py-1.5 pb-2',
    desktop: 'md:px-3 md:py-2.5 md:pb-2',
  },
  // Timeline view specific padding
  timeline: {
    base: 'px-2 py-1.5 space-y-1 md:px-3 md:py-2.5 md:space-y-1.5',
    short: {
      mobile: 'py-1 space-y-1',
      desktop: 'md:py-2 md:space-y-1',
      withComponents: 'py-1 space-y-1',
    },
    long: {
      mobile: 'py-2.5 pb-10 space-y-2',
      desktop: 'md:py-3.5 md:pb-12 md:space-y-2.5',
    },
    bottomPadding: {
      mobile: {
        standard: 'pb-6',
        withComponents: 'pb-8',
      },
      desktop: 'md:pb-8',
    },
  },
  // Gap values
  gap: {
    card: 'gap-2', // Gap between priority line and card
    timeline: 'gap-3', // Gap in timeline view
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
  // Timeline view shadows
  timeline: {
    mobile: 'shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.12)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.4)]',
    desktop: 'shadow-lg dark:shadow-xl',
    hover: 'hover:shadow-xl dark:hover:shadow-2xl',
  },
} as const;

// Border Colors
export const TASK_CARD_BORDERS = {
  mobile: 'border-gray-300/80',
  desktop: 'md:border-gray-300/90',
  hover: 'hover:border-gray-400/90',
  // Timeline view borders
  timeline: {
    mobile: 'border-b border-r border-gray-300/80 dark:border-gray-600/50',
    desktop: 'md:border-gray-300/90 dark:md:border-gray-600/60',
    hover: 'hover:border-gray-400/90 dark:hover:border-gray-500/70',
  },
  // Priority line styling
  priorityLine: {
    className: 'w-1 h-1/2 rounded-full flex-shrink-0 self-center',
  },
} as const;

// Background Colors - Use lighter backgrounds in dark mode for better visibility
export const TASK_CARD_BACKGROUNDS = {
  mobile: 'bg-white dark:bg-[#3E3E52]', // Lighter dark background for better visibility
  desktop: 'bg-white/60 dark:bg-[#3E3E52]/80 backdrop-blur-sm', // Lighter with transparency
  hover: 'hover:bg-white/80 dark:hover:bg-[#4A4A5E]', // Slightly lighter on hover
  // Timeline view backgrounds
  timeline: {
    mobile: 'bg-white dark:bg-[#3E3E52]',
    desktop: 'bg-white/60 dark:bg-[#3E3E52]/80 backdrop-blur-sm',
    hover: 'hover:bg-white/80 dark:hover:bg-[#4A4A5E]',
  },
} as const;

// Width Values
export const TASK_CARD_WIDTHS = {
  dragging: 'w-[386px]', // Increased by 15% from 336px to match wider columns
  normal: 'w-full',
} as const;

// Line Clamp Values
export const TASK_CARD_LINE_CLAMP = {
  title: 'line-clamp-2',
  description: {
    under45mins: 'line-clamp-1', // Tasks under 45 minutes: 1 line
    oneHour: 'line-clamp-2', // Tasks 45-60 minutes: 2 lines
    longer: 'line-clamp-4', // Tasks 60+ minutes: 4 lines
  },
} as const;

// Calculation Constants
export const TASK_CARD_CALCULATIONS = {
  badgeWidths: {
    time: 60,
    priority: 50,
    tag: 60,
    duration: 40,
    tracking: 80,
    average: 60,
  },
  availableWidth: {
    mobile: 276, // Available width for badge calculations on mobile (increased by 15% from 240px)
    desktop: 497, // Available width for badge calculations on desktop (increased by 15% from 432px to match wider columns)
  },
  description: {
    charsPerLine: 50,
    lineHeight: 16, // px for 12px font
    minHeight: 64, // px minimum for 4 lines
  },
  subtask: {
    height: 14, // px per subtask
    spacing: 2, // px between subtasks
  },
  assignedUser: {
    avatarSize: {
      mobile: { width: 12, height: 12 }, // w-3 h-3
      desktop: { width: 16, height: 16 }, // w-4 h-4
    },
    nameMaxWidth: {
      mobile: 40, // px
      desktop: 60, // px
    },
    containerOffset: {
      mobile: 64, // px for max-w-[calc(100%-64px)] - accounts for 8px left + 8px right (pomodoro) + 48px pomodoro width
      desktop: 80, // px for max-w-[calc(100%-80px)]
    },
  },
  priorityLine: {
    width: 4, // w-1 = 4px
    height: '50%', // h-1/2
    minHeight: 80, // min-h-[80px] - doubled from 40px
  },
  padding: {
    short: {
      top: { mobile: 4, desktop: 6 }, // py-1 or py-1.5
      bottom: { mobile: 4, desktop: 6 }, // pb-1 or pb-1.5
    },
    medium: {
      top: { mobile: 6, desktop: 10 }, // py-1.5 or py-2.5
      bottom: { 
        noComponents: { mobile: 8, desktop: 8 }, // pb-2
        withComponents: { mobile: 12, desktop: 16 }, // pb-3 or pb-4
      },
    },
    long: {
      top: 8, // py-2
      bottom: {
        noComponents: 8, // pb-2
        withComponents: { mobile: 12, desktop: 16 }, // pb-3 or pb-4
      },
    },
    description: {
      bottom: {
        standard: 6, // mb-1.5
        noGap: 0, // mb-0 when assigned users follow
      },
    },
    assignedUsers: {
      standard: 24, // px
      noGap: 20, // px when description has mb-0
    },
  },
} as const;

// Rich Text Editor Colors
export const TASK_CARD_RICH_TEXT_COLORS = {
  mark: {
    light: 'bg-yellow-200',
    dark: 'dark:bg-yellow-800',
  },
  code: {
    light: 'bg-gray-100',
    dark: 'dark:bg-muted',
    // Code block padding and styling
    padding: 'px-1 py-0.5',
    rounded: 'rounded',
    fontSize: 'text-[13px]',
    fontFamily: 'font-mono',
  },
} as const;

// Assigned User Avatar Colors
export const TASK_CARD_ASSIGNED_USER_COLORS = {
  gradient: 'bg-gradient-to-br from-purple-100 to-pink-100',
  text: 'text-purple-700',
  // Avatar sizes
  avatar: {
    mobile: {
      width: 12, // w-3 = 12px
      height: 12, // h-3 = 12px
    },
    desktop: {
      width: 16, // w-4 = 16px
      height: 16, // h-4 = 16px
    },
  },
} as const;

// Text Colors - Light colors for dark backgrounds in dark mode
// AI Action Plan text size
export const TASK_CARD_AI_ACTION_PLAN_TEXT_SIZE = '12px'; // All text in AI Action Plan uses 12px

export const TASK_CARD_TEXT_COLORS = {
  description: 'text-gray-500 dark:text-gray-300',
  assignedUserName: 'text-gray-600 dark:text-gray-200',
  assignedUserCount: 'text-gray-500 dark:text-gray-300',
  subtaskCompleted: 'text-gray-400 dark:text-gray-400',
  tooltipEmail: 'text-gray-400 dark:text-gray-300',
  icon: 'text-gray-400 dark:text-gray-300',
  checkbox: {
    default: 'text-gray-300 dark:text-gray-400',
    hover: 'hover:text-gray-400 dark:hover:text-gray-300',
  },
} as const;

// Positioning Values
export const TASK_CARD_POSITIONING = {
  assignedUsers: {
    bottom: {
      mobile: 8, // 8px from bottom (matches card padding px-2 = 8px for proper clearance)
      desktop: 10, // bottom-2.5 = 10px (matches padding pb-2.5 = 10px, leaving adequate clearance)
    },
    left: {
      mobile: 8, // 8px from left (matches card padding px-2 = 8px for proper clearance)
      desktop: 10, // left-2.5 = 10px (matches padding px-3 = 12px, leaving 2px clearance)
    },
    // Timeline view positioning
    timeline: {
      mobile: 'bottom-2 left-2 gap-1',
      desktop: 'bottom-2.5 left-2.5 gap-2',
    },
  },
  // Timeline line positioning
  timelineLine: {
    minHeight: 8, // Minimum visible line height in px
    width: 2, // Line width in px
  },
} as const;

// Font Sizes (Additional - for assigned users and tooltips, increased by 10%)
export const TASK_CARD_ADDITIONAL_FONT_SIZES = {
  assignedUserInitials: {
    mobile: 'text-[8px]', // 7px * 1.1 = 7.7px ≈ 8px
    desktop: 'text-[9px]', // 8px * 1.1 = 8.8px ≈ 9px
  },
  assignedUserNameInline: {
    mobile: 'text-[9px]', // 8px * 1.1 = 8.8px ≈ 9px
    desktop: 'text-[10px]', // 9px * 1.1 = 9.9px ≈ 10px
  },
  assignedUserCount: {
    mobile: 'text-[9px]', // 8px * 1.1 = 8.8px ≈ 9px
    desktop: 'text-[10px]', // 9px * 1.1 = 9.9px ≈ 10px
  },
  tooltipEmail: 'text-[13px]', // text-xs (12px) * 1.1 = 13.2px ≈ 13px
} as const;

// Opacity Values
export const TASK_CARD_OPACITY = {
  done: 60, // opacity-60 for completed tasks
  dragging: 70, // opacity-70 for dragging state
  draggingKanban: 30, // opacity-30 for Kanban dragging state
  overlay: 95, // opacity-95 for drag overlay
  timelineLine: {
    nextUp: 'CC', // 80% opacity hex for Next Up timeline line
  },
} as const;

// Timeline View Constants
export const TASK_CARD_TIMELINE = {
  badge: {
    height: 20, // Badge height in px
    margin: 4, // mb-1 = 4px
  },
  rowGap: {
    mobile: 2, // gap between badge row and headline row on mobile
    desktop: 6, // gap between badge row and headline row on desktop
  },
  headline: {
    lineHeight: {
      mobile: 22, // text-[15px] line-height (increased by 10%)
      desktop: 27, // text-[18px] line-height (increased by 10%)
    },
  },
  timeLabel: {
    height: 18, // text-[13px] height (increased by 10%)
    margin: 4, // mb-1 = 4px
  },
  nextUp: {
    ring: 'ring-2 ring-primary/20',
  },
  scale: {
    dragging: 'scale-95', // scale-95 for dragging state
    draggingKanban: 'scale-95', // scale-95 for Kanban dragging state
    hover: 'hover:scale-[1.005]', // Reduced magnification for Today Agenda (was 1.01)
    hoverKanban: 'hover:scale-[1.02]', // Hover scale for Kanban cards
    todayAgenda: 0.9, // Scale transform for today agenda task cards (reduced magnification)
    kanban: 0.85, // Scale transform for kanban week view task cards
  },
} as const;

// Dropdown Tab Colors - Domain-based pastel colors (using app pastel theme colors)
// Each task domain gets a different pastel color for the dropdown background
export const TASK_CARD_DROPDOWN_DOMAIN_COLORS: Record<string, { light: string; dark: string }> = {
  business: {
    light: COLOR_PASTEL_SKY, // Sky blue pastel for business domain
    dark: getColorWithOpacity(COLOR_PASTEL_SKY, 0.3), // Muted sky for dark mode
  },
  home: {
    light: COLOR_PASTEL_MINT, // Mint green pastel for home domain
    dark: getColorWithOpacity(COLOR_PASTEL_MINT, 0.3), // Muted mint for dark mode
  },
  personal: {
    light: COLOR_PASTEL_LAVENDER, // Lavender pastel for personal domain
    dark: getColorWithOpacity(COLOR_PASTEL_LAVENDER, 0.3), // Muted lavender for dark mode
  },
  world: {
    light: COLOR_PASTEL_PEACH, // Peach pastel for world domain
    dark: getColorWithOpacity(COLOR_PASTEL_PEACH, 0.3), // Muted peach for dark mode
  },
  mixed: {
    light: COLOR_PASTEL_SAGE, // Sage green pastel for mixed domain (default)
    dark: getColorWithOpacity(COLOR_PASTEL_SAGE, 0.3), // Muted sage for dark mode
  },
  default: {
    light: COLOR_PASTEL_SAGE, // Sage green pastel as default
    dark: getColorWithOpacity(COLOR_PASTEL_SAGE, 0.3), // Muted sage for dark mode
  },
} as const;

// Available pastel colors for random dropdown assignment (excluding kanban column colors)
export const DROPDOWN_PASTEL_COLORS = [
  COLOR_PASTEL_SKY,      // #C9E4F7
  COLOR_PASTEL_LAVENDER, // #E6D5F0
  COLOR_PASTEL_PEACH,    // #FFD6BA
  COLOR_PASTEL_LILAC,    // #E1D4F0
  COLOR_PASTEL_PINK,     // #FFD6E8
  COLOR_PASTEL_YELLOW,   // #FFF4CC
  COLOR_PASTEL_SAGE,     // #D4E8D4
  COLOR_PASTEL_MINT,     // #B8E6D5
] as const;

// Kanban column background colors (to exclude from dropdown colors)
// Extracted from KANBAN_DAY_COLORS to avoid hardcoding
export const KANBAN_COLUMN_BACKGROUND_COLORS = [
  KANBAN_DAY_COLORS.monday.background,
  KANBAN_DAY_COLORS.tuesday.background,
  KANBAN_DAY_COLORS.wednesday.background,
  KANBAN_DAY_COLORS.thursday.background,
  KANBAN_DAY_COLORS.friday.background,
  KANBAN_DAY_COLORS.saturday.background,
  KANBAN_DAY_COLORS.sunday.background,
] as const;

/**
 * Get column background color from date string (YYYY-MM-DD format)
 */
function getColumnColorFromDate(dateString: string): string | null {
  try {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    const dayMap: Record<number, keyof typeof KANBAN_DAY_COLORS> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    
    const dayKey = dayMap[dayOfWeek];
    if (dayKey && KANBAN_DAY_COLORS[dayKey] && 'background' in KANBAN_DAY_COLORS[dayKey]) {
      return KANBAN_DAY_COLORS[dayKey].background;
    }
  } catch (e) {
    // Invalid date string, return null
  }
  return null;
}

/**
 * Get a random pastel color for dropdown that's different from the column color
 * Uses task ID for consistent color assignment per task
 */
export function getRandomDropdownColor(
  taskId: string,
  droppableId?: string | null,
  isDark: boolean = false
): { light: string; dark: string } {
  // Get column background color from droppableId (date string)
  const columnBackgroundColor = droppableId ? getColumnColorFromDate(droppableId) : null;
  
  // Filter out column color from available colors
  const availableColors = DROPDOWN_PASTEL_COLORS.filter(
    color => !columnBackgroundColor || color.toLowerCase() !== columnBackgroundColor.toLowerCase()
  );
  
  // If all colors are filtered out (shouldn't happen), use all colors
  const colorsToUse = availableColors.length > 0 ? availableColors : DROPDOWN_PASTEL_COLORS;
  
  // Use task ID to generate a consistent random index (seeded random)
  // Simple hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    const char = taskId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Get color index from hash
  const colorIndex = Math.abs(hash) % colorsToUse.length;
  const selectedColor = colorsToUse[colorIndex];
  
  return {
    light: selectedColor,
    dark: getColorWithOpacity(selectedColor, 0.3),
  };
}

// Badge colors for Description, Subtasks, and Dependencies (light grey background for all)
export const TASK_CARD_DROPDOWN_BADGE_COLORS = {
  description: {
    background: COLOR_BACKGROUND_GRAY, // Light grey for Description badge
    text: COLOR_TEXT_PRIMARY, // Dark text on light background
  },
  subtasks: {
    background: COLOR_BACKGROUND_GRAY, // Light grey for Subtasks badge
    text: COLOR_TEXT_PRIMARY, // Dark text on light background
  },
  dependencies: {
    background: COLOR_BACKGROUND_GRAY, // Light grey for Dependencies badge
    text: COLOR_TEXT_PRIMARY, // Dark text on light background
  },
} as const;

// Base dropdown colors (for borders, hover, etc.)
export const TASK_CARD_DROPDOWN_COLORS = {
  background: {
    light: COLOR_PASTEL_SAGE, // Default sage green (will be overridden by domain)
    dark: getColorWithOpacity(COLOR_PASTEL_SAGE, 0.3), // Default muted sage
  },
  border: {
    light: getColorWithOpacity(COLOR_PASTEL_SAGE_BORDER, 0.3), // Soft green border for light mode (complements sage)
    dark: getColorWithOpacity(COLOR_PASTEL_SAGE_BORDER, 0.4), // Soft green border for dark mode
  },
  tab: {
    active: {
      background: COLOR_PRIMARY, // Primary color for active tab
      text: COLOR_TEXT_WHITE, // White text on active tab
    },
    inactive: {
      background: 'transparent',
      text: COLOR_TEXT_SECONDARY, // Secondary text for inactive tabs (on pastel background)
      darkText: COLOR_TEXT_MUTED, // Muted text for inactive tabs in dark mode
    },
  },
  content: {
    text: {
      light: COLOR_TEXT_PRIMARY, // Dark text for light mode (on pastel background)
      dark: COLOR_TEXT_WHITE, // White text for dark mode
    },
    muted: {
      light: COLOR_TEXT_SECONDARY, // Secondary text for light mode (on pastel background)
      dark: COLOR_TEXT_MUTED, // Muted text for dark mode
    },
  },
  hover: {
    background: {
      light: getColorWithOpacity(COLOR_PASTEL_SAGE_BORDER, 0.2), // Soft green hover for light mode (on pastel background)
      dark: getColorWithOpacity(COLOR_PASTEL_SAGE, 0.2), // Muted sage hover for dark mode
    },
    opacity: 0.5, // Hover opacity for buttons
  },
  subtask: {
    hover: {
      background: {
        light: getColorWithOpacity(COLOR_PASTEL_SAGE_BORDER, 0.2), // Soft green hover for subtasks in light mode
        dark: getColorWithOpacity(COLOR_PASTEL_SAGE, 0.2), // Muted sage hover for subtasks in dark mode
      },
    },
    border: {
      light: COLOR_PASTEL_SAGE_BORDER, // Soft green border for subtask checkbox (on pastel background)
      dark: COLOR_PASTEL_SAGE_BORDER, // Soft green border for subtask checkbox
    },
    text: {
      light: COLOR_TEXT_PRIMARY, // Dark text for subtasks (on pastel background)
      dark: COLOR_TEXT_WHITE, // White text for subtasks
    },
    completed: {
      opacity: 0.6, // Opacity for completed subtasks
    },
  },
  dependency: {
    complete: {
      background: {
        light: getColorWithOpacity(COLOR_SUCCESS, 0.1), // Light green background for completed dependencies
        dark: getColorWithOpacity(COLOR_SUCCESS, 0.2), // Dark green background for completed dependencies
      },
      border: {
        light: getColorWithOpacity(COLOR_SUCCESS, 0.3), // Light green border
        dark: getColorWithOpacity(COLOR_SUCCESS, 0.3), // Dark green border
      },
      indicator: COLOR_SUCCESS, // Green indicator for completed
    },
    incomplete: {
      background: {
        light: getColorWithOpacity(COLOR_WARNING, 0.1), // Light amber background for incomplete dependencies
        dark: getColorWithOpacity(COLOR_WARNING, 0.2), // Dark amber background for incomplete dependencies
      },
      border: {
        light: getColorWithOpacity(COLOR_WARNING, 0.3), // Light amber border
        dark: getColorWithOpacity(COLOR_WARNING, 0.3), // Dark amber border
      },
      indicator: COLOR_WARNING, // Amber indicator for incomplete
    },
    text: {
      light: COLOR_TEXT_PRIMARY, // Dark text for dependencies (on pastel background)
      dark: COLOR_TEXT_WHITE, // White text for dependencies
    },
  },
} as const;

// Dropdown Tab Dimensions and Spacing
export const TASK_CARD_DROPDOWN = {
  fontSizes: {
    base: 14, // Base font size in px
    zoomed: 16, // Font size when zoomed out (+2px)
    badge: 12, // Badge text size in px
    small: 10, // Small text size in px
    tiny: 8, // Tiny text size in px
  },
  dimensions: {
    badge: {
      height: 20, // h-5 = 20px
      paddingX: 8, // px-2 = 8px
      paddingY: 0, // No vertical padding
    },
    icon: {
      small: 12, // w-3 h-3 = 12px
      medium: 16, // w-4 h-4 = 16px
    },
    header: {
      paddingX: 12, // px-3 = 12px
      paddingY: 8, // py-2 = 8px
    },
    content: {
      paddingX: 8, // px-2 = 8px
      paddingBottom: 8, // pb-2 = 8px
      marginTop: 8, // mt-2 = 8px
      padding: 8, // p-2 = 8px
    },
    tabsList: {
      height: 28, // h-7 = 28px
    },
    tabsTrigger: {
      height: 24, // h-6 = 24px
      paddingX: 8, // px-2 = 8px
    },
    subtask: {
      padding: 6, // p-1.5 = 6px
      gap: 8, // gap-2 = 8px
      checkbox: {
        size: 12, // w-3 h-3 = 12px
      },
    },
    dependency: {
      padding: 6, // p-1.5 = 6px
      gap: 8, // gap-2 = 8px
      indicator: {
        size: 12, // w-3 h-3 = 12px
      },
    },
  },
  spacing: {
    badgeGap: 8, // gap-2 = 8px between badges
    iconMargin: 4, // mr-1 = 4px margin right for icons
    tabsGap: 4, // gap-1 = 4px between tabs
    attachmentGap: 0, // No gap - dropdown attached directly to card
    // Alignment with compact card (excluding priority line)
    cardOffset: {
      left: TASK_CARD_CALCULATIONS.priorityLine.width + 8, // priority line width (4px) + gap-2 (8px) = 12px
    },
    // Horizontal inset to respect task card corner radius (rounded-lg = 8px)
    cornerInset: {
      horizontal: 8, // 8px inset on each side to stay away from corner radius
    },
  },
  text: {
    description: 'Description',
    subtasks: 'Subtasks',
    dependencies: 'Dependencies',
  },
} as const;


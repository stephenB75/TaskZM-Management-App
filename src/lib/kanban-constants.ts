/**
 * Kanban View Constants
 * Centralized configuration for week/kanban view styling, colors, dimensions, and calculations
 */

// Day Column Colors
export const KANBAN_DAY_COLORS = {
  monday: {
    header: {
      from: '#B4E4CE',
      via: '#A8DCC4',
      to: '#9FD9BF',
      border: '#7BC9A5',
      opacity: 80,
      borderOpacity: 30,
    },
    background: '#B4E4CE',
    backgroundOpacity: 20,
  },
  tuesday: {
    header: {
      from: '#C9E4F7',
      via: '#B3D9F2',
      to: '#A8DAFF',
      border: '#7BC8FF',
      opacity: 80,
      borderOpacity: 30,
    },
    background: '#C9E4F7',
    backgroundOpacity: 20,
  },
  wednesday: {
    header: {
      from: '#E6D5F0',
      via: '#D4C5F9',
      to: '#C7B8EA',
      border: '#B8A4E6',
      opacity: 80,
      borderOpacity: 30,
    },
    background: '#E6D5F0',
    backgroundOpacity: 20,
  },
  thursday: {
    header: {
      from: '#FFD6BA',
      via: '#FFC9A3',
      to: '#FFB88C',
      border: '#FFA875',
      opacity: 80,
      borderOpacity: 30,
    },
    background: '#FFD6BA',
    backgroundOpacity: 20,
  },
  friday: {
    header: {
      from: '#F4D9F4',
      via: '#E8C5E8',
      to: '#DFB8DF',
      border: '#D4A6D4',
      opacity: 80,
      borderOpacity: 30,
    },
    background: '#F4D9F4',
    backgroundOpacity: 20,
  },
  saturday: {
    header: {
      from: '#FFD9E8',
      via: '#FFC9DD',
      to: '#FFB5D5',
      border: '#FFA0CC',
      opacity: 80,
      borderOpacity: 30,
    },
    background: '#FFD9E8',
    backgroundOpacity: 20,
  },
  sunday: {
    header: {
      from: '#FFF9E3',
      via: '#FFF4D1',
      to: '#FFEFC0',
      border: '#FFE8A0',
      opacity: 80,
      borderOpacity: 30,
    },
    background: '#FFF9E3',
    backgroundOpacity: 20,
  },
  weekend: {
    from: '#E6D5F0',
    to: '#E1D4F0',
    opacity: 50,
  },
  today: {
    ring: '#7B68EE',
    ringOpacity: 40,
    text: '#7B68EE',
  },
} as const;

// Background Gradients
export const KANBAN_BACKGROUND_GRADIENTS = {
  mobile: {
    from: '#E4E0EF',
    to: '#DCD6EB',
  },
  desktop: {
    from: '#F9F7FD',
    via: '#FFFFFF',
    to: '#F3F0F9',
  },
  dark: {
    from: '#1F2937', // gray-800
    via: '#111827', // gray-900
    to: '#1F2937', // gray-800
  },
} as const;

// Column Dimensions
export const KANBAN_COLUMN_DIMENSIONS = {
  width: {
    mobile: 280, // px - for mobile single column (unchanged)
    tablet: 240, // px - narrower for tablets to fit more columns (unchanged)
    desktop: 336, // px - increased by 20% from 280px for standard desktop width
    smallMonitor: 312, // px - increased by 20% from 260px for small monitors (1024px-1280px)
  },
  gap: {
    mobile: 4, // gap-1 = 4px
    tablet: 6, // gap-1.5 = 6px
    desktop: 8, // gap-2 = 8px
  },
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
  borderRadius: 16, // rounded-2xl = 16px
} as const;

// Animation Constants
export const KANBAN_ANIMATION = {
  duration: 0.4, // seconds
  delayPerColumn: 0.06, // seconds per column index
  easing: [0.25, 0.8, 0.25, 1] as [number, number, number, number],
  transformTransition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  initialY: 20, // px
} as const;

// Zoom Constants
export const KANBAN_ZOOM = {
  minScale: 0.35,
  maxScale: 1.0,
  padding: 60, // px total (30px top + 30px bottom)
  resizeDebounce: 100, // ms
  calculateDelay: 200, // ms
} as const;

// Scroll Constants
export const KANBAN_SCROLL = {
  speedMultiplier: 0.8,
} as const;

// Time Constants
export const KANBAN_TIME = {
  defaultHour: 9, // 9 AM default time for new tasks
  daysInWeek: 14,
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
        mobile: 96, // pb-24 = 96px
        tablet: 24, // sm:pb-6 = 24px
      },
    },
  },
  bottomPaddingCalc: 'calc(6rem + env(safe-area-inset-bottom, 0px))',
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
} as const;

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


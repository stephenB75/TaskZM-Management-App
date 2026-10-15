/**
 * App Theme Constants
 * Centralized theme colors for light and dark modes
 * All colors should be referenced from this file - NO HARDCODED VALUES
 */

// Primary Theme Colors (consistent across light/dark)
export const THEME_PRIMARY = {
  light: '#171717',
  dark: '#F5F5F5',
  hover: {
    light: '#404040',
    dark: '#E5E5E5',
  },
  foreground: {
    light: '#FFFFFF',
    dark: '#0A0A0A',
  },
} as const;

// Secondary Theme Colors
export const THEME_SECONDARY = {
  light: '#F4F4F4',
  dark: '#1F1F1F',
  foreground: {
    light: '#262626',
    dark: '#F3F4F6',
  },
} as const;

// Background Colors
export const THEME_BACKGROUND = {
  light: '#FAFAFA',
  dark: '#0A0A0A',
  card: {
    light: '#FFFFFF',
    dark: '#141414',
  },
  popover: {
    light: '#FFFFFF',
    dark: '#1A1A1A',
  },
} as const;

// Text Colors
export const THEME_TEXT = {
  primary: {
    light: '#171717',
    dark: '#F5F5F5',
  },
  secondary: {
    light: '#737373',
    dark: '#A3A3A3',
  },
  muted: {
    light: '#9CA3AF',
    dark: '#9CA3AF',
  },
} as const;

// Border Colors
export const THEME_BORDER = {
  light: 'rgba(115, 115, 115, 0.25)',
  dark: 'rgba(115, 115, 115, 0.2)',
  muted: {
    light: '#E5E7EB',
    dark: '#262626',
  },
} as const;

// Muted/Accent Colors
export const THEME_MUTED = {
  background: {
    light: '#F4F4F4',
    dark: '#282435',
  },
  foreground: {
    light: '#6B7280',
    dark: '#D1D5DB',
  },
} as const;

// Accent Colors
export const THEME_ACCENT = {
  background: {
    light: '#E5E5E5',
    dark: '#262626',
  },
  foreground: {
    light: '#1E3A5F',
    dark: '#F3F4F6',
  },
} as const;

// Destructive Colors
export const THEME_DESTRUCTIVE = {
  light: '#C53030',
  dark: '#E53E3E',
  foreground: {
    light: '#FFFFFF',
    dark: '#FFFFFF',
  },
} as const;

// Input Colors
export const THEME_INPUT = {
  background: {
    light: '#F5F0FA',
    dark: '#282435',
  },
  border: {
    light: 'rgba(115, 115, 115, 0.25)',
    dark: 'rgba(115, 115, 115, 0.35)',
  },
} as const;

// Button Colors (improved for visibility)
export const THEME_BUTTON = {
  primary: {
    background: {
      light: THEME_PRIMARY.light,
      dark: THEME_PRIMARY.dark,
    },
    hover: {
      light: THEME_PRIMARY.hover.light,
      dark: THEME_PRIMARY.hover.dark,
    },
    text: {
      light: THEME_PRIMARY.foreground.light,
      dark: THEME_PRIMARY.foreground.dark,
    },
  },
  secondary: {
    background: {
      light: THEME_SECONDARY.light,
      dark: THEME_SECONDARY.dark,
    },
    hover: {
      light: '#D4C5E0',
      dark: '#262626',
    },
    text: {
      light: THEME_SECONDARY.foreground.light,
      dark: THEME_SECONDARY.foreground.dark,
    },
  },
  outline: {
    border: {
      light: 'rgba(115, 115, 115, 0.3)',
      dark: 'rgba(115, 115, 115, 0.5)',
    },
    hover: {
      light: 'rgba(115, 115, 115, 0.1)',
      dark: 'rgba(115, 115, 115, 0.2)',
    },
    text: {
      light: THEME_TEXT.primary.light,
      dark: THEME_TEXT.primary.dark,
    },
  },
  ghost: {
    hover: {
      light: THEME_ACCENT.background.light,
      dark: THEME_ACCENT.background.dark,
    },
    text: {
      light: THEME_TEXT.primary.light,
      dark: THEME_TEXT.primary.dark,
    },
  },
} as const;

// Dialog Colors (improved for visibility)
export const THEME_DIALOG = {
  background: {
    light: {
      from: '#FAFAFA',
      via: '#F7F7F7',
      to: '#F4F4F4',
    },
    dark: {
      from: '#13111A',
      via: '#0A0A0A',
      to: '#1B1825',
    },
  },
  border: {
    light: 'rgba(115, 115, 115, 0.25)',
    dark: 'rgba(115, 115, 115, 0.4)',
  },
  overlay: {
    light: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.7)',
  },
} as const;

// Status Colors
export const THEME_STATUS = {
  success: {
    light: '#10B981',
    dark: '#34D399',
  },
  error: {
    light: '#EF4444',
    dark: '#F87171',
  },
  warning: {
    light: '#F59E0B',
    dark: '#FBBF24',
  },
  info: {
    light: '#3B82F6',
    dark: '#60A5FA',
  },
} as const;

// Helper function to get theme-aware color
export const getThemeColor = (
  colorKey: keyof typeof THEME_PRIMARY | keyof typeof THEME_SECONDARY | keyof typeof THEME_BACKGROUND,
  mode: 'light' | 'dark' = 'light'
): string => {
  // This is a placeholder - actual implementation would depend on your theme system
  return '';
};

// Helper function to get CSS variable for theme color
export const getThemeVar = (varName: string): string => {
  return `var(--${varName})`;
};

// Export all theme colors as a single object for easy access
export const APP_THEME = {
  primary: THEME_PRIMARY,
  secondary: THEME_SECONDARY,
  background: THEME_BACKGROUND,
  text: THEME_TEXT,
  border: THEME_BORDER,
  muted: THEME_MUTED,
  accent: THEME_ACCENT,
  destructive: THEME_DESTRUCTIVE,
  input: THEME_INPUT,
  button: THEME_BUTTON,
  dialog: THEME_DIALOG,
  status: THEME_STATUS,
} as const;


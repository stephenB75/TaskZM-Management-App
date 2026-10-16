/**
 * UI Colors Constants
 * Centralized color definitions for gradients, charts, rich text, and component-specific colors
 */

// Dialog and Popover Gradient Colors
// Note: Dark mode colors are applied via className in dialog.tsx for better visibility
export const UI_GRADIENT_COLORS = {
  dialog: {
    from: '#FAFAFA',
    via: '#F7F7F7',
    to: '#F4F4F4',
    dark: {
      from: '#0A0A0A',
      via: '#0A0A0A',
      to: '#171717',
    },
    // Tailwind class: bg-gradient-to-br from-[#FAFAFA] via-[#F7F7F7] to-[#F4F4F4]
    className: 'bg-gradient-to-br from-[#FAFAFA] via-[#F7F7F7] to-[#F4F4F4]',
  },
  timeline: {
    from: '#F5F5F5',
    to: '#EDEDED',
    // Tailwind class: bg-gradient-to-b from-[#F5F5F5] to-[#EDEDED]
    className: 'bg-gradient-to-b from-[#F5F5F5] to-[#EDEDED]',
  },
  status: {
    success: {
      from: '#D4D4D4',
      to: '#E5E5E5',
    },
  },
} as const;

// Chart Colors
export const UI_CHART_COLORS = {
  primary: '#8884d8',
  // Additional chart colors can be added here
} as const;

// Rich Text Editor Colors
export const UI_RICH_TEXT_COLORS = {
  highlight: '#fef08a',
  codeBackground: {
    light: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(255, 255, 255, 0.1)',
  },
  muted: '#9ca3af',
} as const;

// Upgrade Prompt Colors
export const UI_UPGRADE_PROMPT_COLORS = {
  accent: '#E5E5E5',
  accentHover: '#E5E5E5',
  // Tailwind classes
  accentClass: 'bg-[#E5E5E5]',
  accentHoverClass: 'hover:bg-[#E5E5E5]/90',
  accentTextClass: 'text-[#525252]',
  accentBorderClass: 'border-[#D4D4D4]',
  accentBgOpacity10: 'bg-[#E5E5E5]/10',
  accentBgOpacity20: 'bg-[#E5E5E5]/20',
  accentBorderOpacity20: 'border-[#D4D4D4]/20',
} as const;

// Folder Colors
export const UI_FOLDER_COLORS = {
  fallback: '#3b82f6',
} as const;

// Pricing Dialog Gradient Colors
export const UI_PRICING_GRADIENT_COLORS = {
  primary: {
    from: '#171717',
    to: '#E5E5E5',
    // Tailwind class: bg-gradient-to-r from-[#171717] to-[#E5E5E5]
    className: 'bg-gradient-to-r from-[#171717] to-[#E5E5E5]',
  },
  primaryHover: {
    from: '#404040',
    to: '#A3A3A3',
    // Tailwind class: hover:from-[#404040] hover:to-[#A3A3A3]
    className: 'hover:from-[#404040] hover:to-[#A3A3A3]',
  },
  primaryBr: {
    from: '#171717',
    to: '#E5E5E5',
    // Tailwind class: bg-gradient-to-br from-[#171717] to-[#E5E5E5]
    className: 'bg-gradient-to-br from-[#171717] to-[#E5E5E5]',
  },
  text: {
    from: '#171717',
    via: '#A3A3A3',
    to: '#E5E5E5',
    // Tailwind class: bg-gradient-to-r from-[#171717] via-[#A3A3A3] to-[#E5E5E5] bg-clip-text text-transparent
    className: 'bg-gradient-to-r from-[#171717] via-[#A3A3A3] to-[#E5E5E5] bg-clip-text text-transparent',
  },
} as const;

// Pricing Dialog Colors
export const UI_PRICING_DIALOG_COLORS = {
  primary: '#171717',
  primaryHover: '#404040',
  primaryClass: 'bg-[#171717]',
  primaryHoverClass: 'hover:bg-[#404040]',
  primaryTextClass: 'text-[#171717]',
  secondary: '#A3A3A3',
  secondaryClass: 'bg-[#A3A3A3]',
  accent: '#D4D4D4',
  accentDark: '#525252',
  accentClass: 'bg-[#D4D4D4]',
  accentDarkClass: 'dark:bg-[#525252]',
  accentBorderClass: 'border-[#A3A3A3]',
  accentRingClass: 'ring-[#A3A3A3]/50',
  accentDarkBorderClass: 'dark:border-[#525252]',
  accentDarkRingClass: 'dark:ring-[#525252]/50',
  accentBgClass: 'bg-[#D4D4D4]/10',
  accentTextClass: 'text-gray-800',
  // Gradients
  titleGradient: {
    from: '#171717',
    via: '#A3A3A3',
    to: '#D4D4D4',
    className: 'bg-gradient-to-r from-[#171717] via-[#A3A3A3] to-[#D4D4D4] bg-clip-text text-transparent',
  },
  cardGradient: {
    from: '#171717',
    via: '#A3A3A3',
    to: '#D4D4D4',
    light: {
      className: 'bg-gradient-to-br from-[#171717]/10 via-[#A3A3A3]/10 to-[#D4D4D4]/10',
    },
    dark: {
      className: 'dark:from-[#171717]/20 dark:via-[#404040]/10 dark:to-[#525252]/10',
    },
    medium: {
      className: 'bg-gradient-to-br from-[#171717]/15 via-[#A3A3A3]/15 to-[#D4D4D4]/15',
    },
    mediumDark: {
      className: 'dark:from-[#171717]/25 dark:via-[#404040]/15 dark:to-[#525252]/15',
    },
  },
  cardBorder: {
    primary: 'border-[#171717]',
    primaryRing: 'ring-[#171717]/50',
    accent: 'border-[#A3A3A3]',
    accentRing: 'ring-[#A3A3A3]/50',
  },
  buttonGradient: {
    from: '#171717',
    to: '#E5E5E5',
    className: 'bg-gradient-to-r from-[#171717] to-[#E5E5E5]',
    hover: {
      from: '#404040',
      to: '#A3A3A3',
      className: 'hover:from-[#404040] hover:to-[#A3A3A3]',
    },
  },
  badgeGradient: {
    from: '#D4D4D4',
    to: '#A3A3A3',
    className: 'bg-gradient-to-r from-[#D4D4D4] to-[#A3A3A3]',
  },
  decorativeBlur: {
    light: {
      className: 'bg-gradient-to-br from-[#171717]/20 to-[#A3A3A3]/20',
    },
    medium: {
      className: 'bg-gradient-to-br from-[#171717]/25 to-[#A3A3A3]/25',
    },
  },
} as const;

// Settings Panel Badge Gradient Colors
export const UI_SETTINGS_BADGE_GRADIENT = {
  from: '#E5E5E5',
  to: '#D4D4D4',
  // Tailwind class: bg-gradient-to-r from-[#E5E5E5] to-[#D4D4D4]
  className: 'bg-gradient-to-r from-[#E5E5E5] to-[#D4D4D4]',
} as const;

// Analytics Panel Colors (from AnalyticsPanel.tsx)
export const UI_ANALYTICS_COLORS = {
  backgroundWhite: '#FFFFFF',
  borderLight: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
} as const;

// Auth Screen Gradient Colors
export const UI_AUTH_GRADIENT_COLORS = {
  text: {
    from: '#262626',
    via: '#A3A3A3',
    to: '#E5E5E5',
    // Tailwind class: bg-gradient-to-r from-[#262626] via-[#A3A3A3] to-[#E5E5E5] bg-clip-text text-transparent
    className: 'bg-gradient-to-r from-[#262626] via-[#A3A3A3] to-[#E5E5E5] bg-clip-text text-transparent',
  },
  icon: {
    from: '#262626',
    via: '#A3A3A3',
    to: '#E5E5E5',
    // Tailwind class: bg-gradient-to-br from-[#262626] via-[#A3A3A3] to-[#E5E5E5]
    className: 'bg-gradient-to-br from-[#262626] via-[#A3A3A3] to-[#E5E5E5]',
  },
} as const;

// Seven Day Kanban Colors
export const UI_KANBAN_COLORS = {
  wednesday: {
    from: '#E5E5E5',
    via: '#E5E5E5',
    to: '#D4D4D4',
    border: '#A3A3A3',
    // Tailwind class: bg-gradient-to-r from-[#E5E5E5]/80 via-[#E5E5E5]/70 to-[#D4D4D4]/80 border-[#A3A3A3]/30
    className: 'bg-gradient-to-r from-[#E5E5E5]/80 via-[#E5E5E5]/70 to-[#D4D4D4]/80 border-[#A3A3A3]/30',
  },
} as const;

// Today Agenda Status Colors
export const UI_TODAY_AGENDA_STATUS_COLORS = {
  success: {
    background: '#D4D4D4',
    text: {
      dark: '#065f46', // green-800
      darker: '#064e3b', // green-900
      light: '#10b981', // green-500
    },
  },
} as const;

// Settings Panel Gradient Colors
export const UI_SETTINGS_PANEL_GRADIENTS = {
  main: {
    from: '#F5F5F5',
    to: '#EDEDED',
    className: 'bg-gradient-to-b from-[#F5F5F5] to-[#EDEDED]',
  },
  profile: {
    from: '#F5F5F5',
    to: '#F5F5F5',
    className: 'bg-gradient-to-br from-[#F5F5F5]/50 to-[#F5F5F5]/50',
  },
  subscription: {
    from: 'white',
    to: '#F5F5F5',
    className: 'bg-gradient-to-br from-white/80 to-[#F5F5F5]/60',
  },
  calendar: {
    from: '#E5E5E5',
    to: '#E5E5E5',
    className: 'bg-gradient-to-br from-[#E5E5E5]/40 to-[#E5E5E5]/40',
  },
  notifications: {
    from: '#EDEDED',
    to: '#F5F5F5',
    className: 'bg-gradient-to-br from-[#EDEDED]/40 to-[#F5F5F5]/40',
  },
  tags: {
    from: '#E5E5E5',
    to: '#E5E5E5',
    className: 'bg-gradient-to-br from-[#E5E5E5]/35 to-[#E5E5E5]/35',
  },
  aiSettings: {
    from: '#A3A3A3',
    to: '#E5E5E5',
    className: 'bg-gradient-to-br from-[#A3A3A3]/35 to-[#E5E5E5]/35',
  },
  datetime: {
    from: '#F5F5F5',
    to: '#EDEDED',
    className: 'bg-gradient-to-br from-[#F5F5F5]/45 to-[#EDEDED]/45',
  },
  rollover: {
    from: '#F5F5F5',
    to: '#A3A3A3',
    className: 'bg-gradient-to-br from-[#F5F5F5]/40 to-[#A3A3A3]/40',
  },
  hours: {
    from: '#EDEDED',
    to: '#E5E5E5',
    className: 'bg-gradient-to-br from-[#EDEDED]/35 to-[#E5E5E5]/35',
  },
  awards: {
    from: '#E5E5E5',
    to: '#EDEDED',
    className: 'bg-gradient-to-br from-[#E5E5E5]/40 to-[#EDEDED]/40',
  },
} as const;

// Settings Panel Badge Colors
export const UI_SETTINGS_BADGE_COLORS = {
  primary: '#E5E5E5',
  secondary: '#D4D4D4',
  subscription: '#D4D4D4',
  primaryClass: 'bg-[#E5E5E5]',
  primaryBorderClass: 'border-[#D4D4D4]',
  primaryHoverClass: 'hover:bg-[#E5E5E5]/90',
  primaryTextClass: 'text-[#525252]',
  subscriptionClass: 'bg-[#D4D4D4]',
  subscriptionBorderClass: 'border-[#D4D4D4]',
  gradientClass: 'bg-gradient-to-r from-[#E5E5E5] to-[#D4D4D4]',
  infoBox: {
    background: {
      from: '#E5E5E5',
      to: '#A3A3A3',
      className: 'bg-gradient-to-br from-[#E5E5E5]/10 to-[#A3A3A3]/10',
      darkClassName: 'dark:from-[#E5E5E5]/5 dark:to-[#A3A3A3]/5',
    },
    border: {
      className: 'border-[#D4D4D4]/20',
    },
    icon: '#E5E5E5',
    iconClass: 'text-[#525252]',
  },
  category: {
    mint: '#B4E4CE',
    lavender: '#DDD6FE',
    peach: '#FDD5B4',
    mintClass: 'bg-[#B4E4CE]',
    lavenderClass: 'bg-[#DDD6FE]',
    peachClass: 'bg-[#FDD5B4]',
  },
} as const;

// Inbox View Gradient Colors
export const UI_INBOX_GRADIENTS = {
  main: {
    from: '#F5F5F5',
    to: '#EDEDED',
    className: 'bg-white dark:bg-gray-950',
  },
  button: {
    from: '#E5E5E5',
    to: '#A3A3A3',
    className: 'bg-gradient-to-r from-[#E5E5E5] to-[#A3A3A3]',
    hover: {
      from: '#A3A3A3',
      to: '#E5E5E5',
      className: 'hover:from-[#A3A3A3] hover:to-[#E5E5E5]',
    },
  },
  card: {
    from: '#A3A3A3',
    to: '#D4D4D4',
    className: 'bg-gradient-to-br from-[#A3A3A3]/30 to-[#D4D4D4]/30',
  },
  emptyState: {
    from: '#E5E5E5',
    to: '#A3A3A3',
    className: 'bg-gradient-to-br from-[#E5E5E5] to-[#A3A3A3]',
  },
} as const;

// Notifications Panel Gradient Colors
export const UI_NOTIFICATIONS_PANEL_GRADIENTS = {
  main: {
    from: '#F5F5F5',
    to: '#EDEDED',
    className: 'bg-white dark:bg-gray-950',
  },
} as const;

// Notification Icon Colors
export const UI_NOTIFICATION_ICON_COLORS = {
  overdue: 'text-red-500',
  dueSoon: 'text-orange-500',
  pomodoro: 'text-foreground',
  award: 'text-yellow-500',
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-orange-500',
  info: 'text-blue-500',
} as const;

// Notification Border Colors
export const UI_NOTIFICATION_BORDER_COLORS = {
  overdue: 'border-l-red-500',
  dueSoon: 'border-l-orange-500',
  pomodoro: 'border-l-blue-500',
  default: 'border-l-gray-400',
  muted: 'border-l-gray-300',
} as const;

// Tag Colors (for Settings Panel and other components)
export const UI_TAG_COLORS = {
  mint: {
    hex: '#E5E5E5',
    class: 'bg-[#E5E5E5]/30',
    fullClass: 'bg-[#E5E5E5]',
  },
  lavender: {
    hex: '#D4D4D4',
    class: 'bg-[#D4D4D4]/30',
    fullClass: 'bg-[#D4D4D4]',
  },
  peach: {
    hex: '#A3A3A3',
    class: 'bg-[#A3A3A3]/30',
    fullClass: 'bg-[#A3A3A3]',
  },
  blue: {
    hex: '#737373',
    class: 'bg-[#737373]/30',
    fullClass: 'bg-[#737373]',
  },
} as const;

// Award Badge Colors (for Settings Panel Awards section)
export const UI_AWARD_BADGE_COLORS = {
  blue: {
    light: 'bg-neutral-100 dark:bg-neutral-900/30',
    text: 'text-neutral-700 dark:text-neutral-300',
    gradient: {
      from: 'from-neutral-50',
      to: 'to-neutral-50',
      darkFrom: 'dark:from-neutral-950/30',
      darkTo: 'dark:to-neutral-950/30',
      border: 'border-neutral-200/50 dark:border-neutral-800/50',
      className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/30 dark:to-neutral-950/30 border-neutral-200/50 dark:border-neutral-800/50',
    },
    activeGradient: {
      className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/40 dark:to-neutral-950/40 border-neutral-200 dark:border-neutral-800/50',
    },
  },
  orange: {
    light: 'bg-neutral-100 dark:bg-neutral-900/30',
    text: 'text-neutral-700 dark:text-neutral-300',
    gradient: {
      from: 'from-neutral-50',
      to: 'to-neutral-50',
      darkFrom: 'dark:from-neutral-950/30',
      darkTo: 'dark:to-neutral-950/30',
      border: 'border-neutral-200/50 dark:border-neutral-800/50',
      className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/30 dark:to-neutral-950/30 border-neutral-200/50 dark:border-neutral-800/50',
    },
    activeGradient: {
      className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/40 dark:to-neutral-950/40 border-neutral-200 dark:border-neutral-800/50',
    },
  },
  purple: {
    light: 'bg-neutral-100 dark:bg-neutral-900/30',
    text: 'text-neutral-700 dark:text-neutral-300',
    gradient: {
      from: 'from-neutral-50',
      to: 'to-neutral-50',
      darkFrom: 'dark:from-neutral-950/30',
      darkTo: 'dark:to-neutral-950/30',
      border: 'border-neutral-200/50 dark:border-neutral-800/50',
      className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/30 dark:to-neutral-950/30 border-neutral-200/50 dark:border-neutral-800/50',
    },
    activeGradient: {
      className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/40 dark:to-neutral-950/40 border-neutral-200 dark:border-neutral-800/50',
    },
  },
  pink: {
    light: 'bg-neutral-100 dark:bg-neutral-900/30',
    text: 'text-neutral-700 dark:text-neutral-300',
    gradient: {
      from: 'from-neutral-50',
      to: 'to-neutral-50',
      darkFrom: 'dark:from-neutral-950/30',
      darkTo: 'dark:to-neutral-950/30',
      border: 'border-neutral-200/50 dark:border-neutral-800/50',
      className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/30 dark:to-neutral-950/30 border-neutral-200/50 dark:border-neutral-800/50',
    },
    activeGradient: {
      className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/40 dark:to-neutral-950/40 border-neutral-200 dark:border-neutral-800/50',
    },
  },
} as const;

// Award Stat Gradient Colors (for Settings Panel award statistics)
export const UI_AWARD_STAT_GRADIENTS = {
  completion: {
    from: 'from-neutral-50',
    to: 'to-neutral-50',
    darkFrom: 'dark:from-neutral-950/30',
    darkTo: 'dark:to-neutral-950/30',
    border: 'border-neutral-200/50 dark:border-neutral-800/50',
    className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/30 dark:to-neutral-950/30 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50',
    textGradient: {
      from: 'from-neutral-600',
      to: 'to-neutral-600',
      className: 'bg-gradient-to-r from-neutral-600 to-neutral-600 bg-clip-text text-transparent',
    },
  },
  earned: {
    from: 'from-neutral-50',
    to: 'to-neutral-50',
    darkFrom: 'dark:from-neutral-950/30',
    darkTo: 'dark:to-neutral-950/30',
    border: 'border-neutral-200/50 dark:border-neutral-800/50',
    className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/30 dark:to-neutral-950/30 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50',
  },
  remaining: {
    from: 'from-neutral-50',
    to: 'to-neutral-50',
    darkFrom: 'dark:from-neutral-950/30',
    darkTo: 'dark:to-neutral-950/30',
    border: 'border-neutral-200/50 dark:border-neutral-800/50',
    className: 'bg-gradient-to-br from-neutral-50 to-neutral-50 dark:from-neutral-950/30 dark:to-neutral-950/30 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50',
  },
} as const;

// Award Function Gradient Colors (for dynamic award gradients)
export const UI_AWARD_FUNCTION_GRADIENTS = {
  bronze: {
    from: '#8A7A9A',
    to: '#6A8AAA',
    opacity: 0.25,
  },
  silver: {
    from: '#6A8AAA',
    to: '#5A8A7A',
    opacity: 0.25,
  },
} as const;

// Rich Text Mark Colors (for Today Agenda and other components)
export const UI_RICH_TEXT_MARK_COLORS = {
  light: {
    background: 'bg-yellow-200',
    className: '[&_mark]:bg-yellow-200',
  },
  dark: {
    background: 'bg-yellow-800',
    className: '[&_mark]:dark:bg-yellow-800',
  },
  combined: {
    className: '[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_mark]:rounded',
  },
} as const;

// Inbox Avatar Gradient Colors
export const UI_INBOX_AVATAR_GRADIENTS = {
  default: {
    from: 'from-neutral-100',
    to: 'to-neutral-200',
    text: 'text-neutral-700',
    className: 'bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-700',
  },
} as const;

// Toggle Switch Colors
export const TOGGLE_SWITCH_COLORS = {
  container: {
    background: {
      light: 'bg-white/80',
      dark: 'dark:bg-gray-700/80',
    },
    border: {
      light: 'border-primary/10',
      dark: 'dark:border-gray-600/50',
    },
  },
  card: {
    background: {
      light: 'bg-white',
      dark: 'dark:bg-card',
    },
    border: {
      light: 'border-primary/20',
    },
  },
  text: {
    active: {
      light: 'text-primary',
      dark: 'dark:text-primary-foreground',
    },
    inactive: {
      light: 'text-muted-foreground',
      dark: 'dark:text-gray-400',
    },
  },
  switch: {
    background: {
      checked: 'bg-primary dark:bg-primary',
      unchecked: 'bg-[var(--switch-background)] dark:bg-gray-600',
    },
    thumb: {
      light: 'bg-white',
      dark: 'dark:bg-gray-200',
    },
  },
} as const;


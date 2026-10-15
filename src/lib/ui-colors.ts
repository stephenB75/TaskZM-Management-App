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
      from: '#13111A',
      via: '#0A0A0A',
      to: '#1B1825',
    },
    // Tailwind class: bg-gradient-to-br from-[#FAFAFA] via-[#F7F7F7] to-[#F4F4F4]
    className: 'bg-gradient-to-br from-[#FAFAFA] via-[#F7F7F7] to-[#F4F4F4]',
  },
  timeline: {
    from: '#E4E0EF',
    to: '#DCD6EB',
    // Tailwind class: bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB]
    className: 'bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB]',
  },
  status: {
    success: {
      from: '#BEF264',
      to: '#DDD6FE',
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
  accent: '#D9F99D',
  accentHover: '#D9F99D',
  // Tailwind classes
  accentClass: 'bg-[#D9F99D]',
  accentHoverClass: 'hover:bg-[#D9F99D]/90',
  accentTextClass: 'text-[#D9F99D]',
  accentBorderClass: 'border-[#D9F99D]',
  accentBgOpacity10: 'bg-[#D9F99D]/10',
  accentBgOpacity20: 'bg-[#D9F99D]/20',
  accentBorderOpacity20: 'border-[#D9F99D]/20',
} as const;

// Folder Colors
export const UI_FOLDER_COLORS = {
  fallback: '#3b82f6',
} as const;

// Pricing Dialog Gradient Colors
export const UI_PRICING_GRADIENT_COLORS = {
  primary: {
    from: '#171717',
    to: '#D9F99D',
    // Tailwind class: bg-gradient-to-r from-[#171717] to-[#D9F99D]
    className: 'bg-gradient-to-r from-[#171717] to-[#D9F99D]',
  },
  primaryHover: {
    from: '#404040',
    to: '#C4B5E9',
    // Tailwind class: hover:from-[#404040] hover:to-[#C4B5E9]
    className: 'hover:from-[#404040] hover:to-[#C4B5E9]',
  },
  primaryBr: {
    from: '#171717',
    to: '#D9F99D',
    // Tailwind class: bg-gradient-to-br from-[#171717] to-[#D9F99D]
    className: 'bg-gradient-to-br from-[#171717] to-[#D9F99D]',
  },
  text: {
    from: '#171717',
    via: '#C4B5FD',
    to: '#D9F99D',
    // Tailwind class: bg-gradient-to-r from-[#171717] via-[#C4B5FD] to-[#D9F99D] bg-clip-text text-transparent
    className: 'bg-gradient-to-r from-[#171717] via-[#C4B5FD] to-[#D9F99D] bg-clip-text text-transparent',
  },
} as const;

// Pricing Dialog Colors
export const UI_PRICING_DIALOG_COLORS = {
  primary: '#171717',
  primaryHover: '#404040',
  primaryClass: 'bg-[#171717]',
  primaryHoverClass: 'hover:bg-[#404040]',
  primaryTextClass: 'text-[#171717]',
  secondary: '#C4B5FD',
  secondaryClass: 'bg-[#C4B5FD]',
  accent: '#BEF264',
  accentDark: '#5A8A7A',
  accentClass: 'bg-[#BEF264]',
  accentDarkClass: 'dark:bg-[#5A8A7A]',
  accentBorderClass: 'border-[#BEF264]',
  accentRingClass: 'ring-[#BEF264]/50',
  accentDarkBorderClass: 'dark:border-[#5A8A7A]',
  accentDarkRingClass: 'dark:ring-[#5A8A7A]/50',
  accentBgClass: 'bg-[#BEF264]/10',
  accentTextClass: 'text-gray-800',
  // Gradients
  titleGradient: {
    from: '#171717',
    via: '#C4B5FD',
    to: '#BEF264',
    className: 'bg-gradient-to-r from-[#171717] via-[#C4B5FD] to-[#BEF264] bg-clip-text text-transparent',
  },
  cardGradient: {
    from: '#171717',
    via: '#C4B5FD',
    to: '#BEF264',
    light: {
      className: 'bg-gradient-to-br from-[#171717]/10 via-[#C4B5FD]/10 to-[#BEF264]/10',
    },
    dark: {
      className: 'dark:from-[#171717]/20 dark:via-[#6A8AAA]/10 dark:to-[#5A8A7A]/10',
    },
    medium: {
      className: 'bg-gradient-to-br from-[#171717]/15 via-[#C4B5FD]/15 to-[#BEF264]/15',
    },
    mediumDark: {
      className: 'dark:from-[#171717]/25 dark:via-[#6A8AAA]/15 dark:to-[#5A8A7A]/15',
    },
  },
  cardBorder: {
    primary: 'border-[#171717]',
    primaryRing: 'ring-[#171717]/50',
    accent: 'border-[#BEF264]',
    accentRing: 'ring-[#BEF264]/50',
  },
  buttonGradient: {
    from: '#171717',
    to: '#D9F99D',
    className: 'bg-gradient-to-r from-[#171717] to-[#D9F99D]',
    hover: {
      from: '#404040',
      to: '#C4B5E9',
      className: 'hover:from-[#404040] hover:to-[#C4B5E9]',
    },
  },
  badgeGradient: {
    from: '#BEF264',
    to: '#C4B5FD',
    className: 'bg-gradient-to-r from-[#BEF264] to-[#C4B5FD]',
  },
  decorativeBlur: {
    light: {
      className: 'bg-gradient-to-br from-[#171717]/20 to-[#C4B5FD]/20',
    },
    medium: {
      className: 'bg-gradient-to-br from-[#171717]/25 to-[#C4B5FD]/25',
    },
  },
} as const;

// Settings Panel Badge Gradient Colors
export const UI_SETTINGS_BADGE_GRADIENT = {
  from: '#D9F99D',
  to: '#B4E4CE',
  // Tailwind class: bg-gradient-to-r from-[#D9F99D] to-[#B4E4CE]
  className: 'bg-gradient-to-r from-[#D9F99D] to-[#B4E4CE]',
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
    via: '#C4B5FD',
    to: '#D9F99D',
    // Tailwind class: bg-gradient-to-r from-[#262626] via-[#C4B5FD] to-[#D9F99D] bg-clip-text text-transparent
    className: 'bg-gradient-to-r from-[#262626] via-[#C4B5FD] to-[#D9F99D] bg-clip-text text-transparent',
  },
  icon: {
    from: '#262626',
    via: '#C4B5FD',
    to: '#D9F99D',
    // Tailwind class: bg-gradient-to-br from-[#262626] via-[#C4B5FD] to-[#D9F99D]
    className: 'bg-gradient-to-br from-[#262626] via-[#C4B5FD] to-[#D9F99D]',
  },
} as const;

// Seven Day Kanban Colors
export const UI_KANBAN_COLORS = {
  wednesday: {
    from: '#DDD6FE',
    via: '#D9F99D',
    to: '#C7B8EA',
    border: '#B8A4E6',
    // Tailwind class: bg-gradient-to-r from-[#DDD6FE]/80 via-[#D9F99D]/70 to-[#C7B8EA]/80 border-[#B8A4E6]/30
    className: 'bg-gradient-to-r from-[#DDD6FE]/80 via-[#D9F99D]/70 to-[#C7B8EA]/80 border-[#B8A4E6]/30',
  },
} as const;

// Today Agenda Status Colors
export const UI_TODAY_AGENDA_STATUS_COLORS = {
  success: {
    background: '#BEF264',
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
    from: '#E4E0EF',
    to: '#DCD6EB',
    className: 'bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB]',
  },
  profile: {
    from: '#E8F5F1',
    to: '#F3E8FF',
    className: 'bg-gradient-to-br from-[#E8F5F1]/50 to-[#F3E8FF]/50',
  },
  subscription: {
    from: 'white',
    to: '#F3E8FF',
    className: 'bg-gradient-to-br from-white/80 to-[#F3E8FF]/60',
  },
  calendar: {
    from: '#B4E4FF',
    to: '#E0BBE4',
    className: 'bg-gradient-to-br from-[#B4E4FF]/40 to-[#E0BBE4]/40',
  },
  notifications: {
    from: '#FFDAB9',
    to: '#E8F5F1',
    className: 'bg-gradient-to-br from-[#FFDAB9]/40 to-[#E8F5F1]/40',
  },
  tags: {
    from: '#E0BBE4',
    to: '#D9F99D',
    className: 'bg-gradient-to-br from-[#E0BBE4]/35 to-[#D9F99D]/35',
  },
  aiSettings: {
    from: '#C4B5FD',
    to: '#B4E4FF',
    className: 'bg-gradient-to-br from-[#C4B5FD]/35 to-[#B4E4FF]/35',
  },
  datetime: {
    from: '#F3E8FF',
    to: '#FFDAB9',
    className: 'bg-gradient-to-br from-[#F3E8FF]/45 to-[#FFDAB9]/45',
  },
  rollover: {
    from: '#E8F5F1',
    to: '#C4B5FD',
    className: 'bg-gradient-to-br from-[#E8F5F1]/40 to-[#C4B5FD]/40',
  },
  hours: {
    from: '#FFDAB9',
    to: '#E0BBE4',
    className: 'bg-gradient-to-br from-[#FFDAB9]/35 to-[#E0BBE4]/35',
  },
  awards: {
    from: '#D9F99D',
    to: '#FFDAB9',
    className: 'bg-gradient-to-br from-[#D9F99D]/40 to-[#FFDAB9]/40',
  },
} as const;

// Settings Panel Badge Colors
export const UI_SETTINGS_BADGE_COLORS = {
  primary: '#D9F99D',
  secondary: '#B4E4CE',
  subscription: '#B5E8D3',
  primaryClass: 'bg-[#D9F99D]',
  primaryBorderClass: 'border-[#D9F99D]',
  primaryHoverClass: 'hover:bg-[#D9F99D]/90',
  primaryTextClass: 'text-[#D9F99D]',
  subscriptionClass: 'bg-[#B5E8D3]',
  subscriptionBorderClass: 'border-[#B5E8D3]',
  gradientClass: 'bg-gradient-to-r from-[#D9F99D] to-[#B4E4CE]',
  infoBox: {
    background: {
      from: '#D9F99D',
      to: '#C4B5FD',
      className: 'bg-gradient-to-br from-[#D9F99D]/10 to-[#C4B5FD]/10',
      darkClassName: 'dark:from-[#D9F99D]/5 dark:to-[#C4B5FD]/5',
    },
    border: {
      className: 'border-[#D9F99D]/20',
    },
    icon: '#D9F99D',
    iconClass: 'text-[#D9F99D]',
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
    from: '#E4E0EF',
    to: '#DCD6EB',
    className: 'bg-white dark:bg-gray-950',
  },
  button: {
    from: '#DDD6FE',
    to: '#C4B5FD',
    className: 'bg-gradient-to-r from-[#DDD6FE] to-[#C4B5FD]',
    hover: {
      from: '#C4B5FD',
      to: '#DDD6FE',
      className: 'hover:from-[#C4B5FD] hover:to-[#DDD6FE]',
    },
  },
  card: {
    from: '#C4B5FD',
    to: '#BEF264',
    className: 'bg-gradient-to-br from-[#C4B5FD]/30 to-[#BEF264]/30',
  },
  emptyState: {
    from: '#DDD6FE',
    to: '#C4B5FD',
    className: 'bg-gradient-to-br from-[#DDD6FE] to-[#C4B5FD]',
  },
} as const;

// Notifications Panel Gradient Colors
export const UI_NOTIFICATIONS_PANEL_GRADIENTS = {
  main: {
    from: '#E4E0EF',
    to: '#DCD6EB',
    className: 'bg-white dark:bg-gray-950',
  },
} as const;

// Notification Icon Colors
export const UI_NOTIFICATION_ICON_COLORS = {
  overdue: 'text-red-500',
  dueSoon: 'text-orange-500',
  pomodoro: 'text-purple-500',
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
    hex: '#B4E4CE',
    class: 'bg-[#B4E4CE]/30',
    fullClass: 'bg-[#B4E4CE]',
  },
  lavender: {
    hex: '#DDD6FE',
    class: 'bg-[#DDD6FE]/30',
    fullClass: 'bg-[#DDD6FE]',
  },
  peach: {
    hex: '#FDD5B4',
    class: 'bg-[#FDD5B4]/30',
    fullClass: 'bg-[#FDD5B4]',
  },
  blue: {
    hex: '#C4B5FD',
    class: 'bg-[#C4B5FD]/30',
    fullClass: 'bg-[#C4B5FD]',
  },
} as const;

// Award Badge Colors (for Settings Panel Awards section)
export const UI_AWARD_BADGE_COLORS = {
  blue: {
    light: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    gradient: {
      from: 'from-blue-50',
      to: 'to-cyan-50',
      darkFrom: 'dark:from-blue-950/30',
      darkTo: 'dark:to-cyan-950/30',
      border: 'border-blue-200/50 dark:border-blue-800/50',
      className: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200/50 dark:border-blue-800/50',
    },
    activeGradient: {
      className: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-blue-200 dark:border-blue-800/50',
    },
  },
  orange: {
    light: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    gradient: {
      from: 'from-amber-50',
      to: 'to-orange-50',
      darkFrom: 'dark:from-amber-950/30',
      darkTo: 'dark:to-orange-950/30',
      border: 'border-amber-200/50 dark:border-amber-800/50',
      className: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200/50 dark:border-amber-800/50',
    },
    activeGradient: {
      className: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/40 dark:to-red-950/40 border-orange-200 dark:border-orange-800/50',
    },
  },
  purple: {
    light: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
    gradient: {
      from: 'from-purple-50',
      to: 'to-pink-50',
      darkFrom: 'dark:from-purple-950/30',
      darkTo: 'dark:to-pink-950/30',
      border: 'border-purple-200/50 dark:border-purple-800/50',
      className: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200/50 dark:border-purple-800/50',
    },
    activeGradient: {
      className: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 border-purple-200 dark:border-purple-800/50',
    },
  },
  pink: {
    light: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-700 dark:text-pink-300',
    gradient: {
      from: 'from-pink-50',
      to: 'to-purple-50',
      darkFrom: 'dark:from-pink-950/30',
      darkTo: 'dark:to-purple-950/30',
      border: 'border-pink-200/50 dark:border-pink-800/50',
      className: 'bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 border-pink-200/50 dark:border-pink-800/50',
    },
    activeGradient: {
      className: 'bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/40 dark:to-purple-950/40 border-pink-200 dark:border-pink-800/50',
    },
  },
} as const;

// Award Stat Gradient Colors (for Settings Panel award statistics)
export const UI_AWARD_STAT_GRADIENTS = {
  completion: {
    from: 'from-blue-50',
    to: 'to-cyan-50',
    darkFrom: 'dark:from-blue-950/30',
    darkTo: 'dark:to-cyan-950/30',
    border: 'border-blue-200/50 dark:border-blue-800/50',
    className: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl border border-blue-200/50 dark:border-blue-800/50',
    textGradient: {
      from: 'from-amber-600',
      to: 'to-orange-600',
      className: 'bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent',
    },
  },
  earned: {
    from: 'from-amber-50',
    to: 'to-orange-50',
    darkFrom: 'dark:from-amber-950/30',
    darkTo: 'dark:to-orange-950/30',
    border: 'border-amber-200/50 dark:border-amber-800/50',
    className: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl border border-amber-200/50 dark:border-amber-800/50',
  },
  remaining: {
    from: 'from-purple-50',
    to: 'to-pink-50',
    darkFrom: 'dark:from-purple-950/30',
    darkTo: 'dark:to-pink-950/30',
    border: 'border-purple-200/50 dark:border-purple-800/50',
    className: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-xl border border-purple-200/50 dark:border-purple-800/50',
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
    from: 'from-purple-100',
    to: 'to-pink-100',
    text: 'text-purple-700',
    className: 'bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700',
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


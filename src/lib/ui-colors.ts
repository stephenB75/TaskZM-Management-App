/**
 * UI Colors Constants
 * Centralized color definitions for gradients, charts, rich text, and component-specific colors
 */

// Dialog and Popover Gradient Colors
export const UI_GRADIENT_COLORS = {
  dialog: {
    from: '#FAF9FC',
    via: '#F9F7FD',
    to: '#F3F0F9',
    // Tailwind class: bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9]
    className: 'bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9]',
  },
  timeline: {
    from: '#E4E0EF',
    to: '#DCD6EB',
    // Tailwind class: bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB]
    className: 'bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB]',
  },
  status: {
    success: {
      from: '#B8E6D5',
      to: '#E6D5F0',
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
  accent: '#D4C5F9',
  accentHover: '#D4C5F9',
  // Tailwind classes
  accentClass: 'bg-[#D4C5F9]',
  accentHoverClass: 'hover:bg-[#D4C5F9]/90',
  accentTextClass: 'text-[#D4C5F9]',
  accentBorderClass: 'border-[#D4C5F9]',
  accentBgOpacity10: 'bg-[#D4C5F9]/10',
  accentBgOpacity20: 'bg-[#D4C5F9]/20',
  accentBorderOpacity20: 'border-[#D4C5F9]/20',
} as const;

// Folder Colors
export const UI_FOLDER_COLORS = {
  fallback: '#3b82f6',
} as const;

// Pricing Dialog Gradient Colors
export const UI_PRICING_GRADIENT_COLORS = {
  primary: {
    from: '#9B87E8',
    to: '#D4C5F9',
    // Tailwind class: bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9]
    className: 'bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9]',
  },
  primaryHover: {
    from: '#8B77D8',
    to: '#C4B5E9',
    // Tailwind class: hover:from-[#8B77D8] hover:to-[#C4B5E9]
    className: 'hover:from-[#8B77D8] hover:to-[#C4B5E9]',
  },
  primaryBr: {
    from: '#9B87E8',
    to: '#D4C5F9',
    // Tailwind class: bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9]
    className: 'bg-gradient-to-br from-[#9B87E8] to-[#D4C5F9]',
  },
  text: {
    from: '#9B87E8',
    via: '#9B7EE8',
    to: '#D4C5F9',
    // Tailwind class: bg-gradient-to-r from-[#9B87E8] via-[#9B7EE8] to-[#D4C5F9] bg-clip-text text-transparent
    className: 'bg-gradient-to-r from-[#9B87E8] via-[#9B7EE8] to-[#D4C5F9] bg-clip-text text-transparent',
  },
} as const;

// Pricing Dialog Colors
export const UI_PRICING_DIALOG_COLORS = {
  primary: '#9B87E8',
  primaryHover: '#8B77D8',
  primaryClass: 'bg-[#9B87E8]',
  primaryHoverClass: 'hover:bg-[#8B77D8]',
  primaryTextClass: 'text-[#9B87E8]',
  secondary: '#C9E4F7',
  secondaryClass: 'bg-[#C9E4F7]',
  accent: '#B8E6D5',
  accentDark: '#5A8A7A',
  accentClass: 'bg-[#B8E6D5]',
  accentDarkClass: 'dark:bg-[#5A8A7A]',
  accentBorderClass: 'border-[#B8E6D5]',
  accentRingClass: 'ring-[#B8E6D5]/50',
  accentDarkBorderClass: 'dark:border-[#5A8A7A]',
  accentDarkRingClass: 'dark:ring-[#5A8A7A]/50',
  accentBgClass: 'bg-[#B8E6D5]/10',
  accentTextClass: 'text-gray-800',
  // Gradients
  titleGradient: {
    from: '#9B87E8',
    via: '#C9E4F7',
    to: '#B8E6D5',
    className: 'bg-gradient-to-r from-[#9B87E8] via-[#C9E4F7] to-[#B8E6D5] bg-clip-text text-transparent',
  },
  cardGradient: {
    from: '#9B87E8',
    via: '#C9E4F7',
    to: '#B8E6D5',
    light: {
      className: 'bg-gradient-to-br from-[#9B87E8]/10 via-[#C9E4F7]/10 to-[#B8E6D5]/10',
    },
    dark: {
      className: 'dark:from-[#9B87E8]/20 dark:via-[#6A8AAA]/10 dark:to-[#5A8A7A]/10',
    },
    medium: {
      className: 'bg-gradient-to-br from-[#9B87E8]/15 via-[#C9E4F7]/15 to-[#B8E6D5]/15',
    },
    mediumDark: {
      className: 'dark:from-[#9B87E8]/25 dark:via-[#6A8AAA]/15 dark:to-[#5A8A7A]/15',
    },
  },
  cardBorder: {
    primary: 'border-[#9B87E8]',
    primaryRing: 'ring-[#9B87E8]/50',
    accent: 'border-[#B8E6D5]',
    accentRing: 'ring-[#B8E6D5]/50',
  },
  buttonGradient: {
    from: '#9B87E8',
    to: '#D4C5F9',
    className: 'bg-gradient-to-r from-[#9B87E8] to-[#D4C5F9]',
    hover: {
      from: '#8B77D8',
      to: '#C4B5E9',
      className: 'hover:from-[#8B77D8] hover:to-[#C4B5E9]',
    },
  },
  badgeGradient: {
    from: '#B8E6D5',
    to: '#C9E4F7',
    className: 'bg-gradient-to-r from-[#B8E6D5] to-[#C9E4F7]',
  },
  decorativeBlur: {
    light: {
      className: 'bg-gradient-to-br from-[#9B87E8]/20 to-[#C9E4F7]/20',
    },
    medium: {
      className: 'bg-gradient-to-br from-[#9B87E8]/25 to-[#C9E4F7]/25',
    },
  },
} as const;

// Settings Panel Badge Gradient Colors
export const UI_SETTINGS_BADGE_GRADIENT = {
  from: '#D4C5F9',
  to: '#B4E4CE',
  // Tailwind class: bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE]
  className: 'bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE]',
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
    from: '#7B68EE',
    via: '#9B7EE8',
    to: '#D4C5F9',
    // Tailwind class: bg-gradient-to-r from-[#7B68EE] via-[#9B7EE8] to-[#D4C5F9] bg-clip-text text-transparent
    className: 'bg-gradient-to-r from-[#7B68EE] via-[#9B7EE8] to-[#D4C5F9] bg-clip-text text-transparent',
  },
  icon: {
    from: '#7B68EE',
    via: '#9B7EE8',
    to: '#D4C5F9',
    // Tailwind class: bg-gradient-to-br from-[#7B68EE] via-[#9B7EE8] to-[#D4C5F9]
    className: 'bg-gradient-to-br from-[#7B68EE] via-[#9B7EE8] to-[#D4C5F9]',
  },
} as const;

// Seven Day Kanban Colors
export const UI_KANBAN_COLORS = {
  wednesday: {
    from: '#E6D5F0',
    via: '#D4C5F9',
    to: '#C7B8EA',
    border: '#B8A4E6',
    // Tailwind class: bg-gradient-to-r from-[#E6D5F0]/80 via-[#D4C5F9]/70 to-[#C7B8EA]/80 border-[#B8A4E6]/30
    className: 'bg-gradient-to-r from-[#E6D5F0]/80 via-[#D4C5F9]/70 to-[#C7B8EA]/80 border-[#B8A4E6]/30',
  },
} as const;

// Today Agenda Status Colors
export const UI_TODAY_AGENDA_STATUS_COLORS = {
  success: {
    background: '#B8E6D5',
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
    to: '#D4C5F9',
    className: 'bg-gradient-to-br from-[#E0BBE4]/35 to-[#D4C5F9]/35',
  },
  aiSettings: {
    from: '#C9E4F7',
    to: '#B4E4FF',
    className: 'bg-gradient-to-br from-[#C9E4F7]/35 to-[#B4E4FF]/35',
  },
  datetime: {
    from: '#F3E8FF',
    to: '#FFDAB9',
    className: 'bg-gradient-to-br from-[#F3E8FF]/45 to-[#FFDAB9]/45',
  },
  rollover: {
    from: '#E8F5F1',
    to: '#C9E4F7',
    className: 'bg-gradient-to-br from-[#E8F5F1]/40 to-[#C9E4F7]/40',
  },
  hours: {
    from: '#FFDAB9',
    to: '#E0BBE4',
    className: 'bg-gradient-to-br from-[#FFDAB9]/35 to-[#E0BBE4]/35',
  },
  awards: {
    from: '#D4C5F9',
    to: '#FFDAB9',
    className: 'bg-gradient-to-br from-[#D4C5F9]/40 to-[#FFDAB9]/40',
  },
} as const;

// Settings Panel Badge Colors
export const UI_SETTINGS_BADGE_COLORS = {
  primary: '#D4C5F9',
  secondary: '#B4E4CE',
  subscription: '#B5E8D3',
  primaryClass: 'bg-[#D4C5F9]',
  primaryBorderClass: 'border-[#D4C5F9]',
  primaryHoverClass: 'hover:bg-[#D4C5F9]/90',
  primaryTextClass: 'text-[#D4C5F9]',
  subscriptionClass: 'bg-[#B5E8D3]',
  subscriptionBorderClass: 'border-[#B5E8D3]',
  gradientClass: 'bg-gradient-to-r from-[#D4C5F9] to-[#B4E4CE]',
  infoBox: {
    background: {
      from: '#D4C5F9',
      to: '#C9E4F7',
      className: 'bg-gradient-to-br from-[#D4C5F9]/10 to-[#C9E4F7]/10',
    },
    border: {
      className: 'border-[#D4C5F9]/20',
    },
    icon: '#D4C5F9',
    iconClass: 'text-[#D4C5F9]',
  },
  category: {
    mint: '#B4E4CE',
    lavender: '#E6D5F0',
    peach: '#FDD5B4',
    mintClass: 'bg-[#B4E4CE]',
    lavenderClass: 'bg-[#E6D5F0]',
    peachClass: 'bg-[#FDD5B4]',
  },
} as const;

// Inbox View Gradient Colors
export const UI_INBOX_GRADIENTS = {
  main: {
    from: '#E4E0EF',
    to: '#DCD6EB',
    className: 'bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB]',
  },
  button: {
    from: '#E6D5F0',
    to: '#C9E4F7',
    className: 'bg-gradient-to-r from-[#E6D5F0] to-[#C9E4F7]',
    hover: {
      from: '#C9E4F7',
      to: '#E6D5F0',
      className: 'hover:from-[#C9E4F7] hover:to-[#E6D5F0]',
    },
  },
  card: {
    from: '#C9E4F7',
    to: '#B8E6D5',
    className: 'bg-gradient-to-br from-[#C9E4F7]/30 to-[#B8E6D5]/30',
  },
  emptyState: {
    from: '#E6D5F0',
    to: '#C9E4F7',
    className: 'bg-gradient-to-br from-[#E6D5F0] to-[#C9E4F7]',
  },
} as const;

// Notifications Panel Gradient Colors
export const UI_NOTIFICATIONS_PANEL_GRADIENTS = {
  main: {
    from: '#E4E0EF',
    to: '#DCD6EB',
    className: 'bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB]',
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
    hex: '#E6D5F0',
    class: 'bg-[#E6D5F0]/30',
    fullClass: 'bg-[#E6D5F0]',
  },
  peach: {
    hex: '#FDD5B4',
    class: 'bg-[#FDD5B4]/30',
    fullClass: 'bg-[#FDD5B4]',
  },
  blue: {
    hex: '#C9E4F7',
    class: 'bg-[#C9E4F7]/30',
    fullClass: 'bg-[#C9E4F7]',
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


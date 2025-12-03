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


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
      dark: 'green-800',
      darker: 'green-900',
    },
  },
} as const;


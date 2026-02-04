import React from 'react';
// Icons migrated to Icon component - already using Icon
import { Icon } from './Icon';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { CALENDAR_EVENT_FONT_SIZES, CALENDAR_EVENT_DIMENSIONS } from '../lib/calendar-event-constants';
import { TASK_CARD_SPACING } from '../lib/task-card-constants';
import { useIsMobile } from './ui/use-mobile';

interface CalendarEventCardProps {
  title: string;
  start: string;
  end: string;
  location?: string;
  provider: 'google' | 'apple' | 'outlook';
  calendarColor?: string;
  isRecurring?: boolean; // Flag indicating if this is a recurring event
  /** When 'kanban', uses light gray background, square left corners, rounded right; background starts at vertical line. */
  variant?: 'default' | 'kanban';
}

// Calculate duration in minutes between two ISO date strings
function getDurationMinutes(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
}

// Format time to AM/PM
function formatTimeAMPM(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Format duration display
function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

// Simple hash function for consistent color assignment based on title
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Map Apple Calendar hex colors to app theme Tailwind color indices
// Apple Calendar uses colors like #RRGGBBAA format (with alpha channel)
function getColorIndexFromHex(hexColor: string): number {
  if (!hexColor) return 0;
  
  // Normalize hex color - remove # and handle RRGGBBAA format (take first 6 chars for RGB)
  let hex = hexColor.replace('#', '').toUpperCase();
  // If it's 8 characters (RRGGBBAA), take only the first 6 (RGB)
  if (hex.length === 8) {
    hex = hex.substring(0, 6);
  }
  
  // Map common Apple Calendar colors to our palette indices
  // 0: Sky, 1: Emerald, 2: Violet, 3: Amber, 4: Rose, 5: Teal, 6: Fuchsia, 7: Orange
  const colorMappings: { [key: string]: number } = {
    // Reds/Pinks -> Rose (4)
    'FF3B30': 4, 'FF2D55': 4, 'FF6B6B': 4, 'E91E63': 4, 'D51D53': 4,
    'CC1100': 4, 'FF0000': 4, 'E6194B': 4, 'FF4444': 4, 'CC3333': 4,
    // Oranges -> Orange (7)
    'FF9500': 7, 'FF6600': 7, 'FF7043': 7, 'F57C00': 7, 'FF5722': 7,
    'FF8C00': 7, 'FFA500': 7, 'FF6347': 7, 'E65100': 7, 'EF6C00': 7,
    // Yellows/Ambers -> Amber (3)
    'FFCC00': 3, 'FFC107': 3, 'FFD700': 3, 'FFEB3B': 3, 'F1C40F': 3,
    'FFFF00': 3, 'FFD600': 3, 'FFCA28': 3, 'FBC02D': 3, 'F9A825': 3,
    // Greens -> Emerald (1)
    '4CD964': 1, '34C759': 1, '28CD41': 1, '00C853': 1, '4CAF50': 1,
    '2ECC71': 1, '27AE60': 1, '00FF00': 1, '00E676': 1, '66BB6A': 1,
    '1DB954': 1, '00C7BE': 1, '43A047': 1, '388E3C': 1, '2E7D32': 1,
    // Teals/Cyans -> Teal (5)
    '5AC8FA': 5, '00BCD4': 5, '009688': 5, '1ABC9C': 5, '00CED1': 5,
    '00FFFF': 5, '17A2B8': 5, '20C997': 5, '26A69A': 5, '00ACC1': 5,
    // Blues -> Sky (0)
    '007AFF': 0, '5856D6': 0, '0A84FF': 0, '2196F3': 0, '64D2FF': 0,
    '1E90FF': 0, '0000FF': 0, '3498DB': 0, '2980B9': 0, '1976D2': 0,
    '42A5F5': 0, '1E88E5': 0, '039BE5': 0, '0288D1': 0, '0277BD': 0,
    // Purples -> Violet (2)
    'AF52DE': 2, '9C27B0': 2, 'BF5AF2': 2, '5E35B1': 2, '673AB7': 2,
    '9B59B6': 2, '8E44AD': 2, '800080': 2, 'AB47BC': 2, '7B1FA2': 2,
    '6A1B9A': 2, '4A148C': 2, '7C4DFF': 2, '651FFF': 2, '6200EA': 2,
    // Magentas/Fuchsias -> Fuchsia (6)
    'FF2D92': 6, 'E040FB': 6, 'EA80FC': 6, 'FF00FF': 6, 'FF1493': 6,
    'FF69B4': 6, 'DB2777': 6, 'EC4899': 6, 'F472B6': 6, 'D946EF': 6,
    // Browns/Grays -> Amber (3) as fallback
    '8E8E93': 3, 'A2845E': 3, '795548': 3, '8D6E63': 3, '6D4C41': 3,
  };
  
  // Check exact match first
  if (colorMappings[hex]) {
    return colorMappings[hex];
  }
  
  // Try to find closest color by parsing RGB
  try {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate hue for better color matching
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    // Check for grayscale first
    if (delta < 30) {
      return 0; // Gray/neutral -> Sky as default
    }
    
    // Calculate approximate hue (0-360)
    let hue = 0;
    if (delta > 0) {
      if (max === r) {
        hue = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        hue = 60 * ((b - r) / delta + 2);
      } else {
        hue = 60 * ((r - g) / delta + 4);
      }
      if (hue < 0) hue += 360;
    }
    
    // Map hue to color index
    // 0-15: Red (Rose 4)
    // 15-45: Orange (Orange 7)
    // 45-70: Yellow/Amber (Amber 3)
    // 70-160: Green (Emerald 1)
    // 160-200: Cyan/Teal (Teal 5)
    // 200-260: Blue (Sky 0)
    // 260-300: Purple/Violet (Violet 2)
    // 300-345: Magenta/Fuchsia (Fuchsia 6)
    // 345-360: Red (Rose 4)
    
    if (hue < 15 || hue >= 345) return 4; // Rose
    if (hue < 45) return 7; // Orange
    if (hue < 70) return 3; // Amber
    if (hue < 160) return 1; // Emerald
    if (hue < 200) return 5; // Teal
    if (hue < 260) return 0; // Sky
    if (hue < 300) return 2; // Violet
    return 6; // Fuchsia
    
  } catch {
    // Fallback
  }
  
  return 0; // Default to Sky
}

// Pastel color palette matching the app theme
const eventColorPalette = [
  { // Sky (original)
    accent: { light: 'bg-gradient-to-b from-sky-500 to-sky-600', dark: 'bg-gradient-to-b from-sky-400 to-sky-600' },
    bg: { light: 'bg-gradient-to-br from-sky-50 to-sky-100', dark: 'bg-sky-950/60' },
    border: { light: 'border-sky-300', dark: 'border-sky-700/60' },
    text: { light: 'text-sky-900', dark: 'text-sky-100' },
    mutedText: { light: 'text-sky-700', dark: 'text-sky-300' },
    iconBg: { light: 'bg-sky-200/90', dark: 'bg-sky-900/70' },
    stripe: { light: 'rgba(14,165,233,0.08)', dark: 'rgba(56,189,248,0.08)' },
  },
  { // Emerald/Mint
    accent: { light: 'bg-gradient-to-b from-emerald-500 to-emerald-600', dark: 'bg-gradient-to-b from-emerald-400 to-emerald-600' },
    bg: { light: 'bg-gradient-to-br from-emerald-50 to-emerald-100', dark: 'bg-emerald-950/60' },
    border: { light: 'border-emerald-300', dark: 'border-emerald-700/60' },
    text: { light: 'text-emerald-900', dark: 'text-emerald-100' },
    mutedText: { light: 'text-emerald-700', dark: 'text-emerald-300' },
    iconBg: { light: 'bg-emerald-200/90', dark: 'bg-emerald-900/70' },
    stripe: { light: 'rgba(16,185,129,0.08)', dark: 'rgba(52,211,153,0.08)' },
  },
  { // Violet/Lavender
    accent: { light: 'bg-gradient-to-b from-violet-500 to-violet-600', dark: 'bg-gradient-to-b from-violet-400 to-violet-600' },
    bg: { light: 'bg-gradient-to-br from-violet-50 to-violet-100', dark: 'bg-violet-950/60' },
    border: { light: 'border-violet-300', dark: 'border-violet-700/60' },
    text: { light: 'text-violet-900', dark: 'text-violet-100' },
    mutedText: { light: 'text-violet-700', dark: 'text-violet-300' },
    iconBg: { light: 'bg-violet-200/90', dark: 'bg-violet-900/70' },
    stripe: { light: 'rgba(139,92,246,0.08)', dark: 'rgba(167,139,250,0.08)' },
  },
  { // Amber/Peach
    accent: { light: 'bg-gradient-to-b from-amber-500 to-amber-600', dark: 'bg-gradient-to-b from-amber-400 to-amber-600' },
    bg: { light: 'bg-gradient-to-br from-amber-50 to-amber-100', dark: 'bg-amber-950/60' },
    border: { light: 'border-amber-300', dark: 'border-amber-700/60' },
    text: { light: 'text-amber-900', dark: 'text-amber-100' },
    mutedText: { light: 'text-amber-700', dark: 'text-amber-300' },
    iconBg: { light: 'bg-amber-200/90', dark: 'bg-amber-900/70' },
    stripe: { light: 'rgba(245,158,11,0.08)', dark: 'rgba(251,191,36,0.08)' },
  },
  { // Rose/Pink
    accent: { light: 'bg-gradient-to-b from-rose-500 to-rose-600', dark: 'bg-gradient-to-b from-rose-400 to-rose-600' },
    bg: { light: 'bg-gradient-to-br from-rose-50 to-rose-100', dark: 'bg-rose-950/60' },
    border: { light: 'border-rose-300', dark: 'border-rose-700/60' },
    text: { light: 'text-rose-900', dark: 'text-rose-100' },
    mutedText: { light: 'text-rose-700', dark: 'text-rose-300' },
    iconBg: { light: 'bg-rose-200/90', dark: 'bg-rose-900/70' },
    stripe: { light: 'rgba(244,63,94,0.08)', dark: 'rgba(251,113,133,0.08)' },
  },
  { // Teal/Sage
    accent: { light: 'bg-gradient-to-b from-teal-500 to-teal-600', dark: 'bg-gradient-to-b from-teal-400 to-teal-600' },
    bg: { light: 'bg-gradient-to-br from-teal-50 to-teal-100', dark: 'bg-teal-950/60' },
    border: { light: 'border-teal-300', dark: 'border-teal-700/60' },
    text: { light: 'text-teal-900', dark: 'text-teal-100' },
    mutedText: { light: 'text-teal-700', dark: 'text-teal-300' },
    iconBg: { light: 'bg-teal-200/90', dark: 'bg-teal-900/70' },
    stripe: { light: 'rgba(20,184,166,0.08)', dark: 'rgba(45,212,191,0.08)' },
  },
  { // Fuchsia/Lilac
    accent: { light: 'bg-gradient-to-b from-fuchsia-500 to-fuchsia-600', dark: 'bg-gradient-to-b from-fuchsia-400 to-fuchsia-600' },
    bg: { light: 'bg-gradient-to-br from-fuchsia-50 to-fuchsia-100', dark: 'bg-fuchsia-950/60' },
    border: { light: 'border-fuchsia-300', dark: 'border-fuchsia-700/60' },
    text: { light: 'text-fuchsia-900', dark: 'text-fuchsia-100' },
    mutedText: { light: 'text-fuchsia-700', dark: 'text-fuchsia-300' },
    iconBg: { light: 'bg-fuchsia-200/90', dark: 'bg-fuchsia-900/70' },
    stripe: { light: 'rgba(217,70,239,0.08)', dark: 'rgba(232,121,249,0.08)' },
  },
  { // Orange
    accent: { light: 'bg-gradient-to-b from-orange-500 to-orange-600', dark: 'bg-gradient-to-b from-orange-400 to-orange-600' },
    bg: { light: 'bg-gradient-to-br from-orange-50 to-orange-100', dark: 'bg-orange-950/60' },
    border: { light: 'border-orange-300', dark: 'border-orange-700/60' },
    text: { light: 'text-orange-900', dark: 'text-orange-100' },
    mutedText: { light: 'text-orange-700', dark: 'text-orange-300' },
    iconBg: { light: 'bg-orange-200/90', dark: 'bg-orange-900/70' },
    stripe: { light: 'rgba(249,115,22,0.08)', dark: 'rgba(251,146,60,0.08)' },
  },
];

export function CalendarEventCard({ title, start, end, location, provider, calendarColor, isRecurring, variant = 'default' }: CalendarEventCardProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const mode = isDark ? 'dark' : 'light';
  const isMobile = useIsMobile();
  
  const durationMinutes = getDurationMinutes(start, end);
  const startTime = formatTimeAMPM(start);
  const endTime = formatTimeAMPM(end);
  
  // Calculate visual height based on duration (similar to tasks but with different styling)
  // Minimum height for very short events, scale up for longer ones
  const calculatedHeight = Math.min(
    CALENDAR_EVENT_DIMENSIONS.height.base + (durationMinutes / 60) * CALENDAR_EVENT_DIMENSIONS.height.perHour,
    CALENDAR_EVENT_DIMENSIONS.height.max
  );
  
  // Get color based on calendar color (if provided) or fallback to title hash
  const colorIndex = calendarColor 
    ? getColorIndexFromHex(calendarColor)
    : hashString(title) % eventColorPalette.length;
  const palette = eventColorPalette[colorIndex];
  
  const colors = {
    accent: palette.accent[mode],
    bg: palette.bg[mode],
    border: palette.border[mode],
    text: palette.text[mode],
    mutedText: palette.mutedText[mode],
    iconBg: palette.iconBg[mode],
    stripe: palette.stripe[mode],
  };

  const contentPaddingLeft = isMobile ? CALENDAR_EVENT_DIMENSIONS.contentPadding.left.mobile : CALENDAR_EVENT_DIMENSIONS.contentPadding.left.desktop;

  // Kanban week view: light gray background, square left, rounded right, background starts at vertical line; same width as task cards
  if (variant === 'kanban') {
    return (
      <div
        className="flex w-full max-w-full overflow-hidden transition-all duration-200 cursor-default select-none box-border"
        style={{ minHeight: `${calculatedHeight}px`, width: '100%', maxWidth: '100%' }}
      >
        {/* Vertical line at left edge (square corners) - background starts from here */}
        <div
          className={cn('flex-shrink-0 rounded-none', colors.accent)}
          style={{
            width: CALENDAR_EVENT_DIMENSIONS.verticalLine.width,
            minHeight: `${calculatedHeight}px`,
          }}
        />
        <div
          className={cn(
            'flex-1 min-h-full flex flex-col gap-1 py-1 rounded-r-lg min-w-0 overflow-hidden',
            'bg-gray-100/90 dark:bg-gray-800/60 border-0 border-l-0',
          )}
          style={{
            paddingLeft: 12,
            minHeight: `${calculatedHeight}px`,
            minWidth: 0,
          }}
        >
          {/* Header with calendar icon */}
          <div className="flex items-center gap-1.5">
            <Icon name="calendar" size={CALENDAR_EVENT_DIMENSIONS.icon.calendar} weight="duotone" className={colors.mutedText} />
            <span className={cn('font-medium uppercase tracking-wide', colors.mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.providerLabel }}>
              {provider === 'apple' ? 'iCloud' : provider === 'outlook' ? 'Outlook' : 'Google'} Calendar
            </span>
            {isRecurring && (
              <Icon name="repeat" size={CALENDAR_EVENT_DIMENSIONS.icon.repeat} weight="duotone" className={colors.mutedText} />
            )}
          </div>
          <h4 className={cn('text-sm font-semibold leading-tight line-clamp-2', colors.text)}>{title}</h4>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Icon name="clock" size={CALENDAR_EVENT_DIMENSIONS.icon.clock} className={colors.mutedText} />
              <span className={colors.mutedText} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.time }}>{startTime} – {endTime}</span>
            </div>
            <span className={cn('font-medium px-1.5 py-0.5 rounded-full', colors.iconBg, colors.mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.duration }}>
              {formatDuration(durationMinutes)}
            </span>
          </div>
          {location && (
            <div className="flex items-center gap-1 mt-0.5">
              <Icon name="map-pin" size={CALENDAR_EVENT_DIMENSIONS.icon.mapPin} className={cn('flex-shrink-0', colors.mutedText)} />
              <span className={cn('truncate', colors.mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.location }}>{location}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default (Today Agenda, etc.): rounded card with colored vertical line inset; full width to match task cards
  return (
    <div
      className={cn(
        "flex w-full transition-all duration-200 cursor-default select-none rounded-lg relative box-border flex-col",
        isMobile ? TASK_CARD_SPACING.short.mobile : TASK_CARD_SPACING.short.desktop,
      )}
      style={{ minHeight: `${calculatedHeight}px`, width: '100%', minWidth: '100%' }}
    >
      <div 
        className={cn('absolute top-0 bottom-0 rounded-full', colors.accent)}
        style={{ 
          left: `${isMobile ? CALENDAR_EVENT_DIMENSIONS.verticalLine.leftOffset.mobile : CALENDAR_EVENT_DIMENSIONS.verticalLine.leftOffset.desktop}px`,
          width: CALENDAR_EVENT_DIMENSIONS.verticalLine.width, 
        }}
      />
      <div className="flex-1 py-1 flex flex-col gap-1" style={{ paddingLeft: `${contentPaddingLeft}px` }}>
        <div className="flex items-center gap-1.5">
          <Icon name="calendar" size={CALENDAR_EVENT_DIMENSIONS.icon.calendar} weight="duotone" className={colors.mutedText} />
          <span className={cn('font-medium uppercase tracking-wide', colors.mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.providerLabel }}>
            {provider === 'apple' ? 'iCloud' : provider === 'outlook' ? 'Outlook' : 'Google'} Calendar
          </span>
          {isRecurring && (
            <Icon name="repeat" size={CALENDAR_EVENT_DIMENSIONS.icon.repeat} weight="duotone" className={colors.mutedText} />
          )}
        </div>
        <h4 className={cn('text-sm font-semibold leading-tight line-clamp-2', colors.text)}>{title}</h4>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Icon name="clock" size={CALENDAR_EVENT_DIMENSIONS.icon.clock} className={colors.mutedText} />
            <span className={colors.mutedText} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.time }}>{startTime} – {endTime}</span>
          </div>
          <span className={cn('font-medium px-1.5 py-0.5 rounded-full', colors.iconBg, colors.mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.duration }}>
            {formatDuration(durationMinutes)}
          </span>
        </div>
        {location && (
          <div className="flex items-center gap-1 mt-0.5">
            <Icon name="map-pin" size={CALENDAR_EVENT_DIMENSIONS.icon.mapPin} className={cn('flex-shrink-0', colors.mutedText)} />
            <span className={cn('truncate', colors.mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.location }}>{location}</span>
          </div>
        )}
      </div>
    </div>
  );
}


import React from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';

interface CalendarEventCardProps {
  title: string;
  start: string;
  end: string;
  location?: string;
  provider: 'google' | 'apple';
  calendarColor?: string;
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
// Apple Calendar uses colors like #FF3B30 (red), #FF9500 (orange), #FFCC00 (yellow), etc.
function getColorIndexFromHex(hexColor: string): number {
  if (!hexColor) return 0;
  // Normalize hex color
  const hex = hexColor.replace('#', '').toUpperCase();
  
  // Map common Apple Calendar colors to our palette indices
  // 0: Sky, 1: Emerald, 2: Violet, 3: Amber, 4: Rose, 5: Teal, 6: Fuchsia, 7: Orange
  const colorMappings: { [key: string]: number } = {
    // Reds/Pinks -> Rose (4)
    'FF3B30': 4, 'FF2D55': 4, 'FF6B6B': 4, 'E91E63': 4,
    // Oranges -> Orange (7)
    'FF9500': 7, 'FF6600': 7, 'FF7043': 7, 'F57C00': 7,
    // Yellows/Ambers -> Amber (3)
    'FFCC00': 3, 'FFC107': 3, 'FFD700': 3, 'FFEB3B': 3,
    // Greens -> Emerald (1)
    '4CD964': 1, '34C759': 1, '28CD41': 1, '00C853': 1, '4CAF50': 1,
    // Teals/Cyans -> Teal (5)
    '5AC8FA': 5, '00BCD4': 5, '009688': 5, '1ABC9C': 5,
    // Blues -> Sky (0)
    '007AFF': 0, '5856D6': 0, '0A84FF': 0, '2196F3': 0, '64D2FF': 0,
    // Purples -> Violet (2)
    'AF52DE': 2, '9C27B0': 2, 'BF5AF2': 2, '5E35B1': 2, '673AB7': 2,
    // Magentas/Fuchsias -> Fuchsia (6)
    'FF2D92': 6, 'E040FB': 6, 'EA80FC': 6, 'FF00FF': 6,
    // Browns/Grays -> Amber (3) as fallback
    '8E8E93': 3, 'A2845E': 3,
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
    
    // Simple hue-based classification
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    if (max - min < 30) {
      // Gray/neutral -> Sky (0) as default
      return 0;
    }
    
    if (r > g && r > b) {
      // Red dominant
      if (g > b * 1.5) return 7; // Orange
      return 4; // Rose
    }
    if (g > r && g > b) {
      // Green dominant
      if (b > r) return 5; // Teal
      return 1; // Emerald
    }
    if (b > r && b > g) {
      // Blue dominant
      if (r > g * 1.3) return 2; // Violet
      if (g > r) return 5; // Teal/Cyan
      return 0; // Sky
    }
    if (r > 200 && g > 150 && b < 100) {
      return 3; // Amber/Yellow
    }
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

export function CalendarEventCard({ title, start, end, location, provider, calendarColor }: CalendarEventCardProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const mode = isDark ? 'dark' : 'light';
  
  const durationMinutes = getDurationMinutes(start, end);
  const startTime = formatTimeAMPM(start);
  const endTime = formatTimeAMPM(end);
  
  // Calculate visual height based on duration (similar to tasks but with different styling)
  // Minimum height for very short events, scale up for longer ones
  const baseHeight = 48; // Minimum height in pixels
  const heightPerHour = 40; // Additional height per hour
  const calculatedHeight = Math.min(
    baseHeight + (durationMinutes / 60) * heightPerHour,
    160 // Max height
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

  return (
    <div
      className={cn(
        'relative rounded-lg border overflow-hidden transition-all duration-200',
        'hover:shadow-md cursor-default select-none',
        colors.bg,
        colors.border
      )}
      style={{
        minHeight: `${calculatedHeight}px`,
      }}
    >
      {/* Left accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', colors.accent)} />
      
      <div className="pl-3 pr-2 py-2 flex flex-col gap-1">
        {/* Header with calendar icon and time */}
        <div className="flex items-center gap-1.5">
          <div className={cn('p-1 rounded', colors.iconBg)}>
            <Calendar className={cn('h-3 w-3', colors.mutedText)} />
          </div>
          <span className={cn('text-[10px] font-medium uppercase tracking-wide', colors.mutedText)}>
            {provider === 'apple' ? 'iCloud' : 'Google'} Calendar
          </span>
        </div>
        
        {/* Title */}
        <h4 className={cn(
          'text-xs font-semibold leading-tight line-clamp-2',
          colors.text
        )}>
          {title}
        </h4>
        
        {/* Time and duration */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Clock className={cn('h-3 w-3', colors.mutedText)} />
            <span className={cn('text-[10px]', colors.mutedText)}>
              {startTime} – {endTime}
            </span>
          </div>
          <span className={cn(
            'text-[9px] font-medium px-1.5 py-0.5 rounded-full',
            colors.iconBg,
            colors.mutedText
          )}>
            {formatDuration(durationMinutes)}
          </span>
        </div>
        
        {/* Location if present */}
        {location && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className={cn('h-3 w-3 flex-shrink-0', colors.mutedText)} />
            <span className={cn('text-[10px] truncate', colors.mutedText)}>
              {location}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}


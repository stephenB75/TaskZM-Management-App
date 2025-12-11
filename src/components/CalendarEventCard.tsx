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

export function CalendarEventCard({ title, start, end, location, provider }: CalendarEventCardProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
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
  
  // Provider-specific accent colors
  const providerColors = {
    apple: {
      accent: isDark ? 'bg-rose-500/80' : 'bg-rose-500',
      bg: isDark ? 'bg-rose-950/40' : 'bg-rose-50',
      border: isDark ? 'border-rose-800/50' : 'border-rose-200',
      text: isDark ? 'text-rose-200' : 'text-rose-900',
      mutedText: isDark ? 'text-rose-300/70' : 'text-rose-600',
      iconBg: isDark ? 'bg-rose-900/50' : 'bg-rose-100',
    },
    google: {
      accent: isDark ? 'bg-blue-500/80' : 'bg-blue-500',
      bg: isDark ? 'bg-blue-950/40' : 'bg-blue-50',
      border: isDark ? 'border-blue-800/50' : 'border-blue-200',
      text: isDark ? 'text-blue-200' : 'text-blue-900',
      mutedText: isDark ? 'text-blue-300/70' : 'text-blue-600',
      iconBg: isDark ? 'bg-blue-900/50' : 'bg-blue-100',
    },
  };
  
  const colors = providerColors[provider];

  return (
    <div
      className={cn(
        'relative rounded-lg border overflow-hidden transition-all duration-200',
        'hover:shadow-md cursor-default select-none',
        colors.bg,
        colors.border,
        // Striped pattern to distinguish from tasks
        'bg-[length:8px_8px]',
        isDark 
          ? 'bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)]'
          : 'bg-[linear-gradient(135deg,transparent_25%,rgba(0,0,0,0.02)_25%,rgba(0,0,0,0.02)_50%,transparent_50%,transparent_75%,rgba(0,0,0,0.02)_75%)]'
      )}
      style={{ minHeight: `${calculatedHeight}px` }}
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


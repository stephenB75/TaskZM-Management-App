import React from 'react';
// Icons migrated to Icon component - already using Icon
import { Icon } from './Icon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { cn, parseCalendarEventTime, getTimeAndPeriod } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { COLOR_CALENDAR_EVENT_SURFACE } from '../lib/color-theme';
import { getCalendarEventAccent } from '../lib/calendar-event-color';
import { MILLISECONDS_PER_MINUTE, MINUTES_PER_HOUR, MINUTES_PER_DAY } from '../lib/business-constants';
import { CALENDAR_EVENT_FONT_SIZES, CALENDAR_EVENT_DIMENSIONS, CALENDAR_EVENT_UI_TEXT } from '../lib/calendar-event-constants';
import { CALENDAR_PROVIDER_EVENT_SOURCE_LABELS, type CalendarProviderId } from '../lib/calendar-integration-constants';
import {
  TASK_CARD_SPACING,
  TASK_CARD_TAB_HEIGHT,
  TASK_CARD_TAB_SPACING,
  TASK_CARD_BORDERS,
  TASK_CARD_FONT_SIZES,
  TASK_CARD_LINE_CLAMP,
  TASK_CARD_ICON_SIZES,
  TASK_CARD_BADGE_SIZES,
  TASK_CARD_KANBAN_TIME_PERIOD_AM,
  TASK_CARD_KANBAN_TIME_PERIOD_PM,
  TASK_CARD_KANBAN_TIME_PERIOD_ICON_SIZE_PX,
  TASK_CARD_KANBAN_TIME_PERIOD_ICON_CLASS,
  TASK_CARD_KANBAN_TIME_PERIOD_ICON_AM,
  TASK_CARD_KANBAN_TIME_PERIOD_ICON_PM,
  TASK_CARD_KANBAN_TIME_ROW_GAP_CLASS,
} from '../lib/task-card-constants';
import { TODAY_AGENDA_TIMELINE } from '../lib/layout-constants';
import { useIsMobile } from './ui/use-mobile';
import { AgendaListCard } from './AgendaListCard';
import { AGENDA_LIST_CARD, AGENDA_LIST_CARD_COLORS } from '../lib/agenda-list-card-constants';

interface CalendarEventCardProps {
  title: string;
  start: string;
  end: string;
  location?: string;
  provider: CalendarProviderId;
  /** Color the event has in the user's calendar; falls back to the app's event blue. */
  calendarColor?: string;
  isRecurring?: boolean; // Flag indicating if this is a recurring event
  /** When 'kanban', uses light gray background, square left corners, rounded right; background starts at vertical line. */
  /** When 'timelineCompact', two-line layout on Today Agenda timeline: line 1 = meta (calendar, time, duration), line 2 = headline only. */
  /** When 'inbox', 2-line layout: meta + time on line 1, headline + location on line 2. */
  /** When 'timeline', embedded in Today Agenda — same layout as task cards. */
  variant?: 'default' | 'kanban' | 'timelineCompact' | 'timelineMicro' | 'timeline' | 'inbox';
  /** Short-duration compact row (matches DraggableTaskCard compactTimeline). */
  compactTimeline?: boolean;
  /** Slot-fit layout tier from Today Agenda (micro / compact / full). */
  timelineLayoutTier?: 'micro' | 'compact' | 'full';
  /** When true, hide footer so title fits in a short timeline slot. */
  timelineHideFooter?: boolean;
  /** Today Agenda: row height (px) so the card fills the duration slot on the time grid. */
  timelineBlockHeightPx?: number;
  /** Today Agenda: duration shown on-card when clipped to the visible timeline (e.g. past midnight). */
  timelineDurationMinutes?: number;
}

// Calculate duration in minutes between two ISO date strings (uses parseCalendarEventTime for correct timezone)
function getDurationMinutes(start: string, end: string): number {
  const startDate = parseCalendarEventTime(start);
  const endDate = parseCalendarEventTime(end);
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_MINUTE));
}

// Format time to AM/PM in user's local timezone (uses parseCalendarEventTime so UTC-from-API displays correctly)
function formatTimeAMPM(isoString: string): string {
  const date = parseCalendarEventTime(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

// True if event is date-only (YYYY-MM-DD) or spans full day (24h and starts at midnight local)
function isAllDayEvent(start: string, end: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return true;
  const startDate = parseCalendarEventTime(start);
  const endDate = parseCalendarEventTime(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
  const durationMinutes = (endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_MINUTE;
  const startHour = startDate.getHours();
  const startMin = startDate.getMinutes();
  return durationMinutes >= MINUTES_PER_DAY - 1 && startHour === 0 && startMin === 0;
}

// Format duration display
function formatDuration(minutes: number): string {
  if (minutes >= MINUTES_PER_HOUR) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const mins = minutes % MINUTES_PER_HOUR;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export function CalendarEventCard({ title, start, end, location, provider, calendarColor, isRecurring, variant = 'default', compactTimeline, timelineLayoutTier, timelineHideFooter = false, timelineBlockHeightPx, timelineDurationMinutes }: CalendarEventCardProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const isMobile = useIsMobile();
  
  const durationMinutes = timelineDurationMinutes ?? getDurationMinutes(start, end);
  const allDay = isAllDayEvent(start, end);
  const startTime = formatTimeAMPM(start);
  const endTime = formatTimeAMPM(end);
  
  // Calculate visual height based on duration (similar to tasks but with different styling)
  // Minimum height for very short events, scale up for longer ones
  const calculatedHeight = Math.min(
    CALENDAR_EVENT_DIMENSIONS.height.base + (durationMinutes / MINUTES_PER_HOUR) * CALENDAR_EVENT_DIMENSIONS.height.perHour,
    CALENDAR_EVENT_DIMENSIONS.height.max
  );
  
  const mutedText = 'text-muted-foreground';
  const contentPaddingLeft = isMobile ? CALENDAR_EVENT_DIMENSIONS.contentPadding.left.mobile : CALENDAR_EVENT_DIMENSIONS.contentPadding.left.desktop;

  const providerLabel = `${CALENDAR_PROVIDER_EVENT_SOURCE_LABELS[provider]}${CALENDAR_EVENT_UI_TEXT.calendarLabelSuffix}`;
  const timeAndPeriod = !allDay ? getTimeAndPeriod(start) : null;
  const accentDotColor = getCalendarEventAccent(calendarColor);

  const agendaCard = (options: { compact?: boolean; hideTime?: boolean; micro?: boolean; timelineEmbedded?: boolean }) => {
    const card = (
      <AgendaListCard
        accentColor={accentDotColor}
        badgeLabel={CALENDAR_EVENT_UI_TEXT.kanbanTabLabel}
        title={title}
        subtitle={options.compact || options.micro ? undefined : (location || undefined)}
        timePart={timeAndPeriod?.timePart}
        periodPart={timeAndPeriod?.period}
        allDayLabel={allDay ? CALENDAR_EVENT_UI_TEXT.allDay : undefined}
        footerIcon="calendar"
        footerSourceLabel={providerLabel}
        durationLabel={formatDuration(durationMinutes)}
        compact={options.compact}
        hideTime={options.hideTime}
        micro={options.micro}
        embedded={options.timelineEmbedded}
        hideAccentColumn={options.timelineEmbedded}
        style={options.timelineEmbedded ? undefined : { height: '100%', minHeight: '100%', maxHeight: '100%' }}
      />
    );

    if (options.timelineEmbedded) {
      return card;
    }

    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-semibold">{title}</p>
            <p className="text-primary-foreground/90 text-xs mt-0.5">
              {allDay ? CALENDAR_EVENT_UI_TEXT.allDay : `${startTime} – ${endTime}`} · {formatDuration(durationMinutes)}
              {location && ` · ${location}`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Today Agenda timeline — single AgendaListCard shell (matches task cards)
  if (variant === 'timeline') {
    const tier = timelineLayoutTier ?? (compactTimeline ? 'compact' : 'full');
    const useMicro = tier === 'micro';
    const useCompact = tier === 'compact' || useMicro;
    return (
      <AgendaListCard
        accentColor={accentDotColor}
        badgeLabel={CALENDAR_EVENT_UI_TEXT.kanbanTabLabel}
        title={title}
        subtitle={useMicro ? undefined : (location || undefined)}
        footerIcon="calendar"
        footerSourceLabel={providerLabel}
        durationLabel={formatDuration(durationMinutes)}
        compact={useCompact}
        micro={useMicro}
        hideFooter={timelineHideFooter}
        fitTimelineSlot
        hideTime
        hideAccentColumn
        embedded
        leftAccentColor={accentDotColor}
        leftAccentWidthPx={TODAY_AGENDA_TIMELINE.blockAccentWidthPx}
        surface="timeline"
        style={
          timelineBlockHeightPx != null
            ? { minHeight: timelineBlockHeightPx, height: '100%' }
            : undefined
        }
      />
    );
  }

  // Today Agenda timeline: ultra-compact row for short events (legacy — prefer timeline)
  if (variant === 'timelineMicro') {
    return agendaCard({ micro: true, hideTime: true, timelineEmbedded: true });
  }

  // Today Agenda timeline: compact or full agenda list card
  if (variant === 'timelineCompact') {
    return agendaCard({ compact: true, hideTime: true, timelineEmbedded: true });
  }

  // Kanban week view: same white agenda list card as tasks
  if (variant === 'kanban') {
    return (
      <div
        className="flex flex-col w-full max-w-full overflow-hidden transition-all duration-200 cursor-default select-none box-border flex-shrink-0"
        style={{
          minHeight: `${calculatedHeight}px`,
          flex: '0 0 100%',
          width: '100%',
          minWidth: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          borderRadius: AGENDA_LIST_CARD.borderRadiusPx,
          boxShadow: AGENDA_LIST_CARD.shadow,
          backgroundColor: isDark ? AGENDA_LIST_CARD_COLORS.cardBackgroundDark : AGENDA_LIST_CARD_COLORS.cardBackground,
        }}
      >
        <AgendaListCard
          accentColor={accentDotColor}
          badgeLabel={CALENDAR_EVENT_UI_TEXT.kanbanTabLabel}
          title={title}
          subtitle={location || undefined}
          timePart={timeAndPeriod?.timePart}
          periodPart={timeAndPeriod?.period}
          allDayLabel={allDay ? CALENDAR_EVENT_UI_TEXT.allDay : undefined}
          footerIcon="calendar"
          footerSourceLabel={providerLabel}
          durationLabel={formatDuration(durationMinutes)}
          embedded
        />
      </div>
    );
  }

  // Inbox: 2-line layout (meta + time on line 1, headline + location on line 2)
  if (variant === 'inbox') {
    return (
      <div
        className={cn(
          "flex w-full max-w-full flex-shrink-0 overflow-hidden transition-all duration-200 cursor-default select-none rounded-lg relative box-border flex-col",
          isMobile ? TASK_CARD_SPACING.short.mobile : TASK_CARD_SPACING.short.desktop,
        )}
        style={{ minHeight: `${calculatedHeight}px`, width: '100%', minWidth: '100%', maxWidth: '100%' }}
      >
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            background: accentDotColor,
            left: `${isMobile ? CALENDAR_EVENT_DIMENSIONS.verticalLine.leftOffset.mobile : CALENDAR_EVENT_DIMENSIONS.verticalLine.leftOffset.desktop}px`,
            width: CALENDAR_EVENT_DIMENSIONS.verticalLine.width,
          }}
        />
        <div className="flex-1 py-2 flex flex-col gap-1.5" style={{ paddingLeft: `${contentPaddingLeft}px` }}>
          {/* Line 1: icon, source, recurring, time, duration */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Icon name="calendar" size={CALENDAR_EVENT_DIMENSIONS.icon.calendar} weight="duotone" className={cn('flex-shrink-0', mutedText)} />
            <span className={cn('font-medium uppercase tracking-wide flex-shrink-0', mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.providerLabel }}>
              {CALENDAR_PROVIDER_EVENT_SOURCE_LABELS[provider]}
              {CALENDAR_EVENT_UI_TEXT.calendarLabelSuffix}
            </span>
            {isRecurring && (
              <Icon name="repeat" size={CALENDAR_EVENT_DIMENSIONS.icon.repeat} weight="duotone" className={cn('flex-shrink-0', mutedText)} />
            )}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Icon name="clock" size={CALENDAR_EVENT_DIMENSIONS.icon.clock} className={mutedText} />
              <span className={cn('whitespace-nowrap', mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.time }}>
                {allDay ? CALENDAR_EVENT_UI_TEXT.allDay : `${startTime} – ${endTime}`}
              </span>
            </div>
            <span className={cn('font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.duration, background: COLOR_CALENDAR_EVENT_SURFACE }}>
              {formatDuration(durationMinutes)}
            </span>
          </div>
          {/* Line 2: headline + location */}
          <div className="flex items-center gap-2 min-w-0">
            <h4 className={cn('font-semibold leading-tight truncate flex-1 min-w-0', 'text-foreground')} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.title }} title={title}>
              {title}
            </h4>
            {location && (
              <div className="flex items-center gap-1.5 flex-shrink-0 min-w-0 max-w-[50%]">
                <Icon name="map-pin" size={CALENDAR_EVENT_DIMENSIONS.icon.mapPin} className={cn('flex-shrink-0', mutedText)} />
                <span className={cn('truncate', mutedText)} style={{ fontSize: CALENDAR_EVENT_FONT_SIZES.location }} title={location}>
                  {location}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default (Today Agenda unscheduled, etc.): white agenda list card
  return agendaCard({ compact: false });
}


import React from 'react';
import { cn } from '../lib/utils';
import {
  MOBILE_HOME_BODY_FONT_SIZE,
  MOBILE_HOME_CARD_BAR_PX,
  MOBILE_HOME_CARD_PADDING,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_PILL_RADIUS,
  MOBILE_HOME_LABEL_GAP,
  MOBILE_HOME_SECTION_GAP,
  MOBILE_HOME_TAB_FONT_SIZE,
} from '../lib/layout-constants';
import { COLOR_TEXT_PRIMARY } from '../lib/color-theme';
import { AGENDA_LIST_CARD, getAgendaCardBadgeStyles } from '../lib/agenda-list-card-constants';

export interface AgendaListCardProps {
  accentColor: string;
  /** When set, renders a tinted icon badge instead of the colored dot. */
  accentIcon?: string;
  badgeLabel: string;
  title: string;
  subtitle?: string | null;
  timePart?: string | null;
  periodPart?: 'AM' | 'PM' | null;
  allDayLabel?: string | null;
  footerIcon?: string;
  footerSourceLabel: string;
  durationLabel?: string | null;
  showCommentIcon?: boolean;
  compact?: boolean;
  /** When true, omits footer row (fits short timeline slots). */
  hideFooter?: boolean;
  /** When true, card is embedded in a Today Agenda duration block (scroll + clamp). */
  fitTimelineSlot?: boolean;
  /** When true, omits the time header row (timeline rail shows time). */
  hideTime?: boolean;
  /** Ultra-compact single row: title + badge only (short timeline events). */
  micro?: boolean;
  /** When true, show compact "NEXT UP" pill at top of timeline card. */
  showNextUpBadge?: boolean;
  /** When true, hides the left dot/accent column (timeline rail shows the dot). */
  hideAccentColumn?: boolean;
  /** Left accent bar on the card (used on timeline when hideAccentColumn is set). */
  leftAccentColor?: string;
  leftAccentWidthPx?: number;
  /** When true, renders without outer shadow/radius (for use inside a parent card shell). */
  embedded?: boolean;
  /** Timeline cards use a lighter single-layer surface (no stacked-card look). */
  surface?: 'default' | 'timeline';
  /** When true, title renders with line-through (completed tasks). */
  titleDone?: boolean;
  className?: string;
  style?: React.CSSProperties;
  headerAction?: React.ReactNode;
  /** Optional inline control in the footer row (e.g. Pomodoro), after duration. */
  footerAction?: React.ReactNode;
}

export function AgendaListCard({
  accentColor,
  title,
  subtitle,
  timePart,
  periodPart,
  allDayLabel,
  footerSourceLabel,
  badgeLabel,
  titleDone = false,
  compact = false,
  className,
  style,
  headerAction,
  embedded = false,
  leftAccentColor,
}: AgendaListCardProps) {
  const timeLabel = allDayLabel || (timePart ? `${timePart}${periodPart ? ` ${periodPart}` : ''}` : '');
  const detail = timeLabel || subtitle || footerSourceLabel;
  const badge = getAgendaCardBadgeStyles(leftAccentColor || accentColor);
  const padding = compact ? AGENDA_LIST_CARD.compact.paddingPx : MOBILE_HOME_CARD_PADDING;
  const titleSize = compact ? AGENDA_LIST_CARD.compact.titleFontSizePx : MOBILE_HOME_BODY_FONT_SIZE;

  return (
    <div
      className={cn('flex w-full min-w-0 items-stretch', className)}
      style={{
        gap: MOBILE_HOME_SECTION_GAP,
        alignItems: 'stretch',
        background: 'transparent',
        color: COLOR_TEXT_PRIMARY,
        borderRadius: embedded ? 0 : MOBILE_HOME_CARD_RADIUS,
        padding: embedded ? 0 : padding,
        boxShadow: 'none',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: MOBILE_HOME_CARD_BAR_PX,
          borderRadius: MOBILE_HOME_CARD_RADIUS,
          background: leftAccentColor || accentColor,
          flex: 'none',
        }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span
            className={cn('block font-medium', titleDone && 'line-through')}
            style={{ fontSize: titleSize }}
          >
            {title}
          </span>
          {badgeLabel ? (
            <span
              className="shrink-0 font-semibold capitalize"
              style={{
                fontSize: AGENDA_LIST_CARD.badgeFontSizePx,
                paddingLeft: AGENDA_LIST_CARD.badgePaddingXPx,
                paddingRight: AGENDA_LIST_CARD.badgePaddingXPx,
                paddingTop: AGENDA_LIST_CARD.badgePaddingYPx,
                paddingBottom: AGENDA_LIST_CARD.badgePaddingYPx,
                borderRadius: MOBILE_HOME_PILL_RADIUS,
                background: badge.badgeBackground,
                color: badge.badgeText,
              }}
            >
              {badgeLabel}
            </span>
          ) : null}
          {headerAction}
        </span>
        {detail ? (
          <span className="block" style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, marginTop: MOBILE_HOME_LABEL_GAP }}>
            {detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}

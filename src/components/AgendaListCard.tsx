import React from 'react';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
import { useTheme } from '../contexts/ThemeContext';
import {
  AGENDA_LIST_CARD,
  AGENDA_LIST_CARD_COLORS,
  getAgendaCardBadgeStyles,
} from '../lib/agenda-list-card-constants';

export interface AgendaListCardProps {
  accentColor: string;
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
  /** When true, renders without outer shadow/radius (for use inside a parent card shell). */
  embedded?: boolean;
  /** When true, title renders with line-through (completed tasks). */
  titleDone?: boolean;
  className?: string;
  style?: React.CSSProperties;
  headerAction?: React.ReactNode;
}

export function AgendaListCard({
  accentColor,
  badgeLabel,
  title,
  subtitle,
  timePart,
  periodPart,
  allDayLabel,
  footerIcon = 'calendar',
  footerSourceLabel,
  durationLabel,
  showCommentIcon = false,
  compact = false,
  embedded = false,
  titleDone = false,
  className,
  style,
  headerAction,
}: AgendaListCardProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const badgeStyles = getAgendaCardBadgeStyles(accentColor);

  const padding = compact ? AGENDA_LIST_CARD.compact.paddingPx : AGENDA_LIST_CARD.paddingPx;
  const dotSize = compact ? AGENDA_LIST_CARD.compact.dotSizePx : AGENDA_LIST_CARD.dotSizePx;
  const titleSize = compact ? AGENDA_LIST_CARD.compact.titleFontSizePx : AGENDA_LIST_CARD.titleFontSizePx;
  const timeSize = compact ? AGENDA_LIST_CARD.compact.timeFontSizePx : AGENDA_LIST_CARD.timeFontSizePx;
  const footerSize = compact ? AGENDA_LIST_CARD.compact.footerFontSizePx : AGENDA_LIST_CARD.footerFontSizePx;

  const hasTime = Boolean(allDayLabel || timePart);

  return (
    <div
      className={cn(
        'flex flex-col w-full h-full min-w-0 box-border',
        isDark ? 'dark:bg-[#3E3E52]' : 'bg-white',
        className,
      )}
      style={{
        borderRadius: embedded ? 0 : AGENDA_LIST_CARD.borderRadiusPx,
        padding,
        boxShadow: embedded ? 'none' : AGENDA_LIST_CARD.shadow,
        backgroundColor: embedded
          ? 'transparent'
          : isDark
            ? AGENDA_LIST_CARD_COLORS.cardBackgroundDark
            : AGENDA_LIST_CARD_COLORS.cardBackground,
        ...style,
      }}
    >
      <div className="flex flex-1 min-h-0 w-full" style={{ gap: AGENDA_LIST_CARD.accentColumnWidthPx - dotSize }}>
        {/* Colored dot + vertical accent line */}
        <div className="flex flex-col items-center flex-shrink-0" style={{ width: AGENDA_LIST_CARD.accentColumnWidthPx }}>
          <span
            className="rounded-full flex-shrink-0"
            style={{
              width: dotSize,
              height: dotSize,
              backgroundColor: badgeStyles.dotColor,
            }}
            aria-hidden
          />
          <span
            className="flex-1 rounded-full mt-1"
            style={{
              width: AGENDA_LIST_CARD.accentLineWidthPx,
              minHeight: compact ? 20 : AGENDA_LIST_CARD.accentLineMinHeightPx,
              backgroundColor: isDark ? AGENDA_LIST_CARD_COLORS.accentLineDark : AGENDA_LIST_CARD_COLORS.accentLine,
            }}
            aria-hidden
          />
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          {/* Header: time + optional comment / action */}
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex items-baseline gap-1 min-w-0">
              {allDayLabel ? (
                <span
                  className="font-semibold truncate"
                  style={{
                    fontSize: timeSize,
                    color: isDark ? AGENDA_LIST_CARD_COLORS.titleDark : AGENDA_LIST_CARD_COLORS.title,
                  }}
                >
                  {allDayLabel}
                </span>
              ) : hasTime && timePart ? (
                <>
                  <span
                    className="font-semibold flex-shrink-0"
                    style={{
                      fontSize: timeSize,
                      color: isDark ? AGENDA_LIST_CARD_COLORS.titleDark : AGENDA_LIST_CARD_COLORS.title,
                    }}
                  >
                    {timePart}
                  </span>
                  {periodPart && (
                    <span
                      className="font-normal flex-shrink-0"
                      style={{
                        fontSize: AGENDA_LIST_CARD.periodFontSizePx,
                        color: isDark ? AGENDA_LIST_CARD_COLORS.periodDark : AGENDA_LIST_CARD_COLORS.period,
                      }}
                    >
                      {periodPart}
                    </span>
                  )}
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {headerAction}
              {showCommentIcon && (
                <Icon
                  name="note"
                  size={AGENDA_LIST_CARD.headerCommentIconSizePx}
                  className={isDark ? 'text-gray-500' : 'text-gray-300'}
                  weight="regular"
                />
              )}
            </div>
          </div>

          {/* Title + subtitle */}
          <div
            className="flex flex-col min-w-0"
            style={{
              marginTop: AGENDA_LIST_CARD.headerBodyGapPx,
              gap: compact ? 2 : 4,
            }}
          >
            <h3
              className={cn(
                'font-bold leading-snug line-clamp-2 break-words',
                titleDone && 'line-through opacity-60',
              )}
              style={{
                fontSize: titleSize,
                color: isDark ? AGENDA_LIST_CARD_COLORS.titleDark : AGENDA_LIST_CARD_COLORS.title,
              }}
              title={title}
            >
              {title}
            </h3>
            {!compact && subtitle && (
              <p
                className="line-clamp-2 break-words"
                style={{
                  fontSize: AGENDA_LIST_CARD.subtitleFontSizePx,
                  color: isDark ? AGENDA_LIST_CARD_COLORS.subtitleDark : AGENDA_LIST_CARD_COLORS.subtitle,
                }}
                title={subtitle}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Footer: source · duration + badge (hidden in compact mode) */}
          {!compact && (
          <div
            className="flex items-center justify-between gap-2 mt-auto min-w-0"
            style={{ marginTop: AGENDA_LIST_CARD.bodyFooterGapPx }}
          >
            <div
              className="flex items-center min-w-0 flex-1"
              style={{ gap: 6, fontSize: footerSize, color: isDark ? AGENDA_LIST_CARD_COLORS.footerDark : AGENDA_LIST_CARD_COLORS.footer }}
            >
              <Icon name={footerIcon} size={AGENDA_LIST_CARD.footerIconSizePx} weight="regular" className="flex-shrink-0" />
              <span className="truncate flex-shrink-0">{footerSourceLabel}</span>
              {durationLabel && (
                <>
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: AGENDA_LIST_CARD.footerDotSizePx,
                      height: AGENDA_LIST_CARD.footerDotSizePx,
                      backgroundColor: isDark ? AGENDA_LIST_CARD_COLORS.footerDark : AGENDA_LIST_CARD_COLORS.footer,
                    }}
                    aria-hidden
                  />
                  <Icon name="clock" size={AGENDA_LIST_CARD.footerIconSizePx} weight="regular" className="flex-shrink-0" />
                  <span className="flex-shrink-0 whitespace-nowrap">{durationLabel}</span>
                </>
              )}
            </div>
            <span
              className="rounded-full font-semibold capitalize flex-shrink-0 whitespace-nowrap"
              style={{
                fontSize: AGENDA_LIST_CARD.badgeFontSizePx,
                paddingLeft: AGENDA_LIST_CARD.badgePaddingXPx,
                paddingRight: AGENDA_LIST_CARD.badgePaddingXPx,
                paddingTop: AGENDA_LIST_CARD.badgePaddingYPx,
                paddingBottom: AGENDA_LIST_CARD.badgePaddingYPx,
                backgroundColor: badgeStyles.badgeBackground,
                color: badgeStyles.badgeText,
              }}
            >
              {badgeLabel}
            </span>
          </div>
          )}
          {compact && durationLabel && (
            <span
              className="font-medium flex-shrink-0 whitespace-nowrap mt-auto"
              style={{
                fontSize: footerSize,
                color: isDark ? AGENDA_LIST_CARD_COLORS.footerDark : AGENDA_LIST_CARD_COLORS.footer,
              }}
            >
              {durationLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

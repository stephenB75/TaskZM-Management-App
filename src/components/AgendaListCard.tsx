import React from 'react';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
import { useTheme } from '../contexts/ThemeContext';
import {
  AGENDA_LIST_CARD,
  AGENDA_LIST_CARD_COLORS,
  getAgendaCardBadgeStyles,
} from '../lib/agenda-list-card-constants';
import { TODAY_AGENDA_TEXT } from '../lib/today-agenda-constants';
import { TODAY_AGENDA_TIMELINE } from '../lib/layout-constants';

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
}

export function AgendaListCard({
  accentColor,
  accentIcon,
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
  hideFooter = false,
  fitTimelineSlot = false,
  hideTime = false,
  micro = false,
  hideAccentColumn = false,
  leftAccentColor,
  leftAccentWidthPx,
  showNextUpBadge = false,
  embedded = false,
  surface = 'default',
  titleDone = false,
  className,
  style,
  headerAction,
}: AgendaListCardProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const badgeStyles = getAgendaCardBadgeStyles(accentColor);

  const padding = micro
    ? AGENDA_LIST_CARD.micro.paddingPx
    : compact
      ? AGENDA_LIST_CARD.compact.paddingPx
      : AGENDA_LIST_CARD.paddingPx;
  const dotSize = micro
    ? AGENDA_LIST_CARD.micro.dotSizePx
    : compact
      ? AGENDA_LIST_CARD.compact.dotSizePx
      : AGENDA_LIST_CARD.dotSizePx;
  const accentIconSize = micro ? 18 : compact ? 22 : AGENDA_LIST_CARD.accentIconSizePx;
  const accentColumnWidth = accentIcon
    ? AGENDA_LIST_CARD.accentIconColumnWidthPx
    : AGENDA_LIST_CARD.accentColumnWidthPx;
  const titleSize = micro
    ? AGENDA_LIST_CARD.micro.titleFontSizePx
    : compact
      ? AGENDA_LIST_CARD.compact.titleFontSizePx
      : AGENDA_LIST_CARD.titleFontSizePx;
  const timeSize = compact ? AGENDA_LIST_CARD.compact.timeFontSizePx : AGENDA_LIST_CARD.timeFontSizePx;
  const footerSize = compact ? AGENDA_LIST_CARD.compact.footerFontSizePx : AGENDA_LIST_CARD.footerFontSizePx;
  const headerBodyGap = micro
    ? AGENDA_LIST_CARD.micro.headerBodyGapPx
    : compact
      ? AGENDA_LIST_CARD.compact.headerBodyGapPx
      : AGENDA_LIST_CARD.headerBodyGapPx;
  const bodyFooterGap = compact ? AGENDA_LIST_CARD.compact.bodyFooterGapPx : AGENDA_LIST_CARD.bodyFooterGapPx;
  const accentLineMinHeight = micro
    ? AGENDA_LIST_CARD.micro.accentLineMinHeightPx
    : compact
      ? AGENDA_LIST_CARD.compact.accentLineMinHeightPx
      : AGENDA_LIST_CARD.accentLineMinHeightPx;

  const hasTime = !hideTime && Boolean(allDayLabel || timePart);
  const showFooter = !micro && !hideFooter;
  const isTimelineSurface = surface === 'timeline' && !embedded;
  const isEmbeddedTimeline = surface === 'timeline' && embedded && fitTimelineSlot;
  const showFullEmbeddedTimelineContent = isEmbeddedTimeline && !micro;
  const allowFullContent = isTimelineSurface || showFullEmbeddedTimelineContent;
  /** When the rail shows time, put complete/action controls on the title row — not a separate header line. */
  const inlineActionsWithTitle = !hasTime && Boolean(headerAction || showCommentIcon);
  const cardBackground = embedded
    ? 'transparent'
    : isDark
      ? AGENDA_LIST_CARD_COLORS.cardBackgroundDark
      : AGENDA_LIST_CARD_COLORS.cardBackground;
  const cardShadow = embedded || isTimelineSurface ? 'none' : AGENDA_LIST_CARD.shadow;
  const timelineBorderColor = isDark
    ? AGENDA_LIST_CARD.timelineBorderDark
    : AGENDA_LIST_CARD.timelineBorderLight;
  const timelineBorderStyles =
    isTimelineSurface && leftAccentColor && hideAccentColumn
      ? {
          borderLeft: `${leftAccentWidthPx ?? AGENDA_LIST_CARD.accentLineWidthPx * 2}px solid ${leftAccentColor}`,
        }
      : isTimelineSurface
        ? { border: `1px solid ${timelineBorderColor}` }
        : leftAccentColor && hideAccentColumn
          ? {
              borderLeft: `${leftAccentWidthPx ?? AGENDA_LIST_CARD.accentLineWidthPx * 2}px solid ${leftAccentColor}`,
            }
          : {};

  const cardPaddingStyle: React.CSSProperties =
    isTimelineSurface && hideTime
      ? {
          paddingTop: AGENDA_LIST_CARD.timelineContentPaddingTopPx,
          paddingRight: padding,
          paddingBottom: padding,
          paddingLeft: padding,
        }
      : { padding };

  return (
    <div
      className={cn(
        'flex flex-col w-full min-w-0 box-border',
        isEmbeddedTimeline
          ? showFullEmbeddedTimelineContent
            ? 'overflow-visible'
            : 'flex-1 min-h-0 overflow-x-hidden'
          : allowFullContent
            ? 'overflow-visible'
            : 'h-full overflow-hidden',
        className,
      )}
      style={{
        borderRadius: embedded ? 0 : AGENDA_LIST_CARD.borderRadiusPx,
        boxShadow: cardShadow,
        backgroundColor: cardBackground,
        ...timelineBorderStyles,
        ...cardPaddingStyle,
        ...style,
      }}
    >
      <div className={cn('flex flex-1 min-h-0 w-full', hideAccentColumn ? '' : '')} style={hideAccentColumn ? undefined : { gap: accentColumnWidth - (accentIcon ? accentIconSize : dotSize) }}>
        {/* Colored dot or icon + vertical accent line */}
        {!hideAccentColumn && (
        <div className="flex flex-col items-center flex-shrink-0" style={{ width: accentColumnWidth }}>
          {accentIcon ? (
            <div
              className="flex items-center justify-center flex-shrink-0 rounded-xl"
              style={{
                width: accentIconSize,
                height: accentIconSize,
                backgroundColor: badgeStyles.badgeBackground,
              }}
            >
              <Icon
                name={accentIcon}
                size={compact ? 12 : AGENDA_LIST_CARD.headerCommentIconSizePx}
                weight="duotone"
                style={{ color: badgeStyles.dotColor }}
              />
            </div>
          ) : (
            <span
              className="rounded-full flex-shrink-0"
              style={{
                width: dotSize,
                height: dotSize,
                backgroundColor: badgeStyles.dotColor,
              }}
              aria-hidden
            />
          )}
          <span
            className="flex-1 rounded-full mt-1"
            style={{
              width: AGENDA_LIST_CARD.accentLineWidthPx,
              minHeight: micro ? 0 : accentLineMinHeight,
              backgroundColor: isDark ? AGENDA_LIST_CARD_COLORS.accentLineDark : AGENDA_LIST_CARD_COLORS.accentLine,
            }}
            aria-hidden
          />
        </div>
        )}

        <div className={cn('flex flex-col flex-1 min-w-0', showFullEmbeddedTimelineContent ? '' : 'min-h-0')}>
          {showNextUpBadge && (
            <div
              className="flex-shrink-0"
              style={{ marginBottom: TODAY_AGENDA_TIMELINE.nextUpBadgeGapAboveBlockPx }}
            >
              <span className="text-xs font-bold tracking-wide px-1.5 py-0.5 rounded bg-primary text-primary-foreground inline-block">
                {TODAY_AGENDA_TEXT.nextUp.toUpperCase()}
              </span>
            </div>
          )}
          {/* Header: time (+ action when time is shown) */}
          {hasTime && (
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
              ) : timePart ? (
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
                        fontSize: compact ? AGENDA_LIST_CARD.compact.periodFontSizePx : AGENDA_LIST_CARD.periodFontSizePx,
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
          )}

          {/* Title + subtitle (+ inline complete dot when no time header) */}
          <div
            className={cn(
              'flex min-w-0',
              inlineActionsWithTitle
                ? 'items-start justify-between gap-2'
                : micro
                  ? 'items-center justify-between gap-2'
                  : 'flex-col',
            )}
            style={{
              marginTop: hasTime ? headerBodyGap : 0,
              gap: inlineActionsWithTitle ? 0 : compact ? 2 : 4,
            }}
          >
            <div className={cn('min-w-0', inlineActionsWithTitle ? 'flex-1' : 'w-full')}>
            <h3
              className={cn(
                'font-bold leading-snug break-words min-w-0',
                isEmbeddedTimeline
                  ? micro
                    ? 'line-clamp-2'
                    : undefined
                  : !allowFullContent && (micro || compact ? 'line-clamp-1' : 'line-clamp-2'),
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
            {!micro && subtitle && (
              <p
                className={cn(
                  'break-words',
                  isEmbeddedTimeline
                    ? micro
                      ? 'line-clamp-2'
                      : undefined
                    : allowFullContent
                      ? undefined
                      : 'line-clamp-2',
                )}
                style={{
                  fontSize: AGENDA_LIST_CARD.subtitleFontSizePx,
                  color: isDark ? AGENDA_LIST_CARD_COLORS.subtitleDark : AGENDA_LIST_CARD_COLORS.subtitle,
                  marginTop: compact ? 2 : 4,
                }}
                title={subtitle}
              >
                {subtitle}
              </p>
            )}
            </div>
            {inlineActionsWithTitle && (
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
            )}
            {micro && (
              <span
                className="rounded-full font-semibold capitalize flex-shrink-0 whitespace-nowrap"
                style={{
                  fontSize: AGENDA_LIST_CARD.badgeFontSizePx,
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: AGENDA_LIST_CARD.badgePaddingYPx,
                  paddingBottom: AGENDA_LIST_CARD.badgePaddingYPx,
                  backgroundColor: badgeStyles.badgeBackground,
                  color: badgeStyles.badgeText,
                }}
              >
                {badgeLabel}
              </span>
            )}
          </div>

          {/* Footer: source · duration + badge */}
          {showFooter && (
          <div
            className="flex items-center justify-between gap-2 mt-auto min-w-0 flex-shrink-0"
            style={{ marginTop: bodyFooterGap }}
          >
            <div
              className="flex items-center min-w-0 flex-1"
              style={{ gap: compact ? 4 : 6, fontSize: footerSize, color: isDark ? AGENDA_LIST_CARD_COLORS.footerDark : AGENDA_LIST_CARD_COLORS.footer }}
            >
              <Icon name={footerIcon} size={AGENDA_LIST_CARD.footerIconSizePx} weight="regular" className="flex-shrink-0" />
              <span className="truncate">{footerSourceLabel}</span>
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
                paddingLeft: compact ? 8 : AGENDA_LIST_CARD.badgePaddingXPx,
                paddingRight: compact ? 8 : AGENDA_LIST_CARD.badgePaddingXPx,
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
        </div>
      </div>
    </div>
  );
}

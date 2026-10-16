/**
 * Agenda list card styling — white cards with colored dot, vertical line, time header, and footer badge.
 * Used by Today Agenda task and calendar event cards.
 */

import {
  COLOR_CALENDAR_EVENT_ACCENT,
  COLOR_CALENDAR_EVENT_SURFACE,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_WHITE,
} from './color-theme';

/** Relative luminance above which a solid badge switches to dark text. */
const BADGE_LIGHT_BACKGROUND_LUMINANCE = 0.6;

function isLightHex(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > BADGE_LIGHT_BACKGROUND_LUMINANCE;
}

export const AGENDA_LIST_CARD = {
  borderRadiusPx: 16,
  paddingPx: 14,
  shadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
  /** Lighter single-layer shadow for Today Agenda timeline cards (avoids stacked-card look). */
  timelineShadow: '0 1px 2px rgba(0,0,0,0.05)',
  timelineBorderLight: 'rgba(0,0,0,0.07)',
  timelineBorderDark: 'rgba(255,255,255,0.08)',
  dotSizePx: 8,
  accentLineWidthPx: 2,
  accentLineMinHeightPx: 48,
  accentColumnWidthPx: 12,
  accentIconSizePx: 28,
  accentIconColumnWidthPx: 32,
  headerCommentIconSizePx: 16,
  timeFontSizePx: 15,
  periodFontSizePx: 12,
  titleFontSizePx: 16,
  subtitleFontSizePx: 13,
  footerFontSizePx: 11,
  footerIconSizePx: 12,
  badgeFontSizePx: 11,
  badgePaddingXPx: 10,
  badgePaddingYPx: 3,
  headerBodyGapPx: 4,
  bodyFooterGapPx: 10,
  footerDotSizePx: 3,
  /** Top padding (px) for timeline cards when the rail shows time (tighter under NEXT UP badge). */
  timelineContentPaddingTopPx: 10,
  compact: {
    paddingPx: 10,
    titleFontSizePx: 13,
    timeFontSizePx: 12,
    periodFontSizePx: 11,
    footerFontSizePx: 10,
    dotSizePx: 6,
    accentLineMinHeightPx: 10,
    bodyFooterGapPx: 6,
    headerBodyGapPx: 3,
  },
  micro: {
    paddingPx: 8,
    titleFontSizePx: 12,
    dotSizePx: 6,
    accentLineMinHeightPx: 0,
    headerBodyGapPx: 0,
  },
} as const;

export const AGENDA_LIST_CARD_COLORS = {
  cardBackground: '#FFFFFF',
  cardBackgroundDark: '#201D2B',
  title: '#111827',
  titleDark: '#F9FAFB',
  subtitle: '#6B7280',
  subtitleDark: '#D1D5DB',
  period: '#9CA3AF',
  periodDark: '#9CA3AF',
  footer: '#9CA3AF',
  footerDark: '#9CA3AF',
  accentLine: '#E5E7EB',
  accentLineDark: '#4B5563',
  commentIcon: '#D1D5DB',
  commentIconDark: '#6B7280',
} as const;

export const AGENDA_LIST_CARD_UI = {
  taskSourceLabel: 'Task',
  taskBadgeLabel: 'Task',
  inboxSourceLabel: 'Inbox',
} as const;

export function getAgendaCardBadgeStyles(accentColor: string) {
  if (accentColor === COLOR_CALENDAR_EVENT_ACCENT) {
    return {
      dotColor: accentColor,
      badgeBackground: COLOR_CALENDAR_EVENT_SURFACE,
      badgeText: 'var(--foreground)',
    };
  }
  return {
    dotColor: accentColor,
    badgeBackground: accentColor,
    badgeText: isLightHex(accentColor) ? COLOR_TEXT_PRIMARY : COLOR_TEXT_WHITE,
  };
}

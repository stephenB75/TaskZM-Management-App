/**
 * Agenda list card styling — white cards with colored dot, vertical line, time header, and footer badge.
 * Used by Today Agenda task and calendar event cards.
 */

import { getColorWithOpacity } from './color-theme';

export const AGENDA_LIST_CARD = {
  borderRadiusPx: 16,
  paddingPx: 14,
  shadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
  dotSizePx: 8,
  accentLineWidthPx: 2,
  accentLineMinHeightPx: 48,
  accentColumnWidthPx: 12,
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
  compact: {
    paddingPx: 8,
    titleFontSizePx: 13,
    timeFontSizePx: 12,
    footerFontSizePx: 10,
    dotSizePx: 6,
  },
} as const;

export const AGENDA_LIST_CARD_COLORS = {
  cardBackground: '#FFFFFF',
  cardBackgroundDark: '#3E3E52',
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
} as const;

export function getAgendaCardBadgeStyles(accentColor: string) {
  return {
    dotColor: accentColor,
    badgeBackground: getColorWithOpacity(accentColor, 0.14),
    badgeText: accentColor,
  };
}

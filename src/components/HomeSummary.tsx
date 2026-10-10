import React from 'react';
import { MOBILE_HOME_UI_TEXT } from '../lib/navigation-constants';
import { TIME_PERIODS } from '../lib/business-constants';
import {
  MOBILE_HOME_BODY_FONT_SIZE,
  MOBILE_HOME_CARD_PADDING,
  MOBILE_HOME_PILL_RADIUS,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_LABEL_GAP,
  MOBILE_HOME_SECTION_GAP,
  MOBILE_HOME_SUMMARY_COMPACT_NUMBER_SIZE,
  MOBILE_HOME_SUMMARY_COMPACT_PADDING,
  MOBILE_HOME_SUMMARY_NUMBER_SIZE,
  MOBILE_HOME_PAGE_PADDING,
  MOBILE_HOME_TAB_FONT_SIZE,
  MOBILE_HOME_TAP_TARGET_PX,
} from '../lib/layout-constants';
import { THEME_COLOR } from '../lib/color-theme';

export function greetingLine(now: Date): string {
  const hour = now.getHours();
  if (hour >= TIME_PERIODS.MORNING_START && hour < TIME_PERIODS.MORNING_END) {
    return MOBILE_HOME_UI_TEXT.greetingMorning;
  }
  if (hour >= TIME_PERIODS.AFTERNOON_START && hour < TIME_PERIODS.AFTERNOON_END) {
    return MOBILE_HOME_UI_TEXT.greetingAfternoon;
  }
  return MOBILE_HOME_UI_TEXT.greetingEvening;
}

interface SummaryCardProps {
  label: string;
  value: number;
  accent?: boolean;
  compact?: boolean;
}

export function SummaryCard({ label, value, accent, compact }: SummaryCardProps) {
  return (
    <article
      style={{
        background: accent ? THEME_COLOR.highlight : THEME_COLOR.surface,
        color: accent ? THEME_COLOR.highlightText : THEME_COLOR.text,
        borderRadius: MOBILE_HOME_CARD_RADIUS,
        padding: compact ? MOBILE_HOME_SUMMARY_COMPACT_PADDING : MOBILE_HOME_CARD_PADDING,
        display: 'flex',
        flexDirection: 'column',
        gap: MOBILE_HOME_LABEL_GAP,
      }}
    >
      <p style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, margin: 0 }}>{label}</p>
      <p
        style={{
          fontSize: compact ? MOBILE_HOME_SUMMARY_COMPACT_NUMBER_SIZE : MOBILE_HOME_SUMMARY_NUMBER_SIZE,
          lineHeight: 1,
          margin: 0,
          fontWeight: 500,
        }}
      >
        {value}
      </p>
    </article>
  );
}

export function PlaceTasksButton({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-tour="place-tasks"
      disabled={disabled || busy}
      onClick={onClick}
      className="bg-primary font-semibold text-primary-foreground disabled:opacity-60"
      style={{
        minHeight: MOBILE_HOME_TAP_TARGET_PX,
        borderRadius: MOBILE_HOME_PILL_RADIUS,
        fontSize: MOBILE_HOME_BODY_FONT_SIZE,
        border: 'none',
        paddingLeft: `calc(${MOBILE_HOME_PAGE_PADDING} + ${MOBILE_HOME_SECTION_GAP})`,
        paddingRight: `calc(${MOBILE_HOME_PAGE_PADDING} + ${MOBILE_HOME_SECTION_GAP})`,
      }}
    >
      {busy ? MOBILE_HOME_UI_TEXT.scheduling : MOBILE_HOME_UI_TEXT.scheduleAction}
    </button>
  );
}

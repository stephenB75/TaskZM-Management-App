import type { CSSProperties } from 'react';
import { COLOR_CALENDAR_EVENT_ACCENT } from './color-theme';

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Provider calendar colors arrive as #RGB, #RRGGBB, or Apple's #RRGGBBAA. Returns #RRGGBB, or
 * undefined when the value isn't a usable hex color.
 */
export function normalizeCalendarColor(calendarColor?: string | null): string | undefined {
  const match = calendarColor?.trim().match(HEX_PATTERN);
  if (!match) return undefined;
  const hex = match[1];
  if (hex.length === 3) return `#${hex.split('').map((c) => c + c).join('')}`.toUpperCase();
  return `#${hex.slice(0, 6)}`.toUpperCase();
}

/** Accent for an imported event: the color the user gave it in their calendar, else the app's event blue. */
export function getCalendarEventAccent(calendarColor?: string | null): string {
  return normalizeCalendarColor(calendarColor) ?? COLOR_CALENDAR_EVENT_ACCENT;
}

/** Inline style feeding `--event-color` to CSS-styled event blocks/chips (see globals.css). */
export function calendarEventColorStyle(calendarColor?: string | null): CSSProperties {
  const hex = normalizeCalendarColor(calendarColor);
  return hex ? ({ '--event-color': hex } as CSSProperties) : {};
}

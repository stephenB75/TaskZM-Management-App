import React, { useId } from 'react';
import type { IconWeight } from '../Icon';

/** Phosphor's 256-unit grid and per-weight stroke widths, so this sits naturally beside Phosphor icons. */
const VIEWBOX = 256;
const STROKE_BY_WEIGHT: Record<IconWeight, number> = {
  thin: 8,
  light: 12,
  regular: 16,
  bold: 24,
  fill: 16,
  duotone: 16,
};

interface CalendarWeekIconProps {
  size: number;
  color?: string;
  weight?: IconWeight;
  className?: string;
  style?: React.CSSProperties;
}

/** Calendar with a single highlighted week row (distinct from the month "calendar" glyph). */
export function CalendarWeekIcon({
  size,
  color = 'currentColor',
  weight = 'regular',
  className,
  style,
}: CalendarWeekIconProps) {
  const maskId = useId();
  const stroke = STROKE_BY_WEIGHT[weight];
  const svgProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: `0 0 ${VIEWBOX} ${VIEWBOX}`,
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
    'aria-hidden': true,
  };

  if (weight === 'fill') {
    return (
      <svg {...svgProps}>
        <mask id={maskId}>
          <rect width={VIEWBOX} height={VIEWBOX} fill="white" stroke="none" />
          <line x1="40" y1="88" x2="216" y2="88" stroke="black" />
          <rect x="68" y="124" width="120" height="44" rx="6" fill="black" stroke="none" />
        </mask>
        <rect x="40" y="40" width="176" height="176" rx="8" fill={color} mask={`url(#${maskId})`} />
        <line x1="176" y1="24" x2="176" y2="56" />
        <line x1="80" y1="24" x2="80" y2="56" />
      </svg>
    );
  }

  return (
    <svg {...svgProps}>
      {weight === 'duotone' ? (
        <rect x="40" y="88" width="176" height="128" fill={color} opacity={0.2} stroke="none" />
      ) : null}
      <rect x="40" y="40" width="176" height="176" rx="8" />
      <line x1="176" y1="24" x2="176" y2="56" />
      <line x1="80" y1="24" x2="80" y2="56" />
      <line x1="40" y1="88" x2="216" y2="88" />
      <rect x="68" y="124" width="120" height="44" rx="6" fill={color} stroke="none" />
    </svg>
  );
}

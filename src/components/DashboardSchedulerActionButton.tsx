import React from 'react';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
import {
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_SKY_DARK,
  COLOR_PRIMARY,
  COLOR_PRIMARY_DARK,
  COLOR_PRIMARY_LIGHT,
  getColorWithOpacity,
} from '../lib/color-theme';
import {
  DASHBOARD_SCHEDULER_ACTION_BUTTON,
  HEADER_BUTTON_SCALE_DESKTOP,
  HEADER_BUTTON_SCALE_SMALL,
} from '../lib/layout-constants';

export type DashboardSchedulerActionAccent = 'ai' | 'reschedule';

const ACCENT_STYLES: Record<
  DashboardSchedulerActionAccent,
  {
    gradientFrom: string;
    gradientTo: string;
    iconBackground: string;
    iconColor: string;
    borderColor: string;
    hoverShadow: string;
  }
> = {
  ai: {
    gradientFrom: COLOR_PASTEL_LAVENDER,
    gradientTo: COLOR_PRIMARY_LIGHT,
    iconBackground: getColorWithOpacity(COLOR_PRIMARY, 0.16),
    iconColor: COLOR_PRIMARY_DARK,
    borderColor: getColorWithOpacity(COLOR_PRIMARY, 0.22),
    hoverShadow: '0 4px 14px rgba(155,135,232,0.22), 0 2px 6px rgba(0,0,0,0.08)',
  },
  reschedule: {
    gradientFrom: COLOR_PASTEL_SKY,
    gradientTo: COLOR_PASTEL_MINT,
    iconBackground: getColorWithOpacity(COLOR_PASTEL_SKY_DARK, 0.14),
    iconColor: COLOR_PASTEL_SKY_DARK,
    borderColor: getColorWithOpacity(COLOR_PASTEL_SKY_DARK, 0.28),
    hoverShadow: '0 4px 14px rgba(106,138,170,0.2), 0 2px 6px rgba(0,0,0,0.08)',
  },
};

export interface DashboardSchedulerActionButtonProps {
  label: string;
  icon: string;
  accent: DashboardSchedulerActionAccent;
  onClick: () => void;
  disabled?: boolean;
  iconSpinning?: boolean;
  isSmallScreen?: boolean;
  scale?: number;
  className?: string;
  'data-tour'?: string;
}

export function DashboardSchedulerActionButton({
  label,
  icon,
  accent,
  onClick,
  disabled = false,
  iconSpinning = false,
  isSmallScreen = false,
  scale,
  className,
  'data-tour': dataTour,
}: DashboardSchedulerActionButtonProps) {
  const styles = ACCENT_STYLES[accent];
  const buttonScale = scale ?? (isSmallScreen ? HEADER_BUTTON_SCALE_SMALL : HEADER_BUTTON_SCALE_DESKTOP);
  const iconBadgeSize = isSmallScreen
    ? DASHBOARD_SCHEDULER_ACTION_BUTTON.iconBadgeSizeSmallPx
    : DASHBOARD_SCHEDULER_ACTION_BUTTON.iconBadgeSizeDesktopPx;
  const iconSize = isSmallScreen
    ? DASHBOARD_SCHEDULER_ACTION_BUTTON.iconInnerSizeSmallPx
    : DASHBOARD_SCHEDULER_ACTION_BUTTON.iconInnerSizeDesktopPx;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
      className={cn(
        'group inline-flex items-center flex-shrink-0 cursor-pointer',
        'border transition-all duration-200',
        'hover:scale-[1.02] active:scale-[0.98]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none disabled:scale-100',
        className,
      )}
      style={{
        transform: `scale(${buttonScale})`,
        transformOrigin: 'center right',
        gap: DASHBOARD_SCHEDULER_ACTION_BUTTON.gapPx,
        paddingLeft: isSmallScreen
          ? DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingXSmallPx
          : DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingXDesktopPx,
        paddingRight: isSmallScreen
          ? DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingXSmallPx
          : DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingXDesktopPx,
        paddingTop: isSmallScreen
          ? DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingYSmallPx
          : DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingYDesktopPx,
        paddingBottom: isSmallScreen
          ? DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingYSmallPx
          : DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingYDesktopPx,
        borderRadius: DASHBOARD_SCHEDULER_ACTION_BUTTON.borderRadiusPx,
        background: `linear-gradient(135deg, ${styles.gradientFrom} 0%, ${styles.gradientTo} 100%)`,
        borderColor: styles.borderColor,
        boxShadow: DASHBOARD_SCHEDULER_ACTION_BUTTON.shadow,
        fontSize: isSmallScreen
          ? DASHBOARD_SCHEDULER_ACTION_BUTTON.fontSizeSmallPx
          : DASHBOARD_SCHEDULER_ACTION_BUTTON.fontSizeDesktopPx,
        fontWeight: DASHBOARD_SCHEDULER_ACTION_BUTTON.fontWeight,
        letterSpacing: `${DASHBOARD_SCHEDULER_ACTION_BUTTON.letterSpacingEm}em`,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = styles.hoverShadow;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = DASHBOARD_SCHEDULER_ACTION_BUTTON.shadow;
      }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0 rounded-xl transition-transform group-hover:scale-105"
        style={{
          width: iconBadgeSize,
          height: iconBadgeSize,
          backgroundColor: styles.iconBackground,
        }}
        aria-hidden
      >
        <Icon
          name={icon}
          size={iconSize}
          weight="duotone"
          className={cn(iconSpinning && 'animate-spin')}
          style={{ color: styles.iconColor }}
        />
      </span>
      <span className="whitespace-nowrap text-foreground/90 dark:text-foreground">
        {label}
      </span>
    </button>
  );
}

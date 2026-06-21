import React from 'react';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
import {
  COLOR_BORDER_LIGHT,
  COLOR_PRIMARY,
  COLOR_PRIMARY_DARK,
  COLOR_TEXT_SECONDARY,
  COLOR_TEXT_WHITE,
  getColorWithOpacity,
} from '../lib/color-theme';
import {
  DASHBOARD_SCHEDULER_ACTION_BUTTON,
  HEADER_BUTTON_SCALE_DESKTOP,
  HEADER_BUTTON_SCALE_SMALL,
} from '../lib/layout-constants';

export type DashboardSchedulerActionVariant = 'primary' | 'secondary';

export interface DashboardSchedulerActionButtonProps {
  label: string;
  icon: string;
  variant?: DashboardSchedulerActionVariant;
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
  variant = 'secondary',
  onClick,
  disabled = false,
  iconSpinning = false,
  isSmallScreen = false,
  scale,
  className,
  'data-tour': dataTour,
}: DashboardSchedulerActionButtonProps) {
  const buttonScale = scale ?? (isSmallScreen ? HEADER_BUTTON_SCALE_SMALL : HEADER_BUTTON_SCALE_DESKTOP);
  const iconSize = isSmallScreen
    ? DASHBOARD_SCHEDULER_ACTION_BUTTON.iconSizeSmallPx
    : DASHBOARD_SCHEDULER_ACTION_BUTTON.iconSizeDesktopPx;
  const height = isSmallScreen
    ? DASHBOARD_SCHEDULER_ACTION_BUTTON.heightSmallPx
    : DASHBOARD_SCHEDULER_ACTION_BUTTON.heightDesktopPx;
  const isPrimary = variant === 'primary';
  const primaryShadow = `0 4px 14px ${getColorWithOpacity(COLOR_PRIMARY_DARK, 0.38)}`;
  const primaryShadowHover = `0 6px 18px ${getColorWithOpacity(COLOR_PRIMARY_DARK, 0.48)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
      className={cn(
        'inline-flex items-center justify-center flex-shrink-0 cursor-pointer whitespace-nowrap uppercase',
        'border transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        !isPrimary && 'bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-muted/40',
        className,
      )}
      style={{
        transform: `scale(${buttonScale})`,
        transformOrigin: 'center right',
        gap: DASHBOARD_SCHEDULER_ACTION_BUTTON.gapPx,
        height,
        paddingLeft: isSmallScreen
          ? DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingXSmallPx
          : DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingXDesktopPx,
        paddingRight: isSmallScreen
          ? DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingXSmallPx
          : DASHBOARD_SCHEDULER_ACTION_BUTTON.paddingXDesktopPx,
        borderRadius: DASHBOARD_SCHEDULER_ACTION_BUTTON.borderRadiusPx,
        fontSize: isSmallScreen
          ? DASHBOARD_SCHEDULER_ACTION_BUTTON.fontSizeSmallPx
          : DASHBOARD_SCHEDULER_ACTION_BUTTON.fontSizeDesktopPx,
        fontWeight: DASHBOARD_SCHEDULER_ACTION_BUTTON.fontWeight,
        letterSpacing: `${DASHBOARD_SCHEDULER_ACTION_BUTTON.letterSpacingEm}em`,
        ...(isPrimary
          ? {
              backgroundColor: COLOR_PRIMARY,
              borderColor: 'transparent',
              color: COLOR_TEXT_WHITE,
              boxShadow: primaryShadow,
            }
          : {
              backgroundColor: undefined,
              borderColor: COLOR_BORDER_LIGHT,
              color: COLOR_TEXT_SECONDARY,
              boxShadow: 'none',
            }),
      }}
      onMouseEnter={(e) => {
        if (disabled || !isPrimary) return;
        e.currentTarget.style.backgroundColor = COLOR_PRIMARY_DARK;
        e.currentTarget.style.boxShadow = primaryShadowHover;
      }}
      onMouseLeave={(e) => {
        if (!isPrimary) return;
        e.currentTarget.style.backgroundColor = COLOR_PRIMARY;
        e.currentTarget.style.boxShadow = primaryShadow;
      }}
    >
      <Icon
        name={icon}
        size={iconSize}
        weight="regular"
        className={cn('flex-shrink-0', iconSpinning && 'animate-spin')}
        style={{ color: isPrimary ? COLOR_TEXT_WHITE : COLOR_TEXT_SECONDARY }}
      />
      <span>{label}</span>
    </button>
  );
}

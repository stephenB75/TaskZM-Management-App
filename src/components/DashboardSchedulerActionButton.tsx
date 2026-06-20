import React from 'react';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
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

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
      className={cn(
        'inline-flex items-center flex-shrink-0 cursor-pointer whitespace-nowrap',
        'rounded-full border transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        isPrimary
          ? cn(
              'border-transparent text-white shadow-md',
              'bg-gradient-to-r from-primary to-primary/85',
              'hover:from-primary/95 hover:to-primary/75 hover:shadow-lg',
              'active:brightness-95',
            )
          : cn(
              'border-border/55 bg-card/90 text-foreground/90',
              'hover:border-primary/30 hover:bg-muted/50 hover:text-foreground',
              'active:bg-muted/60',
              'dark:bg-card/70 dark:hover:bg-muted/30',
            ),
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
        fontSize: isSmallScreen
          ? DASHBOARD_SCHEDULER_ACTION_BUTTON.fontSizeSmallPx
          : DASHBOARD_SCHEDULER_ACTION_BUTTON.fontSizeDesktopPx,
        fontWeight: DASHBOARD_SCHEDULER_ACTION_BUTTON.fontWeight,
      }}
    >
      <Icon
        name={icon}
        size={iconSize}
        weight={isPrimary ? 'duotone' : 'regular'}
        className={cn(
          'flex-shrink-0',
          iconSpinning && 'animate-spin',
          isPrimary ? 'text-white' : 'text-primary',
        )}
      />
      <span>{label}</span>
    </button>
  );
}

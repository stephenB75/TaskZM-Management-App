import React from 'react';
import { Icon } from '../Icon';
import { cn } from '../../lib/utils';
import {
  SETTINGS_PANEL_GAP_MEDIUM,
  SETTINGS_PANEL_ICON_SIZE_MEDIUM,
  SETTINGS_PANEL_TEXT_SIZE_SMALL,
} from '../../lib/layout-constants';

interface SettingsFeatureRowProps {
  enabled: boolean;
  label: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/** Subscription / feature checklist row with check or x icon. */
export function SettingsFeatureRow({ enabled, label, badge, className }: SettingsFeatureRowProps) {
  return (
    <div
      className={cn('flex min-w-0 items-center', className)}
      style={{ gap: SETTINGS_PANEL_GAP_MEDIUM }}
    >
      <Icon
        name={enabled ? 'check' : 'x'}
        size={SETTINGS_PANEL_ICON_SIZE_MEDIUM}
        className={cn(
          'flex-shrink-0',
          enabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground/50',
        )}
      />
      <span
        className={cn('min-w-0 flex-1 break-words', !enabled && 'text-muted-foreground/70')}
        style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}
      >
        {label}
      </span>
      {badge}
    </div>
  );
}

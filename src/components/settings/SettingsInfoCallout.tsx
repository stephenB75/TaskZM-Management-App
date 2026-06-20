import React from 'react';
import { Icon } from '../Icon';
import { cn } from '../../lib/utils';
import { COLOR_PRIMARY } from '../../lib/color-theme';
import { ICON_SIZE_MD } from '../../lib/layout-constants';
import { SETTINGS_PANEL_GAP_SMALL, SETTINGS_PANEL_PADDING_MEDIUM, SETTINGS_PANEL_TEXT_SIZE_SMALL } from '../../lib/layout-constants';

interface SettingsInfoCalloutProps {
  children: React.ReactNode;
  className?: string;
}

/** Subtle info tip box with icon. */
export function SettingsInfoCallout({ children, className }: SettingsInfoCalloutProps) {
  return (
    <div
      className={cn('rounded-xl border border-primary/15 bg-primary/5', className)}
      style={{ padding: SETTINGS_PANEL_PADDING_MEDIUM }}
    >
      <div className="flex items-start" style={{ gap: SETTINGS_PANEL_GAP_SMALL }}>
        <Icon name="info" size={ICON_SIZE_MD} color={COLOR_PRIMARY} className="mt-0.5 flex-shrink-0" />
        <div
          className="text-muted-foreground"
          style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL, lineHeight: 1.5 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

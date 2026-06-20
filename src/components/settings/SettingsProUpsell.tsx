import React from 'react';
import { cn } from '../../lib/utils';
import { UI_SETTINGS_BADGE_COLORS } from '../../lib/ui-colors';
import { SETTINGS_PANEL_PADDING_LARGE, SETTINGS_PANEL_SPACING_SMALL } from '../../lib/layout-constants';

interface SettingsProUpsellProps {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Pro feature upgrade callout box. */
export function SettingsProUpsell({ children, action, className }: SettingsProUpsellProps) {
  return (
    <div
      className={cn(
        'rounded-xl border',
        UI_SETTINGS_BADGE_COLORS.infoBox.background.className,
        UI_SETTINGS_BADGE_COLORS.infoBox.border.className,
        className,
      )}
      style={{ padding: SETTINGS_PANEL_PADDING_LARGE }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_SMALL }}>
        {children}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

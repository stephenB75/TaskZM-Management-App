import React from 'react';
import { SETTINGS_PANEL_SPACING_MEDIUM } from '../../lib/layout-constants';

interface SettingsActionStackProps {
  children: React.ReactNode;
}

/** Full-width stacked action buttons. */
export function SettingsActionStack({ children }: SettingsActionStackProps) {
  return (
    <div
      className="flex w-full flex-col items-stretch"
      style={{ gap: SETTINGS_PANEL_SPACING_MEDIUM }}
    >
      {children}
    </div>
  );
}

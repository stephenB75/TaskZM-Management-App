import React from 'react';
import { SETTINGS_PANEL_SPACING_MEDIUM } from '../../lib/layout-constants';

interface SettingsGroupProps {
  children: React.ReactNode;
  className?: string;
}

/** Vertical stack wrapper for content inside a settings section. */
export function SettingsGroup({ children, className }: SettingsGroupProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SETTINGS_PANEL_SPACING_MEDIUM,
      }}
    >
      {children}
    </div>
  );
}

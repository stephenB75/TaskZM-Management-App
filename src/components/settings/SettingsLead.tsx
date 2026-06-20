import React from 'react';
import { cn } from '../../lib/utils';
import { SETTINGS_PANEL_TEXT_SIZE_MEDIUM } from '../../lib/layout-constants';

interface SettingsLeadProps {
  children: React.ReactNode;
  className?: string;
}

/** Introductory paragraph at the top of a settings section. */
export function SettingsLead({ children, className }: SettingsLeadProps) {
  return (
    <p
      className={cn('text-muted-foreground leading-relaxed', className)}
      style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}
    >
      {children}
    </p>
  );
}

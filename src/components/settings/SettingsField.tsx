import React from 'react';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import {
  SETTINGS_PANEL_SPACING_XSMALL,
  SETTINGS_PANEL_TEXT_SIZE_MEDIUM,
  SETTINGS_PANEL_TEXT_SIZE_SMALL,
} from '../../lib/layout-constants';

interface SettingsFieldProps {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

/** Label + helper text + control (input, select, etc.). */
export function SettingsField({ id, label, hint, children, className }: SettingsFieldProps) {
  return (
    <div
      className={cn('flex flex-col', className)}
      style={{ gap: SETTINGS_PANEL_SPACING_XSMALL }}
    >
      <Label htmlFor={id} className="font-medium text-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}>
        {label}
      </Label>
      {hint ? (
        <p className="text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL, lineHeight: 1.4 }}>
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

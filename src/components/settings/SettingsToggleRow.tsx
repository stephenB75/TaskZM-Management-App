import React from 'react';
import { Label } from '../ui/label';
import { CheckboxSwitch as Switch } from '../ui/checkbox-switch';
import {
  SETTINGS_PANEL_SPACING_XSMALL,
  SETTINGS_PANEL_TEXT_SIZE_MEDIUM,
  SETTINGS_PANEL_TEXT_SIZE_SMALL,
  SETTINGS_PANEL_TOGGLE_ROW_PADDING_Y,
} from '../../lib/layout-constants';

interface SettingsToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: SettingsToggleRowProps) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg border border-border/30 bg-background/60 px-3"
      style={{ paddingTop: SETTINGS_PANEL_TOGGLE_ROW_PADDING_Y, paddingBottom: SETTINGS_PANEL_TOGGLE_ROW_PADDING_Y }}
    >
      <div className="min-w-0 flex-1" style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_XSMALL }}>
        <Label htmlFor={id} className="cursor-pointer font-medium" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}>
          {label}
        </Label>
        {description ? (
          <p className="text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL, lineHeight: 1.4 }}>
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5 flex-shrink-0"
      />
    </div>
  );
}

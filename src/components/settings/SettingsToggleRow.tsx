import React from 'react';
import { Label } from '../ui/label';
import { CheckboxSwitch as Switch } from '../ui/checkbox-switch';
import { cn } from '../../lib/utils';
import {
  MIN_TOUCH_TARGET_PX,
  SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
  SETTINGS_PANEL_LIST_ROW_PADDING_Y,
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
  variant?: 'standalone' | 'grouped';
  /** Expands row height for reliable mobile touch targets. */
  touchTarget?: boolean;
  className?: string;
}

export function SettingsToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  variant = 'grouped',
  touchTarget = false,
  className,
}: SettingsToggleRowProps) {
  const isGrouped = variant === 'grouped';

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3',
        isGrouped
          ? 'bg-transparent'
          : 'rounded-xl border border-border/40 bg-background/80 px-3 shadow-sm',
        className,
      )}
      style={{
        paddingTop: isGrouped ? SETTINGS_PANEL_LIST_ROW_PADDING_Y : SETTINGS_PANEL_TOGGLE_ROW_PADDING_Y,
        paddingBottom: isGrouped ? SETTINGS_PANEL_LIST_ROW_PADDING_Y : SETTINGS_PANEL_TOGGLE_ROW_PADDING_Y,
        paddingLeft: isGrouped ? SETTINGS_PANEL_CONTROL_GROUP_PADDING_X : undefined,
        paddingRight: isGrouped ? SETTINGS_PANEL_CONTROL_GROUP_PADDING_X : undefined,
        minHeight: touchTarget ? MIN_TOUCH_TARGET_PX : undefined,
      }}
    >
      <div
        className="min-w-0 flex-1"
        style={{ display: 'flex', flexDirection: 'column', gap: SETTINGS_PANEL_SPACING_XSMALL }}
      >
        <Label
          htmlFor={id}
          className="cursor-pointer font-medium text-foreground"
          style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}
        >
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
        aria-label={label}
      />
    </div>
  );
}

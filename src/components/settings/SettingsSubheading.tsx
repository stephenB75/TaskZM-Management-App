import React from 'react';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { SETTINGS_PANEL_TEXT_SIZE_MEDIUM, SETTINGS_PANEL_TEXT_SIZE_SMALL } from '../../lib/layout-constants';

interface SettingsSubheadingProps {
  title: string;
  description?: string;
  className?: string;
}

/** In-section group label (e.g. "Features", "Daily Work Hour Limit"). */
export function SettingsSubheading({ title, description, className }: SettingsSubheadingProps) {
  return (
    <div className={cn('flex flex-col', className)} style={{ gap: '0.125rem' }}>
      <Label className="font-semibold text-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}>
        {title}
      </Label>
      {description ? (
        <p className="text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL, lineHeight: 1.4 }}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

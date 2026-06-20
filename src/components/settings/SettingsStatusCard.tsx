import React from 'react';
import { cn } from '../../lib/utils';
import { SETTINGS_PANEL_PADDING_MEDIUM } from '../../lib/layout-constants';

interface SettingsStatusCardProps {
  children: React.ReactNode;
  className?: string;
  tone?: 'neutral' | 'primary' | 'warning';
}

/** Highlight card for status, permissions, or summary info. */
export function SettingsStatusCard({
  children,
  className,
  tone = 'neutral',
}: SettingsStatusCardProps) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/20 bg-primary/5'
      : tone === 'warning'
        ? 'border-amber-200/80 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/20'
        : 'border-border/50 bg-muted/30';

  return (
    <div
      className={cn('rounded-xl border', toneClass, className)}
      style={{ padding: SETTINGS_PANEL_PADDING_MEDIUM }}
    >
      {children}
    </div>
  );
}

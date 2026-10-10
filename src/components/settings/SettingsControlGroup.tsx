import React from 'react';
import { cn } from '../../lib/utils';

interface SettingsControlGroupProps {
  children: React.ReactNode;
  className?: string;
}

/** iOS-style grouped list container for toggles, rows, and compact controls. */
export function SettingsControlGroup({ children, className }: SettingsControlGroupProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/40 bg-background/80 shadow-sm divide-y divide-border/30',
        className,
      )}
    >
      {children}
    </div>
  );
}

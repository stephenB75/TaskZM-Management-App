/**
 * Secondary header strip for desktop dashboard week view.
 * Sits below the main AppHeader and shows week context pills (e.g. "WEEK 2 Jun 21 – Jun 27").
 */

import React from 'react';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import {
  DASHBOARD_WEEK_SUBHEADER,
} from '../lib/layout-constants';
import {
  KANBAN_WEEK_GROUP_LABELS,
  formatKanbanWeekGroupDateRange,
} from '../lib/kanban-constants';

export interface DashboardWeekGroupSummary {
  groupIndex: number;
  startDate: Date;
  endDate: Date;
  containsToday: boolean;
}

interface DashboardWeekSubHeaderProps {
  weekGroups: DashboardWeekGroupSummary[];
}

export function DashboardWeekSubHeader({ weekGroups }: DashboardWeekSubHeaderProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  if (weekGroups.length === 0) {
    return null;
  }

  return (
    <div
      className="flex-shrink-0 flex items-center justify-center border-b backdrop-blur-sm"
      style={{
        height: DASHBOARD_WEEK_SUBHEADER.heightPx,
        minHeight: DASHBOARD_WEEK_SUBHEADER.heightPx,
        backgroundColor: isDark
          ? DASHBOARD_WEEK_SUBHEADER.backgroundDark
          : DASHBOARD_WEEK_SUBHEADER.backgroundLight,
        borderColor: isDark
          ? DASHBOARD_WEEK_SUBHEADER.borderColorDark
          : DASHBOARD_WEEK_SUBHEADER.borderColorLight,
        gap: DASHBOARD_WEEK_SUBHEADER.pill.gapPx,
      }}
      aria-label="Visible week ranges"
    >
      {weekGroups.map((group) => {
        const weekLabel =
          KANBAN_WEEK_GROUP_LABELS[group.groupIndex]?.toUpperCase() ??
          `WEEK ${group.groupIndex + 1}`;
        const dateRange = formatKanbanWeekGroupDateRange(group.startDate, group.endDate);

        return (
          <span
            key={`week-subheader-${group.groupIndex}`}
            className={cn(
              'uppercase font-medium border whitespace-nowrap',
              group.containsToday
                ? 'bg-white/90 text-foreground/80 border-border/60 dark:bg-card/80 dark:text-foreground/90 dark:border-border/50'
                : 'bg-white/70 text-muted-foreground border-border/50 dark:bg-card/60 dark:border-border/40',
            )}
            style={{
              fontSize: DASHBOARD_WEEK_SUBHEADER.pill.fontSizePx,
              paddingLeft: DASHBOARD_WEEK_SUBHEADER.pill.paddingX,
              paddingRight: DASHBOARD_WEEK_SUBHEADER.pill.paddingX,
              paddingTop: DASHBOARD_WEEK_SUBHEADER.pill.paddingY,
              paddingBottom: DASHBOARD_WEEK_SUBHEADER.pill.paddingY,
              letterSpacing: `${DASHBOARD_WEEK_SUBHEADER.pill.letterSpacingEm}em`,
              borderRadius: DASHBOARD_WEEK_SUBHEADER.pill.borderRadiusPx,
            }}
          >
            {weekLabel} {dateRange}
          </span>
        );
      })}
    </div>
  );
}

import React from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../contexts/ThemeContext';
import {
  AGENDA_LIST_CARD_COLORS,
  getAgendaCardBadgeStyles,
} from '../../lib/agenda-list-card-constants';
import { TASK_DIALOG_SECTION } from '../../lib/task-dialog-constants';

export interface TaskDialogSectionProps {
  accentColor: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function TaskDialogSection({
  accentColor,
  title,
  children,
  className,
  compact = false,
}: TaskDialogSectionProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const badgeStyles = getAgendaCardBadgeStyles(accentColor);
  const padding = compact ? TASK_DIALOG_SECTION.compactPaddingPx : TASK_DIALOG_SECTION.paddingPx;

  return (
    <div
      className={cn('w-full min-w-0 box-border', className)}
      style={{
        borderRadius: TASK_DIALOG_SECTION.borderRadiusPx,
        padding,
        boxShadow: TASK_DIALOG_SECTION.shadow,
        backgroundColor: isDark
          ? AGENDA_LIST_CARD_COLORS.cardBackgroundDark
          : AGENDA_LIST_CARD_COLORS.cardBackground,
      }}
    >
      <div
        className="flex w-full min-w-0"
        style={{ gap: TASK_DIALOG_SECTION.accentColumnWidthPx - TASK_DIALOG_SECTION.dotSizePx }}
      >
        <div
          className="flex flex-col items-center flex-shrink-0"
          style={{ width: TASK_DIALOG_SECTION.accentColumnWidthPx }}
        >
          <span
            className="rounded-full flex-shrink-0"
            style={{
              width: TASK_DIALOG_SECTION.dotSizePx,
              height: TASK_DIALOG_SECTION.dotSizePx,
              backgroundColor: badgeStyles.dotColor,
            }}
            aria-hidden
          />
          <span
            className="flex-1 rounded-full mt-1"
            style={{
              width: TASK_DIALOG_SECTION.accentLineWidthPx,
              minHeight: TASK_DIALOG_SECTION.accentLineMinHeightPx,
              backgroundColor: isDark
                ? AGENDA_LIST_CARD_COLORS.accentLineDark
                : AGENDA_LIST_CARD_COLORS.accentLine,
            }}
            aria-hidden
          />
        </div>
        <div
          className="flex flex-col flex-1 min-w-0"
          style={{ gap: TASK_DIALOG_SECTION.sectionGapPx }}
        >
          {title && (
            <h4
              className="font-semibold uppercase tracking-wide"
              style={{
                fontSize: TASK_DIALOG_SECTION.sectionTitleSizePx,
                color: isDark ? AGENDA_LIST_CARD_COLORS.subtitleDark : AGENDA_LIST_CARD_COLORS.subtitle,
              }}
            >
              {title}
            </h4>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

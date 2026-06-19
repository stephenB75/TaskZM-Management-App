import React from 'react';
import { AgendaListCard } from '../AgendaListCard';
import { getTimeAndPeriod } from '../../lib/utils';
import {
  getTaskDialogPriorityAccent,
  TASK_DIALOG_UI_TEXT,
} from '../../lib/task-dialog-constants';
import { AGENDA_LIST_CARD_UI } from '../../lib/agenda-list-card-constants';
import { MINUTES_PER_HOUR } from '../../lib/business-constants';
import type { TaskPriority, TaskStatus } from '../../types';

function formatDuration(minutes: number): string {
  if (minutes >= MINUTES_PER_HOUR) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const mins = minutes % MINUTES_PER_HOUR;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export interface TaskDialogPreviewCardProps {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  scheduledDate?: Date;
  scheduledTime?: string;
  tags: string[];
  estimatedMinutes: number;
}

export function TaskDialogPreviewCard({
  title,
  description,
  priority,
  status,
  scheduledDate,
  scheduledTime,
  tags,
  estimatedMinutes,
}: TaskDialogPreviewCardProps) {
  const accentColor = getTaskDialogPriorityAccent(priority);

  let timeSource: string | null = null;
  if (scheduledDate) {
    const date = new Date(scheduledDate);
    if (scheduledTime) {
      const [hours, minutes] = scheduledTime.split(':').map((part) => parseInt(part, 10));
      if (!Number.isNaN(hours)) date.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
    }
    timeSource = date.toISOString();
  }

  const timeAndPeriod = timeSource ? getTimeAndPeriod(timeSource) : null;
  const subtitle = description
    ? description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    : null;
  const displayTitle = title.trim() || TASK_DIALOG_UI_TEXT.taskTitlePlaceholder;
  const badgeLabel = priority && priority !== 'default' ? priority : AGENDA_LIST_CARD_UI.taskBadgeLabel;

  return (
    <AgendaListCard
      accentColor={accentColor}
      badgeLabel={badgeLabel}
      title={displayTitle}
      subtitle={subtitle}
      timePart={timeAndPeriod?.timePart}
      periodPart={timeAndPeriod?.period}
      footerIcon={tags.length ? 'tag' : 'list-checks'}
      footerSourceLabel={tags[0] ?? AGENDA_LIST_CARD_UI.taskSourceLabel}
      durationLabel={estimatedMinutes > 0 ? formatDuration(estimatedMinutes) : null}
      showCommentIcon={Boolean(subtitle)}
      titleDone={status === 'done'}
      compact
    />
  );
}

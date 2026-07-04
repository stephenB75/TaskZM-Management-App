import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Icon } from '../Icon';
import { UserProfileAvatar } from '../UserProfileAvatar';
import { TEAM_PANEL_UI_TEXT } from '../../lib/team-panel-constants';
import { getAbbreviatedDisplayName } from '../../lib/utils';
import type { Task, User } from '../../types';

interface TeamAssignedTaskRowProps {
  task: Task;
  assignees: User[];
  onViewMember?: (member: User) => void;
}

function statusLabel(status: Task['status']): string {
  if (status === 'done') return 'Done';
  if (status === 'in-progress') return 'In progress';
  if (status === 'on-hold') return 'On hold';
  return 'To do';
}

export function TeamAssignedTaskRow({ task, assignees, onViewMember }: TeamAssignedTaskRowProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/90 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize">
              {statusLabel(task.status)}
            </Badge>
            {task.priority ? (
              <Badge variant="secondary" className="text-[10px] capitalize">
                {task.priority}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {assignees.map((assignee) => (
          <Button
            key={assignee.id}
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto gap-2 px-2 py-1"
            onClick={() => onViewMember?.(assignee)}
          >
            <UserProfileAvatar
              src={assignee.avatar}
              name={assignee.name}
              size="1.5rem"
              fontSize="0.625rem"
              showRing={false}
            />
            <span className="text-xs">{getAbbreviatedDisplayName(assignee.name)}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

interface TeamAssignedTasksListProps {
  tasks: Task[];
  members: User[];
  onViewMember: (member: User) => void;
}

export function TeamAssignedTasksList({ tasks, members, onViewMember }: TeamAssignedTasksListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <Icon name="check-square" size={40} className="mb-4 text-muted-foreground/50" />
        <p className="font-medium text-foreground">{TEAM_PANEL_UI_TEXT.overview.emptyTasks}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{TEAM_PANEL_UI_TEXT.overview.emptyTasksHint}</p>
      </div>
    );
  }

  const memberById = new Map(members.map((member) => [member.id, member]));

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const assignees = (task.assignedTo ?? [])
          .map((id) => memberById.get(id))
          .filter((member): member is User => Boolean(member));

        return (
          <TeamAssignedTaskRow
            key={task.id}
            task={task}
            assignees={assignees}
            onViewMember={onViewMember}
          />
        );
      })}
    </div>
  );
}

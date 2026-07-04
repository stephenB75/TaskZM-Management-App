import React from 'react';
import { cn } from '../../lib/utils';
import { TEAM_PANEL_UI_TEXT } from '../../lib/team-panel-constants';

export type TeamPanelSection = 'members' | 'tasks' | 'invites';

interface TeamSectionNavProps {
  activeSection: TeamPanelSection;
  memberCount: number;
  assignedTaskCount: number;
  pendingInviteCount: number;
  onSectionChange: (section: TeamPanelSection) => void;
  className?: string;
}

export function TeamSectionNav({
  activeSection,
  memberCount,
  assignedTaskCount,
  pendingInviteCount,
  onSectionChange,
  className,
}: TeamSectionNavProps) {
  const items: Array<{ id: TeamPanelSection; label: string; count: number }> = [
    { id: 'members', label: TEAM_PANEL_UI_TEXT.sections.members, count: memberCount },
    { id: 'tasks', label: TEAM_PANEL_UI_TEXT.sections.assignedTasks, count: assignedTaskCount },
    { id: 'invites', label: TEAM_PANEL_UI_TEXT.sections.invites, count: pendingInviteCount },
  ];

  return (
    <div className={cn('border-b border-border/40 px-4 py-2', className)}>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/40 p-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSectionChange(item.id)}
            className={cn(
              'rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors sm:text-sm',
              activeSection === item.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{item.label}</span>
            <span className="ml-1 text-muted-foreground">({item.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import { cn } from '../../lib/utils';
import { TEAM_PANEL_UI_TEXT } from '../../lib/team-panel-constants';
import { TEAM_PANEL_SECTION_NAV } from '../../lib/layout-constants';

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
    { id: 'members', label: TEAM_PANEL_UI_TEXT.sectionsShort.members, count: memberCount },
    { id: 'tasks', label: TEAM_PANEL_UI_TEXT.sectionsShort.assignedTasks, count: assignedTaskCount },
    { id: 'invites', label: TEAM_PANEL_UI_TEXT.sectionsShort.invites, count: pendingInviteCount },
  ];

  return (
    <div
      className={cn('min-w-0 w-full overflow-x-hidden border-b border-border/40', className)}
      style={{
        paddingLeft: TEAM_PANEL_SECTION_NAV.paddingX,
        paddingRight: TEAM_PANEL_SECTION_NAV.paddingX,
        paddingTop: TEAM_PANEL_SECTION_NAV.paddingY,
        paddingBottom: TEAM_PANEL_SECTION_NAV.paddingY,
      }}
    >
      <div
        className="flex gap-1 overflow-x-auto rounded-xl bg-muted/40 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Team sections"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeSection === item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              'shrink-0 rounded-lg text-center text-xs font-medium transition-colors sm:text-sm',
              activeSection === item.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            style={{
              minWidth: TEAM_PANEL_SECTION_NAV.tabMinWidthPx,
              paddingLeft: TEAM_PANEL_SECTION_NAV.tabPaddingX,
              paddingRight: TEAM_PANEL_SECTION_NAV.tabPaddingX,
              paddingTop: TEAM_PANEL_SECTION_NAV.tabPaddingY,
              paddingBottom: TEAM_PANEL_SECTION_NAV.tabPaddingY,
            }}
          >
            <span className="whitespace-nowrap">{item.label}</span>
            <span className="ml-1 tabular-nums text-muted-foreground">({item.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

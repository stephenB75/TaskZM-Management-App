import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Icon } from '../Icon';
import { TEAM_PANEL_UI_TEXT } from '../../lib/team-panel-constants';
import { TEAM_MAX_MEMBERS } from '../../lib/layout-constants';
import type { Team } from '../../types';
import { cn } from '../../lib/utils';

interface TeamOverviewBarProps {
  teamLabel: string;
  teamDescription: string;
  memberCount: number;
  assignedTaskCount: number;
  pendingInviteCount: number;
  teams: Team[];
  currentTeamId: string | null;
  isLoadingTeams: boolean;
  canManageTeam: boolean;
  onTeamChange: (teamId: string | null) => void;
  onInvite: () => void;
  onBulkInvite: () => void;
  onCreateTeam: () => void;
  onEditTeam?: () => void;
  className?: string;
}

export function TeamOverviewBar({
  teamLabel,
  teamDescription,
  memberCount,
  assignedTaskCount,
  pendingInviteCount,
  teams,
  currentTeamId,
  isLoadingTeams,
  canManageTeam,
  onTeamChange,
  onInvite,
  onBulkInvite,
  onCreateTeam,
  onEditTeam,
  className,
}: TeamOverviewBarProps) {
  const stats = [
    { label: TEAM_PANEL_UI_TEXT.overview.statMembers, value: memberCount, icon: 'users' as const },
    { label: TEAM_PANEL_UI_TEXT.overview.statAssigned, value: assignedTaskCount, icon: 'check-square' as const },
    { label: TEAM_PANEL_UI_TEXT.overview.statPending, value: pendingInviteCount, icon: 'clock' as const },
  ];

  return (
    <div className={cn('border-b border-border/40 bg-muted/15 px-4 py-4 space-y-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{teamLabel}</h2>
            {currentTeamId && onEditTeam && canManageTeam ? (
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onEditTeam}>
                <Icon name="pencil" size={16} />
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{teamDescription}</p>
        </div>

        {canManageTeam ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button type="button" onClick={onInvite} className="gap-2">
              <Icon name="user-plus" size={18} />
              {TEAM_PANEL_UI_TEXT.overview.inviteMember}
            </Button>
            <Button type="button" variant="outline" onClick={onBulkInvite} className="gap-2">
              <Icon name="paper-plane-tilt" size={18} />
              {TEAM_PANEL_UI_TEXT.overview.bulkInvite}
            </Button>
            <Button type="button" variant="outline" onClick={onCreateTeam} className="gap-2">
              <Icon name="user-three" size={18} />
              {TEAM_PANEL_UI_TEXT.overview.createTeam}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/50 bg-background/80 px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon name={stat.icon} size={14} />
              <span className="text-xs font-medium">{stat.label}</span>
            </div>
            <p className="mt-1 text-xl font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {(teams.length > 0 || isLoadingTeams) && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {TEAM_PANEL_UI_TEXT.overview.selectTeam}
          </label>
          <Select
            value={currentTeamId ?? 'workspace'}
            onValueChange={(value) => onTeamChange(value === 'workspace' ? null : value)}
            disabled={isLoadingTeams}
          >
            <SelectTrigger className="bg-background/80">
              <SelectValue placeholder={TEAM_PANEL_UI_TEXT.selectTeam} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspace">{TEAM_PANEL_UI_TEXT.workspaceTeam}</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  <span className="inline-flex items-center gap-2">
                    {team.name}
                    <Badge variant="secondary" className="text-[10px]">
                      {team.memberCount ?? 0}/{TEAM_MAX_MEMBERS}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

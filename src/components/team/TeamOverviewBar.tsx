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
import { TEAM_MAX_MEMBERS, TEAM_PANEL_OVERVIEW } from '../../lib/layout-constants';
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
    <div
      className={cn('min-w-0 w-full overflow-x-hidden border-b border-border/40 bg-muted/15', className)}
      style={{
        paddingLeft: TEAM_PANEL_OVERVIEW.paddingX,
        paddingRight: TEAM_PANEL_OVERVIEW.paddingX,
        paddingTop: TEAM_PANEL_OVERVIEW.paddingY,
        paddingBottom: TEAM_PANEL_OVERVIEW.paddingY,
      }}
    >
      <div
        className="flex w-full min-w-0 flex-col"
        style={{ gap: TEAM_PANEL_OVERVIEW.sectionGapPx }}
      >
        {/* Title + description — always full width (panel is narrow even on desktop) */}
        <div className="w-full min-w-0 space-y-1">
          <div className="flex min-w-0 items-start gap-2">
            <h2 className="min-w-0 flex-1 text-lg font-semibold leading-snug text-foreground break-words">
              {teamLabel}
            </h2>
            {currentTeamId && onEditTeam && canManageTeam ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onEditTeam}
                aria-label={TEAM_PANEL_UI_TEXT.editTeam}
              >
                <Icon name="pencil" size={16} />
              </Button>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{teamDescription}</p>
        </div>

        {canManageTeam ? (
          <div
            className="grid w-full grid-cols-2"
            style={{ gap: TEAM_PANEL_OVERVIEW.actionGridGapPx }}
          >
            <Button
              type="button"
              onClick={onInvite}
              className="col-span-2 w-full justify-center gap-2"
            >
              <Icon name="user-plus" size={18} />
              {TEAM_PANEL_UI_TEXT.overview.inviteMember}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onBulkInvite}
              className="w-full justify-center gap-2 px-2"
            >
              <Icon name="paper-plane-tilt" size={18} className="shrink-0" />
              <span className="truncate">{TEAM_PANEL_UI_TEXT.overview.bulkInvite}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCreateTeam}
              className="w-full justify-center gap-2 px-2"
            >
              <Icon name="user-three" size={18} className="shrink-0" />
              <span className="truncate">{TEAM_PANEL_UI_TEXT.overview.createTeam}</span>
            </Button>
          </div>
        ) : null}

        <div
          className="grid w-full grid-cols-3"
          style={{ gap: TEAM_PANEL_OVERVIEW.statsGridGapPx }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="min-w-0 rounded-xl border border-border/50 bg-background/80"
              style={{
                paddingLeft: TEAM_PANEL_OVERVIEW.statsCardPaddingX,
                paddingRight: TEAM_PANEL_OVERVIEW.statsCardPaddingX,
                paddingTop: TEAM_PANEL_OVERVIEW.statsCardPaddingY,
                paddingBottom: TEAM_PANEL_OVERVIEW.statsCardPaddingY,
              }}
            >
              <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <Icon name={stat.icon} size={14} className="shrink-0" />
                <span className="truncate text-xs font-medium">{stat.label}</span>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {(teams.length > 0 || isLoadingTeams) && (
          <div className="w-full min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {TEAM_PANEL_UI_TEXT.overview.selectTeam}
            </label>
            <Select
              value={currentTeamId ?? 'workspace'}
              onValueChange={(value) => onTeamChange(value === 'workspace' ? null : value)}
              disabled={isLoadingTeams}
            >
              <SelectTrigger className="w-full bg-background/80">
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
    </div>
  );
}

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Icon } from '../Icon';
import { UserProfileAvatar } from '../UserProfileAvatar';
import { TEAM_PANEL_UI_TEXT } from '../../lib/team-panel-constants';
import {
  getRoleBadgeVariant,
  getRoleIconName,
  getRoleLabel,
  type MemberTaskStats,
} from '../../lib/team-utils';
import {
  PANEL_DROPDOWN_MENU_TRIGGER_DATA_SLOT,
  PANEL_DROPDOWN_TIMEOUT_DELAY_MS,
  TEAM_PANEL_ROW,
} from '../../lib/layout-constants';
import { cn, getAbbreviatedDisplayName } from '../../lib/utils';
import type { User } from '../../types';

interface TeamMemberRowProps {
  member: User;
  stats: MemberTaskStats;
  isCurrentUser: boolean;
  canManageTeam: boolean;
  onViewProfile: (member: User) => void;
  onUpdateRole: (member: User, role: User['role']) => void;
  onRemoveMember: (member: User) => void;
}

export function TeamMemberRow({
  member,
  stats,
  isCurrentUser,
  canManageTeam,
  onViewProfile,
  onUpdateRole,
  onRemoveMember,
}: TeamMemberRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        'group flex min-w-0 items-center rounded-xl border border-border/50 bg-card/90 transition-colors',
        'hover:border-primary/30 hover:bg-muted/20',
        isCurrentUser && 'ring-1 ring-primary/15',
      )}
      style={{
        gap: TEAM_PANEL_ROW.gapPx,
        paddingLeft: TEAM_PANEL_ROW.paddingX,
        paddingRight: TEAM_PANEL_ROW.paddingX,
        paddingTop: TEAM_PANEL_ROW.paddingY,
        paddingBottom: TEAM_PANEL_ROW.paddingY,
      }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => onViewProfile(member)}
        aria-label={`${TEAM_PANEL_UI_TEXT.memberProfile.viewProfile}: ${member.name}`}
      >
        <UserProfileAvatar
          src={member.avatar}
          name={member.name}
          size={TEAM_PANEL_ROW.avatarSize}
          fontSize="0.875rem"
          showRing={false}
          className="shrink-0 ring-1 ring-border/60"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-semibold text-foreground">
              {getAbbreviatedDisplayName(member.name)}
            </span>
            {isCurrentUser ? (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {TEAM_PANEL_UI_TEXT.currentUser.replace(/[()]/g, '')}
              </Badge>
            ) : null}
            <Badge variant={getRoleBadgeVariant(member.role)} className="shrink-0 text-[10px] capitalize">
              <span className="inline-flex items-center gap-1">
                <Icon name={getRoleIconName(member.role)} size={12} />
                {getRoleLabel(member.role)}
              </span>
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{member.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.total} {stats.total === 1 ? TEAM_PANEL_UI_TEXT.stats.task : TEAM_PANEL_UI_TEXT.stats.tasks}
            {stats.completed > 0 ? ` · ${stats.completed} ${TEAM_PANEL_UI_TEXT.stats.completed}` : ''}
          </p>
        </div>
      </button>

      <div className="flex shrink-0 items-center">
        {canManageTeam && !isCurrentUser ? (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                data-slot={PANEL_DROPDOWN_MENU_TRIGGER_DATA_SLOT}
                onClick={(event) => event.stopPropagation()}
                aria-label={TEAM_PANEL_UI_TEXT.menu.moreActions}
              >
                <Icon name="more-vertical" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                disabled={member.role === 'admin'}
                onSelect={() => {
                  setMenuOpen(false);
                  setTimeout(() => onUpdateRole(member, 'admin'), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                }}
              >
                {TEAM_PANEL_UI_TEXT.overview.makeAdmin}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={member.role === 'member'}
                onSelect={() => {
                  setMenuOpen(false);
                  setTimeout(() => onUpdateRole(member, 'member'), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                }}
              >
                {TEAM_PANEL_UI_TEXT.overview.makeMember}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={member.role === 'viewer'}
                onSelect={() => {
                  setMenuOpen(false);
                  setTimeout(() => onUpdateRole(member, 'viewer'), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                }}
              >
                {TEAM_PANEL_UI_TEXT.overview.makeViewer}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setMenuOpen(false);
                  setTimeout(() => onRemoveMember(member), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                }}
              >
                {TEAM_PANEL_UI_TEXT.overview.removeMember}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => onViewProfile(member)}
            aria-label={TEAM_PANEL_UI_TEXT.memberProfile.viewProfile}
          >
            <Icon name="chevron-right" size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

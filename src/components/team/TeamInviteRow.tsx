import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Icon } from '../Icon';
import { UserProfileAvatar } from '../UserProfileAvatar';
import { TEAM_PANEL_UI_TEXT } from '../../lib/team-panel-constants';
import { MILLISECONDS_PER_DAY } from '../../lib/business-constants';
import type { User } from '../../types';

interface TeamInviteRowProps {
  member: User;
  canManageTeam: boolean;
  onResend: (member: User) => void;
  onCancel: (member: User) => void;
}

function formatInviteExpiry(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((date.getTime() - now.getTime()) / MILLISECONDS_PER_DAY);

  if (daysLeft < 0) return 'Expired';
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft === 1) return 'Expires tomorrow';
  if (daysLeft <= 7) return `Expires in ${daysLeft} days`;
  return date.toLocaleDateString();
}

export function TeamInviteRow({ member, canManageTeam, onResend, onCancel }: TeamInviteRowProps) {
  const expiry = formatInviteExpiry(member.expiresAt);
  const isDeclined = member.inviteStatus === 'declined';

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/90 px-3 py-3">
      <UserProfileAvatar
        src={member.avatar}
        name={member.name}
        size="2.5rem"
        fontSize="0.8125rem"
        showRing={false}
        className="shrink-0 ring-1 ring-border/60"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{member.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {isDeclined ? 'Declined' : expiry === 'Expired' ? 'Expired' : 'Pending'}
          </Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">{member.email}</p>
        {expiry ? <p className="mt-0.5 text-xs text-muted-foreground">{expiry}</p> : null}
      </div>

      {canManageTeam && !isDeclined ? (
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <Button type="button" variant="outline" size="sm" onClick={() => onResend(member)}>
            {TEAM_PANEL_UI_TEXT.overview.resendInvitation}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onCancel(member)}>
            {TEAM_PANEL_UI_TEXT.overview.cancelInvitation}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

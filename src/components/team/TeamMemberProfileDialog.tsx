import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Icon } from '../Icon';
import { UserProfileAvatar } from '../UserProfileAvatar';
import { TEAM_PANEL_UI_TEXT } from '../../lib/team-panel-constants';
import {
  TEAM_PANEL_MEMBER_PROFILE_DIALOG_CLASS,
  TEAM_PANEL_MEMBER_PROFILE_DIALOG_MAX_HEIGHT,
  TEAM_PANEL_PROFILE_AVATAR_OVERLAP_OFFSET,
  TEAM_PANEL_PROFILE_BANNER_HEIGHT,
} from '../../lib/layout-constants';
import {
  getRoleBadgeVariant,
  getRoleIconName,
  getRoleLabel,
  type MemberTaskStats,
} from '../../lib/team-utils';
import {
  COLOR_TASK_COMPLETED_GREEN,
  COLOR_TASK_IN_PROGRESS_AMBER,
  COLOR_TASK_TODO_BLUE,
} from '../../lib/color-theme';
import type { Task, User } from '../../types';

interface TeamMemberProfileDialogProps {
  member: User | null;
  stats: MemberTaskStats | null;
  teamName: string | null;
  assignedTasks: Task[];
  isCurrentUser: boolean;
  inviteStatusBadge: React.ReactNode;
  onClose: () => void;
}

export function TeamMemberProfileDialog({
  member,
  stats,
  teamName,
  assignedTasks,
  isCurrentUser,
  inviteStatusBadge,
  onClose,
}: TeamMemberProfileDialogProps) {
  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={TEAM_PANEL_MEMBER_PROFILE_DIALOG_CLASS}
        style={{ maxHeight: TEAM_PANEL_MEMBER_PROFILE_DIALOG_MAX_HEIGHT }}
      >
        {member && stats ? (
          <>
            <div className="shrink-0">
              <div
                className="w-full bg-primary/80 dark:bg-primary/60"
                style={{ height: TEAM_PANEL_PROFILE_BANNER_HEIGHT }}
              />
              <div className="px-4" style={{ marginTop: TEAM_PANEL_PROFILE_AVATAR_OVERLAP_OFFSET }}>
                <UserProfileAvatar
                  src={member.avatar}
                  name={member.name}
                  size="4.5rem"
                  fontSize="1.125rem"
                  className="border-4 border-background shadow-lg"
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-3 pt-2">
                <DialogHeader className="space-y-2 text-left">
                  <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
                    <span>{member.name}</span>
                    {isCurrentUser ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {TEAM_PANEL_UI_TEXT.currentUser.replace(/[()]/g, '')}
                      </Badge>
                    ) : null}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="space-y-3">
                      <a
                        href={`mailto:${member.email}`}
                        className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
                      >
                        <Icon name="envelope-simple" size={16} />
                        <span className="break-all">{member.email}</span>
                      </a>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize">
                          <span className="inline-flex items-center gap-1">
                            <Icon name={getRoleIconName(member.role)} size={12} />
                            {getRoleLabel(member.role)}
                          </span>
                        </Badge>
                        {inviteStatusBadge}
                        {teamName ? (
                          <Badge variant="outline" className="text-[10px]">
                            <Icon name="users" size={12} className="mr-1" />
                            {teamName}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {TEAM_PANEL_UI_TEXT.overview.roleDescriptions[member.role]}
                      </p>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{TEAM_PANEL_UI_TEXT.stats.tasks}</p>
                    <p className="text-lg font-semibold">{stats.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{TEAM_PANEL_UI_TEXT.stats.completed}</p>
                    <p className="text-lg font-semibold" style={{ color: COLOR_TASK_COMPLETED_GREEN }}>{stats.completed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{TEAM_PANEL_UI_TEXT.stats.inProgress}</p>
                    <p className="text-lg font-semibold" style={{ color: COLOR_TASK_IN_PROGRESS_AMBER }}>{stats.inProgress}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{TEAM_PANEL_UI_TEXT.stats.todo}</p>
                    <p className="text-lg font-semibold" style={{ color: COLOR_TASK_TODO_BLUE }}>{stats.todo}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {TEAM_PANEL_UI_TEXT.memberProfile.assignedTaskList}
                  </p>
                  {assignedTasks.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                      {TEAM_PANEL_UI_TEXT.memberProfile.noAssignedTasks}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {assignedTasks.map((task) => (
                        <div key={task.id} className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          <p className="text-xs capitalize text-muted-foreground">{task.status.replace('-', ' ')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="shrink-0 border-t border-border/50 bg-background/95 px-4 py-3 sm:flex-row sm:justify-end">
                <Button variant="outline" asChild className="w-full sm:w-auto">
                  <a href={`mailto:${member.email}`}>
                    <Icon name="paper-plane-tilt" size={16} className="mr-2" />
                    {TEAM_PANEL_UI_TEXT.memberProfile.emailMember}
                  </a>
                </Button>
                <Button onClick={onClose} className="w-full sm:w-auto">
                  {TEAM_PANEL_UI_TEXT.memberProfile.close}
                </Button>
              </DialogFooter>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

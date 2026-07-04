/**
 * Shared helpers for team panel UI.
 */

import type { Task, User } from '../types';
import { TEAM_PANEL_UI_TEXT } from './team-panel-constants';

export interface MemberTaskStats {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
}

export function getMemberTaskStats(memberId: string, tasks: Task[]): MemberTaskStats {
  const assignedTasks = tasks.filter((task) => task.assignedTo?.includes(memberId));
  return {
    total: assignedTasks.length,
    completed: assignedTasks.filter((task) => task.status === 'done').length,
    inProgress: assignedTasks.filter((task) => task.status === 'in-progress').length,
    todo: assignedTasks.filter((task) => task.status === 'todo').length,
  };
}

export function getAcceptedMembers(members: User[]): User[] {
  return members.filter((member) => member.inviteStatus !== 'pending' && member.inviteStatus !== 'declined');
}

export function getPendingMembers(members: User[]): User[] {
  return members.filter((member) => member.inviteStatus === 'pending' || member.inviteStatus === 'declined');
}

export function getRoleLabel(role: User['role']): string {
  if (role === 'admin') return TEAM_PANEL_UI_TEXT.roles.admin;
  if (role === 'viewer') return TEAM_PANEL_UI_TEXT.roles.viewer;
  return TEAM_PANEL_UI_TEXT.roles.member;
}

export function getRoleIconName(role: User['role']): string {
  if (role === 'admin') return 'shield-check';
  if (role === 'viewer') return 'eye';
  return 'shield';
}

export function getRoleBadgeVariant(role: User['role']): 'default' | 'secondary' | 'outline' {
  if (role === 'admin') return 'default';
  if (role === 'viewer') return 'outline';
  return 'secondary';
}

export function getAssignedTasksForMembers(members: User[], tasks: Task[]): Task[] {
  const memberIds = new Set(members.map((member) => member.id));
  return tasks.filter((task) =>
    Array.isArray(task.assignedTo) && task.assignedTo.some((id) => memberIds.has(id)),
  );
}

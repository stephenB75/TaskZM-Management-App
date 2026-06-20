/**
 * Folder panel — UI strings and card layout tokens.
 */

import { AGENDA_LIST_CARD } from './agenda-list-card-constants';
import { PANEL_DROPDOWN_TIMEOUT_DELAY_MS } from './layout-constants';

export const FOLDER_UI_TEXT = {
  unnamedFolder: 'Unnamed Folder',
  badgeLabel: 'Folder',
  emptyFolder: 'Empty folder',
  task: 'task',
  tasks: 'tasks',
  project: 'project',
  projects: 'projects',
  item: 'item',
  items: 'items',
  openFolder: 'Open Folder',
  editFolder: 'Edit',
  deleteFolder: 'Delete',
  openFolderAria: 'Open folder',
  folderOptionsAria: 'Folder options',
} as const;

export const FOLDER_CARD = {
  listGapPx: 10,
  actionButtonSizePx: 28,
  menuButtonSizePx: 28,
  dropTargetRingClass: 'ring-2 ring-primary/40 bg-primary/5 shadow-md',
  hoverRingClass: 'hover:ring-1 hover:ring-primary/20 hover:shadow-sm',
  dropdownTimeoutMs: PANEL_DROPDOWN_TIMEOUT_DELAY_MS,
  accentIcon: 'folder',
  footerIcon: 'folder-tree',
  accentLineMinHeightPx: AGENDA_LIST_CARD.accentLineMinHeightPx,
} as const;

export function formatFolderTaskLabel(count: number): string {
  return `${count} ${count === 1 ? FOLDER_UI_TEXT.task : FOLDER_UI_TEXT.tasks}`;
}

export function formatFolderProjectLabel(count: number): string {
  return `${count} ${count === 1 ? FOLDER_UI_TEXT.project : FOLDER_UI_TEXT.projects}`;
}

export function formatFolderItemSummary(taskCount: number, projectCount: number): string {
  const total = taskCount + projectCount;
  if (total === 0) return FOLDER_UI_TEXT.emptyFolder;
  return `${total} ${total === 1 ? FOLDER_UI_TEXT.item : FOLDER_UI_TEXT.items}`;
}

export function formatFolderFooterBreakdown(taskCount: number, projectCount: number): string {
  const parts: string[] = [];
  if (taskCount > 0) parts.push(formatFolderTaskLabel(taskCount));
  if (projectCount > 0) parts.push(formatFolderProjectLabel(projectCount));
  if (parts.length === 0) return FOLDER_UI_TEXT.emptyFolder;
  return parts.join(' · ');
}

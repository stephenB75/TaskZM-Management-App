import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
import { AgendaListCard } from './AgendaListCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useIsMobile } from './ui/use-mobile';
import {
  FOLDER_CARD,
  FOLDER_UI_TEXT,
  formatFolderFooterBreakdown,
  formatFolderItemSummary,
} from '../lib/folder-constants';
import {
  COLOR_FOLDER_DEFAULT,
} from '../lib/color-theme';
import {
  FOLDER_PANEL_DROPDOWN_WIDTH,
  FOLDER_PANEL_DROPDOWN_Z_INDEX,
  FOLDER_PANEL_ICON_MARGIN_RIGHT,
  FOLDER_PANEL_ICON_SIZE_SMALL,
  ICON_SIZE_XS,
} from '../lib/layout-constants';
import type { Folder as FolderType } from '../types';

export interface FolderCardProps {
  folder: FolderType;
  taskCount: number;
  projectCount: number;
  onFolderClick: (folder: FolderType) => void;
  onEditFolder: (folder: FolderType) => void;
  onDeleteFolder: (folder: FolderType) => void;
}

export const FolderCard = React.memo(function FolderCard({
  folder,
  taskCount,
  projectCount,
  onFolderClick,
  onEditFolder,
  onDeleteFolder,
}: FolderCardProps) {
  const isMobile = useIsMobile();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `folder_${folder.id}`,
    disabled: isMobile,
  });

  const accentColor = folder.color || COLOR_FOLDER_DEFAULT;
  const title = folder.name?.trim() || FOLDER_UI_TEXT.unnamedFolder;
  const subtitle = folder.description?.trim() || undefined;

  const headerAction = (
    <div
      className="flex items-center gap-0.5 flex-shrink-0 opacity-70 group-hover/card:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex-shrink-0 hover:opacity-70 transition-opacity flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            style={{
              width: FOLDER_CARD.menuButtonSizePx,
              height: FOLDER_CARD.menuButtonSizePx,
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={FOLDER_UI_TEXT.folderOptionsAria}
          >
            <Icon name="more-vertical" size={ICON_SIZE_XS} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          style={{
            zIndex: FOLDER_PANEL_DROPDOWN_Z_INDEX,
            width: FOLDER_PANEL_DROPDOWN_WIDTH,
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem
            onSelect={() => {
              setDropdownOpen(false);
              setTimeout(() => onFolderClick(folder), FOLDER_CARD.dropdownTimeoutMs);
            }}
            className="cursor-pointer"
          >
            <Icon name="folder" size={FOLDER_PANEL_ICON_SIZE_SMALL} style={{ marginRight: FOLDER_PANEL_ICON_MARGIN_RIGHT }} />
            {FOLDER_UI_TEXT.openFolder}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setDropdownOpen(false);
              setTimeout(() => onEditFolder(folder), FOLDER_CARD.dropdownTimeoutMs);
            }}
            className="cursor-pointer"
          >
            <Icon name="edit-2" size={FOLDER_PANEL_ICON_SIZE_SMALL} style={{ marginRight: FOLDER_PANEL_ICON_MARGIN_RIGHT }} />
            {FOLDER_UI_TEXT.editFolder}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setDropdownOpen(false);
              setTimeout(() => onDeleteFolder(folder), FOLDER_CARD.dropdownTimeoutMs);
            }}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <Icon name="trash-2" size={FOLDER_PANEL_ICON_SIZE_SMALL} style={{ marginRight: FOLDER_PANEL_ICON_MARGIN_RIGHT }} />
            {FOLDER_UI_TEXT.deleteFolder}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFolderClick(folder);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-shrink-0 hover:opacity-70 transition-opacity flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        style={{
          width: FOLDER_CARD.actionButtonSizePx,
          height: FOLDER_CARD.actionButtonSizePx,
        }}
        aria-label={FOLDER_UI_TEXT.openFolderAria}
        title={FOLDER_UI_TEXT.openFolder}
      >
        <Icon name="chevron-right" size={ICON_SIZE_XS} />
      </button>
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group/card cursor-pointer',
        isOver && 'ring-2 ring-primary/50 ring-inset rounded-2xl',
      )}
      onClick={() => onFolderClick(folder)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFolderClick(folder);
        }
      }}
    >
      <div
        className={cn(
          'rounded-2xl transition-all',
          FOLDER_CARD.hoverRingClass,
          isOver && FOLDER_CARD.dropTargetRingClass,
          dropdownOpen && 'ring-1 ring-primary/25 shadow-sm',
        )}
      >
        <AgendaListCard
          accentColor={accentColor}
          accentIcon={FOLDER_CARD.accentIcon}
          badgeLabel={FOLDER_UI_TEXT.badgeLabel}
          title={title}
          subtitle={subtitle}
          allDayLabel={formatFolderItemSummary(taskCount, projectCount)}
          footerIcon={FOLDER_CARD.footerIcon}
          footerSourceLabel={formatFolderFooterBreakdown(taskCount, projectCount)}
          showCommentIcon={Boolean(subtitle)}
          headerAction={headerAction}
        />
      </div>
    </div>
  );
}, (prev, next) =>
  prev.folder.id === next.folder.id
  && prev.folder.name === next.folder.name
  && prev.folder.description === next.folder.description
  && prev.folder.color === next.folder.color
  && prev.taskCount === next.taskCount
  && prev.projectCount === next.projectCount
  && prev.onFolderClick === next.onFolderClick
  && prev.onEditFolder === next.onEditFolder
  && prev.onDeleteFolder === next.onDeleteFolder,
);

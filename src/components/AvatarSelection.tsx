/**
 * Avatar Selection — Multiavatar multicultural portraits with TaskZM pastels.
 */

import React, { useMemo } from 'react';
import { cn } from '../lib/utils';
import {
  AVATAR_LORELEI_PREFIX,
  AVATAR_MICAH_PREFIX,
  AVATAR_NOTIONISTS_PREFIX,
  AVATAR_OPTIONS,
  AVATAR_SELECTION_GAP,
  AVATAR_SELECTION_GRID_COLS,
  AVATAR_SELECTION_GRID_MAX_HEIGHT,
  AVATAR_SELECTION_MAX_CELL_SIZE,
  AVATAR_SELECTION_RING_CLASS,
  AVATAR_SELECTION_SECTION_GAP,
  AVATAR_SELECTION_SECTION_LABEL_CLASS,
  AVATAR_SELECTION_SELECTED_CLASS,
  AVATAR_SELECTION_UNSELECTED_CLASS,
  AVATAR_CHECKMARK_SIZE,
  AVATAR_CHECKMARK_ICON_SIZE,
  AVATAR_UI_TEXT,
  MULTIAVATAR_PARTS,
  MULTIAVATAR_THEME_LABELS,
  getAvatarOptionsByPart,
} from '../lib/avatar-constants';
import { getAvatarSvgDataUrl } from '../lib/avatar-render';
import { resolveAvatarOption } from '../lib/avatar-utils';
import { COLOR_TEXT_WHITE } from '../lib/color-theme';

interface AvatarSelectionProps {
  selectedAvatar?: string;
  onAvatarSelect: (avatarId: string) => void;
  className?: string;
  previewSeed?: string;
  /** Enable vertical scroll for the grid (use inside dialogs on mobile) */
  scrollable?: boolean;
}

function AvatarGrid({
  options,
  avatarUrls,
  resolvedSelection,
  onAvatarSelect,
}: {
  options: readonly (typeof AVATAR_OPTIONS)[number][];
  avatarUrls: Record<string, string>;
  resolvedSelection: string;
  onAvatarSelect: (avatarId: string) => void;
}) {
  return (
    <div
      className="grid w-full min-w-0"
      style={{
        gridTemplateColumns: `repeat(${Math.min(options.length, AVATAR_SELECTION_GRID_COLS)}, minmax(0, 1fr))`,
        gap: AVATAR_SELECTION_GAP,
      }}
    >
      {options.map((option) => {
        const isSelected = resolvedSelection === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onAvatarSelect(option.id)}
            className={cn(
              'relative mx-auto aspect-square w-full max-w-full cursor-pointer overflow-hidden rounded-full border-2 transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 sm:hover:scale-105 sm:focus:ring-offset-2',
              AVATAR_SELECTION_RING_CLASS,
              isSelected ? AVATAR_SELECTION_SELECTED_CLASS : AVATAR_SELECTION_UNSELECTED_CLASS,
            )}
            style={{
              maxWidth: AVATAR_SELECTION_MAX_CELL_SIZE,
              backgroundColor: option.backgroundColor,
            }}
            aria-label={option.label}
            title={option.label}
          >
            <img
              src={avatarUrls[option.id]}
              alt={option.label}
              className="block h-full w-full object-cover object-center"
              loading="lazy"
              draggable={false}
            />
            {isSelected && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/15">
                <div
                  className="flex items-center justify-center rounded-full bg-primary shadow-sm"
                  style={{
                    width: AVATAR_CHECKMARK_SIZE,
                    height: AVATAR_CHECKMARK_SIZE,
                  }}
                >
                  <svg
                    style={{
                      color: COLOR_TEXT_WHITE,
                      width: AVATAR_CHECKMARK_ICON_SIZE,
                      height: AVATAR_CHECKMARK_ICON_SIZE,
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function AvatarSelection({
  selectedAvatar,
  onAvatarSelect,
  className,
  previewSeed = 'User',
  scrollable = false,
}: AvatarSelectionProps) {
  const resolvedSelection = resolveAvatarOption(selectedAvatar, previewSeed).id;

  const avatarUrls = useMemo(
    () =>
      Object.fromEntries(
        AVATAR_OPTIONS.map((option) => [option.id, getAvatarSvgDataUrl(option)]),
      ),
    [],
  );

  return (
    <div className={cn('w-full min-w-0', className)}>
      <p className="mb-3 text-center text-[11px] leading-snug text-muted-foreground sm:text-xs">
        {AVATAR_UI_TEXT.selectAvatarDescription}
      </p>

      <div
        className={cn(
          'w-full min-w-0 rounded-xl border border-border/40 bg-muted/20 p-2 sm:p-3',
          scrollable && 'overflow-y-auto overscroll-contain',
        )}
        style={{
          maxHeight: scrollable ? AVATAR_SELECTION_GRID_MAX_HEIGHT : undefined,
        }}
      >
        <div
          className="flex flex-col"
          style={{ gap: AVATAR_SELECTION_SECTION_GAP }}
        >
          {MULTIAVATAR_PARTS.map((part) => {
            const partOptions = getAvatarOptionsByPart(part);
            return (
              <section key={part}>
                <h4 className={AVATAR_SELECTION_SECTION_LABEL_CLASS}>
                  {AVATAR_UI_TEXT.characterSectionPrefix} {part}
                  {' · '}
                  {partOptions.map((option) => MULTIAVATAR_THEME_LABELS[option.theme]).join(' / ')}
                </h4>
                <AvatarGrid
                  options={partOptions}
                  avatarUrls={avatarUrls}
                  resolvedSelection={resolvedSelection}
                  onAvatarSelect={onAvatarSelect}
                />
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground">
        {AVATAR_UI_TEXT.packCredit}
      </p>
    </div>
  );
}

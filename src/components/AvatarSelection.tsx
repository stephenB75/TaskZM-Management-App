/**
 * Avatar Selection — Avataaars flat vector portraits (bundled SVG pack).
 */

import React from 'react';
import { cn } from '../lib/utils';
import {
  AVATAR_OPTIONS,
  AVATAR_SELECTION_SIZE,
  AVATAR_SELECTION_GAP,
  AVATAR_SELECTION_GRID_COLS,
  AVATAR_CHECKMARK_SIZE,
  AVATAR_CHECKMARK_ICON_SIZE,
  AVATAR_UI_TEXT,
  USER_PROFILE_AVATAR_RING_CLASS,
  getAvatarImageUrl,
} from '../lib/avatar-constants';
import { resolveAvatarOption } from '../lib/avatar-utils';
import { COLOR_TEXT_WHITE } from '../lib/color-theme';

interface AvatarSelectionProps {
  selectedAvatar?: string;
  onAvatarSelect: (avatarId: string) => void;
  className?: string;
  previewSeed?: string;
}

export function AvatarSelection({
  selectedAvatar,
  onAvatarSelect,
  className,
  previewSeed = 'User',
}: AvatarSelectionProps) {
  const resolvedSelection = resolveAvatarOption(selectedAvatar, previewSeed).id;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="grid rounded-xl border border-border/40 bg-muted/20 p-3"
        style={{
          gridTemplateColumns: `repeat(${AVATAR_SELECTION_GRID_COLS}, 1fr)`,
          gap: AVATAR_SELECTION_GAP,
        }}
      >
        {AVATAR_OPTIONS.map((option) => {
          const isSelected = resolvedSelection === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onAvatarSelect(option.id)}
              className={cn(
                'relative cursor-pointer overflow-hidden rounded-full border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                isSelected
                  ? 'border-primary ring-2 ring-primary ring-offset-2'
                  : 'border-border/50 hover:border-primary/40',
                USER_PROFILE_AVATAR_RING_CLASS,
              )}
              style={{
                width: AVATAR_SELECTION_SIZE,
                height: AVATAR_SELECTION_SIZE,
              }}
              aria-label={option.label}
              title={option.label}
            >
              <img
                src={getAvatarImageUrl(option)}
                alt={option.label}
                className="h-full w-full object-cover"
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
      <p className="mt-2 text-center text-[10px] text-muted-foreground">{AVATAR_UI_TEXT.packCredit}</p>
    </div>
  );
}

/** @deprecated Gender is no longer used for avatar selection */
export type AvatarGender = 'male' | 'female';

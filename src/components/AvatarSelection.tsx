/**
 * Avatar Selection Component
 * Allows users to select an avatar from a grid of illustrations
 */

import React from 'react';
import { cn } from '../lib/utils';
import {
  AVATAR_PATHS,
  DEFAULT_AVATAR,
  AVATAR_SELECTION_SIZE,
  AVATAR_SELECTION_GAP,
  AVATAR_SELECTION_GRID_COLS,
  AVATAR_CHECKMARK_SIZE,
  AVATAR_CHECKMARK_ICON_SIZE,
  USER_PROFILE_AVATAR_BG_CLASS,
  type AvatarGender,
} from '../lib/avatar-constants';
import { COLOR_TEXT_WHITE } from '../lib/color-theme';

export type { AvatarGender };

interface AvatarSelectionProps {
  selectedAvatar?: string;
  gender: AvatarGender;
  onAvatarSelect: (avatarPath: string) => void;
  className?: string;
}

export function AvatarSelection({
  selectedAvatar,
  gender,
  onAvatarSelect,
  className,
}: AvatarSelectionProps) {
  const avatars = AVATAR_PATHS[gender];

  return (
    <div className={cn('w-full', className)} key={`avatar-selection-${gender}`}>
      <div
        className="grid rounded-xl border border-border/40 bg-muted/20 p-3"
        style={{
          gridTemplateColumns: `repeat(${AVATAR_SELECTION_GRID_COLS}, 1fr)`,
          gap: AVATAR_SELECTION_GAP,
        }}
      >
        {avatars.map((avatarPath, index) => {
          const isSelected = selectedAvatar === avatarPath;
          return (
            <button
              key={`${gender}-${avatarPath}`}
              type="button"
              onClick={() => onAvatarSelect(avatarPath)}
              className={cn(
                'relative cursor-pointer overflow-hidden rounded-full border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                USER_PROFILE_AVATAR_BG_CLASS,
                isSelected
                  ? 'border-primary ring-2 ring-primary ring-offset-2'
                  : 'border-border/60 hover:border-primary/40',
              )}
              style={{
                width: AVATAR_SELECTION_SIZE,
                height: AVATAR_SELECTION_SIZE,
              }}
            >
              <img
                src={avatarPath}
                alt={`${gender} avatar ${index + 1}`}
                className="h-full w-full object-cover object-top"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== DEFAULT_AVATAR && !target.src.includes(DEFAULT_AVATAR)) {
                    target.src = DEFAULT_AVATAR;
                  }
                }}
              />
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                  <div
                    className="flex items-center justify-center rounded-full bg-primary"
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
    </div>
  );
}

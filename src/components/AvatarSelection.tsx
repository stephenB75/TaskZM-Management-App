/**
 * Avatar Selection Component
 * Allows users to select an avatar from a grid of illustrations
 * Supports gender filtering
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
} from '../lib/avatar-constants';

export type AvatarGender = 'male' | 'female';

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
    <div className={cn("w-full", className)}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${AVATAR_SELECTION_GRID_COLS}, 1fr)`,
          gap: AVATAR_SELECTION_GAP,
        }}
      >
        {avatars.map((avatarPath, index) => {
          const isSelected = selectedAvatar === avatarPath;
          return (
            <button
              key={avatarPath}
              type="button"
              onClick={() => onAvatarSelect(avatarPath)}
              className={cn(
                "relative rounded-full overflow-hidden border-2 transition-all cursor-pointer hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : "border-border hover:border-primary/50"
              )}
              style={{
                width: AVATAR_SELECTION_SIZE,
                height: AVATAR_SELECTION_SIZE,
              }}
            >
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <img
                  key={avatarPath}
                  src={avatarPath}
                  alt={`${gender} Avatar ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to default avatar if image fails to load
                    const target = e.target as HTMLImageElement;
                    if (target.src !== DEFAULT_AVATAR && !target.src.includes(DEFAULT_AVATAR)) {
                      target.src = DEFAULT_AVATAR;
                    }
                  }}
                />
              </div>
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                  <div 
                    className="rounded-full bg-primary flex items-center justify-center"
                    style={{
                      width: AVATAR_CHECKMARK_SIZE,
                      height: AVATAR_CHECKMARK_SIZE,
                    }}
                  >
                    <svg
                      className="text-white"
                      style={{
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

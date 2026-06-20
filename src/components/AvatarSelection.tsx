/**
 * Avatar Selection — user portrait icons on pastel rings.
 */

import React from 'react';
import { cn } from '../lib/utils';
import {
  AVATAR_ICONS,
  AVATAR_SELECTION_SIZE,
  AVATAR_SELECTION_GAP,
  AVATAR_SELECTION_GRID_COLS,
  AVATAR_CHECKMARK_SIZE,
  AVATAR_CHECKMARK_ICON_SIZE,
  AVATAR_ICON,
  USER_PROFILE_AVATAR_RING_CLASS,
  getAvatarRingStyle,
} from '../lib/avatar-constants';
import { COLOR_TEXT_WHITE } from '../lib/color-theme';

interface AvatarSelectionProps {
  selectedAvatar?: string;
  onAvatarSelect: (avatarPath: string) => void;
  className?: string;
}

export function AvatarSelection({
  selectedAvatar,
  onAvatarSelect,
  className,
}: AvatarSelectionProps) {
  const selectionSizePx = parseFloat(AVATAR_SELECTION_SIZE);
  const insetPx = (selectionSizePx * AVATAR_ICON.imageInsetPercent) / 100;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="grid rounded-xl border border-border/40 bg-muted/20 p-3"
        style={{
          gridTemplateColumns: `repeat(${AVATAR_SELECTION_GRID_COLS}, 1fr)`,
          gap: AVATAR_SELECTION_GAP,
        }}
      >
        {AVATAR_ICONS.map((icon, index) => {
          const isSelected = selectedAvatar === icon.path || selectedAvatar === icon.id;
          const ringStyle = getAvatarRingStyle(index);
          return (
            <button
              key={icon.id}
              type="button"
              onClick={() => onAvatarSelect(icon.path)}
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
                background: `linear-gradient(145deg, ${ringStyle.gradientFrom} 0%, ${ringStyle.gradientTo} 100%)`,
              }}
              aria-label={icon.label}
              title={icon.label}
            >
              <div
                className="flex h-full w-full items-end justify-center overflow-hidden"
                style={{ padding: insetPx }}
              >
                <img
                  src={icon.path}
                  alt=""
                  className="max-h-full max-w-full object-contain object-bottom pointer-events-none select-none"
                  style={{
                    transform: `scale(${AVATAR_ICON.imageScale})`,
                    transformOrigin: 'bottom center',
                  }}
                  loading="lazy"
                  draggable={false}
                />
              </div>
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
    </div>
  );
}

/** @deprecated Gender is no longer used for avatar selection */
export type AvatarGender = 'male' | 'female';

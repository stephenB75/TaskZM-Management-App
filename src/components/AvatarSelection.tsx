/**
 * Avatar Selection — Phosphor user icons on pastel gradient circles.
 */

import React from 'react';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
import {
  AVATAR_PRESETS,
  AVATAR_SELECTION_SIZE,
  AVATAR_SELECTION_GAP,
  AVATAR_SELECTION_GRID_COLS,
  AVATAR_CHECKMARK_SIZE,
  AVATAR_CHECKMARK_ICON_SIZE,
  AVATAR_ICON,
  USER_PROFILE_AVATAR_RING_CLASS,
  getAvatarPresetStyles,
} from '../lib/avatar-constants';
import { resolveAvatarPreset } from '../lib/avatar-utils';
import { COLOR_TEXT_WHITE } from '../lib/color-theme';

interface AvatarSelectionProps {
  selectedAvatar?: string;
  onAvatarSelect: (avatarPresetId: string) => void;
  className?: string;
  /** Used to resolve legacy portrait paths to the matching preset highlight. */
  previewSeed?: string;
}

export function AvatarSelection({
  selectedAvatar,
  onAvatarSelect,
  className,
  previewSeed = 'User',
}: AvatarSelectionProps) {
  const selectionSizePx = parseFloat(AVATAR_SELECTION_SIZE);
  const iconSize = Math.max(selectionSizePx * AVATAR_ICON.iconScaleRatio, 16);
  const resolvedSelection = resolveAvatarPreset(selectedAvatar, previewSeed).id;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="grid rounded-xl border border-border/40 bg-muted/20 p-3"
        style={{
          gridTemplateColumns: `repeat(${AVATAR_SELECTION_GRID_COLS}, 1fr)`,
          gap: AVATAR_SELECTION_GAP,
        }}
      >
        {AVATAR_PRESETS.map((preset) => {
          const isSelected = resolvedSelection === preset.id;
          const style = getAvatarPresetStyles(preset, false);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onAvatarSelect(preset.id)}
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
                background: `linear-gradient(145deg, ${style.gradientFrom} 0%, ${style.gradientTo} 100%)`,
              }}
              aria-label={preset.label}
              title={preset.label}
            >
              <div className="flex h-full w-full items-center justify-center">
                <Icon
                  name={preset.icon}
                  size={iconSize}
                  weight="duotone"
                  style={{ color: style.iconColor }}
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

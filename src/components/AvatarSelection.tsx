/**
 * Avatar Selection — pastel preset swatches matching TaskZM brand colors.
 */

import React from 'react';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import {
  AVATAR_PRESETS,
  AVATAR_SELECTION_SIZE,
  AVATAR_SELECTION_GAP,
  AVATAR_SELECTION_GRID_COLS,
  AVATAR_CHECKMARK_SIZE,
  AVATAR_CHECKMARK_ICON_SIZE,
  USER_PROFILE_AVATAR_RING_CLASS,
  getAvatarPresetStyles,
} from '../lib/avatar-constants';
import { COLOR_TEXT_WHITE } from '../lib/color-theme';

interface AvatarSelectionProps {
  selectedAvatar?: string;
  onAvatarSelect: (avatarId: string) => void;
  previewInitials?: string;
  className?: string;
}

export function AvatarSelection({
  selectedAvatar,
  onAvatarSelect,
  previewInitials = 'TM',
  className,
}: AvatarSelectionProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

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
          const isSelected = selectedAvatar === preset.id;
          const styles = getAvatarPresetStyles(preset, isDark);
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
                background: `linear-gradient(135deg, ${styles.gradientFrom} 0%, ${styles.gradientTo} 100%)`,
              }}
              aria-label={preset.label}
              title={preset.label}
            >
              <span
                className="relative flex h-full w-full items-center justify-center text-sm font-semibold"
                style={{ color: styles.textColor }}
              >
                {previewInitials.slice(0, 2).toUpperCase()}
              </span>
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

import React from 'react';
import { cn, getInitials } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import {
  USER_PROFILE_AVATAR_RING_CLASS,
  USER_PROFILE_AVATAR_BG_CLASS,
  getAvatarPresetStyles,
} from '../lib/avatar-constants';
import { resolveAvatarPreset } from '../lib/avatar-utils';

interface UserProfileAvatarProps {
  src?: string;
  name: string;
  size?: string;
  fontSize?: string;
  className?: string;
  showRing?: boolean;
  alt?: string;
}

export function UserProfileAvatar({
  src,
  name,
  size = '3rem',
  fontSize = '0.875rem',
  className,
  showRing = true,
  alt,
}: UserProfileAvatarProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const seed = name.trim() || 'User';
  const preset = resolveAvatarPreset(src, seed);
  const styles = getAvatarPresetStyles(preset, isDark);
  const initials = getInitials(name);

  return (
    <div
      className={cn(
        'relative flex-shrink-0 overflow-hidden rounded-full',
        USER_PROFILE_AVATAR_BG_CLASS,
        showRing && USER_PROFILE_AVATAR_RING_CLASS,
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${styles.gradientFrom} 0%, ${styles.gradientTo} 100%)`,
      }}
      title={alt || name}
      aria-label={alt || name}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.06) 100%)',
        }}
        aria-hidden
      />
      <div
        className="relative flex h-full w-full items-center justify-center font-semibold tracking-tight select-none"
        style={{
          fontSize,
          color: styles.textColor,
        }}
      >
        {initials}
      </div>
    </div>
  );
}

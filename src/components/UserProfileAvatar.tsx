import React from 'react';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
import {
  AVATAR_ICON,
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

function parseSizePx(size: string): number {
  if (size.includes('rem')) return parseFloat(size) * 16;
  return parseFloat(size.replace(/[^0-9.]/g, '')) || 48;
}

export function UserProfileAvatar({
  src,
  name,
  size = '3rem',
  className,
  showRing = true,
  alt,
}: UserProfileAvatarProps) {
  const seed = name.trim() || 'User';
  const preset = resolveAvatarPreset(src, seed);
  const style = getAvatarPresetStyles(preset, false);
  const sizePx = parseSizePx(size);
  const iconSize = Math.max(sizePx * AVATAR_ICON.iconScaleRatio, 16);

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
        background: `linear-gradient(145deg, ${style.gradientFrom} 0%, ${style.gradientTo} 100%)`,
        boxShadow: `inset 0 0 0 1px ${style.iconColor}22`,
      }}
      title={alt || name}
      aria-label={alt || name}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.05) 100%)',
        }}
        aria-hidden
      />
      <div className="relative flex h-full w-full items-center justify-center">
        <Icon
          name={preset.icon}
          size={iconSize}
          weight="duotone"
          style={{ color: style.iconColor }}
        />
      </div>
    </div>
  );
}

import React from 'react';
import { cn } from '../lib/utils';
import {
  USER_PROFILE_AVATAR_RING_CLASS,
  USER_PROFILE_AVATAR_BG_CLASS,
  AVATAR_DISPLAY_IMAGE_SCALE,
} from '../lib/avatar-constants';
import { getAvatarDisplayUrl } from '../lib/avatar-utils';

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
  className,
  showRing = true,
  alt,
}: UserProfileAvatarProps) {
  const seed = name.trim() || 'User';
  const imageUrl = getAvatarDisplayUrl(src, seed);

  return (
    <div
      className={cn(
        'relative flex-shrink-0 overflow-hidden rounded-full',
        USER_PROFILE_AVATAR_BG_CLASS,
        showRing && USER_PROFILE_AVATAR_RING_CLASS,
        className,
      )}
      style={{ width: size, height: size }}
      title={alt || name}
      aria-label={alt || name}
    >
      <img
        src={imageUrl}
        alt={alt || `${name} avatar`}
        className="block h-full w-full object-cover object-center"
        style={{
          transform: `scale(${AVATAR_DISPLAY_IMAGE_SCALE})`,
          transformOrigin: 'center center',
        }}
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}

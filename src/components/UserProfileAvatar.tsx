import React from 'react';
import { cn } from '../lib/utils';
import {
  USER_PROFILE_AVATAR_RING_CLASS,
} from '../lib/avatar-constants';
import { getAvatarDisplayBackground, getAvatarDisplayUrl } from '../lib/avatar-utils';

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
  const backgroundColor = getAvatarDisplayBackground(src, seed);

  return (
    <div
      className={cn(
        'relative flex-shrink-0 overflow-hidden rounded-full',
        showRing && USER_PROFILE_AVATAR_RING_CLASS,
        className,
      )}
      style={{ width: size, height: size, backgroundColor }}
      title={alt || name}
      aria-label={alt || name}
    >
      <img
        src={imageUrl}
        alt={alt || `${name} avatar`}
        className="block h-full w-full object-cover object-center"
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}

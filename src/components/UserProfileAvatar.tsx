import React from 'react';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
import {
  AVATAR_ICON,
  USER_PROFILE_AVATAR_RING_CLASS,
  USER_PROFILE_AVATAR_BG_CLASS,
  getAvatarRingStyle,
} from '../lib/avatar-constants';
import { resolveAvatarIcon, resolveAvatarIconIndex } from '../lib/avatar-utils';

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
  const icon = resolveAvatarIcon(src, seed);
  const ringStyle = getAvatarRingStyle(resolveAvatarIconIndex(src, seed));
  const sizePx = parseSizePx(size);
  const insetPx = (sizePx * AVATAR_ICON.imageInsetPercent) / 100;

  const [imageSrc, setImageSrc] = React.useState(icon.path);
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageSrc(icon.path);
    setImageFailed(false);
  }, [icon.path, src]);

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
        background: `linear-gradient(145deg, ${ringStyle.gradientFrom} 0%, ${ringStyle.gradientTo} 100%)`,
        boxShadow: `inset 0 0 0 1px ${ringStyle.ringColor}22`,
      }}
      title={alt || name}
      aria-label={alt || name}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.04) 100%)',
        }}
        aria-hidden
      />
      <div
        className="relative flex h-full w-full items-end justify-center overflow-hidden"
        style={{ padding: insetPx }}
      >
        {!imageFailed ? (
          <img
            src={imageSrc}
            alt={alt || name}
            className="max-h-full max-w-full object-contain object-bottom select-none"
            style={{ transform: `scale(${AVATAR_ICON.imageScale})`, transformOrigin: 'bottom center' }}
            loading="lazy"
            draggable={false}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ color: ringStyle.ringColor }}
          >
            <Icon name="user-circle" size={Math.max(sizePx * 0.55, 16)} weight="duotone" />
          </div>
        )}
      </div>
    </div>
  );
}

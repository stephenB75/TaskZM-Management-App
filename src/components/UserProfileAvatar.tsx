import React from 'react';
import { cn, getInitials } from '../lib/utils';
import {
  USER_PROFILE_AVATAR_RING_CLASS,
  USER_PROFILE_AVATAR_BG_CLASS,
  DEFAULT_AVATAR,
} from '../lib/avatar-constants';

interface UserProfileAvatarProps {
  src?: string;
  name: string;
  size?: string;
  fontSize?: string;
  className?: string;
  imageClassName?: string;
  showRing?: boolean;
  alt?: string;
}

export function UserProfileAvatar({
  src,
  name,
  size = '3rem',
  fontSize = '0.875rem',
  className,
  imageClassName,
  showRing = true,
  alt,
}: UserProfileAvatarProps) {
  const [imageSrc, setImageSrc] = React.useState<string | undefined>(src);
  const [showInitials, setShowInitials] = React.useState(false);

  React.useEffect(() => {
    setImageSrc(src);
    setShowInitials(false);
  }, [src]);

  const handleError = () => {
    if (imageSrc && imageSrc !== DEFAULT_AVATAR) {
      setImageSrc(DEFAULT_AVATAR);
      return;
    }
    setShowInitials(true);
  };

  return (
    <div
      className={cn(
        'relative flex-shrink-0 overflow-hidden rounded-full',
        USER_PROFILE_AVATAR_BG_CLASS,
        showRing && USER_PROFILE_AVATAR_RING_CLASS,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {!showInitials && imageSrc ? (
        <img
          src={imageSrc}
          alt={alt || name}
          className={cn('h-full w-full object-cover object-top', imageClassName)}
          loading="lazy"
          onError={handleError}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-semibold text-primary"
          style={{ fontSize }}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}

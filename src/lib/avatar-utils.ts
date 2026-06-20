import {
  AVATAR_ICON_PREFIX,
  AVATAR_ICONS,
  AVATAR_PRESET_PREFIX,
  DEFAULT_AVATAR,
  getAvatarIconById,
  getAvatarIconByPath,
  type AvatarGender,
  type AvatarIconOption,
} from './avatar-constants';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function isLegacyAvatarUrl(avatar?: string): boolean {
  if (!avatar) return false;
  return (
    avatar.includes('api.dicebear.com') ||
    avatar.includes('user_profiles') ||
    avatar.startsWith(AVATAR_PRESET_PREFIX)
  );
}

export function isAvatarIconPath(avatar?: string): boolean {
  if (!avatar) return false;
  return avatar.startsWith('/avatars/') || avatar.startsWith(AVATAR_ICON_PREFIX);
}

export function resolveAvatarIcon(avatar: string | undefined, seed: string): AvatarIconOption {
  if (avatar) {
    const byId = avatar.startsWith(AVATAR_ICON_PREFIX) ? getAvatarIconById(avatar) : undefined;
    if (byId) return byId;

    const byPath = getAvatarIconByPath(avatar);
    if (byPath) return byPath;

    if (avatar.includes('/avatars/')) {
      const normalized = avatar.startsWith('/') ? avatar : `/${avatar.replace(/^\//, '')}`;
      const match = getAvatarIconByPath(normalized);
      if (match) return match;
    }
  }

  const index = hashString(seed.toLowerCase()) % AVATAR_ICONS.length;
  return AVATAR_ICONS[index];
}

export function resolveAvatarIconIndex(avatar: string | undefined, seed: string): number {
  const icon = resolveAvatarIcon(avatar, seed);
  const index = AVATAR_ICONS.findIndex((entry) => entry.id === icon.id);
  return index >= 0 ? index : hashString(seed.toLowerCase()) % AVATAR_ICONS.length;
}

export function pickAvatarFromPool(seed: string, _gender?: AvatarGender): string {
  return resolveAvatarIcon(undefined, seed).path;
}

export function pickAvatarFromPoolAuto(seed: string): string {
  return pickAvatarFromPool(seed);
}

/** @deprecated Use resolveAvatarIcon + UserProfileAvatar instead */
export function getDiceBearAvatarUrl(seed: string, _gender?: AvatarGender): string {
  return pickAvatarFromPool(seed);
}

export function resolveUserAvatar(
  avatar: string | undefined,
  seed: string,
  _gender?: AvatarGender,
): string {
  if (avatar && isAvatarIconPath(avatar) && !isLegacyAvatarUrl(avatar)) {
    return resolveAvatarIcon(avatar, seed).path;
  }
  return resolveAvatarIcon(avatar, seed).path;
}

export function isDiceBearAvatar(avatar?: string): boolean {
  return Boolean(avatar?.includes('api.dicebear.com'));
}

export function getAvatarFallback(_avatar?: string): string {
  return DEFAULT_AVATAR;
}

/** @deprecated Use resolveAvatarIconIndex */
export function resolveAvatarPresetIndex(avatar: string | undefined, seed: string): number {
  return resolveAvatarIconIndex(avatar, seed);
}

/** @deprecated */
export function encodeAvatarPreset(index: number): string {
  const safeIndex = ((index % AVATAR_ICONS.length) + AVATAR_ICONS.length) % AVATAR_ICONS.length;
  return AVATAR_ICONS[safeIndex].path;
}

/** @deprecated */
export function parseAvatarPresetId(avatar?: string): string | null {
  if (!avatar) return null;
  if (avatar.startsWith(AVATAR_ICON_PREFIX)) return avatar;
  if (avatar.startsWith('/avatars/')) return avatar;
  return null;
}

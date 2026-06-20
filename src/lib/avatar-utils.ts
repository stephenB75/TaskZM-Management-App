import {
  AVATAR_ICON_PREFIX,
  AVATAR_PRESET_PREFIX,
  AVATAR_PRESETS,
  DEFAULT_AVATAR,
  getAvatarPresetById,
  type AvatarGender,
  type AvatarPreset,
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
    avatar.includes('/avatars/') ||
    avatar.includes('api.dicebear.com') ||
    avatar.includes('user_profiles') ||
    avatar.startsWith(AVATAR_ICON_PREFIX)
  );
}

export function parseAvatarPresetId(avatar?: string): string | null {
  if (!avatar) return null;
  if (!avatar.startsWith(AVATAR_PRESET_PREFIX)) return null;
  return getAvatarPresetById(avatar) ? avatar : null;
}

export function resolveAvatarPresetIndex(avatar: string | undefined, seed: string): number {
  const presetId = parseAvatarPresetId(avatar);
  if (presetId) {
    const index = AVATAR_PRESETS.findIndex((preset) => preset.id === presetId);
    if (index >= 0) return index;
  }
  const migrationSeed = avatar && isLegacyAvatarUrl(avatar) ? avatar : seed;
  return hashString(migrationSeed.toLowerCase()) % AVATAR_PRESETS.length;
}

export function resolveAvatarPreset(avatar: string | undefined, seed: string): AvatarPreset {
  return AVATAR_PRESETS[resolveAvatarPresetIndex(avatar, seed)];
}

export function encodeAvatarPreset(index: number): string {
  const safeIndex =
    ((index % AVATAR_PRESETS.length) + AVATAR_PRESETS.length) % AVATAR_PRESETS.length;
  return AVATAR_PRESETS[safeIndex].id;
}

export function pickAvatarFromPool(seed: string, _gender?: AvatarGender): string {
  return encodeAvatarPreset(hashString(seed.toLowerCase()) % AVATAR_PRESETS.length);
}

export function pickAvatarFromPoolAuto(seed: string): string {
  return pickAvatarFromPool(seed);
}

/** @deprecated Use resolveAvatarPreset + UserProfileAvatar instead */
export function getDiceBearAvatarUrl(seed: string, _gender?: AvatarGender): string {
  return pickAvatarFromPool(seed);
}

export function resolveUserAvatar(
  avatar: string | undefined,
  seed: string,
  _gender?: AvatarGender,
): string {
  const presetId = parseAvatarPresetId(avatar);
  if (presetId && getAvatarPresetById(presetId)) return presetId;
  if (avatar && !isLegacyAvatarUrl(avatar)) return avatar;
  return encodeAvatarPreset(hashString(seed.toLowerCase()) % AVATAR_PRESETS.length);
}

export function isDiceBearAvatar(avatar?: string): boolean {
  return Boolean(avatar?.includes('api.dicebear.com'));
}

export function getAvatarFallback(_avatar?: string): string {
  return DEFAULT_AVATAR;
}

/** @deprecated Use resolveAvatarPreset */
export function resolveAvatarIcon(avatar: string | undefined, seed: string): AvatarPreset {
  return resolveAvatarPreset(avatar, seed);
}

/** @deprecated Use resolveAvatarPresetIndex */
export function resolveAvatarIconIndex(avatar: string | undefined, seed: string): number {
  return resolveAvatarPresetIndex(avatar, seed);
}

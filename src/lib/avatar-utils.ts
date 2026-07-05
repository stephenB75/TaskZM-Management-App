import {
  AVATAR_ID_PREFIX,
  AVATAR_LEGACY_PREFIXES,
  AVATAR_PRESET_PREFIX,
  AVATAR_USERPICS_PREFIX,
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  getAvatarOptionById,
  type AvatarOption,
  type MultiavatarTheme,
} from './avatar-constants';
import { getAvatarSvgDataUrl } from './avatar-render';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function parseMultiavatarId(avatar: string): string | null {
  if (!avatar.startsWith(AVATAR_ID_PREFIX)) return null;
  return getAvatarOptionById(avatar) ? avatar : null;
}

function parseBundledAvatarIndex(avatar: string): number | null {
  for (const prefix of AVATAR_LEGACY_PREFIXES) {
    if (prefix === AVATAR_ID_PREFIX) continue;
    if (!avatar.startsWith(prefix)) continue;
    const suffix = avatar.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= AVATAR_OPTIONS.length) {
      return parsed - 1;
    }
  }
  return null;
}

export function isLegacyAvatarUrl(avatar?: string): boolean {
  if (!avatar) return false;
  if (avatar.startsWith(AVATAR_PRESET_PREFIX)) return true;
  if (parseMultiavatarId(avatar)) return false;
  if (parseBundledAvatarIndex(avatar) !== null) return true;
  return (
    avatar.includes('/avatars/') ||
    avatar.includes('api.dicebear.com') ||
    avatar.includes('user_profiles')
  );
}

export function parseAvatarId(avatar?: string): string | null {
  if (!avatar) return null;
  const multiavatarId = parseMultiavatarId(avatar);
  if (multiavatarId) return multiavatarId;
  const legacyIndex = parseBundledAvatarIndex(avatar);
  if (legacyIndex !== null) {
    return AVATAR_OPTIONS[legacyIndex % AVATAR_OPTIONS.length].id;
  }
  return null;
}

function migrateLegacyToIndex(avatar: string | undefined, seed: string): number {
  const bundledIndex = avatar ? parseBundledAvatarIndex(avatar) : null;
  if (bundledIndex !== null) return bundledIndex % AVATAR_OPTIONS.length;

  if (avatar?.startsWith(AVATAR_PRESET_PREFIX)) {
    const suffix = avatar.slice(AVATAR_PRESET_PREFIX.length);
    const parsed = Number.parseInt(suffix, 10);
    if (!Number.isNaN(parsed)) {
      return parsed % AVATAR_OPTIONS.length;
    }
  }

  if (avatar?.startsWith(AVATAR_USERPICS_PREFIX)) {
    const suffix = avatar.slice(AVATAR_USERPICS_PREFIX.length);
    const parsed = Number.parseInt(suffix, 10);
    if (!Number.isNaN(parsed)) {
      return (parsed - 1) % AVATAR_OPTIONS.length;
    }
  }

  const migrationSeed = avatar && isLegacyAvatarUrl(avatar) ? avatar : seed;
  return hashString(migrationSeed.toLowerCase()) % AVATAR_OPTIONS.length;
}

export function resolveAvatarOptionIndex(avatar: string | undefined, seed: string): number {
  const avatarId = parseAvatarId(avatar);
  if (avatarId) {
    const index = AVATAR_OPTIONS.findIndex((option) => option.id === avatarId);
    if (index >= 0) return index;
  }
  return migrateLegacyToIndex(avatar, seed);
}

export function resolveAvatarOption(avatar: string | undefined, seed: string): AvatarOption {
  return AVATAR_OPTIONS[resolveAvatarOptionIndex(avatar, seed)];
}

export function encodeAvatarOption(index: number): string {
  const safeIndex =
    ((index % AVATAR_OPTIONS.length) + AVATAR_OPTIONS.length) % AVATAR_OPTIONS.length;
  return AVATAR_OPTIONS[safeIndex].id;
}

export function pickAvatarFromPool(seed: string): string {
  const index = hashString(seed.toLowerCase()) % AVATAR_OPTIONS.length;
  return AVATAR_OPTIONS[index].id;
}

export function pickAvatarFromPoolAuto(seed: string): string {
  return pickAvatarFromPool(seed);
}

export function resolveUserAvatar(
  avatar: string | undefined,
  seed: string,
): string {
  const avatarId = parseAvatarId(avatar);
  if (avatarId && getAvatarOptionById(avatarId)) return avatarId;
  if (avatar && !isLegacyAvatarUrl(avatar)) return avatar;
  const index = migrateLegacyToIndex(avatar, seed) % AVATAR_OPTIONS.length;
  return AVATAR_OPTIONS[index].id;
}

export function isDiceBearAvatar(avatar?: string): boolean {
  return Boolean(avatar?.includes('api.dicebear.com'));
}

export function getAvatarFallback(_avatar?: string): string {
  return DEFAULT_AVATAR;
}

/** @deprecated Use resolveAvatarOption */
export function resolveAvatarPreset(avatar: string | undefined, seed: string): AvatarOption {
  return resolveAvatarOption(avatar, seed);
}

/** @deprecated Use resolveAvatarOptionIndex */
export function resolveAvatarPresetIndex(avatar: string | undefined, seed: string): number {
  return resolveAvatarOptionIndex(avatar, seed);
}

/** @deprecated Use parseAvatarId */
export function parseAvatarPresetId(avatar?: string): string | null {
  return parseAvatarId(avatar);
}

/** @deprecated Use resolveAvatarOption */
export function resolveAvatarIcon(avatar: string | undefined, seed: string): AvatarOption {
  return resolveAvatarOption(avatar, seed);
}

/** @deprecated Use resolveAvatarOptionIndex */
export function resolveAvatarIconIndex(avatar: string | undefined, seed: string): number {
  return resolveAvatarOptionIndex(avatar, seed);
}

/** @deprecated Use pickAvatarFromPool */
export function getDiceBearAvatarUrl(seed: string): string {
  return pickAvatarFromPool(seed);
}

export function getAvatarDisplayUrl(avatar: string | undefined, seed: string): string {
  const option = resolveAvatarOption(avatar, seed);
  return getAvatarSvgDataUrl(option);
}

/** @deprecated */
export type { MultiavatarTheme };

import {
  AVATAR_ACTIVE_PREFIXES,
  AVATAR_LEGACY_PREFIXES,
  AVATAR_MULTIAVATAR_PREFIX,
  AVATAR_PRESET_PREFIX,
  AVATAR_SEEDS_PER_STYLE,
  AVATAR_USERPICS_PREFIX,
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  getAvatarOptionById,
  getMultiavatarLegacyIndex,
  type AvatarOption,
  type MultiavatarLegacyTheme,
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

function normalizeBundledAvatarId(avatar: string, prefix: string): string | null {
  if (!avatar.startsWith(prefix)) return null;
  const suffix = avatar.slice(prefix.length);
  const parsed = Number.parseInt(suffix, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > AVATAR_SEEDS_PER_STYLE) {
    return null;
  }
  const slot = String(parsed).padStart(2, '0');
  return getAvatarOptionById(`${prefix}${slot}`)?.id ?? null;
}

function parseCurrentAvatarId(avatar: string): string | null {
  if (getAvatarOptionById(avatar)) return avatar;

  for (const prefix of AVATAR_ACTIVE_PREFIXES) {
    const normalized = normalizeBundledAvatarId(avatar, prefix);
    if (normalized) return normalized;
  }

  return null;
}

function parseLegacyBundledAvatarIndex(avatar: string): number | null {
  for (const prefix of AVATAR_LEGACY_PREFIXES) {
    if (AVATAR_ACTIVE_PREFIXES.includes(prefix as (typeof AVATAR_ACTIVE_PREFIXES)[number])) {
      continue;
    }
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
  if (parseCurrentAvatarId(avatar)) return false;
  if (parseLegacyBundledAvatarIndex(avatar) !== null) return true;
  return (
    avatar.includes('/avatars/') ||
    avatar.includes('api.dicebear.com') ||
    avatar.includes('user_profiles')
  );
}

export function parseAvatarId(avatar?: string): string | null {
  if (!avatar) return null;

  const currentId = parseCurrentAvatarId(avatar);
  if (currentId) return currentId;

  const legacyIndex = parseLegacyBundledAvatarIndex(avatar);
  if (legacyIndex !== null) {
    return AVATAR_OPTIONS[legacyIndex % AVATAR_OPTIONS.length].id;
  }

  if (avatar.startsWith(AVATAR_MULTIAVATAR_PREFIX)) {
    const body = avatar.slice(AVATAR_MULTIAVATAR_PREFIX.length);
    const [part, theme] = body.split(':') as [string, MultiavatarLegacyTheme];
    const legacyIndex = getMultiavatarLegacyIndex(part, theme);
    if (legacyIndex !== null) {
      return AVATAR_OPTIONS[legacyIndex % AVATAR_OPTIONS.length].id;
    }
  }

  return null;
}

function migrateLegacyToIndex(avatar: string | undefined, seed: string): number {
  const legacyIndex = avatar ? parseLegacyBundledAvatarIndex(avatar) : null;
  if (legacyIndex !== null) return legacyIndex % AVATAR_OPTIONS.length;

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
  if (!avatar) return false;
  if (parseCurrentAvatarId(avatar)) return true;
  return avatar.includes('api.dicebear.com');
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

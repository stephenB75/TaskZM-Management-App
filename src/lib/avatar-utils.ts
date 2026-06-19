import {
  AVATAR_PATHS,
  DEFAULT_AVATAR,
  DICEBEAR_STYLE,
  DICEBEAR_BACKGROUND_COLORS,
  type AvatarGender,
} from './avatar-constants';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDiceBearAvatarUrl(seed: string, gender?: AvatarGender): string {
  const params = new URLSearchParams({
    seed,
    backgroundColor: DICEBEAR_BACKGROUND_COLORS.join(','),
  });

  if (gender === 'male') {
    params.set('facialHairProbability', '40');
  } else if (gender === 'female') {
    params.set('facialHairProbability', '0');
  }

  return `https://api.dicebear.com/7.x/${DICEBEAR_STYLE}/svg?${params.toString()}`;
}

export function pickAvatarFromPool(seed: string, gender: AvatarGender = 'male'): string {
  const avatars = AVATAR_PATHS[gender];
  const index = hashString(seed.toLowerCase()) % avatars.length;
  return avatars[index];
}

export function pickAvatarFromPoolAuto(seed: string): string {
  const gender: AvatarGender = hashString(seed.toLowerCase()) % 2 === 0 ? 'male' : 'female';
  return pickAvatarFromPool(seed, gender);
}

export function resolveUserAvatar(
  avatar: string | undefined,
  seed: string,
  gender?: AvatarGender,
): string {
  if (avatar) return avatar;
  if (gender) return pickAvatarFromPool(seed, gender);
  return getDiceBearAvatarUrl(seed);
}

export function isDiceBearAvatar(avatar?: string): boolean {
  return Boolean(avatar?.includes('api.dicebear.com'));
}

export function getAvatarFallback(avatar?: string): string {
  return avatar || DEFAULT_AVATAR;
}

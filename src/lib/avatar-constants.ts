/**
 * Avatar Constants
 * Bundled Avataaars pack (DiceBear / Pablo Stanley) — flat colorful vector portraits.
 */

export const AVATAR_ID_PREFIX = 'taskzm:avataaars:';
/** @deprecated Lorelei pack */
export const AVATAR_LORELEI_PREFIX = 'taskzm:lorelei:';
/** @deprecated Notionists pack */
export const AVATAR_NOTIONISTS_PREFIX = 'taskzm:notionists:';
/** @deprecated Icon-based pastel presets */
export const AVATAR_PRESET_PREFIX = 'taskzm:pastel-';
/** @deprecated Portrait PNG avatars */
export const AVATAR_ICON_PREFIX = 'taskzm:icon:';

export const AVATAR_PACK = {
  id: 'avataaars',
  name: 'Avataaars',
  license: 'Free for personal and commercial use',
  sourceUrl: 'https://avataaars.com/',
  credit: 'Avataaars by Pablo Stanley (via DiceBear)',
  publicPath: '/avatars/avataaars',
} as const;

export const AVATAR_COUNT = 24;

/** @deprecated Gender is no longer used for avatar selection */
export type AvatarGender = 'male' | 'female';

export interface AvatarOption {
  id: string;
  label: string;
  file: string;
}

export const AVATAR_OPTIONS: readonly AvatarOption[] = Array.from(
  { length: AVATAR_COUNT },
  (_, index) => {
    const file = `${String(index + 1).padStart(2, '0')}.svg`;
    return {
      id: `${AVATAR_ID_PREFIX}${file.replace('.svg', '')}`,
      label: `Profile ${index + 1}`,
      file,
    };
  },
);

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0].id;

export const AVATAR_SELECTION_GRID_COLS = 6;
export const AVATAR_SELECTION_SIZE = '72px';
export const AVATAR_SELECTION_GAP = '0.625rem';

export const AVATAR_UI_TEXT = {
  chooseYourAvatar: 'Choose Your Avatar',
  chooseAvatar: 'Choose Avatar',
  selectYourAvatar: 'Select Your Avatar',
  selectAvatarDescription: 'Pick a flat vector profile avatar',
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar',
  packCredit: `${AVATAR_PACK.credit}`,
} as const;

export const AVATAR_CHECKMARK_SIZE = '1.5rem';
export const AVATAR_CHECKMARK_ICON_SIZE = '1rem';

export const USER_PROFILE_AVATAR_RING_CLASS =
  'ring-2 ring-background/80 ring-offset-2 ring-offset-card shadow-md';
export const USER_PROFILE_AVATAR_BG_CLASS = 'bg-muted/30';

/** @deprecated Use AVATAR_OPTIONS */
export const AVATAR_PRESETS = AVATAR_OPTIONS;

export function getAvatarOptionById(id: string): AvatarOption | undefined {
  return AVATAR_OPTIONS.find((option) => option.id === id);
}

export function getAvatarImageUrl(option: AvatarOption): string {
  return `${AVATAR_PACK.publicPath}/${option.file}`;
}

export function getAvatarOptionIndex(option: AvatarOption): number {
  return AVATAR_OPTIONS.findIndex((entry) => entry.id === option.id);
}

/** @deprecated */
export function getAvatarPresetById(id: string): AvatarOption | undefined {
  return getAvatarOptionById(id);
}

/** @deprecated */
export function getAvatarPresetIndex(option: AvatarOption): number {
  return getAvatarOptionIndex(option);
}

/** All bundled pack ID prefixes — used for legacy migration by slot index. */
export const AVATAR_LEGACY_PREFIXES = [
  AVATAR_ID_PREFIX,
  AVATAR_LORELEI_PREFIX,
  AVATAR_NOTIONISTS_PREFIX,
] as const;

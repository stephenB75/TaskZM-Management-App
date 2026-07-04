/**
 * Avatar Constants
 * Craftwork Userpics — diverse flat vector portraits (free commercial use).
 * https://userpics.craftwork.design/
 */

export const AVATAR_ID_PREFIX = 'taskzm:userpics:';
/** @deprecated Avataaars pack */
export const AVATAR_AVATAAARS_PREFIX = 'taskzm:avataaars:';
/** @deprecated Micah pack */
export const AVATAR_MICAH_PREFIX = 'taskzm:micah:';
/** @deprecated Lorelei pack */
export const AVATAR_LORELEI_PREFIX = 'taskzm:lorelei:';
/** @deprecated Notionists pack */
export const AVATAR_NOTIONISTS_PREFIX = 'taskzm:notionists:';
/** @deprecated Icon-based pastel presets */
export const AVATAR_PRESET_PREFIX = 'taskzm:pastel-';
/** @deprecated Portrait PNG avatars */
export const AVATAR_ICON_PREFIX = 'taskzm:icon:';

export const AVATAR_PACK = {
  id: 'userpics',
  name: 'Userpics',
  license: 'Free commercial use (Craftwork)',
  sourceUrl: 'https://userpics.craftwork.design/',
  credit: 'Userpics by Craftwork',
  publicPath: '/avatars/userpics',
  fileExtension: 'png',
} as const;

export const AVATAR_COUNT = 30;

/** Bump when avatar PNGs change so browsers drop stale collage caches */
export const AVATAR_ASSET_VERSION = '2';

export const AVATAR_RENDER_SIZE = 256;

export type AvatarGender = 'male' | 'female';

export const DEFAULT_AVATAR_GENDER: AvatarGender = 'male';

/** Gender tags for Craftwork s-5-img-1 … s-5-img-30 single portraits */
const USERPICS_GENDERS: readonly AvatarGender[] = [
  'male',
  'male',
  'female',
  'female',
  'female',
  'female',
  'male',
  'male',
  'male',
  'female',
  'female',
  'male',
  'male',
  'male',
  'female',
  'male',
  'male',
  'female',
  'female',
  'female',
  'female',
  'male',
  'male',
  'male',
  'female',
  'female',
  'male',
  'female',
  'male',
  'female',
] as const;

export interface AvatarOption {
  id: string;
  label: string;
  file: string;
  gender: AvatarGender;
}

export const AVATAR_OPTIONS: readonly AvatarOption[] = Array.from(
  { length: AVATAR_COUNT },
  (_, index) => {
    const file = `${String(index + 1).padStart(2, '0')}.${AVATAR_PACK.fileExtension}`;
    return {
      id: `${AVATAR_ID_PREFIX}${file.replace(`.${AVATAR_PACK.fileExtension}`, '')}`,
      label: `Profile ${index + 1}`,
      file,
      gender: USERPICS_GENDERS[index],
    };
  },
);

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0].id;

export const AVATAR_SELECTION_GRID_COLS = 5;
export const AVATAR_SELECTION_SIZE = '72px';
export const AVATAR_SELECTION_GAP = '0.5rem';
/** Zoom past square letterboxing so circular masks show one face */
export const AVATAR_SELECTION_IMAGE_SCALE = 1.12;
export const AVATAR_DISPLAY_IMAGE_SCALE = 1.1;

export const AVATAR_SELECTION_RING_CLASS = 'shadow-sm';
export const AVATAR_SELECTION_SELECTED_CLASS =
  'border-primary ring-2 ring-primary ring-offset-1 ring-offset-background';
export const AVATAR_SELECTION_UNSELECTED_CLASS =
  'border-border/60 hover:border-primary/50';

export const AVATAR_UI_TEXT = {
  chooseYourAvatar: 'Choose Your Avatar',
  chooseAvatar: 'Choose Avatar',
  selectYourAvatar: 'Select Your Avatar',
  selectAvatarDescription: 'Pick a profile character that fits you',
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar',
  packCredit: `${AVATAR_PACK.credit} · ${AVATAR_PACK.license}`,
  male: 'Male',
  female: 'Female',
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

export function getAvatarOptionsByGender(gender: AvatarGender): readonly AvatarOption[] {
  return AVATAR_OPTIONS.filter((option) => option.gender === gender);
}

export function getAvatarImageUrl(option: AvatarOption): string {
  return `${AVATAR_PACK.publicPath}/${option.file}?v=${AVATAR_ASSET_VERSION}`;
}

export function getAvatarOptionIndex(option: AvatarOption): number {
  return AVATAR_OPTIONS.findIndex((entry) => entry.id === option.id);
}

export function getAvatarGenderById(id: string): AvatarGender | undefined {
  return getAvatarOptionById(id)?.gender;
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
  AVATAR_AVATAAARS_PREFIX,
  AVATAR_MICAH_PREFIX,
  AVATAR_LORELEI_PREFIX,
  AVATAR_NOTIONISTS_PREFIX,
] as const;

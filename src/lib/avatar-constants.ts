/**
 * Avatar Constants
 * Multiavatar — multicultural SVG avatars (free commercial use in apps).
 * https://multiavatar.com
 */

export const AVATAR_ID_PREFIX = 'taskzm:multiavatar:';
/** @deprecated Craftwork Userpics PNG pack */
export const AVATAR_USERPICS_PREFIX = 'taskzm:userpics:';
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

export type MultiavatarTheme = 'A' | 'B';

export const AVATAR_PACK = {
  id: 'multiavatar',
  name: 'Multiavatar',
  license: 'Multiavatar License v1.0 (free in apps)',
  sourceUrl: 'https://multiavatar.com/',
  credit: 'Avatars by Multiavatar',
} as const;

export type AvatarGender = 'male' | 'female';

export const DEFAULT_AVATAR_GENDER: AvatarGender = 'male';

/**
 * Sixteen multicultural base characters (00–15), each with two color themes.
 * Gender tags group picker tabs; parts are Netguru/Multiavatar inclusive designs.
 */
const MULTIAVATAR_PART_GENDERS: readonly AvatarGender[] = [
  'female',
  'male',
  'female',
  'male',
  'female',
  'male',
  'female',
  'male',
  'female',
  'male',
  'female',
  'male',
  'female',
  'male',
  'female',
  'male',
] as const;

const MULTIAVATAR_PARTS = Array.from({ length: 16 }, (_, index) =>
  String(index).padStart(2, '0'),
);

const MULTIAVATAR_THEMES: readonly MultiavatarTheme[] = ['A', 'B'];

export interface AvatarOption {
  id: string;
  label: string;
  part: string;
  theme: MultiavatarTheme;
  gender: AvatarGender;
}

export const AVATAR_OPTIONS: readonly AvatarOption[] = MULTIAVATAR_PARTS.flatMap(
  (part, partIndex) =>
    MULTIAVATAR_THEMES.map((theme) => ({
      id: `${AVATAR_ID_PREFIX}${part}:${theme}`,
      label: `Profile ${part}${theme}`,
      part,
      theme,
      gender: MULTIAVATAR_PART_GENDERS[partIndex],
    })),
);

export const AVATAR_COUNT = AVATAR_OPTIONS.length;

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0].id;

export const AVATAR_SELECTION_GRID_COLS = 4;
/** Max avatar cell size on large screens; grid shrinks cells on narrow viewports */
export const AVATAR_SELECTION_MAX_CELL_SIZE = '4.5rem';
export const AVATAR_SELECTION_GAP = '0.5rem';
export const AVATAR_SELECTION_PANEL_PADDING = '0.5rem';
export const AVATAR_SELECTION_PANEL_PADDING_DESKTOP = '0.75rem';
/** Scrollable grid area inside dialogs on small screens (4 rows of avatars) */
export const AVATAR_SELECTION_GRID_MAX_HEIGHT = 'min(17rem, 45dvh)';

export const AVATAR_SELECTION_DIALOG_CLASS =
  'flex max-h-[calc(var(--viewport-height,100dvh)-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] max-w-[calc(100%-1rem)] flex-col gap-4 overflow-hidden sm:max-w-lg';
export const AVATAR_SELECTION_DIALOG_BODY_CLASS =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain';
export const AVATAR_SELECTION_DIALOG_FOOTER_CLASS =
  'flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end';

export const AVATAR_SELECTION_RING_CLASS = 'shadow-sm';
export const AVATAR_SELECTION_SELECTED_CLASS =
  'border-primary ring-2 ring-primary ring-offset-1 ring-offset-background';
export const AVATAR_SELECTION_UNSELECTED_CLASS =
  'border-border/60 hover:border-primary/50';

export const AVATAR_UI_TEXT = {
  chooseYourAvatar: 'Choose Your Avatar',
  chooseAvatar: 'Choose Avatar',
  selectYourAvatar: 'Select Your Avatar',
  selectAvatarDescription: 'Pick a profile character that represents you',
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar',
  packCredit: `${AVATAR_PACK.credit} · Multicultural avatar maker`,
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

export function getAvatarOptionIndex(option: AvatarOption): number {
  return AVATAR_OPTIONS.findIndex((entry) => entry.id === option.id);
}

export function getAvatarGenderById(id: string): AvatarGender | undefined {
  return getAvatarOptionById(id)?.gender;
}

/** @deprecated Use getAvatarSvgDataUrl from avatar-render.ts */
export function getAvatarImageUrl(option: AvatarOption): string {
  return `${AVATAR_ID_PREFIX}${option.part}:${option.theme}`;
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
  AVATAR_USERPICS_PREFIX,
  AVATAR_AVATAAARS_PREFIX,
  AVATAR_MICAH_PREFIX,
  AVATAR_LORELEI_PREFIX,
  AVATAR_NOTIONISTS_PREFIX,
] as const;

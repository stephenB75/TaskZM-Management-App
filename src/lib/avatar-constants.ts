/**
 * Avatar Constants
 * User portrait icons in public/avatars/ on pastel rings — aligned with TaskZM brand.
 */

import {
  COLOR_PRIMARY,
  COLOR_PRIMARY_DARK,
  COLOR_PRIMARY_LIGHT,
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_LAVENDER_DARK,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_MINT_DARK,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_SKY_DARK,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_PINK,
  COLOR_PASTEL_SAGE,
  COLOR_PASTEL_SAGE_BORDER,
  COLOR_PASTEL_YELLOW,
} from './color-theme';

export type AvatarGender = 'male' | 'female';

export const AVATAR_PRESET_PREFIX = 'taskzm:pastel-';
export const AVATAR_ICON_PREFIX = 'taskzm:icon:';

export interface AvatarRingStyle {
  gradientFrom: string;
  gradientTo: string;
  ringColor: string;
}

export interface AvatarIconOption {
  id: string;
  path: string;
  label: string;
}

const MALE_AVATAR_COUNT = 10;
const FEMALE_AVATAR_COUNT = 14;

function buildAvatarIconOptions(): readonly AvatarIconOption[] {
  const options: AvatarIconOption[] = [];
  for (let index = 1; index <= MALE_AVATAR_COUNT; index += 1) {
    options.push({
      id: `${AVATAR_ICON_PREFIX}male-${index}`,
      path: `/avatars/male-${index}.png`,
      label: `Profile ${index}`,
    });
  }
  for (let index = 1; index <= FEMALE_AVATAR_COUNT; index += 1) {
    options.push({
      id: `${AVATAR_ICON_PREFIX}female-${index}`,
      path: `/avatars/female-${index}.png`,
      label: `Profile ${MALE_AVATAR_COUNT + index}`,
    });
  }
  return options;
}

export const AVATAR_ICONS = buildAvatarIconOptions();

/** Pastel ring backgrounds — cycled by avatar index for visual variety. */
export const AVATAR_RING_STYLES: readonly AvatarRingStyle[] = [
  { gradientFrom: COLOR_PASTEL_LAVENDER, gradientTo: COLOR_PRIMARY_LIGHT, ringColor: COLOR_PRIMARY_DARK },
  { gradientFrom: COLOR_PASTEL_MINT, gradientTo: COLOR_PASTEL_SKY, ringColor: COLOR_PASTEL_MINT_DARK },
  { gradientFrom: COLOR_PASTEL_PEACH, gradientTo: COLOR_PASTEL_PINK, ringColor: COLOR_PASTEL_LAVENDER_DARK },
  { gradientFrom: COLOR_PASTEL_SKY, gradientTo: COLOR_PASTEL_LILAC, ringColor: COLOR_PASTEL_SKY_DARK },
  { gradientFrom: COLOR_PASTEL_SAGE, gradientTo: COLOR_PASTEL_MINT, ringColor: COLOR_PASTEL_SAGE_BORDER },
  { gradientFrom: COLOR_PASTEL_YELLOW, gradientTo: COLOR_PASTEL_PEACH, ringColor: COLOR_PASTEL_SKY_DARK },
  { gradientFrom: COLOR_PRIMARY_LIGHT, gradientTo: COLOR_PRIMARY, ringColor: COLOR_PRIMARY_DARK },
  { gradientFrom: COLOR_PASTEL_PINK, gradientTo: COLOR_PASTEL_LAVENDER, ringColor: COLOR_PASTEL_LAVENDER_DARK },
] as const;

/** @deprecated Use AVATAR_ICONS */
export const AVATAR_PATHS = {
  male: AVATAR_ICONS.filter((icon) => icon.path.includes('/male-')).map((icon) => icon.path),
  female: AVATAR_ICONS.filter((icon) => icon.path.includes('/female-')).map((icon) => icon.path),
} as const;

export const DEFAULT_AVATAR = AVATAR_ICONS[0]?.path ?? '/avatars/male-1.png';

export const AVATAR_SELECTION_GRID_COLS = 4;
export const AVATAR_SELECTION_SIZE = '72px';
export const AVATAR_SELECTION_GAP = '0.625rem';

export const AVATAR_UI_TEXT = {
  chooseYourAvatar: 'Choose Your Avatar',
  chooseAvatar: 'Choose Avatar',
  selectYourAvatar: 'Select Your Avatar',
  selectAvatarDescription: 'Pick a profile icon that represents you',
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar',
} as const;

export const AVATAR_CHECKMARK_SIZE = '1.5rem';
export const AVATAR_CHECKMARK_ICON_SIZE = '1rem';

export const AVATAR_ICON = {
  /** Portrait inset from circle edge (percent of diameter). */
  imageInsetPercent: 8,
  imageScale: 1.08,
} as const;

export const USER_PROFILE_AVATAR_RING_CLASS =
  'ring-2 ring-background/80 ring-offset-2 ring-offset-card shadow-sm';
export const USER_PROFILE_AVATAR_BG_CLASS = 'bg-card';

export function getAvatarIconById(id: string): AvatarIconOption | undefined {
  return AVATAR_ICONS.find((icon) => icon.id === id);
}

export function getAvatarIconByPath(path: string): AvatarIconOption | undefined {
  return AVATAR_ICONS.find((icon) => icon.path === path);
}

export function getAvatarRingStyle(index: number): AvatarRingStyle {
  const safeIndex =
    ((index % AVATAR_RING_STYLES.length) + AVATAR_RING_STYLES.length) %
    AVATAR_RING_STYLES.length;
  return AVATAR_RING_STYLES[safeIndex];
}

export function getAvatarIconIndex(icon: AvatarIconOption): number {
  return AVATAR_ICONS.findIndex((entry) => entry.id === icon.id);
}

/** @deprecated Pastel-only presets — use AVATAR_ICONS */
export interface AvatarPresetStyle {
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
}

/** @deprecated */
export interface AvatarPreset {
  id: string;
  label: string;
  light: AvatarPresetStyle;
  dark: AvatarPresetStyle;
}

/** @deprecated */
export const AVATAR_PRESETS: readonly AvatarPreset[] = [] as const;

/** @deprecated */
export function getAvatarPresetById(_id: string): AvatarPreset | undefined {
  return undefined;
}

/** @deprecated */
export function getAvatarPresetStyles(preset: AvatarPreset, _isDark: boolean): AvatarPresetStyle {
  return preset.light;
}

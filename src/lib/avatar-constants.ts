/**
 * Avatar Constants
 * Phosphor user icons on pastel gradient circles — aligned with TaskZM brand.
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
/** @deprecated Portrait PNG avatars */
export const AVATAR_ICON_PREFIX = 'taskzm:icon:';

export interface AvatarPresetStyle {
  gradientFrom: string;
  gradientTo: string;
  iconColor: string;
}

export interface AvatarPreset {
  id: string;
  label: string;
  icon: string;
  style: AvatarPresetStyle;
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  {
    id: `${AVATAR_PRESET_PREFIX}0`,
    label: 'Lavender',
    icon: 'user-circle',
    style: {
      gradientFrom: COLOR_PASTEL_LAVENDER,
      gradientTo: COLOR_PRIMARY_LIGHT,
      iconColor: COLOR_PRIMARY_DARK,
    },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}1`,
    label: 'Mint',
    icon: 'user',
    style: {
      gradientFrom: COLOR_PASTEL_MINT,
      gradientTo: COLOR_PASTEL_SKY,
      iconColor: COLOR_PASTEL_MINT_DARK,
    },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}2`,
    label: 'Peach',
    icon: 'user-plus',
    style: {
      gradientFrom: COLOR_PASTEL_PEACH,
      gradientTo: COLOR_PASTEL_PINK,
      iconColor: COLOR_PASTEL_LAVENDER_DARK,
    },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}3`,
    label: 'Sky',
    icon: 'users',
    style: {
      gradientFrom: COLOR_PASTEL_SKY,
      gradientTo: COLOR_PASTEL_LILAC,
      iconColor: COLOR_PASTEL_SKY_DARK,
    },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}4`,
    label: 'Sage',
    icon: 'user-three',
    style: {
      gradientFrom: COLOR_PASTEL_SAGE,
      gradientTo: COLOR_PASTEL_MINT,
      iconColor: COLOR_PASTEL_SAGE_BORDER,
    },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}5`,
    label: 'Sunrise',
    icon: 'user-circle',
    style: {
      gradientFrom: COLOR_PASTEL_YELLOW,
      gradientTo: COLOR_PASTEL_PEACH,
      iconColor: COLOR_PASTEL_SKY_DARK,
    },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}6`,
    label: 'Violet',
    icon: 'user',
    style: {
      gradientFrom: COLOR_PRIMARY_LIGHT,
      gradientTo: COLOR_PRIMARY,
      iconColor: COLOR_PRIMARY_DARK,
    },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}7`,
    label: 'Rose',
    icon: 'user-plus',
    style: {
      gradientFrom: COLOR_PASTEL_PINK,
      gradientTo: COLOR_PASTEL_LAVENDER,
      iconColor: COLOR_PASTEL_LAVENDER_DARK,
    },
  },
] as const;

/** @deprecated Portrait PNG pool */
export const AVATAR_PATHS = { male: [] as string[], female: [] as string[] } as const;

export const DEFAULT_AVATAR = AVATAR_PRESETS[0].id;

export const AVATAR_SELECTION_GRID_COLS = 4;
export const AVATAR_SELECTION_SIZE = '72px';
export const AVATAR_SELECTION_GAP = '0.625rem';

export const AVATAR_UI_TEXT = {
  chooseYourAvatar: 'Choose Your Avatar',
  chooseAvatar: 'Choose Avatar',
  selectYourAvatar: 'Select Your Avatar',
  selectAvatarDescription: 'Pick a profile icon and color',
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar',
} as const;

export const AVATAR_CHECKMARK_SIZE = '1.5rem';
export const AVATAR_CHECKMARK_ICON_SIZE = '1rem';

export const AVATAR_ICON = {
  /** Icon size as a ratio of avatar diameter. */
  iconScaleRatio: 0.46,
} as const;

export const USER_PROFILE_AVATAR_RING_CLASS =
  'ring-2 ring-background/80 ring-offset-2 ring-offset-card shadow-sm';
export const USER_PROFILE_AVATAR_BG_CLASS = 'bg-card';

export function getAvatarPresetById(id: string): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((preset) => preset.id === id);
}

export function getAvatarPresetStyles(preset: AvatarPreset, _isDark: boolean): AvatarPresetStyle {
  return preset.style;
}

export function getAvatarPresetIndex(preset: AvatarPreset): number {
  return AVATAR_PRESETS.findIndex((entry) => entry.id === preset.id);
}

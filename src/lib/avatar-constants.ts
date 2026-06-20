/**
 * Avatar Constants
 * Pastel gradient initials — aligned with TaskZM brand colors (no illustration PNGs).
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
  COLOR_PASTEL_YELLOW,
  COLOR_TEXT_WHITE,
} from './color-theme';

export type AvatarGender = 'male' | 'female';

export const AVATAR_PRESET_PREFIX = 'taskzm:pastel-';

export interface AvatarPresetStyle {
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
}

export interface AvatarPreset {
  id: string;
  label: string;
  light: AvatarPresetStyle;
  dark: AvatarPresetStyle;
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  {
    id: `${AVATAR_PRESET_PREFIX}0`,
    label: 'Lavender',
    light: { gradientFrom: COLOR_PASTEL_LAVENDER, gradientTo: COLOR_PRIMARY_LIGHT, textColor: COLOR_PRIMARY_DARK },
    dark: { gradientFrom: '#4A3F5C', gradientTo: '#5C4A7A', textColor: COLOR_PASTEL_LAVENDER },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}1`,
    label: 'Mint',
    light: { gradientFrom: COLOR_PASTEL_MINT, gradientTo: COLOR_PASTEL_SKY, textColor: COLOR_PASTEL_MINT_DARK },
    dark: { gradientFrom: '#3A5A4F', gradientTo: '#4A6A7A', textColor: COLOR_PASTEL_MINT },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}2`,
    label: 'Peach',
    light: { gradientFrom: COLOR_PASTEL_PEACH, gradientTo: COLOR_PASTEL_PINK, textColor: '#9A5A4A' },
    dark: { gradientFrom: '#6A4A3A', gradientTo: '#7A5A5A', textColor: COLOR_PASTEL_PEACH },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}3`,
    label: 'Sky',
    light: { gradientFrom: COLOR_PASTEL_SKY, gradientTo: COLOR_PASTEL_LILAC, textColor: COLOR_PASTEL_SKY_DARK },
    dark: { gradientFrom: '#3A4A6A', gradientTo: '#4A5A7A', textColor: COLOR_PASTEL_SKY },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}4`,
    label: 'Sage',
    light: { gradientFrom: COLOR_PASTEL_SAGE, gradientTo: COLOR_PASTEL_MINT, textColor: '#4A6A4A' },
    dark: { gradientFrom: '#3A5A3A', gradientTo: '#4A6A5A', textColor: COLOR_PASTEL_SAGE },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}5`,
    label: 'Sun',
    light: { gradientFrom: COLOR_PASTEL_YELLOW, gradientTo: COLOR_PASTEL_PEACH, textColor: '#8A6A2A' },
    dark: { gradientFrom: '#5A4A2A', gradientTo: '#6A5A3A', textColor: COLOR_PASTEL_YELLOW },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}6`,
    label: 'Brand',
    light: { gradientFrom: COLOR_PRIMARY_LIGHT, gradientTo: COLOR_PRIMARY, textColor: COLOR_TEXT_WHITE },
    dark: { gradientFrom: COLOR_PRIMARY_DARK, gradientTo: COLOR_PRIMARY, textColor: COLOR_TEXT_WHITE },
  },
  {
    id: `${AVATAR_PRESET_PREFIX}7`,
    label: 'Blush',
    light: { gradientFrom: COLOR_PASTEL_PINK, gradientTo: COLOR_PASTEL_LAVENDER, textColor: '#7A4A6A' },
    dark: { gradientFrom: '#5A3A4A', gradientTo: '#6A4A5A', textColor: COLOR_PASTEL_PINK },
  },
] as const;

/** @deprecated Illustration paths — kept for legacy avatar value detection only */
export const AVATAR_PATHS = {
  male: [] as readonly string[],
  female: [] as readonly string[],
} as const;

export const DEFAULT_AVATAR = AVATAR_PRESETS[0].id;

export const AVATAR_SELECTION_GRID_COLS = 4;
export const AVATAR_SELECTION_SIZE = '72px';
export const AVATAR_SELECTION_GAP = '0.625rem';

export const AVATAR_UI_TEXT = {
  chooseYourAvatar: 'Choose Your Color',
  chooseAvatar: 'Avatar Color',
  selectYourAvatar: 'Select Your Avatar',
  selectAvatarDescription: 'Pick a pastel color — your initials appear on every profile',
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar color',
} as const;

export const AVATAR_CHECKMARK_SIZE = '1.5rem';
export const AVATAR_CHECKMARK_ICON_SIZE = '1rem';

export const USER_PROFILE_AVATAR_RING_CLASS =
  'ring-2 ring-background/80 ring-offset-2 ring-offset-card shadow-sm';
export const USER_PROFILE_AVATAR_BG_CLASS = 'bg-card';

export function getAvatarPresetById(id: string): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((preset) => preset.id === id);
}

export function getAvatarPresetStyles(
  preset: AvatarPreset,
  isDark: boolean,
): AvatarPresetStyle {
  return isDark ? preset.dark : preset.light;
}

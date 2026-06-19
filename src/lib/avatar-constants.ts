/**
 * Avatar Constants
 * Processed PNG illustrations live in public/avatars/ (generated via scripts/process-user-profiles.mjs).
 */

export type AvatarGender = 'male' | 'female';

const maleAvatarCount = 10;
const femaleAvatarCount = 14;

function buildPublicAvatarPaths(gender: AvatarGender, count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) => `/avatars/${gender}-${index + 1}.png`);
}

export const AVATAR_PATHS = {
  male: buildPublicAvatarPaths('male', maleAvatarCount),
  female: buildPublicAvatarPaths('female', femaleAvatarCount),
} as const;

export const DICEBEAR_STYLE = 'notionists';
export const DICEBEAR_BACKGROUND_COLORS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'] as const;

export const DEFAULT_AVATAR = `https://api.dicebear.com/7.x/${DICEBEAR_STYLE}/svg?seed=default&backgroundColor=${DICEBEAR_BACKGROUND_COLORS[0]}`;

export const AVATAR_SELECTION_GRID_COLS = 4;
export const AVATAR_SELECTION_SIZE = '72px';
export const AVATAR_SELECTION_GAP = '0.625rem';

export const AVATAR_UI_TEXT = {
  selectGender: 'Select Gender',
  chooseYourAvatar: 'Choose Your Avatar',
  chooseAvatar: 'Choose Avatar',
  selectYourAvatar: 'Select Your Avatar',
  selectAvatarDescription: 'Pick a portrait that represents you',
  male: 'Male',
  female: 'Female',
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  gender: 'Gender',
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar',
  defaultGender: 'male' as const,
} as const;

export const AVATAR_CHECKMARK_SIZE = '1.5rem';
export const AVATAR_CHECKMARK_ICON_SIZE = '1rem';

export const USER_PROFILE_AVATAR_RING_CLASS = 'ring-2 ring-background ring-offset-2 ring-offset-card';
export const USER_PROFILE_AVATAR_BG_CLASS = 'bg-gradient-to-br from-muted to-muted/60 dark:from-muted/80 dark:to-muted/40';

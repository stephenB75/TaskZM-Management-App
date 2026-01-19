/**
 * Avatar Constants
 * Contains paths to cropped avatar illustrations
 * These should be placed in public/avatars/ directory (for Vite, files in public/ are served at root)
 */

// Avatar paths - organized by gender
// Note: These paths assume avatars are in public/avatars/ directory
// When you add the cropped images, name them: male-1.svg through male-6.svg and female-1.svg through female-6.svg
export const AVATAR_PATHS = {
  male: [
    '/avatars/male-1.svg',
    '/avatars/male-2.svg',
    '/avatars/male-3.svg',
    '/avatars/male-4.svg',
    '/avatars/male-5.svg',
    '/avatars/male-6.svg',
  ],
  female: [
    '/avatars/female-1.svg',
    '/avatars/female-2.svg',
    '/avatars/female-3.svg',
    '/avatars/female-4.svg',
    '/avatars/female-5.svg',
    '/avatars/female-6.svg',
  ],
} as const;

// Default avatar (fallback) - uses DiceBear as fallback
export const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/lorelei/svg?seed=default&backgroundColor=e5e7eb&hairColor=000000&skinColor=fdbcb4&clothingColor=262e33';

// Avatar selection constants
export const AVATAR_SELECTION_GRID_COLS = 3; // Number of columns in avatar grid
export const AVATAR_SELECTION_SIZE = '80px'; // Size of avatar in selection grid
export const AVATAR_SELECTION_GAP = '0.75rem'; // gap-3 = 0.75rem (12px)

// Avatar selection UI text
export const AVATAR_UI_TEXT = {
  selectGender: 'Select Gender',
  chooseYourAvatar: 'Choose Your Avatar',
  chooseAvatar: 'Choose Avatar',
  selectYourAvatar: 'Select Your Avatar',
  selectAvatarDescription: 'Choose a profile picture that represents you',
  male: 'Male',
  female: 'Female',
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  gender: 'Gender',
} as const;

// Avatar selection icon sizes
export const AVATAR_CHECKMARK_SIZE = '1.5rem'; // w-6 h-6 = 1.5rem (24px)
export const AVATAR_CHECKMARK_ICON_SIZE = '1rem'; // w-4 h-4 = 1rem (16px)

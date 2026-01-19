/**
 * Avatar Constants
 * Contains paths to cropped avatar illustrations
 * These should be placed in public/avatars/ directory (for Vite, files in public/ are served at root)
 */

// Avatar paths - organized by gender
// Note: These paths assume avatars are in public/avatars/ directory
// Avatar files are PNG format, processed from user profile images
// All avatars have white background removed, converted to black & white, and cleaned
export const AVATAR_PATHS = {
  male: [
    '/avatars/male-1.png',
    '/avatars/male-2.png',
    '/avatars/male-3.png',
    '/avatars/male-4.png',
    '/avatars/male-5.png',
    '/avatars/male-6.png',
  ],
  female: [
    '/avatars/female-1.png',
    '/avatars/female-2.png',
    '/avatars/female-3.png',
    '/avatars/female-4.png',
    '/avatars/female-5.png',
    '/avatars/female-6.png',
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
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar',
  defaultGender: 'male' as const,
} as const;

// Avatar selection icon sizes
export const AVATAR_CHECKMARK_SIZE = '1.5rem'; // w-6 h-6 = 1.5rem (24px)
export const AVATAR_CHECKMARK_ICON_SIZE = '1rem'; // w-4 h-4 = 1rem (16px)

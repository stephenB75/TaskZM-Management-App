/**
 * Avatar Constants
 * Contains paths to cropped avatar illustrations
 * These should be placed in public/avatars/ directory (for Vite, files in public/ are served at root)
 */

// Avatar imports - importing color JPG avatars from assets
import male1 from '../assets/user_profiles/male_1.jpg';
import male2 from '../assets/user_profiles/male_2.jpg';
import male3 from '../assets/user_profiles/male_3.jpg';
import male4 from '../assets/user_profiles/Male_4.jpg';
import male5 from '../assets/user_profiles/male_5.jpg';
import male6 from '../assets/user_profiles/male_6.jpg';
import male7 from '../assets/user_profiles/male_7.jpg';
import male8 from '../assets/user_profiles/male_8.jpg';
import male9 from '../assets/user_profiles/male_9.jpg';
import male10 from '../assets/user_profiles/male_10.jpg';

import female1 from '../assets/user_profiles/Female_1.jpg';
import female2 from '../assets/user_profiles/Female_2.jpg';
import female3 from '../assets/user_profiles/Female_3.jpg';
import female4 from '../assets/user_profiles/Female_4.jpg';
import female5 from '../assets/user_profiles/Female_5.jpg';
import female6 from '../assets/user_profiles/Female_6.jpg';
import female7 from '../assets/user_profiles/Female_7.jpg';
import female8 from '../assets/user_profiles/Female_8.jpg';
import female9 from '../assets/user_profiles/Female_9.jpg';
import female10 from '../assets/user_profiles/Female_10.jpg';
import female11 from '../assets/user_profiles/Female_11.jpg';
import female12 from '../assets/user_profiles/Female_12.jpg';
import female13 from '../assets/user_profiles/Female_13.jpg';
import female14 from '../assets/user_profiles/Female_14.jpg';

// Avatar paths - organized by gender
// These now reference color avatars (JPG format with full color)
export const AVATAR_PATHS = {
  male: [
    male1,
    male2,
    male3,
    male4,
    male5,
    male6,
    male7,
    male8,
    male9,
    male10,
  ],
  female: [
    female1,
    female2,
    female3,
    female4,
    female5,
    female6,
    female7,
    female8,
    female9,
    female10,
    female11,
    female12,
    female13,
    female14,
  ],
} as const;

// Default avatar (fallback) - uses DiceBear as fallback
export const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/lorelei/svg?seed=default&backgroundColor=e5e7eb&hairColor=000000&skinColor=fdbcb4&clothingColor=262e33';

// Avatar selection constants
export const AVATAR_SELECTION_GRID_COLS = 4; // Number of columns in avatar grid (increased to 4 for more avatars)
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

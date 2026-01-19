# Avatar Images

This directory should contain the cropped avatar illustrations.

## Avatar Files

The following PNG avatar files are available in this directory (processed from user profile images):

### Male Avatars (10 files):
- `male-1.png` through `male-10.png`
- App uses: `male-1.png` through `male-6.png`

### Female Avatars (14 files):
- `female-1.png` through `female-14.png`
- App uses: `female-1.png` through `female-6.png`

## Processing

All avatars were processed from source images in `src/assets/user_profiles/` using `scripts/process-user-profiles.py`:
- ✅ White background removed (transparent)
- ✅ Converted to black & white
- ✅ Enhanced and cleaned
- ✅ Cropped to square (300x300px)
- ✅ Saved as PNG format with RGBA transparency

## Image Specifications

- Format: PNG with RGBA transparency
- Size: 300x300px (square)
- Style: Black and white illustrations
- Background: Transparent
- Content: Head and shoulders view, centered

## Instructions

1. Clean up and crop each illustration from the reference images
2. Save them with the exact filenames listed above
3. Place all files in the `public/avatars/` directory
4. The app will automatically load and display them in the avatar selection component

## Fallback

If an avatar image fails to load, the app will:
- Use DiceBear generated avatar as fallback
- Show user initials if image loading fails

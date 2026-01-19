# Avatar Images

This directory should contain the cropped avatar illustrations.

## Required Files

Place the following SVG files in this directory:

### Male Avatars (6 files):
- `male-1.svg`
- `male-2.svg`
- `male-3.svg`
- `male-4.svg`
- `male-5.svg`
- `male-6.svg`

### Female Avatars (6 files):
- `female-1.svg`
- `female-2.svg`
- `female-3.svg`
- `female-4.svg`
- `female-5.svg`
- `female-6.svg`

## Image Requirements

- Format: SVG (preferred) or PNG
- Size: Square format recommended (e.g., 200x200px or 300x300px)
- Style: Black and white illustrations matching the reference images
- Background: Transparent or light gray (#e5e7eb)
- Content: Head and shoulders view, circular crop ready

## Instructions

1. Clean up and crop each illustration from the reference images
2. Save them with the exact filenames listed above
3. Place all files in the `public/avatars/` directory
4. The app will automatically load and display them in the avatar selection component

## Fallback

If an avatar image fails to load, the app will:
- Use DiceBear generated avatar as fallback
- Show user initials if image loading fails

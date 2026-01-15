#!/usr/bin/env python3
"""
Crop top and bottom of logo images to remove excess space
"""

from PIL import Image
import os
import sys

# Constants
LOGO_CROP_PADDING = 20  # Padding in pixels to add around logo content (top and bottom)

def find_content_bounds(image):
    """Find the bounding box of non-transparent content"""
    # Convert to RGBA if not already
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
    
    # Get alpha channel
    alpha = image.split()[3]
    
    # Find top and bottom bounds
    pixels = alpha.load()
    width, height = image.size
    
    # Find top bound
    top = 0
    for y in range(height):
        for x in range(width):
            if pixels[x, y] > 0:  # Non-transparent pixel
                top = y
                break
        if top > 0:
            break
    
    # Find bottom bound
    bottom = height - 1
    for y in range(height - 1, -1, -1):
        for x in range(width):
            if pixels[x, y] > 0:  # Non-transparent pixel
                bottom = y
                break
        if bottom < height - 1:
            break
    
    return top, bottom

def crop_logo(input_path, output_path, padding=LOGO_CROP_PADDING):
    """Crop logo to remove excess top and bottom space"""
    try:
        # Open image
        img = Image.open(input_path)
        print(f"Processing: {input_path}")
        print(f"Original size: {img.size[0]}x{img.size[1]}")
        
        # Find content bounds
        top, bottom = find_content_bounds(img)
        print(f"Content bounds: top={top}, bottom={bottom}")
        
        # Add padding around content (top and bottom)
        top = max(0, top - padding)
        bottom = min(img.size[1] - 1, bottom + padding)
        
        # Crop the image
        cropped = img.crop((0, top, img.size[0], bottom + 1))
        print(f"Cropped size: {cropped.size[0]}x{cropped.size[1]}")
        
        # Save the cropped image
        cropped.save(output_path, 'PNG', optimize=True)
        print(f"Saved: {output_path}\n")
        
        return True
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return False

def main():
    # Logo files to process
    logos = [
        {
            'input': 'src/assets/taskzm-logo-gray.png',
            'output': 'src/assets/taskzm-logo-gray.png'
        },
        {
            'input': 'src/assets/Taskzm_Logo_BLK-removebg.png',
            'output': 'src/assets/Taskzm_Logo_BLK-removebg.png'
        }
    ]
    
    # Process each logo
    success_count = 0
    for logo in logos:
        input_path = logo['input']
        output_path = logo['output']
        
        if not os.path.exists(input_path):
            print(f"Warning: {input_path} not found, skipping...")
            continue
        
        if crop_logo(input_path, output_path, padding=LOGO_CROP_PADDING):
            success_count += 1
    
    print(f"Successfully processed {success_count} logo(s)")
    return 0 if success_count == len(logos) else 1

if __name__ == '__main__':
    sys.exit(main())

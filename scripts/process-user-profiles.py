#!/usr/bin/env python3
"""
Process user profile images:
1. Remove white background
2. Convert to black & white
3. Clean up and optimize
4. Save as avatars in public/avatars/
"""

from PIL import Image, ImageEnhance, ImageFilter
import os
import sys
import re

# Constants
AVATAR_SIZE = 300  # Target size for avatars (square)
OUTPUT_DIR = 'public/avatars'
WHITE_THRESHOLD = 240  # Threshold for white background removal (0-255)
TOLERANCE = 30  # Color tolerance for background removal

def ensure_output_dir():
    """Create output directory if it doesn't exist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"📁 Output directory: {OUTPUT_DIR}")

def remove_white_background(image, threshold=WHITE_THRESHOLD, tolerance=TOLERANCE):
    """
    Remove white background from image and make it transparent
    """
    # Convert to RGBA if not already
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
    
    # Get image data
    data = image.getdata()
    
    # Create new image data with transparency
    new_data = []
    for item in data:
        r, g, b, a = item
        
        # Check if pixel is white or near-white (with tolerance)
        is_white = (
            r > (threshold - tolerance) and 
            g > (threshold - tolerance) and 
            b > (threshold - tolerance)
        )
        
        if is_white:
            # Make transparent
            new_data.append((255, 255, 255, 0))
        else:
            # Keep original pixel with full opacity
            new_data.append((r, g, b, 255))
    
    # Create new image with transparent background
    image.putdata(new_data)
    return image

def convert_to_black_white(image):
    """
    Convert image to black and white (grayscale)
    """
    # Convert to grayscale
    gray = image.convert('L')
    
    # Convert back to RGBA to maintain transparency
    bw = Image.new('RGBA', gray.size)
    bw.paste(gray, (0, 0))
    
    # Copy alpha channel from original
    if image.mode == 'RGBA':
        bw.putalpha(image.split()[3])
    
    return bw

def enhance_image(image):
    """
    Enhance and clean up the image
    """
    # Increase contrast slightly
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.2)
    
    # Sharpen slightly
    image = image.filter(ImageFilter.UnsharpMask(radius=1, percent=150, threshold=3))
    
    return image

def crop_to_square(image, size=AVATAR_SIZE):
    """
    Crop image to square and resize
    """
    width, height = image.size
    
    # Determine crop size (use smaller dimension)
    crop_size = min(width, height)
    
    # Center crop
    left = (width - crop_size) // 2
    top = (height - crop_size) // 2
    right = left + crop_size
    bottom = top + crop_size
    
    # Crop and resize
    cropped = image.crop((left, top, right, bottom))
    resized = cropped.resize((size, size), Image.Resampling.LANCZOS)
    
    return resized

def process_profile_image(input_path, output_path):
    """
    Process a single profile image
    """
    try:
        # Open image
        img = Image.open(input_path)
        print(f"📷 Processing: {os.path.basename(input_path)}")
        print(f"   Original size: {img.size[0]}x{img.size[1]}")
        
        # Step 1: Remove white background
        img = remove_white_background(img)
        print("   ✅ Removed white background")
        
        # Step 2: Convert to black & white
        img = convert_to_black_white(img)
        print("   ✅ Converted to black & white")
        
        # Step 3: Enhance and clean up
        img = enhance_image(img)
        print("   ✅ Enhanced and cleaned")
        
        # Step 4: Crop to square and resize
        img = crop_to_square(img, AVATAR_SIZE)
        print(f"   ✅ Cropped and resized to {AVATAR_SIZE}x{AVATAR_SIZE}")
        
        # Save as PNG
        img.save(output_path, 'PNG', optimize=True)
        print(f"   💾 Saved: {os.path.basename(output_path)}\n")
        
        return True
    except Exception as e:
        print(f"❌ Error processing {input_path}: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    os.chdir(project_root)
    
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("🎨 User Profile Image Processor")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    
    # Ensure output directory exists
    ensure_output_dir()
    
    # Source directory
    source_dir = 'src/assets/user_profiles'
    
    if not os.path.exists(source_dir):
        print(f"❌ Source directory not found: {source_dir}")
        return 1
    
    # Find all profile images
    profile_files = []
    for ext in ['*.jpg', '*.jpeg', '*.png']:
        import glob
        profile_files.extend(glob.glob(os.path.join(source_dir, ext)))
        profile_files.extend(glob.glob(os.path.join(source_dir, ext.upper())))
    
    if not profile_files:
        print(f"❌ No profile images found in {source_dir}")
        return 1
    
    print(f"✅ Found {len(profile_files)} profile image(s)")
    print()
    
    # Process each image
    success_count = 0
    processed_files = []
    
    # Sort files to process in order
    profile_files.sort()
    
    for input_path in profile_files:
        filename = os.path.basename(input_path)
        
        # Extract gender and number from filename
        # Examples: Female_1.jpg, male_1.jpg, Male_4.jpg
        match = re.match(r'^(female|male|Female|Male)[_\s]*(\d+)', filename, re.IGNORECASE)
        
        if match:
            gender = match.group(1).lower()
            number = match.group(2)
            
            # Create output filename
            output_filename = f'{gender}-{number}.png'
            output_path = os.path.join(OUTPUT_DIR, output_filename)
            
            # Process the image
            if process_profile_image(input_path, output_path):
                success_count += 1
                processed_files.append(output_path)
        else:
            print(f"⚠️  Skipping {filename} - doesn't match expected pattern (female_# or male_#)")
    
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"✅ Successfully processed {success_count} profile image(s)!")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    
    # List processed files
    if processed_files:
        print("📁 Processed avatar files:")
        for f in sorted(processed_files):
            print(f"   {os.path.basename(f)}")
        print()
        
        # Count by gender
        male_count = len([f for f in processed_files if 'male' in f.lower()])
        female_count = len([f for f in processed_files if 'female' in f.lower()])
        
        print(f"📊 Summary:")
        print(f"   Male avatars: {male_count}")
        print(f"   Female avatars: {female_count}")
        print()
        
        print("🎉 Profile images processed and saved as avatars!")
        print("   All images have:")
        print("   - White background removed (transparent)")
        print("   - Converted to black & white")
        print("   - Enhanced and cleaned")
        print("   - Cropped to square (300x300px)")
        return 0
    else:
        print("❌ No images were processed successfully")
        return 1

if __name__ == '__main__':
    sys.exit(main())

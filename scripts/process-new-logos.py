#!/usr/bin/env python3

"""
Process new TaskZM logos to remove white backgrounds and make them transparent
This script will process logo images and save them with transparent backgrounds
"""

from PIL import Image
import sys
import os

def remove_white_background(input_path, output_path, tolerance=30):
    """
    Remove white background from an image and make it transparent
    
    Args:
        input_path: Path to input image
        output_path: Path to save output image
        tolerance: Color tolerance for white detection (0-255)
    """
    try:
        # Open the image
        img = Image.open(input_path)
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Get image data
        data = img.getdata()
        
        # Create new image data with transparency
        new_data = []
        for item in data:
            r, g, b, a = item
            
            # Check if pixel is white or near-white (with tolerance)
            # White is when all RGB values are high (close to 255)
            is_white = (
                r > (255 - tolerance) and 
                g > (255 - tolerance) and 
                b > (255 - tolerance)
            )
            
            if is_white:
                # Make transparent
                new_data.append((255, 255, 255, 0))
            else:
                # Keep original pixel with full opacity
                new_data.append((r, g, b, 255))
        
        # Create new image with transparent background
        img.putdata(new_data)
        
        # Save with transparency
        img.save(output_path, 'PNG', optimize=True)
        print(f"✅ Processed: {input_path} → {output_path}")
        
        # Verify transparency
        verify_img = Image.open(output_path)
        if verify_img.mode == 'RGBA':
            alpha = verify_img.split()[3]
            transparent = sum(1 for p in alpha.getdata() if p < 255)
            total = verify_img.width * verify_img.height
            transparency_pct = (transparent / total) * 100
            print(f"   Transparency: {transparency_pct:.1f}%")
            print(f"   Size: {verify_img.width}x{verify_img.height}, Mode: {verify_img.mode}")
        
        return True
    except Exception as e:
        print(f"❌ Error processing {input_path}: {e}")
        return False

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # Define logo paths
    assets_dir = os.path.join(project_root, 'src', 'assets')
    public_dir = os.path.join(project_root, 'src', 'public')
    
    # Expected input files (user should place these in the assets folder)
    # User should name them: new-logo-black.png and new-logo-gray.png
    input_files = {
        'black': os.path.join(assets_dir, 'new-logo-black.png'),
        'gray': os.path.join(assets_dir, 'new-logo-gray.png'),
    }
    
    # Output files (where processed logos will be saved)
    output_files = {
        'black': os.path.join(assets_dir, 'Taskzm_Logo_BLK-removebg.png'),
        'gray': os.path.join(assets_dir, 'taskzm-logo-gray.png'),
        'splash': os.path.join(public_dir, 'taskzm-logo.png'),
    }
    
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("🎨 TaskZM Logo Processor")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    
    # Check if input files exist
    all_exist = True
    for name, path in input_files.items():
        if not os.path.exists(path):
            print(f"⚠️  Input file not found: {path}")
            print(f"   Please add your new {name} logo as: new-logo-{name}.png")
            all_exist = False
    
    if not all_exist:
        print()
        print("📋 Instructions:")
        print("1. Place your new logo files in: src/assets/")
        print("   - Name the black/colored version: new-logo-black.png")
        print("   - Name the gray version: new-logo-gray.png")
        print("2. Run this script again: python3 scripts/process-new-logos.py")
        print()
        return 1
    
    print("📄 Processing logos...")
    print()
    
    # Process black logo
    success_black = remove_white_background(
        input_files['black'],
        output_files['black'],
        tolerance=30
    )
    
    # Process gray logo
    success_gray = remove_white_background(
        input_files['gray'],
        output_files['gray'],
        tolerance=30
    )
    
    # Copy black logo to splash screen location
    if success_black:
        try:
            import shutil
            shutil.copy2(output_files['black'], output_files['splash'])
            print(f"✅ Copied to splash screen: {output_files['splash']}")
        except Exception as e:
            print(f"⚠️  Could not copy to splash screen: {e}")
    
    print()
    if success_black and success_gray:
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("✅ All logos processed successfully!")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print()
        print("📁 Processed files:")
        print(f"   Black logo: {output_files['black']}")
        print(f"   Gray logo: {output_files['gray']}")
        print(f"   Splash logo: {output_files['splash']}")
        print()
        print("🎉 Your new logos are ready to use!")
        print("   The app will automatically use them on next build.")
        return 0
    else:
        print("❌ Some logos failed to process. Please check the errors above.")
        return 1

if __name__ == '__main__':
    sys.exit(main())

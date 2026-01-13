#!/usr/bin/env node

/**
 * Generate app icons with proper padding to fit within borders
 * This script takes the source icon and generates all required sizes
 * with appropriate safe area padding (typically 10-20% for app icons)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon sizes to generate
const ICON_SIZES = [
  { size: 16, name: 'icon-16.png', padding: 0.15 }, // 15% padding for very small icons
  { size: 32, name: 'icon-32.png', padding: 0.15 }, // 15% padding for small icons
  { size: 180, name: 'icon-180.png', padding: 0.10 }, // 10% padding for Apple touch icon
  { size: 192, name: 'icon-192.png', padding: 0.10 }, // 10% padding for PWA icons
  { size: 512, name: 'icon-512.png', padding: 0.10 }, // 10% padding for large PWA icons
];

// Source icon path
const SOURCE_ICON = path.join(__dirname, '../src/assets/app-icon.png');
// Output directory
const OUTPUT_DIR = path.join(__dirname, '../src/public');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateIcon({ size, name, padding }) {
  try {
    console.log(`Generating ${name} (${size}x${size}) with ${(padding * 100).toFixed(0)}% padding...`);
    
    // Calculate the content size (icon size minus padding on both sides)
    const contentSize = Math.floor(size * (1 - padding * 2));
    
    // Load source image
    const sourceImage = sharp(SOURCE_ICON);
    const metadata = await sourceImage.metadata();
    
    // Calculate scaling to fit content area while maintaining aspect ratio
    const scale = Math.min(
      contentSize / metadata.width,
      contentSize / metadata.height
    );
    
    const scaledWidth = Math.floor(metadata.width * scale);
    const scaledHeight = Math.floor(metadata.height * scale);
    
    // Calculate position to center the content
    const offsetX = Math.floor((size - scaledWidth) / 2);
    const offsetY = Math.floor((size - scaledHeight) / 2);
    
    // Create a transparent background (app icon now has transparent background)
    const backgroundColor = { r: 0, g: 0, b: 0, alpha: 0 };
    
    // Generate the icon
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: backgroundColor,
      },
    })
      .composite([
        {
          input: await sourceImage
            .resize(scaledWidth, scaledHeight, {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toBuffer(),
          left: offsetX,
          top: offsetY,
        },
      ])
      .png()
      .toFile(path.join(OUTPUT_DIR, name));
    
    console.log(`✓ Generated ${name}`);
  } catch (error) {
    console.error(`✗ Error generating ${name}:`, error.message);
    throw error;
  }
}

async function generateFavicon() {
  try {
    console.log('Generating favicon.ico...');
    
    // Generate 16x16 and 32x32 PNGs first, then convert to ICO
    // For simplicity, we'll use the 16x16 icon as the favicon
    const favicon16 = await sharp(SOURCE_ICON)
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    
    // Write as favicon.ico (most browsers accept PNG as ICO)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'favicon.ico'),
      favicon16
    );
    
    console.log('✓ Generated favicon.ico');
  } catch (error) {
    console.error('✗ Error generating favicon.ico:', error.message);
    throw error;
  }
}

async function main() {
  console.log('Starting icon generation with proper padding...\n');
  console.log(`Source: ${SOURCE_ICON}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);
  
  // Check if source exists
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`✗ Source icon not found: ${SOURCE_ICON}`);
    process.exit(1);
  }
  
  try {
    // Generate all icon sizes
    for (const iconConfig of ICON_SIZES) {
      await generateIcon(iconConfig);
    }
    
    // Generate favicon
    await generateFavicon();
    
    console.log('\n✓ All icons generated successfully!');
    console.log('\nGenerated files:');
    ICON_SIZES.forEach(({ name }) => {
      console.log(`  - ${name}`);
    });
    console.log('  - favicon.ico');
  } catch (error) {
    console.error('\n✗ Icon generation failed:', error);
    process.exit(1);
  }
}

main();


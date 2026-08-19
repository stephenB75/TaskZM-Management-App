#!/usr/bin/env node
/**
 * Build TaskZM avatar assets from bundled IconScout pack preview sheets.
 *
 * Each pack PNG is a 720×480 preview with six icons in a 3×2 grid (240×240 cells).
 * Place pack files in assets/iconscout-source/ as pack-{id}.png.
 *
 * Source listing: https://iconscout.com/free-icon-packs/avatars
 *
 * Optional: unzip manual SVGs to assets/iconscout-avatar-pack/ to override.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets/iconscout-source');
const MANUAL_SOURCE_DIR = path.join(ROOT, 'assets/iconscout-avatar-pack');
const OUTPUT_DIR = path.join(ROOT, 'src/public/avatars/iconscout');

const GRID_COLS = 3;
const GRID_ROWS = 2;
const ICONS_PER_PACK = GRID_COLS * GRID_ROWS;
const OUTPUT_SIZE_PX = 128;
const TRIM_BACKGROUND = '#ffffff';
const TRIM_THRESHOLD = 18;

const ICONSCOUT_LISTING_URL = 'https://iconscout.com/free-icon-packs/avatars';

/** Bundled local pack sheets — order defines avatar slot groups. */
const ICONSCOUT_SOURCE_PACKS = [
  { id: '25077', label: 'Character', file: 'pack-25077.png' },
  { id: '27092', label: 'Everyday', file: 'pack-27092.png' },
  { id: '35981', label: 'Profiles', file: 'pack-35981.png' },
  { id: '40231', label: 'Classic', file: 'pack-40231.png' },
  { id: '52933', label: 'Global', file: 'pack-52933.png' },
  { id: '61203', label: 'Professional', file: 'pack-61203.png' },
  { id: '89116', label: 'Happy', file: 'pack-89116.png' },
];

const AVATAR_COUNT = ICONSCOUT_SOURCE_PACKS.length * ICONS_PER_PACK;

function slotName(index) {
  return String(index + 1).padStart(2, '0');
}

function resolvePackPath(pack) {
  return path.join(SOURCE_DIR, pack.file);
}

function requirePackPath(pack) {
  const packPath = resolvePackPath(pack);
  if (!fs.existsSync(packPath)) {
    throw new Error(`Missing pack file: ${packPath}`);
  }
  return packPath;
}

async function cropPackIcons(previewPath) {
  const metadata = await sharp(previewPath).metadata();
  const width = metadata.width ?? 720;
  const height = metadata.height ?? 480;
  const cellWidth = Math.floor(width / GRID_COLS);
  const cellHeight = Math.floor(height / GRID_ROWS);
  const squareSize = Math.min(cellWidth, cellHeight);
  const icons = [];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const cellLeft = col * cellWidth;
      const cellTop = row * cellHeight;
      const left = cellLeft + Math.floor((cellWidth - squareSize) / 2);
      const top = cellTop + Math.floor((cellHeight - squareSize) / 2);
      const cropped = await sharp(previewPath)
        .extract({
          left,
          top,
          width: squareSize,
          height: squareSize,
        })
        .png()
        .toBuffer();
      icons.push(cropped);
    }
  }

  return icons;
}

async function processTransparentAvatar(iconBuffer) {
  const trimmed = await sharp(iconBuffer)
    .trim({
      background: TRIM_BACKGROUND,
      threshold: TRIM_THRESHOLD,
    })
    .png()
    .toBuffer();

  const metadata = await sharp(trimmed).metadata();
  const sourceWidth = Math.max(1, metadata.width ?? 1);
  const sourceHeight = Math.max(1, metadata.height ?? 1);
  const squareSide = Math.max(sourceWidth, sourceHeight);
  const padLeft = Math.floor((squareSide - sourceWidth) / 2);
  const padRight = squareSide - sourceWidth - padLeft;
  const padTop = Math.floor((squareSide - sourceHeight) / 2);
  const padBottom = squareSide - sourceHeight - padTop;

  const squared = await sharp(trimmed)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp(squared)
    .resize(OUTPUT_SIZE_PX, OUTPUT_SIZE_PX, {
      fit: 'fill',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer();
}

function clearOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const entry of fs.readdirSync(OUTPUT_DIR)) {
    if (entry.endsWith('.png')) {
      fs.unlinkSync(path.join(OUTPUT_DIR, entry));
    }
  }
}

function findManualSvgs(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
        results.push(fullPath);
      }
    }
  };
  walk(dir);
  return results.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function buildFromManualSvgs(svgPaths) {
  clearOutputDir();

  for (let index = 0; index < AVATAR_COUNT; index += 1) {
    const slot = slotName(index);
    const sourcePath = svgPaths[index % svgPaths.length];
    const rasterized = await sharp(sourcePath).png().toBuffer();
    const output = await processTransparentAvatar(rasterized);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${slot}.png`), output);
  }
}

async function buildFromLocalPacks() {
  clearOutputDir();
  let slotIndex = 0;

  for (const pack of ICONSCOUT_SOURCE_PACKS) {
    const previewPath = requirePackPath(pack);
    const icons = await cropPackIcons(previewPath);

    for (const iconBuffer of icons) {
      const slot = slotName(slotIndex);
      const output = await processTransparentAvatar(iconBuffer);
      fs.writeFileSync(path.join(OUTPUT_DIR, `${slot}.png`), output);
      slotIndex += 1;
    }
  }

  if (slotIndex !== AVATAR_COUNT) {
    throw new Error(`Generated ${slotIndex} avatars; expected ${AVATAR_COUNT}`);
  }
}

async function main() {
  const manualSvgs = findManualSvgs(MANUAL_SOURCE_DIR);
  if (manualSvgs.length > 0) {
    await buildFromManualSvgs(manualSvgs);
    console.log(`Built ${AVATAR_COUNT} avatars from ${manualSvgs.length} manual SVG(s) in ${MANUAL_SOURCE_DIR}`);
    return;
  }

  await buildFromLocalPacks();
  console.log(`Built ${AVATAR_COUNT} square avatars from ${ICONSCOUT_SOURCE_PACKS.length} local IconScout packs`);
  console.log(`Listing: ${ICONSCOUT_LISTING_URL}`);
  console.log(`Source: ${SOURCE_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

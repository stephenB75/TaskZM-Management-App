/**
 * Download and normalize Craftwork Userpics single-portrait assets.
 * Source: https://userpics.craftwork.design/
 * Run: npm run generate:avatars
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = join(process.cwd(), 'src/public/avatars/userpics');
const BASE_URL = 'https://userpics.craftwork.design/images';
/** Individual portraits — not modal-* landing-page collages */
const COUNT = 30;
const RENDER_SIZE = 256;
/** Trim only when black letterboxing removes a meaningful border */
const TRIM_AREA_RATIO = 0.88;

mkdirSync(OUT_DIR, { recursive: true });

async function normalizeAvatar(buffer) {
  const originalMeta = await sharp(buffer).metadata();
  const trimmed = await sharp(buffer).trim({ threshold: 20 }).toBuffer({ resolveWithObject: true });
  const trimmedArea = trimmed.info.width * trimmed.info.height;
  const originalArea = (originalMeta.width ?? RENDER_SIZE) * (originalMeta.height ?? RENDER_SIZE);
  const source = trimmedArea / originalArea < TRIM_AREA_RATIO ? trimmed.data : buffer;

  return sharp(source)
    .resize(RENDER_SIZE, RENDER_SIZE, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

for (let index = 1; index <= COUNT; index += 1) {
  const id = String(index).padStart(2, '0');
  const url = `${BASE_URL}/s-5-img-${index}.png`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const raw = Buffer.from(await response.arrayBuffer());
  const normalized = await normalizeAvatar(raw);
  writeFileSync(join(OUT_DIR, `${id}.png`), normalized);
  console.log(`Saved ${id}.png (${normalized.length} bytes)`);
}

console.log(`Downloaded and normalized ${COUNT} Userpics avatars to ${OUT_DIR}`);

/**
 * Download Craftwork Userpics single-portrait assets (free commercial use).
 * Source: https://userpics.craftwork.design/
 * Run: npm run generate:avatars
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'src/public/avatars/userpics');
const BASE_URL = 'https://userpics.craftwork.design/images';
/** Individual portraits — not modal-* landing-page collages */
const COUNT = 30;

mkdirSync(OUT_DIR, { recursive: true });

for (let index = 1; index <= COUNT; index += 1) {
  const id = String(index).padStart(2, '0');
  const url = `${BASE_URL}/s-5-img-${index}.png`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(join(OUT_DIR, `${id}.png`), buffer);
  console.log(`Saved ${id}.png`);
}

console.log(`Downloaded ${COUNT} Userpics avatars to ${OUT_DIR}`);

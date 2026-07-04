/**
 * Download Craftwork Userpics preview assets (free commercial use).
 * Source: https://userpics.craftwork.design/
 * Run: npm run generate:avatars
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'src/public/avatars/userpics');
const BASE_URL = 'https://userpics.craftwork.design/images';
const COUNT = 27;

mkdirSync(OUT_DIR, { recursive: true });

for (let index = 1; index <= COUNT; index += 1) {
  const id = String(index).padStart(2, '0');
  const url = `${BASE_URL}/modal-${id}@2x.png`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(join(OUT_DIR, `${id}.png`), buffer);
  console.log(`Saved ${id}.png`);
}

console.log(`Downloaded ${COUNT} Userpics avatars to ${OUT_DIR}`);

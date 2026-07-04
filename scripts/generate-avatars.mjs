/**
 * Generate bundled Avataaars avatar SVGs for TaskZM (DiceBear / Pablo Stanley).
 * Flat colorful vector portraits — Flaticon-style profile icons.
 * Run: npm run generate:avatars
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';

const OUT_DIR = join(process.cwd(), 'public/avatars/avataaars');

/** Pastel backgrounds aligned with TaskZM color-theme (no # prefix for DiceBear). */
const BACKGROUND_COLORS = [
  'e6d5f0', // lavender
  'd4c5f9', // primary light
  'b8e6d5', // mint
  'c9e4f7', // sky
  'ffd6ba', // peach
  'ffd6e8', // pink
  'd4e8d4', // sage
  'fff4cc', // yellow
  'e1d4f0', // lilac
  'f5f3ff', // app background tint
];

const AVATAR_SEEDS = [
  'taskzm-amara',
  'taskzm-noah',
  'taskzm-maya',
  'taskzm-elias',
  'taskzm-sora',
  'taskzm-luna',
  'taskzm-kai',
  'taskzm-ivy',
  'taskzm-omar',
  'taskzm-zara',
  'taskzm-leo',
  'taskzm-nina',
  'taskzm-theo',
  'taskzm-aria',
  'taskzm-milan',
  'taskzm-esme',
  'taskzm-reid',
  'taskzm-june',
  'taskzm-felix',
  'taskzm-nova',
  'taskzm-hugo',
  'taskzm-clara',
  'taskzm-odin',
  'taskzm-piper',
];

mkdirSync(OUT_DIR, { recursive: true });

AVATAR_SEEDS.forEach((seed, index) => {
  const id = String(index + 1).padStart(2, '0');
  const svg = createAvatar(avataaars, {
    seed,
    size: 256,
    backgroundColor: [BACKGROUND_COLORS[index % BACKGROUND_COLORS.length]],
    radius: 50,
  }).toString();

  writeFileSync(join(OUT_DIR, `${id}.svg`), svg, 'utf8');
});

console.log(`Generated ${AVATAR_SEEDS.length} Avataaars avatars in ${OUT_DIR}`);

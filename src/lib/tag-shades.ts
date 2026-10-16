/**
 * Per-tag gray shades. Each new tag claims the next slot in a persisted registry, and slots map to
 * lightness via a van der Corput sequence, so no two tags ever share a shade.
 */

import { TAG_SHADE_LIGHTNESS, TAG_SHADE_STORAGE_KEY } from './color-theme';

type Registry = Record<string, number>;

let cache: Registry | null = null;

function readRegistry(): Registry {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TAG_SHADE_STORAGE_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === 'object' ? (parsed as Registry) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function slotFor(tag: string): number {
  const key = tag.trim().toLowerCase();
  const registry = readRegistry();
  if (registry[key] !== undefined) return registry[key];
  const slot = Object.keys(registry).length;
  registry[key] = slot;
  try {
    localStorage.setItem(TAG_SHADE_STORAGE_KEY, JSON.stringify(registry));
  } catch {
    /* storage full or unavailable: shade still unique for this session */
  }
  return slot;
}

/** Radical inverse in base 2: 0, .5, .25, .75, .125 … never repeats. */
function vanDerCorput(n: number): number {
  let value = 0;
  let base = 0.5;
  let rest = n;
  while (rest > 0) {
    if (rest & 1) value += base;
    rest >>= 1;
    base /= 2;
  }
  return value;
}

function isDarkTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

/** Unique gray (or near-black) for a tag. */
export function tagShade(tag: string): string {
  const { minPercent, maxPercent } = TAG_SHADE_LIGHTNESS;
  const lightness = minPercent + (maxPercent - minPercent) * vanDerCorput(slotFor(tag));
  const themed = isDarkTheme() ? 100 - lightness : lightness;
  return `hsl(0 0% ${themed.toFixed(2)}%)`;
}

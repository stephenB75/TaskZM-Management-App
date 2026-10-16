#!/usr/bin/env node
/**
 * Generates TaskZM's original avatar set (src/public/avatars/people/NN.svg).
 *
 * Flat, friendly busts with an even spread of skin tones, hair textures, head coverings, ages,
 * and presentations. Every tone appears equally often and nothing is grouped by identity.
 * Re-run after editing PEOPLE: node scripts/generate-people-avatars.mjs
 * Keep PEOPLE_AVATAR_LABELS in src/lib/avatar-constants.ts in the same order.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'public', 'avatars', 'people');

const SKIN = {
  s1: '#F7D9C4',
  s2: '#EDBF98',
  s3: '#D9A066',
  s4: '#B87943',
  s5: '#8A5530',
  s6: '#5E3B22',
};
const SKIN_SHADE = {
  s1: '#E8BFA4',
  s2: '#D9A77E',
  s3: '#C08650',
  s4: '#9C6234',
  s5: '#6F4224',
  s6: '#4A2D19',
};
const HAIR = {
  black: '#1E1A18',
  darkBrown: '#3B2A20',
  brown: '#6B4A31',
  auburn: '#8C3F1F',
  blonde: '#D8B26E',
  gray: '#B8B3AD',
  white: '#E6E2DC',
};
const CLOTHES = ['#6C8EF2', '#F28C6C', '#5FB89A', '#B07CE8', '#F2C14E', '#4FA3C7', '#E8739A', '#7C8A9E'];
const WRAP = ['#2F6F8F', '#C2414B', '#5B4B9A', '#2E8B57', '#D9822B', '#8E5BA8'];
const INK = '#2A2522';

const HEAD = { cx: 64, cy: 56, rx: 21, ry: 24 };

const hairBack = {
  long: (c) => `<path d="M38 56 C38 30 50 25 64 25 C78 25 90 30 90 56 L93 100 C84 104 44 104 35 100 Z" fill="${c}"/>`,
  afro: (c) => `<circle cx="64" cy="46" r="31" fill="${c}"/>`,
  locs: (c) =>
    [36, 44, 52, 76, 84, 92]
      .map((x) => `<rect x="${x - 4}" y="40" width="8" height="${x < 64 ? 60 : 58}" rx="4" fill="${c}"/>`)
      .join(''),
  braids: (c) =>
    [38, 90]
      .map((x) => [52, 62, 72, 82, 92].map((y) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="6" fill="${c}"/>`).join(''))
      .join(''),
  curlyLong: (c) =>
    [
      [40, 58], [38, 70], [40, 82], [44, 92], [88, 58], [90, 70], [88, 82], [84, 92],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/>`)
      .join(''),
  bob: (c) => `<path d="M39 56 C39 30 50 26 64 26 C78 26 89 30 89 56 L90 78 C82 82 46 82 38 78 Z" fill="${c}"/>`,
};

const hairFront = {
  short: (c) => `<path d="M43 52 C42 35 52 29 64 29 C77 29 86 35 85 52 C81 44 73 40 64 40 C55 40 47 44 43 52 Z" fill="${c}"/>`,
  sidePart: (c) =>
    `<path d="M43 54 C41 34 52 28 65 28 C78 28 87 35 85 54 C83 45 78 40 70 39 C62 42 52 44 43 54 Z" fill="${c}"/>`,
  fringe: (c) => `<path d="M42 54 C41 33 52 28 64 28 C77 28 87 33 86 54 C80 46 72 44 64 46 C56 44 48 46 42 54 Z" fill="${c}"/>`,
  buzz: (c) =>
    `<path d="M44 50 C44 36 53 31 64 31 C75 31 84 36 84 50 C80 43 72 40 64 40 C56 40 48 43 44 50 Z" fill="${c}" opacity="0.85"/>`,
  curls: (c) =>
    [
      [45, 44], [51, 36], [59, 32], [69, 32], [77, 36], [83, 44],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${c}"/>`)
      .join(''),
  afroTop: (c) => `<path d="M43 50 C44 38 52 34 64 34 C76 34 84 38 85 50 C80 45 72 43 64 43 C56 43 48 45 43 50 Z" fill="${c}"/>`,
  bun: (c) => `${hairFront.short(c)}<circle cx="64" cy="24" r="9" fill="${c}"/>`,
  receding: (c) =>
    `<path d="M43 54 C42 46 44 42 47 40 C46 46 46 50 45 56 Z M85 54 C86 46 84 42 81 40 C82 46 82 50 83 56 Z" fill="${c}"/>`,
};

const coverings = {
  hijab: (c) => ({
    back: `<path d="M33 62 C33 34 47 23 64 23 C81 23 95 34 95 62 C95 80 92 94 100 112 L28 112 C36 94 33 80 33 62 Z" fill="${c}"/>`,
    front: `<path d="M41 54 C42 37 52 31 64 31 C76 31 86 37 87 54 C81 42 73 38 64 38 C55 38 47 42 41 54 Z" fill="${c}"/><path d="M41 54 C42 37 52 31 64 31 C76 31 86 37 87 54" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="2"/>`,
    hideEars: true,
  }),
  turban: (c) => ({
    back: '',
    front: `<path d="M40 48 C38 28 51 20 64 20 C77 20 90 28 88 48 C81 41 73 39 64 39 C55 39 47 41 40 48 Z" fill="${c}"/><path d="M44 42 C52 30 70 26 84 36 M46 34 C56 26 70 24 80 28" fill="none" stroke="#000" stroke-opacity="0.15" stroke-width="2.5" stroke-linecap="round"/>`,
    hideEars: false,
  }),
  headwrap: (c) => ({
    back: '',
    front: `<path d="M39 48 C34 26 48 12 66 14 C85 16 95 30 89 48 C81 41 73 39 64 39 C55 39 46 41 39 48 Z" fill="${c}"/><ellipse cx="76" cy="18" rx="10" ry="7" fill="${c}"/><path d="M42 40 C52 28 74 24 88 34" fill="none" stroke="#000" stroke-opacity="0.15" stroke-width="2.5" stroke-linecap="round"/>`,
    hideEars: false,
  }),
  kippah: (c) => ({
    back: '',
    front: `<path d="M54 31 C58 27 70 27 74 31 C70 30 58 30 54 31 Z" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
    hideEars: false,
  }),
};

function beard(c) {
  return `<path d="M44 58 C45 78 55 87 64 87 C73 87 83 78 84 58 C82 66 77 70 72 70 C68 67 60 67 56 70 C51 70 46 66 44 58 Z" fill="${c}"/>`;
}
function mustache(c) {
  return `<path d="M55 66 C59 63 63 64 64 66 C65 64 69 63 73 66 C69 68 66 68 64 67 C62 68 59 68 55 66 Z" fill="${c}"/>`;
}
function glasses() {
  return `<g fill="none" stroke="${INK}" stroke-width="2"><circle cx="55" cy="56" r="6.5"/><circle cx="73" cy="56" r="6.5"/><path d="M61.5 56 H66.5 M48.5 55 L43 53 M79.5 55 L85 53"/></g>`;
}
function earrings() {
  return `<circle cx="43" cy="66" r="2.5" fill="#E8C35A"/><circle cx="85" cy="66" r="2.5" fill="#E8C35A"/>`;
}

function face({ skin, hasBeard, older }) {
  const eyes = `<circle cx="55" cy="56" r="2.3" fill="${INK}"/><circle cx="73" cy="56" r="2.3" fill="${INK}"/>`;
  const brows = `<path d="M50 49 Q55 46 60 49 M68 49 Q73 46 78 49" fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="2" stroke-linecap="round"/>`;
  const smile = hasBeard
    ? `<path d="M59 71 Q64 74 69 71" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
    : `<path d="M57 67 Q64 73 71 67" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
  const cheeks = `<circle cx="49" cy="64" r="3.5" fill="#E86A6A" opacity="0.18"/><circle cx="79" cy="64" r="3.5" fill="#E86A6A" opacity="0.18"/>`;
  const lines = older
    ? `<path d="M46 60 Q47 63 49 64 M82 60 Q81 63 79 64" fill="none" stroke="${SKIN_SHADE[skin]}" stroke-width="1.5" stroke-linecap="round"/>`
    : '';
  return eyes + brows + smile + cheeks + lines;
}

function renderAvatar(p) {
  const skinFill = SKIN[p.skin];
  const shade = SKIN_SHADE[p.skin];
  const hairColor = HAIR[p.hairColor ?? 'black'];
  const covering = p.covering ? coverings[p.covering.type](p.covering.color) : null;
  const parts = [];

  parts.push(`<path d="M22 128 C22 101 39 89 64 89 C89 89 106 101 106 128 Z" fill="${p.clothes}"/>`);
  if (covering?.back) parts.push(covering.back);
  if (!covering && p.hairBack) parts.push(hairBack[p.hairBack](hairColor));
  parts.push(`<rect x="56" y="74" width="16" height="17" rx="6" fill="${shade}"/>`);
  if (!covering?.hideEars) {
    parts.push(`<circle cx="43" cy="58" r="5" fill="${skinFill}"/><circle cx="85" cy="58" r="5" fill="${skinFill}"/>`);
  }
  parts.push(`<ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}" fill="${skinFill}"/>`);
  if (p.beard) parts.push(beard(hairColor));
  if (p.mustache) parts.push(mustache(hairColor));
  parts.push(face({ skin: p.skin, hasBeard: p.beard, older: p.older }));
  if (!covering || p.covering.type === 'kippah') {
    if (p.hairFront) parts.push(hairFront[p.hairFront](hairColor));
  }
  if (covering?.front) parts.push(covering.front);
  if (p.glasses) parts.push(glasses());
  if (p.earrings && !covering?.hideEars) parts.push(earrings());

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${p.label}">${parts.join('')}</svg>\n`;
}

/** Each skin tone appears four times; styles are spread across tones rather than tied to one. */
const PEOPLE = [
  { label: 'Coily hair', skin: 's6', hairBack: 'afro', hairFront: 'afroTop', clothes: CLOTHES[0], earrings: true },
  { label: 'Hijab', skin: 's3', covering: { type: 'hijab', color: WRAP[0] }, clothes: CLOTHES[2] },
  { label: 'Short hair and beard', skin: 's2', hairFront: 'short', hairColor: 'brown', beard: true, clothes: CLOTHES[1] },
  { label: 'Long straight hair', skin: 's1', hairBack: 'long', hairFront: 'fringe', hairColor: 'blonde', clothes: CLOTHES[3] },
  { label: 'Turban and beard', skin: 's4', covering: { type: 'turban', color: WRAP[1] }, beard: true, clothes: CLOTHES[5] },
  { label: 'Locs', skin: 's5', hairBack: 'locs', hairFront: 'short', clothes: CLOTHES[4] },
  { label: 'Bun and glasses', skin: 's2', hairFront: 'bun', hairColor: 'black', glasses: true, clothes: CLOTHES[6] },
  { label: 'Gray hair and glasses', skin: 's1', hairFront: 'receding', hairColor: 'gray', glasses: true, older: true, clothes: CLOTHES[7] },
  { label: 'Head wrap', skin: 's6', covering: { type: 'headwrap', color: WRAP[4] }, earrings: true, clothes: CLOTHES[2] },
  { label: 'Curly hair', skin: 's3', hairBack: 'curlyLong', hairFront: 'curls', hairColor: 'darkBrown', clothes: CLOTHES[0] },
  { label: 'Buzz cut', skin: 's5', hairFront: 'buzz', clothes: CLOTHES[3] },
  { label: 'Bob haircut', skin: 's4', hairBack: 'bob', hairFront: 'fringe', hairColor: 'black', clothes: CLOTHES[1] },
  { label: 'Side part', skin: 's1', hairFront: 'sidePart', hairColor: 'auburn', clothes: CLOTHES[4] },
  { label: 'Braids', skin: 's5', hairBack: 'braids', hairFront: 'short', earrings: true, clothes: CLOTHES[6] },
  { label: 'White hair', skin: 's3', hairBack: 'bob', hairFront: 'fringe', hairColor: 'white', older: true, glasses: true, clothes: CLOTHES[5] },
  { label: 'Mustache', skin: 's4', hairFront: 'sidePart', hairColor: 'black', mustache: true, clothes: CLOTHES[7] },
  { label: 'Hijab and glasses', skin: 's2', covering: { type: 'hijab', color: WRAP[2] }, glasses: true, clothes: CLOTHES[1] },
  { label: 'Bald with beard', skin: 's6', beard: true, hairColor: 'black', clothes: CLOTHES[3] },
  { label: 'Long wavy hair', skin: 's4', hairBack: 'curlyLong', hairFront: 'fringe', hairColor: 'brown', earrings: true, clothes: CLOTHES[2] },
  { label: 'Kippah', skin: 's1', covering: { type: 'kippah', color: WRAP[2] }, hairFront: 'short', hairColor: 'darkBrown', beard: true, clothes: CLOTHES[0] },
  { label: 'Short curls', skin: 's5', hairFront: 'curls', hairColor: 'black', glasses: true, clothes: CLOTHES[5] },
  { label: 'Gray bun', skin: 's6', hairFront: 'bun', hairColor: 'gray', older: true, clothes: CLOTHES[4] },
  { label: 'Long hair with glasses', skin: 's3', hairBack: 'long', hairFront: 'sidePart', hairColor: 'black', glasses: true, clothes: CLOTHES[6] },
  { label: 'Short hair', skin: 's2', hairFront: 'short', hairColor: 'blonde', clothes: CLOTHES[7] },
];

mkdirSync(OUT_DIR, { recursive: true });
PEOPLE.forEach((person, index) => {
  const slot = String(index + 1).padStart(2, '0');
  writeFileSync(join(OUT_DIR, `${slot}.svg`), renderAvatar(person));
});
console.log(`Wrote ${PEOPLE.length} avatars to ${OUT_DIR}`);

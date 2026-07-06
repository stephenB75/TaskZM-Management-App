/**
 * Avatar Constants
 * Multiavatar — multicultural SVG avatars styled with TaskZM pastel palettes.
 * https://multiavatar.com
 */

import {
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_PINK,
  COLOR_PASTEL_SAGE,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_YELLOW,
} from './color-theme';

export const AVATAR_ID_PREFIX = 'taskzm:multiavatar:';
/** @deprecated Craftwork Userpics PNG pack */
export const AVATAR_USERPICS_PREFIX = 'taskzm:userpics:';
/** @deprecated Avataaars pack */
export const AVATAR_AVATAAARS_PREFIX = 'taskzm:avataaars:';
/** @deprecated DiceBear Micah pack */
export const AVATAR_MICAH_PREFIX = 'taskzm:micah:';
/** @deprecated DiceBear Lorelei pack */
export const AVATAR_LORELEI_PREFIX = 'taskzm:lorelei:';
/** @deprecated DiceBear Notionists pack */
export const AVATAR_NOTIONISTS_PREFIX = 'taskzm:notionists:';
/** @deprecated Icon-based pastel presets */
export const AVATAR_PRESET_PREFIX = 'taskzm:pastel-';
/** @deprecated Portrait PNG avatars */
export const AVATAR_ICON_PREFIX = 'taskzm:icon:';

/** @deprecated Use AVATAR_ID_PREFIX */
export const AVATAR_MULTIAVATAR_PREFIX = AVATAR_ID_PREFIX;

export type MultiavatarTheme = 'A' | 'B' | 'C';

/** Inclusive base characters in the Multiavatar pack (parts 00–15). */
export const MULTIAVATAR_PART_COUNT = 16;

export const MULTIAVATAR_THEME_COUNT = 3;

export const MULTIAVATAR_THEMES: readonly MultiavatarTheme[] = ['A', 'B', 'C'];

/** Pastel palette labels aligned with TaskZM theme colors. */
export const MULTIAVATAR_THEME_LABELS: Record<MultiavatarTheme, string> = {
  A: 'Lavender',
  B: 'Mint',
  C: 'Sky',
};

/** TaskZM pastel backgrounds cycled across the avatar catalog. */
export const AVATAR_PASTEL_BACKGROUNDS = [
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_PINK,
  COLOR_PASTEL_YELLOW,
  COLOR_PASTEL_SAGE,
] as const;

export const AVATAR_PACK = {
  id: 'multiavatar',
  name: 'Multiavatar',
  license: 'Multiavatar License v1.0 (free in apps)',
  sourceUrl: 'https://multiavatar.com/',
  credit: 'Avatars by Multiavatar',
} as const;

const MULTIAVATAR_PARTS = Array.from({ length: MULTIAVATAR_PART_COUNT }, (_, index) =>
  String(index).padStart(2, '0'),
);

export { MULTIAVATAR_PARTS };

export interface AvatarOption {
  id: string;
  label: string;
  part: string;
  theme: MultiavatarTheme;
  slot: string;
  backgroundColor: string;
}

const AVATAR_OPTION_LABEL = {
  portraitPrefix: 'Portrait',
  paletteSeparator: '·',
} as const;

function buildAvatarLabel(part: string, theme: MultiavatarTheme): string {
  return `${AVATAR_OPTION_LABEL.portraitPrefix} ${part} ${AVATAR_OPTION_LABEL.paletteSeparator} ${MULTIAVATAR_THEME_LABELS[theme]}`;
}

function buildAvatarOptions(): readonly AvatarOption[] {
  return MULTIAVATAR_PARTS.flatMap((part, partIndex) =>
    MULTIAVATAR_THEMES.map((theme, themeIndex) => {
      const slot = String(partIndex * MULTIAVATAR_THEME_COUNT + themeIndex + 1).padStart(2, '0');
      const backgroundIndex = partIndex * MULTIAVATAR_THEME_COUNT + themeIndex;
      return {
        id: `${AVATAR_ID_PREFIX}${part}:${theme}`,
        label: buildAvatarLabel(part, theme),
        part,
        theme,
        slot,
        backgroundColor: getAvatarBackgroundColor(backgroundIndex),
      };
    }),
  );
}

export const AVATAR_OPTIONS = buildAvatarOptions();

export const AVATAR_COUNT = AVATAR_OPTIONS.length;

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0].id;

/** SVG render size in pixels. */
export const AVATAR_RENDER_SIZE = 128;

export const AVATAR_SELECTION_GRID_COLS = 4;
/** Max avatar cell size on large screens; grid shrinks cells on narrow viewports */
export const AVATAR_SELECTION_MAX_CELL_SIZE = '4.5rem';
export const AVATAR_SELECTION_GAP = '0.5rem';
export const AVATAR_SELECTION_PANEL_PADDING = '0.5rem';
export const AVATAR_SELECTION_PANEL_PADDING_DESKTOP = '0.75rem';
/** Visible rows in scrollable picker grids (full catalog scrolls beyond this) */
export const AVATAR_SELECTION_SCROLLABLE_VISIBLE_ROWS = 4;
/** Scrollable grid area inside dialogs on small screens */
export const AVATAR_SELECTION_GRID_MAX_HEIGHT = 'min(22rem, 55dvh)';
export const AVATAR_SELECTION_SECTION_GAP = '1rem';
export const AVATAR_SELECTION_SECTION_LABEL_CLASS =
  'mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]';

export const AVATAR_SELECTION_DIALOG_CLASS =
  'flex max-h-[calc(var(--viewport-height,100dvh)-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] max-w-[calc(100%-1rem)] flex-col gap-4 overflow-hidden sm:max-w-lg';
export const AVATAR_SELECTION_DIALOG_BODY_CLASS =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain';
export const AVATAR_SELECTION_DIALOG_FOOTER_CLASS =
  'flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end';

export const AVATAR_SELECTION_RING_CLASS = 'shadow-sm';
export const AVATAR_SELECTION_SELECTED_CLASS =
  'border-primary ring-2 ring-primary ring-offset-1 ring-offset-background';
export const AVATAR_SELECTION_UNSELECTED_CLASS =
  'border-border/60 hover:border-primary/50';

export const AVATAR_UI_TEXT = {
  chooseYourAvatar: 'Choose Your Avatar',
  chooseAvatar: 'Choose Avatar',
  selectYourAvatar: 'Select Your Avatar',
  selectAvatarDescription: `${AVATAR_COUNT} inclusive portraits representing people from many cultures — styled with TaskZM pastel palettes`,
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar',
  packCredit: `${AVATAR_PACK.credit} · Multicultural characters · Pastel palettes`,
  characterSectionPrefix: 'Character',
} as const;

export const AVATAR_CHECKMARK_SIZE = '1.5rem';
export const AVATAR_CHECKMARK_ICON_SIZE = '1rem';

export const USER_PROFILE_AVATAR_RING_CLASS =
  'ring-2 ring-background/80 ring-offset-2 ring-offset-card shadow-md';
export const USER_PROFILE_AVATAR_BG_CLASS = 'bg-muted/30';

/** @deprecated Use AVATAR_OPTIONS */
export const AVATAR_PRESETS = AVATAR_OPTIONS;

/** @deprecated Multiavatar theme count for legacy ID migration */
export const MULTIAVATAR_LEGACY_THEME_COUNT = MULTIAVATAR_THEME_COUNT;

/** @deprecated Multiavatar part count for legacy ID migration */
export const MULTIAVATAR_LEGACY_PART_COUNT = MULTIAVATAR_PART_COUNT;

export type MultiavatarLegacyTheme = MultiavatarTheme;

export const MULTIAVATAR_LEGACY_THEMES = MULTIAVATAR_THEMES;

export function getMultiavatarLegacyIndex(part: string, theme: MultiavatarLegacyTheme): number | null {
  const partIndex = Number.parseInt(part, 10);
  const themeIndex = MULTIAVATAR_THEMES.indexOf(theme);
  if (
    Number.isNaN(partIndex) ||
    partIndex < 0 ||
    partIndex >= MULTIAVATAR_PART_COUNT ||
    themeIndex < 0
  ) {
    return null;
  }
  return partIndex * MULTIAVATAR_THEME_COUNT + themeIndex;
}

export function getAvatarOptionById(id: string): AvatarOption | undefined {
  return AVATAR_OPTIONS.find((option) => option.id === id);
}

export function getAvatarOptionsByPart(part: string): readonly AvatarOption[] {
  return AVATAR_OPTIONS.filter((option) => option.part === part);
}

export function getAvatarOptionIndex(option: AvatarOption): number {
  return AVATAR_OPTIONS.findIndex((entry) => entry.id === option.id);
}

export function getAvatarBackgroundColor(index: number): string {
  const colors = AVATAR_PASTEL_BACKGROUNDS;
  return colors[((index % colors.length) + colors.length) % colors.length];
}

/** @deprecated Use getAvatarSvgDataUrl from avatar-render.ts */
export function getAvatarImageUrl(option: AvatarOption): string {
  return option.id;
}

/** @deprecated */
export function getAvatarPresetById(id: string): AvatarOption | undefined {
  return getAvatarOptionById(id);
}

/** @deprecated */
export function getAvatarPresetIndex(option: AvatarOption): number {
  return getAvatarOptionIndex(option);
}

/** Active bundled pack ID prefixes. */
export const AVATAR_ACTIVE_PREFIXES = [AVATAR_ID_PREFIX] as const;

/** Curated slot count per legacy DiceBear style pack. */
export const AVATAR_SEEDS_PER_STYLE = MULTIAVATAR_PART_COUNT;

/** All bundled pack ID prefixes — used for legacy migration by slot index. */
export const AVATAR_LEGACY_PREFIXES = [
  AVATAR_ID_PREFIX,
  AVATAR_USERPICS_PREFIX,
  AVATAR_AVATAAARS_PREFIX,
  AVATAR_MICAH_PREFIX,
  AVATAR_LORELEI_PREFIX,
  AVATAR_NOTIONISTS_PREFIX,
] as const;

/** @deprecated Use getAvatarOptionsByPart */
export function getAvatarOptionsByStyle(_style: string): readonly AvatarOption[] {
  return AVATAR_OPTIONS;
}

/** @deprecated Use AVATAR_PASTEL_BACKGROUNDS */
export const AVATAR_DICEBEAR_BACKGROUND_COLORS = AVATAR_PASTEL_BACKGROUNDS;

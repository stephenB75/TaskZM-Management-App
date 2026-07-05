/**
 * Avatar Constants
 * DiceBear illustrated SVG avatars (MIT license, free commercial use).
 * https://www.dicebear.com
 */

/** @deprecated Multiavatar pack */
export const AVATAR_MULTIAVATAR_PREFIX = 'taskzm:multiavatar:';
/** @deprecated Craftwork Userpics PNG pack */
export const AVATAR_USERPICS_PREFIX = 'taskzm:userpics:';
/** @deprecated Avataaars pack */
export const AVATAR_AVATAAARS_PREFIX = 'taskzm:avataaars:';
/** Active DiceBear style prefixes */
export const AVATAR_MICAH_PREFIX = 'taskzm:micah:';
export const AVATAR_LORELEI_PREFIX = 'taskzm:lorelei:';
export const AVATAR_NOTIONISTS_PREFIX = 'taskzm:notionists:';
/** @deprecated Icon-based pastel presets */
export const AVATAR_PRESET_PREFIX = 'taskzm:pastel-';
/** @deprecated Portrait PNG avatars */
export const AVATAR_ICON_PREFIX = 'taskzm:icon:';

export type AvatarStyleId = 'lorelei' | 'notionists' | 'micah';

/** Curated seeds per style — deterministic, visually distinct portraits. */
export const AVATAR_SEEDS_PER_STYLE = 16;

export const AVATAR_STYLE_ORDER: readonly AvatarStyleId[] = [
  'lorelei',
  'notionists',
  'micah',
] as const;

export const AVATAR_STYLE_CONFIG: Record<
  AvatarStyleId,
  {
    prefix: string;
    sectionLabel: string;
    credit: string;
    seeds: readonly string[];
  }
> = {
  lorelei: {
    prefix: AVATAR_LORELEI_PREFIX,
    sectionLabel: 'Illustrated ink portraits',
    credit: 'Lorelei by Lisa Wischofsky (CC0)',
    seeds: [
      'amina',
      'benedict',
      'chiara',
      'diego',
      'elena',
      'fatima',
      'goran',
      'hiroshi',
      'imani',
      'jinwei',
      'kenji',
      'lena',
      'marcus',
      'nadia',
      'omar',
      'priya',
    ],
  },
  notionists: {
    prefix: AVATAR_NOTIONISTS_PREFIX,
    sectionLabel: 'Modern editorial portraits',
    credit: 'Notionists by Zoish (CC0)',
    seeds: [
      'andre',
      'blake',
      'cleo',
      'darius',
      'esme',
      'finn',
      'grace',
      'hassan',
      'sarah',
      'tomas',
      'uma',
      'vikram',
      'willa',
      'xavier',
      'yuki',
      'zara',
    ],
  },
  micah: {
    prefix: AVATAR_MICAH_PREFIX,
    sectionLabel: 'Hand-drawn sketch portraits',
    credit: 'Micah Lanier (CC BY 4.0)',
    seeds: [
      'aria',
      'blaze',
      'cruz',
      'dina',
      'ellis',
      'farah',
      'gideon',
      'hanna',
      'ivan',
      'jade',
      'kofi',
      'luz',
      'milan',
      'noor',
      'oliver',
      'quinn',
    ],
  },
};

export const AVATAR_PACK = {
  id: 'dicebear',
  name: 'DiceBear',
  license: 'MIT (DiceBear) · CC0 / CC BY style licenses',
  sourceUrl: 'https://www.dicebear.com/',
  credit: 'Avatars by DiceBear',
} as const;

export interface AvatarOption {
  id: string;
  label: string;
  style: AvatarStyleId;
  seed: string;
  slot: string;
}

const AVATAR_OPTION_LABEL = {
  optionPrefix: 'Portrait',
} as const;

function buildAvatarLabel(sectionLabel: string, slot: string): string {
  return `${sectionLabel} · ${AVATAR_OPTION_LABEL.optionPrefix} ${slot}`;
}

function buildAvatarOptions(): readonly AvatarOption[] {
  return AVATAR_STYLE_ORDER.flatMap((styleId) => {
    const config = AVATAR_STYLE_CONFIG[styleId];
    return config.seeds.map((seed, index) => {
      const slot = String(index + 1).padStart(2, '0');
      return {
        id: `${config.prefix}${slot}`,
        label: buildAvatarLabel(config.sectionLabel, slot),
        style: styleId,
        seed,
        slot,
      };
    });
  });
}

export const AVATAR_OPTIONS = buildAvatarOptions();

export const AVATAR_COUNT = AVATAR_OPTIONS.length;

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0].id;

/** SVG render size in pixels (DiceBear output resolution). */
export const AVATAR_RENDER_SIZE = 128;

/** Soft background palette cycled by avatar index for visual variety. */
export const AVATAR_DICEBEAR_BACKGROUND_COLORS = [
  'b6e3f4',
  'c0aede',
  'd1d4f9',
  'ffd5dc',
  'ffdfbf',
  'c1f2d0',
  'f9e8a8',
  'e8d5f2',
] as const;

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
  selectAvatarDescription: `Browse ${AVATAR_COUNT} illustrated portraits across three hand-crafted styles`,
  changeAvatar: 'Change Avatar',
  saveAvatar: 'Save Avatar',
  saving: 'Saving…',
  cancel: 'Cancel',
  pleaseSelectAvatar: 'Please select an avatar',
  packCredit: `${AVATAR_PACK.credit} · Illustrated portrait styles`,
} as const;

export const AVATAR_CHECKMARK_SIZE = '1.5rem';
export const AVATAR_CHECKMARK_ICON_SIZE = '1rem';

export const USER_PROFILE_AVATAR_RING_CLASS =
  'ring-2 ring-background/80 ring-offset-2 ring-offset-card shadow-md';
export const USER_PROFILE_AVATAR_BG_CLASS = 'bg-muted/30';

/** @deprecated Use AVATAR_OPTIONS */
export const AVATAR_PRESETS = AVATAR_OPTIONS;

/** @deprecated Use AVATAR_MULTIAVATAR_PREFIX */
export const AVATAR_ID_PREFIX = AVATAR_MULTIAVATAR_PREFIX;

/** @deprecated Multiavatar theme count for legacy ID migration */
export const MULTIAVATAR_LEGACY_THEME_COUNT = 3;

/** @deprecated Multiavatar part count for legacy ID migration */
export const MULTIAVATAR_LEGACY_PART_COUNT = 16;

export type MultiavatarLegacyTheme = 'A' | 'B' | 'C';

export const MULTIAVATAR_LEGACY_THEMES: readonly MultiavatarLegacyTheme[] = [
  'A',
  'B',
  'C',
] as const;

export function getMultiavatarLegacyIndex(part: string, theme: MultiavatarLegacyTheme): number | null {
  const partIndex = Number.parseInt(part, 10);
  const themeIndex = MULTIAVATAR_LEGACY_THEMES.indexOf(theme);
  if (
    Number.isNaN(partIndex) ||
    partIndex < 0 ||
    partIndex >= MULTIAVATAR_LEGACY_PART_COUNT ||
    themeIndex < 0
  ) {
    return null;
  }
  return partIndex * MULTIAVATAR_LEGACY_THEME_COUNT + themeIndex;
}

export function getAvatarOptionById(id: string): AvatarOption | undefined {
  return AVATAR_OPTIONS.find((option) => option.id === id);
}

export function getAvatarOptionsByStyle(style: AvatarStyleId): readonly AvatarOption[] {
  return AVATAR_OPTIONS.filter((option) => option.style === style);
}

export function getAvatarOptionIndex(option: AvatarOption): number {
  return AVATAR_OPTIONS.findIndex((entry) => entry.id === option.id);
}

export function getAvatarBackgroundColor(index: number): string {
  const colors = AVATAR_DICEBEAR_BACKGROUND_COLORS;
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
export const AVATAR_ACTIVE_PREFIXES = [
  AVATAR_LORELEI_PREFIX,
  AVATAR_NOTIONISTS_PREFIX,
  AVATAR_MICAH_PREFIX,
] as const;

/** All bundled pack ID prefixes — used for legacy migration by slot index. */
export const AVATAR_LEGACY_PREFIXES = [
  AVATAR_MULTIAVATAR_PREFIX,
  AVATAR_USERPICS_PREFIX,
  AVATAR_AVATAAARS_PREFIX,
  AVATAR_MICAH_PREFIX,
  AVATAR_LORELEI_PREFIX,
  AVATAR_NOTIONISTS_PREFIX,
] as const;

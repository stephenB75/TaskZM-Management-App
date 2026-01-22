/**
 * Text Size Constants
 * Centralized text size definitions for consistent typography across the application
 * These values are used to replace hardcoded text-[Xpx] classes
 */

export const TEXT_SIZES = {
  // Extra small sizes
  xs8: 'text-[8px]',   // 8px
  xs9: 'text-[9px]',   // 9px
  xs10: 'text-[10px]', // 10px - most common in SettingsPanel
  xs11: 'text-[11px]', // 11px
  
  // Small sizes
  sm12: 'text-[12px]', // 12px
  sm13: 'text-[13px]', // 13px
  sm15: 'text-[15px]', // 15px
  
  // Medium sizes
  md18: 'text-[18px]', // 18px
  
  // Responsive sizes (mobile/desktop)
  responsive: {
    xs10_md_xs: 'text-[10px] md:text-xs', // 10px on mobile, xs on desktop
    xs11_sm12: 'text-[11px] sm:text-[12px]', // 11px mobile, 12px tablet+
    xs12_sm13: 'text-[12px] sm:text-[13px]', // 12px mobile, 13px tablet+
    sm15_md18: 'text-[15px] md:text-[18px]', // 15px mobile, 18px desktop
  },
} as const;

// Common text size combinations used frequently
export const COMMON_TEXT_SIZES = {
  // Settings Panel helper text (most common)
  settingsHelper: TEXT_SIZES.xs10,
  settingsHelperResponsive: TEXT_SIZES.responsive.xs10_md_xs,
  
  // Task card text sizes
  taskCardSmall: TEXT_SIZES.xs10,
  taskCardMedium: TEXT_SIZES.xs11,
  taskCardLarge: TEXT_SIZES.sm12,
  taskCardTitleMobile: TEXT_SIZES.sm15,
  taskCardTitleDesktop: TEXT_SIZES.md18,
  
  // Badge and label sizes
  badge: TEXT_SIZES.xs9,
  label: TEXT_SIZES.xs10,
  labelSmall: TEXT_SIZES.xs8,
} as const;

// Settings Panel specific text sizes
export const SETTINGS_PANEL_TEXT_SIZE_BASE = '1rem'; // text-base = 1rem (16px)
export const SETTINGS_PANEL_TEXT_SIZE_LARGE = '1.125rem'; // text-lg = 1.125rem (18px)
export const SETTINGS_PANEL_TEXT_SIZES = {
  helper: TEXT_SIZES.responsive.xs10_md_xs, // text-[10px] md:text-xs - Most common
  helperStatic: TEXT_SIZES.xs10, // text-[10px] - Static helper text
  badge: TEXT_SIZES.xs10, // text-[10px] - Badge text
  label: 'text-sm', // text-sm = 0.875rem (14px) - Standard label text size
  labelSmall: TEXT_SIZES.xs10, // text-[10px] - Small label text
  small: TEXT_SIZES.xs11, // text-[11px] - Small text
  versionInfo: TEXT_SIZES.xs10, // text-[10px] - Version info text
  awardLabel: TEXT_SIZES.xs10, // text-[10px] - Award labels (Earned, Complete, Remaining)
  progressLabel: TEXT_SIZES.xs10, // text-[10px] - Progress labels
} as const;

// Pricing Dialog specific text sizes
export const PRICING_DIALOG_TEXT_SIZES = {
  description: 'text-[11px] md:text-xs', // text-[11px] md:text-xs - Dialog description
  badge: 'text-[9px] md:text-[10px]', // text-[9px] md:text-[10px] - Badge text
  helper: 'text-[10px] md:text-xs', // text-[10px] md:text-xs - Helper text
  small: 'text-[10px] md:text-[11px]', // text-[10px] md:text-[11px] - Small responsive text
  static: {
    xs10: TEXT_SIZES.xs10, // text-[10px] - Static 10px
    xs11: TEXT_SIZES.xs11, // text-[11px] - Static 11px
  },
} as const;


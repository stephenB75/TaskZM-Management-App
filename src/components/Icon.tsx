/**
 * Icon Component using Phosphor Icons
 * Supports duotone style perfect for gradient themes
 * Uses app color theme constants
 */

import React from 'react';
import * as PhosphorIcons from 'phosphor-react';
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT, COLOR_PASTEL_LAVENDER, COLOR_PASTEL_SKY } from '../lib/color-theme';
import { ICON_SIZE_XL } from '../lib/layout-constants';

// Ensure React is available globally for phosphor-react
if (typeof window !== 'undefined' && !(window as any).React) {
  (window as any).React = React;
}

const DEFAULT_ICON_SIZE = ICON_SIZE_XL;

export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

export interface IconProps {
  name: string;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  weight?: IconWeight;
  secondaryColor?: string; // For duotone weight
  useDuotone?: boolean; // Auto-enable duotone for certain icons
}

// Map common icon names to Phosphor icon names
const ICON_NAME_MAP: Record<string, keyof typeof PhosphorIcons> = {
  // Common icons
  'sparkles': 'Sparkle',
  'calendar': 'Calendar',
  'calendar-days': 'CalendarBlank',
  'calendar-blank': 'CalendarBlank',
  'clock': 'Clock',
  'settings': 'Gear',
  'check': 'Check',
  'checkmark': 'Check',
  'check-circle': 'CheckCircle',
  'checkmark-circle': 'CheckCircle',
  'x': 'X',
  'x-circle': 'XCircle',
  'plus': 'Plus',
  'minus': 'Minus',
  'trash': 'Trash',
  'edit': 'Pencil',
  'folder': 'Folder',
  'folder-plus': 'FolderPlus',
  'inbox': 'ArchiveBox',
  'archive': 'Archive',
  'search': 'MagnifyingGlass',
  'filter': 'Funnel',
  'tag': 'Tag',
  'users': 'Users',
  'user': 'User',
  'bell': 'Bell',
  'alert-circle': 'WarningCircle',
  'alert-triangle': 'Warning',
  'warning': 'Warning',
  'info': 'Info',
  'target': 'Target',
  'timer': 'Timer',
  'brain': 'Brain',
  'zap': 'Lightning',
  'refresh': 'ArrowClockwise',
  'refresh-cw': 'ArrowClockwise',
  'arrow-clockwise': 'ArrowClockwise',
  'rotate-ccw': 'ArrowCounterClockwise',
  'repeat': 'Repeat',
  'trash-2': 'Trash',
  'link': 'Link',
  'link-2': 'Link',
  'copy': 'Copy',
  'download': 'Download',
  'upload': 'Upload',
  'chevron-left': 'CaretLeft',
  'chevron-right': 'CaretRight',
  'chevron-up': 'CaretUp',
  'chevron-down': 'CaretDown',
  'caret-left': 'CaretLeft',
  'caret-right': 'CaretRight',
  'caret-up': 'CaretUp',
  'caret-down': 'CaretDown',
  'arrow-left': 'ArrowLeft',
  'arrow-right': 'ArrowRight',
  'menu': 'List',
  'more-vertical': 'DotsThreeVertical',
  'circle': 'Circle',
  'play': 'Play',
  'pause': 'Pause',
  'play-circle': 'PlayCircle',
  'square': 'Square',
  'loader': 'Spinner',
  'loader2': 'Spinner',
  'mail': 'Envelope',
  'lock': 'Lock',
  'eye': 'Eye',
  'eye-off': 'EyeSlash',
  'shield': 'Shield',
  'shield-check': 'ShieldCheck',
  'credit-card': 'CreditCard',
  'award': 'Trophy',
  'trophy': 'Trophy',
  'crown': 'Crown',
  'bar-chart': 'ChartBar',
  'bar-chart-3': 'ChartBar',
  'pie-chart': 'ChartPie',
  'grid': 'GridFour',
  'dashboard': 'GridFour',
  'trending-up': 'TrendUp',
  'activity': 'Activity',
  'file-text': 'FileText',
  'folder-tree': 'Folders',
  'forward': 'ArrowRight',
  'arrow-right': 'ArrowRight',
  'calendar-range': 'CalendarBlank',
  'sparkle': 'Sparkle',
  'sparkling': 'Sparkle',
  'sticky-note': 'Note',
  'list': 'List',
  'list-ordered': 'ListNumbers',
  'list-checks': 'ListChecks',
  'cloud': 'Cloud',
  'cloud-off': 'CloudSlash',
  'cloud-slash': 'CloudSlash',
  'bold': 'TextB',
  'italic': 'TextItalic',
  'underline': 'TextUnderline',
  'strikethrough': 'TextStrikethrough',
  'highlighter': 'Highlighter',
  'type': 'TextAa',
  'eraser': 'Eraser',
  'case-lower': 'TextT',
  'pilcrow': 'Paragraph',
  'code': 'Code',
  'indent': 'TextIndent',
  'outdent': 'TextOutdent',
  'align-left': 'TextAlignLeft',
  'align-center': 'TextAlignCenter',
  'align-right': 'TextAlignRight',
  'align-justify': 'TextAlignJustify',
  'external-link': 'ArrowSquareOut',
  'check-circle-2': 'CheckCircle',
  'rotate-ccw': 'ArrowCounterClockwise',
  'more-vertical': 'DotsThreeVertical',
  'edit-2': 'Pencil',
  'edit': 'Pencil',
  'user-plus': 'UserPlus',
  'x-circle': 'XCircle',
  'loader-2': 'Spinner',
  'sticky-note': 'Note',
  'map-pin': 'MapPin',
  'zoom-out': 'MagnifyingGlassMinus',
  'globe': 'Globe',
  'alert-circle': 'WarningCircle',
  'calendar-days': 'CalendarBlank',
  'calendar-range': 'CalendarBlank',
  'play-circle': 'PlayCircle',
  'coffee': 'Coffee',
  'keyboard': 'Keyboard',
  'log-out': 'SignOut',
  'alert-triangle': 'Warning',
  'folder-plus': 'FolderPlus',
  'external-link': 'ArrowSquareOut',
  'briefcase': 'Briefcase',
  'compass': 'Compass',
  'battery-charging': 'BatteryCharging',
  'sunrise': 'Sunrise',
  'moon': 'Moon',
  'sun': 'Sun',
  'monitor': 'Monitor',
};

// Icons that should use duotone by default for better visual appeal
const DUOTONE_ICONS = new Set([
  'sparkles',
  'sparkle',
  'sparkling',
  'brain',
  'target',
  'trophy',
  'award',
  'crown',
  'zap',
  'star',
  'flame',
  'calendar',
  'calendar-days',
  'calendar-blank',
  'check-circle',
  'checkmark-circle',
  'grid',
  'dashboard',
  'inbox',
  'archive',
  'bar-chart',
]);

export function Icon({
  name,
  size = DEFAULT_ICON_SIZE,
  className = '',
  style,
  color,
  weight,
  secondaryColor,
  useDuotone = false,
}: IconProps) {
  const sizeNum = typeof size === 'string'
    ? parseInt(size.replace(/[^0-9]/g, ''), 10) || DEFAULT_ICON_SIZE
    : size;

  // Get Phosphor icon name
  const phosphorIconName = ICON_NAME_MAP[name.toLowerCase()] || 
    name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase());

  // Get the icon component
  const IconComponent = (PhosphorIcons as any)[phosphorIconName] as React.ComponentType<any>;

  if (!IconComponent) {
    if (import.meta.env.DEV) {
      console.warn(`[Icon] Phosphor icon "${phosphorIconName}" not found for name "${name}"`);
    }
    return null;
  }

  // Determine weight - prefer duotone for certain icons or if explicitly requested
  const shouldUseDuotone = useDuotone || DUOTONE_ICONS.has(name.toLowerCase());
  const iconWeight: IconWeight = weight || (shouldUseDuotone ? 'duotone' : 'regular');

  // Set colors for duotone
  const primaryColor = color || COLOR_PRIMARY;
  const secondary = secondaryColor || (iconWeight === 'duotone' ? COLOR_PRIMARY_LIGHT : undefined);

  // Build props
  const iconProps: any = {
    size: sizeNum,
    weight: iconWeight,
    className,
    style: { ...style },
  };

  // Add colors based on weight
  if (iconWeight === 'duotone' && secondary) {
    iconProps.color = primaryColor;
    iconProps.secondaryColor = secondary;
  } else {
    iconProps.color = primaryColor;
  }

  return <IconComponent {...iconProps} />;
}

// Default export for compatibility
export default Icon;

/**
 * Icon Component using Phosphor Icons
 * Supports duotone style perfect for gradient themes
 * Uses app color theme constants
 */

import React from 'react';
import { PhosphorIcons } from './phosphor-icons';
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT, COLOR_PASTEL_LAVENDER, COLOR_PASTEL_SKY } from '../lib/color-theme';
import { ICON_SIZE_XL } from '../lib/layout-constants';

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
  'calendar-dots': 'Calendar',
  'clock': 'Clock',
  'settings': 'Gear',
  'check': 'CheckCircle',
  'checkmark': 'CheckCircle',
  'check-circle': 'CheckCircle',
  'checkmark-circle': 'CheckCircle',
  'check-square': 'CheckSquare',
  'x': 'X',
  'x-circle': 'XCircle',
  'plus': 'Plus',
  'minus': 'Minus',
  'trash': 'Trash',
  'trash-2': 'Trash',
  'edit': 'Pencil',
  'edit-2': 'Pencil',
  'folder': 'Folder',
  'folder-plus': 'FolderPlus',
  'folder-simple-plus': 'FolderSimplePlus',
  'inbox': 'ArchiveBox',
  'archive': 'Archive',
  'search': 'MagnifyingGlass',
  'zoom-out': 'MagnifyingGlassMinus',
  'filter': 'Funnel',
  'tag': 'Tag',
  'users': 'Users',
  'user': 'User',
  'user-plus': 'UserPlus',
  'user-circle': 'UserCircle',
  'user-circle-check': 'IdentificationBadge',
  'user-focus': 'UserFocus',
  'user-three': 'UsersThree',
  'identification-badge': 'IdentificationBadge',
  'smiley-wink': 'SmileyWink',
  'flower-lotus': 'FlowerLotus',
  'flower': 'Flower',
  'leaf': 'Leaf',
  'heart': 'Heart',
  'star-four': 'StarFour',
  'sun-horizon': 'SunHorizon',
  'bell': 'Bell',
  'alert-circle': 'WarningCircle',
  'alert-triangle': 'Warning',
  'warning': 'Warning',
  'info': 'Info',
  'target': 'Target',
  'timer': 'Timer',
  'brain': 'Brain',
  'head-circuit': 'Brain',
  'circuit': 'Brain',
  'zap': 'Lightning',
  'refresh': 'ArrowClockwise',
  'refresh-cw': 'ArrowClockwise',
  'arrow-clockwise': 'ArrowClockwise',
  'repeat': 'Repeat',
  'link': 'Link',
  'link-2': 'Link',
  'copy': 'CopySimple',
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
  'more-horizontal': 'DotsThree',
  'circle': 'Circle',
  'play': 'Play',
  'pause': 'Pause',
  'play-circle': 'PlayCircle',
  'square': 'Square',
  'loader': 'Spinner',
  'loader2': 'Spinner',
  'loader-2': 'Spinner',
  'mail': 'Envelope',
  'envelope': 'Envelope',
  'envelope-simple': 'EnvelopeSimple',
  'send': 'PaperPlaneTilt',
  'paper-plane-tilt': 'PaperPlaneTilt',
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
  'dashboard': 'Kanban', // Changed from GridFour to Kanban
  'kanban': 'Kanban',
  'trending-up': 'TrendUp',
  'activity': 'Activity',
  'file-text': 'FileText',
  'folder-tree': 'Folders',
  'forward': 'ArrowRight',
  'calendar-range': 'CalendarBlank',
  'calendar-as': 'Calendar',
  'sparkle': 'Sparkle',
  'sparkling': 'Sparkle',
  'sticky-note': 'Note',
  'list': 'List',
  'list-ordered': 'ListNumbers',
  'list-checks': 'ListChecks',
  'bold': 'TextBolder',
  'italic': 'TextItalic',
  'underline': 'TextUnderline',
  'strikethrough': 'TextStrikethrough',
  'type': 'TextAa',
  'eraser': 'Eraser',
  'code': 'Code',
  'align-left': 'TextAlignLeft',
  'align-center': 'TextAlignCenter',
  'align-right': 'TextAlignRight',
  'align-justify': 'TextAlignJustify',
  'indent': 'TextIndent',
  'outdent': 'TextOutdent',
  'pilcrow': 'TextAlignLeft',
  'highlighter': 'HighlighterCircle',
  'external-link': 'ArrowSquareOut',
  'check-circle-2': 'CheckCircle',
  'rotate-ccw': 'ArrowCounterClockwise',
  'map-pin': 'MapPin',
  'globe': 'Globe',
  'coffee': 'Coffee',
  'keyboard': 'Keyboard',
  'sign-out': 'SignOut',
  'log-out': 'SignOut',
  'briefcase': 'Briefcase',
  'compass': 'Compass',
  'battery-charging': 'BatteryCharging',
  'moon': 'Moon',
  'sun': 'Sun',
  'monitor': 'Monitor',
  'sidebar-simple': 'SidebarSimple',
  'panel-left': 'SidebarSimple',
  // Social media icons
  'twitter': 'TwitterLogo',
  'facebook': 'FacebookLogo',
  'instagram': 'InstagramLogo',
  'linkedin': 'LinkedinLogo',
};

// Icons that should use duotone by default for better visual appeal
const DUOTONE_ICONS = new Set([
  'sparkles',
  'sparkle',
  'sparkling',
  'brain',
  'head-circuit', // Added for AI Suggestions icon
  'circuit', // Added for circuit alias
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
  'calendar-dots', // Added for Re-Scheduler icon
  'check-circle',
  'checkmark-circle',
  'user-circle-check',
  'identification-badge',
  'user-focus',
  'sparkle',
  'leaf',
  'flower-lotus',
  'smiley-wink',
  'heart',
  'star-four',
  'sun-horizon',
  'compass',
  'crown',
  'coffee',
  'briefcase',
  'brain',
]);

function Icon({
  name,
  size = DEFAULT_ICON_SIZE,
  className = '',
  style,
  color,
  weight,
  secondaryColor,
  useDuotone = false,
}: IconProps) {
  // Convert size to number - handle rem strings (e.g., "0.75rem" = 12px) and numeric strings
  const sizeNum = typeof size === 'string'
    ? size.includes('rem')
      ? parseFloat(size.replace('rem', '')) * 16 // Convert rem to pixels (1rem = 16px)
      : parseInt(size.replace(/[^0-9]/g, ''), 10) || DEFAULT_ICON_SIZE
    : size || DEFAULT_ICON_SIZE;

  // Get Phosphor icon name
  const phosphorIconName = ICON_NAME_MAP[name.toLowerCase()] || 
    name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase());

  // Get the icon component dynamically from phosphor-react
  let IconComponent: React.ComponentType<any> | undefined;
  try {
    IconComponent = (PhosphorIcons as any)[phosphorIconName] as React.ComponentType<any>;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[Icon] Error accessing Phosphor icon "${phosphorIconName}" for name "${name}":`, error);
    }
    return null;
  }

  if (!IconComponent) {
    if (import.meta.env.DEV) {
      console.warn(`[Icon] Phosphor icon "${phosphorIconName}" not found for name "${name}"`);
    }
    return null;
  }

  // Determine weight - prefer duotone for certain icons or if explicitly requested
  const shouldUseDuotone = useDuotone || DUOTONE_ICONS.has(name.toLowerCase());
  const iconWeight: IconWeight = weight || (shouldUseDuotone ? 'duotone' : 'regular');

  // When color is not passed, use currentColor so caller's className (e.g. text-gray-700) controls icon color.
  // This prevents Icon from overriding Tailwind text-* classes with COLOR_PRIMARY (lavender).
  const primaryColor = color != null && color !== '' ? color : 'currentColor';
  const secondary = secondaryColor != null && secondaryColor !== ''
    ? secondaryColor
    : (iconWeight === 'duotone' && (color != null && color !== '') ? COLOR_PRIMARY_LIGHT : undefined);

  // Build props
  const iconProps: any = {
    size: sizeNum,
    weight: iconWeight,
  };
  
  // Add className if provided and not empty (avoid passing empty strings)
  if (className && typeof className === 'string' && className.trim().length > 0) {
    iconProps.className = className;
  }
  
  // Add style if provided (React handles undefined/null style gracefully)
  if (style != null && typeof style === 'object') {
    iconProps.style = style;
  }

  // Add colors based on weight (only set when not currentColor so Phosphor uses CSS from className)
  if (iconWeight === 'duotone' && secondary) {
    iconProps.color = primaryColor;
    iconProps.secondaryColor = secondary;
  } else {
    iconProps.color = primaryColor;
  }

  return <IconComponent {...iconProps} />;
}

// Export as named export (components import as: import { Icon } from './Icon')
export { Icon };

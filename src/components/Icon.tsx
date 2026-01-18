/**
 * Icon Component using Phosphor Icons
 * Supports duotone style perfect for gradient themes
 * Uses app color theme constants
 */

import React from 'react';
import {
  Sparkle,
  Calendar,
  CalendarBlank,
  Clock,
  Gear,
  Check,
  CheckCircle,
  X,
  XCircle,
  Plus,
  Minus,
  Trash,
  Pencil,
  Folder,
  FolderPlus,
  ArchiveBox,
  Archive,
  MagnifyingGlass,
  Funnel,
  Tag,
  Users,
  User,
  Bell,
  WarningCircle,
  Warning,
  Info,
  Target,
  Timer,
  Brain,
  Lightning,
  ArrowClockwise,
  ArrowCounterClockwise,
  Repeat,
  Link,
  ArrowSquareOut,
  Copy,
  Download,
  Upload,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
  ArrowLeft,
  ArrowRight,
  List,
  DotsThreeVertical,
  Circle,
  Play,
  Pause,
  PlayCircle,
  Square,
  Spinner,
  Envelope,
  PaperPlaneTilt,
  Lock,
  Eye,
  EyeSlash,
  Shield,
  ShieldCheck,
  CreditCard,
  Trophy,
  Crown,
  ChartBar,
  ChartPie,
  GridFour,
  TrendUp,
  Activity,
  FileText,
  Folders,
  Note,
  ListNumbers,
  ListChecks,
  Cloud,
  CloudSlash,
  TextBolder,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  TextAa,
  Eraser,
  Code,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  UserPlus,
  MapPin,
  MagnifyingGlassMinus,
  Globe,
  Coffee,
  Keyboard,
  SignOut,
  Briefcase,
  Compass,
  BatteryCharging,
  Moon,
  Sun,
  Monitor,
} from 'phosphor-react';
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

// Icon registry - maps icon names to actual Phosphor icon components
const ICON_REGISTRY: Record<string, React.ComponentType<any>> = {
  // Common icons
  'Sparkle': Sparkle,
  'Calendar': Calendar,
  'CalendarBlank': CalendarBlank,
  'Clock': Clock,
  'Gear': Gear,
  'Check': Check,
  'CheckCircle': CheckCircle,
  'X': X,
  'XCircle': XCircle,
  'Plus': Plus,
  'Minus': Minus,
  'Trash': Trash,
  'Pencil': Pencil,
  'Folder': Folder,
  'FolderPlus': FolderPlus,
  'ArchiveBox': ArchiveBox,
  'Archive': Archive,
  'MagnifyingGlass': MagnifyingGlass,
  'Funnel': Funnel,
  'Tag': Tag,
  'Users': Users,
  'User': User,
  'Bell': Bell,
  'WarningCircle': WarningCircle,
  'Warning': Warning,
  'Info': Info,
  'Target': Target,
  'Timer': Timer,
  'Brain': Brain,
  'Lightning': Lightning,
  'ArrowClockwise': ArrowClockwise,
  'ArrowCounterClockwise': ArrowCounterClockwise,
  'Repeat': Repeat,
  'Link': Link,
  'ArrowSquareOut': ArrowSquareOut,
  'Copy': Copy,
  'Download': Download,
  'Upload': Upload,
  'CaretLeft': CaretLeft,
  'CaretRight': CaretRight,
  'CaretUp': CaretUp,
  'CaretDown': CaretDown,
  'ArrowLeft': ArrowLeft,
  'ArrowRight': ArrowRight,
  'List': List,
  'DotsThreeVertical': DotsThreeVertical,
  'Circle': Circle,
  'Play': Play,
  'Pause': Pause,
  'PlayCircle': PlayCircle,
  'Square': Square,
  'Spinner': Spinner,
  'Envelope': Envelope,
  'PaperPlaneTilt': PaperPlaneTilt,
  'Lock': Lock,
  'Eye': Eye,
  'EyeSlash': EyeSlash,
  'Shield': Shield,
  'ShieldCheck': ShieldCheck,
  'CreditCard': CreditCard,
  'Trophy': Trophy,
  'Crown': Crown,
  'ChartBar': ChartBar,
  'ChartPie': ChartPie,
  'GridFour': GridFour,
  'TrendUp': TrendUp,
  'Activity': Activity,
  'FileText': FileText,
  'Folders': Folders,
  'Note': Note,
  'ListNumbers': ListNumbers,
  'ListChecks': ListChecks,
  'Cloud': Cloud,
  'CloudSlash': CloudSlash,
  'TextBolder': TextBolder,
  'TextItalic': TextItalic,
  'TextUnderline': TextUnderline,
  'TextStrikethrough': TextStrikethrough,
  'TextAa': TextAa,
  'Eraser': Eraser,
  'Code': Code,
  'TextAlignLeft': TextAlignLeft,
  'TextAlignCenter': TextAlignCenter,
  'TextAlignRight': TextAlignRight,
  'TextAlignJustify': TextAlignJustify,
  'UserPlus': UserPlus,
  'MapPin': MapPin,
  'MagnifyingGlassMinus': MagnifyingGlassMinus,
  'Globe': Globe,
  'Coffee': Coffee,
  'Keyboard': Keyboard,
  'SignOut': SignOut,
  'Briefcase': Briefcase,
  'Compass': Compass,
  'BatteryCharging': BatteryCharging,
  'Moon': Moon,
  'Sun': Sun,
  'Monitor': Monitor,
};

// Map common icon names to Phosphor icon names
const ICON_NAME_MAP: Record<string, string> = {
  // Common icons
  'sparkles': 'Sparkle',
  'calendar': 'Calendar',
  'calendar-days': 'CalendarBlank',
  'calendar-blank': 'CalendarBlank',
  'calendar-range': 'Calendar',
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
  'external-link': 'ArrowSquareOut',
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
  'send': 'PaperPlaneTilt',
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
  'sparkle': 'Sparkle',
  'sparkling': 'Sparkle',
  'sticky-note': 'Note',
  'list': 'List',
  'list-ordered': 'ListNumbers',
  'list-checks': 'ListChecks',
  'cloud': 'Cloud',
  'cloud-off': 'CloudSlash',
  'cloud-slash': 'CloudSlash',
  'bold': 'TextBolder',
  'italic': 'TextItalic',
  'underline': 'TextUnderline',
  'strikethrough': 'TextStrikethrough',
  'highlighter': 'TextBolder', // Highlighter doesn't exist in phosphor-react, using TextBolder as alternative
  'type': 'TextAa',
  'eraser': 'Eraser',
  'case-lower': 'TextAa',
  'pilcrow': 'Code', // Paragraph doesn't exist in phosphor-react, using Code as alternative
  'code': 'Code',
  'indent': 'Code', // TextIndent doesn't exist in phosphor-react, using Code as alternative
  'outdent': 'Code', // TextOutdent doesn't exist in phosphor-react, using Code as alternative
  'align-left': 'TextAlignLeft',
  'align-center': 'TextAlignCenter',
  'align-right': 'TextAlignRight',
  'align-justify': 'TextAlignJustify',
  'check-circle-2': 'CheckCircle',
  'user-plus': 'UserPlus',
  'loader-2': 'Spinner',
  'map-pin': 'MapPin',
  'zoom-out': 'MagnifyingGlassMinus',
  'globe': 'Globe',
  'coffee': 'Coffee',
  'keyboard': 'Keyboard',
  'log-out': 'SignOut',
  'briefcase': 'Briefcase',
  'compass': 'Compass',
  'battery-charging': 'BatteryCharging',
  'sunrise': 'Sun', // Sunrise doesn't exist in phosphor-react, using Sun as alternative
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

  // Get the icon component from registry
  const IconComponent = ICON_REGISTRY[phosphorIconName];

  // Validate component exists and is a valid React component
  // Check for null, undefined, or non-function values
  if (!IconComponent || typeof IconComponent !== 'function') {
    if (import.meta.env.DEV) {
      console.warn(`[Icon] Phosphor icon "${phosphorIconName}" not found for name "${name}". Available icons: ${Object.keys(ICON_REGISTRY).join(', ')}`);
    }
    // Return a fallback div instead of null to prevent React error #130
    return <div style={{ display: 'inline-block', width: sizeNum, height: sizeNum }} aria-hidden="true" />;
  }

  // Final safety check before rendering - ensure component is actually callable
  try {
    // Verify it's a valid React component by checking if it has required properties
    if (!React.isValidElement && typeof IconComponent !== 'function') {
      return <div style={{ display: 'inline-block', width: sizeNum, height: sizeNum }} aria-hidden="true" />;
    }
  } catch (e) {
    // If any error occurs during validation, return fallback
    return <div style={{ display: 'inline-block', width: sizeNum, height: sizeNum }} aria-hidden="true" />;
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

  // Final safety check before rendering
  try {
    // Ensure IconComponent is still valid (could be undefined in some edge cases)
    if (!IconComponent || typeof IconComponent !== 'function') {
      return <div style={{ display: 'inline-block', width: sizeNum, height: sizeNum }} aria-hidden="true" />;
    }
    
    // Render the icon component with error boundary
    const RenderedIcon = IconComponent as React.ComponentType<any>;
    return <RenderedIcon {...iconProps} />;
  } catch (error) {
    // If rendering fails, return fallback
    if (import.meta.env.DEV) {
      console.error('[Icon] Error rendering icon:', error);
    }
    return <div style={{ display: 'inline-block', width: sizeNum, height: sizeNum }} aria-hidden="true" />;
  }
}

// Default export for compatibility
export default Icon;

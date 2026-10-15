/**
 * Color Theme Constants
 * Centralized color palette for the TaskZM application
 * These colors are used throughout the app for consistent theming
 */

// Primary Theme Colors
export const COLOR_PRIMARY = '#737373'; // Neutral brand gray (reads on light and dark surfaces)
export const COLOR_PRIMARY_DARK = '#525252'; // Darker neutral variant
export const COLOR_PRIMARY_LIGHT = '#E5E5E5'; // Light neutral variant
export const COLOR_PRIMARY_SECONDARY = '#171717'; // Manifest theme color

// Pastel Palette Colors
export const COLOR_PASTEL_MINT = '#D9F99D'; // Lime pop
export const COLOR_PASTEL_MINT_DARK = '#5A8A7A'; // Dark mint for dark mode
export const COLOR_PASTEL_LAVENDER = '#DDD6FE'; // Violet pop
export const COLOR_PASTEL_LAVENDER_DARK = '#8A7A9A'; // Dark lavender for dark mode
export const COLOR_PASTEL_SKY = '#BFDBFE'; // Blue pop
export const COLOR_PASTEL_SKY_DARK = '#6A8AAA'; // Dark sky for dark mode
export const COLOR_PASTEL_PEACH = '#FED7AA'; // Orange pop
export const COLOR_PASTEL_LILAC = '#E9D5FF'; // Lilac
export const COLOR_PASTEL_PINK = '#FBCFE8'; // Pink
export const COLOR_PASTEL_YELLOW = '#FEF08A'; // Yellow
export const COLOR_PASTEL_SAGE = '#ECFCCB'; // Soft lime
export const COLOR_PASTEL_SAGE_BORDER = '#A3A3A3'; // Neutral border

// Additional colors for analytics (Power BI inspired)
export const COLOR_ANALYTICS_GREEN = '#10B981'; // Success green (matches COLOR_SUCCESS)
export const COLOR_ANALYTICS_BLUE = '#3B82F6'; // Info blue (matches COLOR_INFO)
export const COLOR_ANALYTICS_ORANGE = '#F59E0B'; // Warning orange (matches COLOR_WARNING)

// Background Colors
export const COLOR_BACKGROUND_LIGHT = '#FAFAFA'; // Light neutral background
export const COLOR_BACKGROUND_WHITE = '#FFFFFF'; // Pure white
export const COLOR_BACKGROUND_GRAY = '#F9FAFB'; // Light gray background
export const COLOR_BACKGROUND_DARK_COLOR = 'rgba(10, 10, 10, 0.95)'; // Dark background for dark mode (matches HEADER_BACKGROUND_DARK_COLOR)

// Pastel pops on the neutral canvas (strong tones for bars and dots)
export const COLOR_POP_LIME = '#BEF264';
export const COLOR_POP_VIOLET = '#C4B5FD';
export const COLOR_POP_ORANGE = '#FDBA74';
export const COLOR_POP_BLUE = '#93C5FD';
export const COLOR_POP_PINK = '#F9A8D4';
export const COLOR_POP_NEUTRAL = '#D4D4D4';
/** Low priority reads as dark gray so it stays distinct from the gray task surfaces. */
export const COLOR_PRIORITY_LOW = '#525252';

// Theme-aware tokens (follow light/dark CSS variables in globals.css)
export const THEME_COLOR = {
  page: 'var(--background)',
  surface: 'var(--card)',
  muted: 'var(--muted)',
  text: 'var(--foreground)',
  textMuted: 'var(--muted-foreground)',
  highlight: 'var(--home-highlight)',
  highlightText: 'var(--home-highlight-foreground)',
  border: 'var(--border)',
  popLime: 'var(--pop-lime)',
  popLimeInk: 'var(--pop-lime-ink)',
  popViolet: 'var(--pop-violet)',
  popVioletInk: 'var(--pop-violet-ink)',
  popOrange: 'var(--pop-orange)',
  popOrangeInk: 'var(--pop-orange-ink)',
  popBlue: 'var(--pop-blue)',
  popBlueInk: 'var(--pop-blue-ink)',
} as const;

// Gradient Colors (for complex gradients)
export const COLOR_GRADIENT_START = '#BEF264'; // Gradient start (lime pop)
export const COLOR_GRADIENT_MID = '#C4B5FD'; // Gradient middle (violet pop)
export const COLOR_GRADIENT_END = '#93C5FD'; // Gradient end (blue pop)

// Status Colors
export const COLOR_SUCCESS = '#10B981'; // Green for success states
export const COLOR_ERROR = '#EF4444'; // Red for error states
export const COLOR_WARNING = '#F59E0B'; // Orange for warnings
export const COLOR_INFO = '#3B82F6'; // Blue for info

// Award Colors (for gamification)
export const COLOR_AWARD_COMMON = '#3B82F6'; // Blue for common awards
export const COLOR_AWARD_RARE = '#8B5CF6'; // Purple for rare awards
export const COLOR_AWARD_EPIC = '#F59E0B'; // Orange for epic awards
export const COLOR_AWARD_LEGENDARY = '#EF4444'; // Red for legendary awards
export const COLOR_AWARD_STREAK = '#F97316'; // Orange-red for streak awards

// Text Colors
export const COLOR_TEXT_PRIMARY = '#1F2937'; // Dark gray for primary text
export const COLOR_TEXT_SECONDARY = '#6B7280'; // Medium gray for secondary text
export const COLOR_TEXT_MUTED = '#9CA3AF'; // Light gray for muted text
export const COLOR_TEXT_WHITE = '#FFFFFF'; // White text
export const COLOR_TEXT_BLACK = '#000000'; // Black text

// Background Colors
export const COLOR_BACKGROUND_TRANSPARENT = 'transparent'; // Transparent background

// Border Colors
export const COLOR_BORDER_LIGHT = '#E5E7EB'; // Light gray border
export const COLOR_BORDER_MEDIUM = '#D1D5DB'; // Medium gray border
export const COLOR_BORDER_DARK = '#9CA3AF'; // Dark gray border

// Badge/Notification Colors
export const COLOR_BADGE_RED = '#EF4444'; // Red for badges/notifications
export const COLOR_BADGE_BLUE = '#3B82F6'; // Blue for badges

// Project Default Color
export const COLOR_PROJECT_DEFAULT = '#3B82F6'; // Blue for default project

// Folder Default Color
export const COLOR_FOLDER_DEFAULT = '#3B82F6'; // Blue for default folder

// Folder Color Options
export const COLOR_FOLDER_BLUE = '#3B82F6'; // Blue
export const COLOR_FOLDER_PURPLE = '#8B5CF6'; // Purple
export const COLOR_FOLDER_PINK = '#EC4899'; // Pink
export const COLOR_FOLDER_AMBER = '#F59E0B'; // Amber
export const COLOR_FOLDER_GREEN = '#10B981'; // Green
export const COLOR_FOLDER_RED = '#EF4444'; // Red
export const COLOR_FOLDER_CYAN = '#06B6D4'; // Cyan
export const COLOR_FOLDER_ORANGE = '#F97316'; // Orange

// Folder Color Options Array (for color picker)
export const FOLDER_COLOR_OPTIONS = [
  COLOR_FOLDER_BLUE,
  COLOR_FOLDER_PURPLE,
  COLOR_FOLDER_PINK,
  COLOR_FOLDER_AMBER,
  COLOR_FOLDER_GREEN,
  COLOR_FOLDER_RED,
  COLOR_FOLDER_CYAN,
  COLOR_FOLDER_ORANGE,
];

// Team Role Colors
export const COLOR_ROLE_ADMIN = '#8B5CF6'; // Purple for admin role
export const COLOR_ROLE_MEMBER = '#3B82F6'; // Blue for member role
export const COLOR_ROLE_VIEWER = '#9CA3AF'; // Gray for viewer role

// Status Badge Colors (for team invitations)
export const COLOR_STATUS_EXPIRED_RED = '#EF4444'; // Red for expired invitations
export const COLOR_STATUS_PENDING_AMBER = '#F59E0B'; // Amber for pending invitations
export const COLOR_STATUS_DECLINED_GRAY = '#6B7280'; // Gray for declined invitations

// Task Status Colors (for team member stats)
export const COLOR_TASK_COMPLETED_GREEN = '#10B981'; // Green for completed tasks
export const COLOR_TASK_IN_PROGRESS_AMBER = '#F59E0B'; // Amber for in-progress tasks
export const COLOR_TASK_TODO_BLUE = '#3B82F6'; // Blue for todo tasks

// Helper function to get color with opacity
export const getColorWithOpacity = (color: string, opacity: number): string => {
  // Convert hex to rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Helper function for Tailwind arbitrary values
export const getTailwindColor = (color: string): string => {
  return `[${color}]`;
};


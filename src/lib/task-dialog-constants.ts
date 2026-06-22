/**
 * Task Dialog Constants
 * 
 * Centralized constants for TaskDialog component UI text, styling, and dimensions
 */

import { AGENDA_LIST_CARD, getAgendaCardBadgeStyles } from './agenda-list-card-constants';
import { TASK_CARD_PRIORITY_COLORS } from './task-card-constants';
import type { TaskPriority } from '../types';

// UI Text Constants
export const TASK_DIALOG_UI_TEXT = {
  // Dialog Titles
  editTask: 'Edit Task',
  createNewTask: 'Create New Task',
  editTaskDescription: 'Update the task details below.',
  createTaskDescription: 'Fill in the details to create a new task.',
  
  // Form Labels
  taskName: 'Task Name *',
  taskNamePlaceholder: 'Enter task name...',
  taskTitlePlaceholder: 'Task title',
  descriptionPlaceholderShort: 'Add a description...',
  status: 'Status',
  priority: 'Priority',
  description: 'Description (Optional)',
  // Minimal view (reference): labels without asterisk/optional
  taskNameMinimal: 'Task Name',
  descriptionMinimal: 'Description',
  scheduledDate: 'Scheduled Date',
  dueDate: 'Due Date',
  // Schedule block: short labels for compact layout
  scheduledSectionTitle: 'Scheduled',
  timeLabel: 'Time',
  dueDatePlaceholder: 'MM/DD/YYYY',
  
  // Minimal view: section title and labels (inspiration: consolidated task dialog)
  taskInfoTitle: 'Task Info',
  priorityLevelLabel: 'Priority Level',

  // Tab Labels
  basicInfo: {
    desktop: 'Basic Info',
    mobile: 'Basic',
  },
  schedule: {
    desktop: 'Schedule',
    mobile: 'Time',
  },
  organize: {
    desktop: 'Organize & Advanced',
    mobile: 'More',
    header: 'Organize', // Reference: short label in header nav
  },
  
  // Status Options
  statusOptions: {
    todo: 'To Do',
    inProgress: 'In Progress',
    done: 'Done',
    onHold: 'On Hold',
  },
  
  // Priority Options
  priorityOptions: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  },
  
  // Buttons
  clear: 'Clear',
  cancel: 'Cancel',
  updateTask: 'Update Task',
  createTask: 'Create Task',
  saving: 'Saving...',
  duplicate: {
    desktop: 'Duplicate',
    mobile: 'Dup',
  },
  delete: {
    desktop: 'Delete',
    mobile: 'Del',
  },
  deleteTask: 'Delete Task',
  
  // Button Tooltips (for icon-only mobile buttons)
  buttonTooltips: {
    duplicate: 'Duplicate',
    delete: 'Delete',
    cancel: 'Cancel',
    createTask: 'Create Task',
    updateTask: 'Update Task',
  },
  
  // Delete Confirmation Dialog
  deleteConfirmation: {
    title: 'Delete Task?',
    description: (taskTitle: string) => `Are you sure you want to delete "${taskTitle}"?`,
    cannotUndo: 'This action cannot be undone.',
    hasSubtasks: (count: number) => `This task has ${count} subtask${count !== 1 ? 's' : ''} that will also be deleted.`,
  },
  
  // Validation
  taskNameRequired: 'Please enter a task name.',
  // Recurrence + Schedule validation
  recurrenceScheduleRequired: 'Recurring tasks need a start date. Please pick a date or turn off recurrence.',

  // Conflict Resolution Dialog
  conflictResolution: {
    title: 'Time Slot Already Taken',
    description: (requestedTime: string, alternativeTime: string) =>
      `The time slot ${requestedTime} is already occupied by another task. Would you like to schedule this task at ${alternativeTime} instead?`,
    useAlternative: (alternativeTime: string) => `Use ${alternativeTime}`,
  },

  // Description / AI
  descriptionRedo: 'Redo',
  descriptionRedoTooltip: 'Redo/Regenerate description (replaces current)',
  aiGenerate: 'AI Generate',
  aiGenerateTooltip: 'Generate new description (appends to existing)',
  aiAnalysis: 'AI Analysis',
  aiAssistUseDuration: 'Use AI duration',
  aiAssistAddSubtasks: 'Add suggested steps',
  aiAssistDurationApplied: 'Duration updated from AI estimate',
  aiAssistSubtasksAdded: (count: number) =>
    `Added ${count} suggested step${count === 1 ? '' : 's'}`,
  aiAssistPrioritySuggested: (priority: string) =>
    `Priority set to ${priority} based on task effort`,
  addedAsSubtask: 'Added as subtask',
  enterNewTagName: 'Enter new tag name...',
  enterSubtaskName: 'Enter subtask name...',
  selectOrAddTag: 'Select or add tag...',
  noFolder: 'No folder',
  addDependency: 'Add dependency...',
  addAssignee: 'Add assignee...',
  selectHour: 'Hour',
  selectMin: 'Min',
  selectAmPm: 'AM/PM',

  // Toasts (description generation)
  toast: {
    aiDescriptionGenerated: 'AI description generated',
    aiDescriptionGeneratedDetail: (domain: string) => `Generated based on ${domain} context. AI Action Plan will update automatically.`,
    aiDescriptionFailed: 'Failed to generate description',
    aiDescriptionFailedDetail: 'The AI could not generate a description. Please try again or enter description manually.',
    aiDescriptionFailedShort: 'Please try again or enter description manually',
  },
} as const;

// Font Sizes
export const TASK_DIALOG_FONT_SIZES = {
  calendarDayHeader: '0.625rem', // text-[10px] = 10px = 0.625rem
  stepNumber: '0.625rem', // text-[10px] = 10px = 0.625rem
  assigneeFallback: '0.625rem', // text-[10px] = 10px = 0.625rem
  xs: '0.75rem', // text-xs = 12px = 0.75rem
  sm: '0.875rem', // text-sm = 14px = 0.875rem
  base: '1rem', // text-base = 16px = 1rem
  lg: '1.125rem', // text-lg = 18px = 1.125rem
  xl: '1.25rem', // text-xl = 20px = 1.25rem
  '2xl': '1.5rem', // text-2xl = 24px = 1.5rem
} as const;

// Component Dimensions
export const TASK_DIALOG_DIMENSIONS = {
  stepNumberCircle: {
    small: {
      width: '1.25rem', // w-5 = 20px = 1.25rem
      height: '1.25rem', // h-5 = 20px = 1.25rem
    },
    medium: {
      width: '1.5rem', // w-6 = 24px = 1.5rem
      height: '1.5rem', // h-6 = 24px = 1.5rem
    },
  },
  inputHeight: {
    small: '2rem', // h-8 = 32px = 2rem
    medium: '2.5rem', // h-10 = 40px = 2.5rem
    large: '2.75rem', // h-11 = 44px = 2.75rem
  },
  calendarButton: {
    height: '1.5rem', // h-6 = 24px = 1.5rem
  },
  dateButton: {
    height: '2rem', // h-8 = 32px = 2rem
  },
  // Footer button dimensions
  footerButton: {
    mobile: {
      height: '2rem', // h-8 = 32px (reduced from h-10 = 40px for mobile)
      paddingX: '0.75rem', // px-3 = 12px (reduced from px-4/px-5 for mobile)
      fontSize: '0.75rem', // text-xs = 12px (reduced from text-sm = 14px for mobile)
      iconSize: 16, // Icon size for mobile (increased for better visibility)
      iconOnly: true, // Use icon-only buttons on mobile
    },
    desktop: {
      height: '2.5rem', // h-10 = 40px
      paddingX: '1.25rem', // px-5 = 20px
      fontSize: '0.875rem', // text-sm = 14px
      iconSize: 16, // ICON_SIZE_MD
    },
  },
} as const;

// Color Classes — aligned with AgendaListCard / task card design
export const TASK_DIALOG_COLORS = {
  assigneeFallbackGradient: 'bg-gradient-to-br from-primary/20 to-primary/40',
  minimalCardBg: 'bg-gray-50/60 dark:bg-gray-800/30 border border-gray-200/60 dark:border-gray-600/40',
  dialogMaxWidth: 'max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl',
  dialogShell: 'bg-white dark:bg-[#3E3E52]',
  sectionCard: 'bg-white dark:bg-[#3E3E52]/90 border border-gray-200/60 dark:border-gray-600/40',
  pillSelected: 'bg-primary/14 text-primary font-semibold',
  pillUnselected: 'bg-gray-100/90 dark:bg-gray-700/40 text-muted-foreground hover:bg-gray-200/80 dark:hover:bg-gray-600/50',
  tabActive: 'bg-primary/12 text-primary font-semibold shadow-sm',
  tabInactive: 'text-muted-foreground hover:bg-gray-100/90 dark:hover:bg-gray-700/40',
  footerCancel: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  footerCreate: 'bg-primary text-primary-foreground hover:bg-primary/90',
  inputFieldBg: 'bg-gray-50/90 dark:bg-gray-800/70 border border-gray-200/80 dark:border-gray-600/50 shadow-sm placeholder:text-muted-foreground/70',
  contentCardBg: 'bg-white dark:bg-[#3E3E52]',
  menuLayerBg: 'bg-white dark:bg-gray-900',
  menuLayerBorder: 'border border-gray-200 dark:border-gray-600',
  /** @deprecated Use contentCardBg — kept for gradual migration */
  dialogBg: 'bg-white dark:bg-[#3E3E52]',
} as const;

/** Section layout tokens (accent dot + line, shared with agenda cards). */
export const TASK_DIALOG_SECTION = {
  paddingPx: AGENDA_LIST_CARD.paddingPx,
  compactPaddingPx: AGENDA_LIST_CARD.compact.paddingPx,
  borderRadiusPx: AGENDA_LIST_CARD.borderRadiusPx,
  shadow: AGENDA_LIST_CARD.shadow,
  accentColumnWidthPx: AGENDA_LIST_CARD.accentColumnWidthPx,
  dotSizePx: AGENDA_LIST_CARD.dotSizePx,
  accentLineWidthPx: AGENDA_LIST_CARD.accentLineWidthPx,
  accentLineMinHeightPx: 28,
  sectionTitleSizePx: 12,
  sectionGapPx: 10,
} as const;

export function getTaskDialogPriorityAccent(priority: string): string {
  const key = priority in TASK_CARD_PRIORITY_COLORS ? priority : 'default';
  return TASK_CARD_PRIORITY_COLORS[key as keyof typeof TASK_CARD_PRIORITY_COLORS].line;
}

export function getTaskDialogPriorityPillStyles(
  priority: TaskPriority,
  selected: boolean,
): { backgroundColor?: string; color?: string } {
  if (!selected) return {};
  const badge = getAgendaCardBadgeStyles(getTaskDialogPriorityAccent(priority));
  return {
    backgroundColor: badge.badgeBackground,
    color: badge.badgeText,
  };
}

// Menu Dimensions
export const TASK_DIALOG_MENU_WIDTH = {
  desktop: '14rem', // 224px
  mobile: '100%',
} as const;

export const TASK_DIALOG_MENU_ITEM_HEIGHT = {
  desktop: '3rem', // 48px
  mobile: '2.5rem', // 40px
} as const;

// Spacing Improvements
export const TASK_DIALOG_SECTION_SPACING = {
  mobile: '1.5rem', // space-y-6
  desktop: '2rem', // space-y-8
} as const;

// Minimal view: responsive compact spacing
export const TASK_DIALOG_MINIMAL_SPACING = {
  headerGap: 'gap-1 sm:gap-2',
  headerPaddingBottom: 'pb-2 sm:pb-3',
  cardPadding: 'p-3 sm:p-3.5',
  cardSpaceY: 'space-y-2 sm:space-y-2.5',
  fieldSpaceY: 'space-y-1 sm:space-y-1.5',
  statusPriorityRowGap: 'gap-1.5 sm:gap-2',
  pillGap: 'gap-1 sm:gap-1.5',
  contentPadding: 'px-0 pb-2 sm:pb-3',
  mobileTabSelectWrapper: 'px-3 pt-3 pb-2 sm:px-4 sm:pt-4 lg:px-5 lg:pt-4 lg:pb-3',
  basicContentSpaceY: 'space-y-3 sm:space-y-4',
  dialogInnerPadding: 'pt-3 px-3 pb-3 sm:pt-4 sm:px-5 sm:pb-4 md:px-6 md:pb-4',
  tabButtonMinHeight: 'min-h-[2rem] sm:min-h-[2.25rem]',
  // Schedule tab: grid and time row spacing (no hardcoded values in component)
  scheduleGridGap: 'gap-6 sm:gap-8',
  scheduleColumnSpaceY: 'space-y-4',
  scheduleTimeRowGap: 'gap-3 sm:gap-4',
  scheduleTimeRowGapCompact: 'gap-2', // time row: fit full width without scroll
  scheduleTimeRowMarginLeft: 'ml-0 sm:ml-4',
  // Time row control sizes (compact so row fits without overflow)
  timeRowHeight: 'h-8',
  timeRowToggleButtonHeight: '[&>button]:h-8', // match timeRowHeight for ToggleGroup inner buttons
  timeRowTogglePadding: '[&>button]:px-2 [&>button]:text-xs',
  timeRowSelectMinWidth: 'min-w-0', // allow selects to shrink; flex-1 shares space
  timeRowClearButtonClass: 'px-2 text-xs text-muted-foreground hover:text-foreground shrink-0',
  // Close button on gradient panel (position + nav right padding so tabs don't overlap)
  closeButtonPosition: 'absolute top-3 right-3 z-20 rounded-md p-1.5',
  navPaddingRightForClose: 'pr-10',
} as const;

// Calendar Constants
export const TASK_DIALOG_CALENDAR = {
  // Calendar grid configuration
  DAYS_IN_GRID: 35, // 5 weeks * 7 days = 35 days for full calendar grid
  WEEKS_IN_GRID: 5, // 5 weeks for full calendar display
  
  // Week day abbreviations (short format for calendar headers)
  WEEK_DAYS_SHORT: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const,
  
  // Week day names (full format for recurrence selection)
  WEEK_DAYS_FULL: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const,
  
  // Icon size for calendar buttons
  ICON_SIZE: 14, // ICON_SIZE_SM = 14px
  /** Days ahead to load calendar events for manual scheduling conflict checks. */
  conflictCheckHorizonDays: 90,
} as const;

// Timezone Constants
export const TASK_DIALOG_TIMEZONE = {
  // UTC offset range for timezone detection
  MIN_OFFSET_HOURS: -12, // Minimum UTC offset (UTC-12)
  MAX_OFFSET_HOURS: 14, // Maximum UTC offset (UTC+14)
} as const;

// Transition Constants
export const TASK_DIALOG_TRANSITIONS = {
  // Button hover transition duration
  BUTTON_HOVER_DURATION: 200, // duration-200 = 200ms
  BUTTON_HOVER_DURATION_CLASS: 'duration-200', // Tailwind class
} as const;

// Calculation Constants
export const TASK_DIALOG_CALCULATIONS = {
  // Used in Math.floor for description preview calculations
  DESCRIPTION_PREVIEW_RATIO: 0.5, // 50% ratio for preview calculations
} as const;

/**
 * Task Dialog Constants
 * 
 * Centralized constants for TaskDialog component UI text, styling, and dimensions
 */

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
  status: 'Status',
  priority: 'Priority',
  description: 'Description (Optional)',
  scheduledDate: 'Scheduled Date',
  dueDate: 'Due Date',
  
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
  
  // Conflict Resolution Dialog
  conflictResolution: {
    title: 'Time Slot Already Taken',
    description: (requestedTime: string, alternativeTime: string) => 
      `The time slot ${requestedTime} is already occupied by another task. Would you like to schedule this task at ${alternativeTime} instead?`,
    useAlternative: (alternativeTime: string) => `Use ${alternativeTime}`,
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

// Color Classes (for intentional design differences)
export const TASK_DIALOG_COLORS = {
  // Intentional design difference: TaskDialog uses primary color with opacity
  // instead of purple gradient like other task cards
  assigneeFallbackGradient: 'bg-gradient-to-br from-primary/20 to-primary/40',
} as const;

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

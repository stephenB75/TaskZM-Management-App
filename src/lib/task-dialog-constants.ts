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
} as const;

// Color Classes (for intentional design differences)
export const TASK_DIALOG_COLORS = {
  // Intentional design difference: TaskDialog uses primary color with opacity
  // instead of purple gradient like other task cards
  assigneeFallbackGradient: 'bg-gradient-to-br from-primary/20 to-primary/40',
} as const;

// Core Task Types
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'on-hold';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null; // ISO date string
  scheduledDate: string | null; // ISO date string for the weekly view
  projectId: string;
  folderId?: string | null; // Optional folder assignment for organizing repeating tasks and projects
  tags: string[];
  assignedTo: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  estimatedTime: number | null; // in minutes
  actualTime: number | null; // in minutes
  dependencies: string[]; // task IDs
  subtasks: Subtask[];
  recurrence: RecurrenceConfig;
  notes: string;
  /** Set when task was created from an imported calendar event; used to avoid showing duplicate event on Today Agenda */
  calendar_event_id?: string | null;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  assignedTo?: string[]; // Optional: assign subtasks to team members
}

export interface RecurrenceConfig {
  type: RecurrenceType;
  interval: number; // e.g., every 2 days
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday
  dayOfMonth?: number;
  endDate?: string | null;
}

// Folder Types
export interface Folder {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  pendingSync?: boolean;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  color: string;
  description: string;
  createdAt: string;
  archived: boolean;
  folderId?: string | null; // Optional folder assignment
}

// Time Tracking Types
export interface TimeTrackingSession {
  id: string;
  taskId: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number; // in seconds
  notes: string;
  pauses: PauseEntry[];
}

export interface PauseEntry {
  startTime: string;
  endTime: string | null;
  duration: number; // in seconds
}

// User and Team Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'member' | 'viewer';
  inviteStatus?: 'pending' | 'accepted' | 'declined';
  hasUnreadNotification?: boolean;
  isDemo?: boolean; // Flag to identify demo users for automatic cleanup
  lastViewedAt?: string | null;
  invitedAt?: string;
  acceptedAt?: string | null;
  expiresAt?: string; // Invitation expiration date
  invitationToken?: string; // Token for pending invitations
  teamId?: string; // Team ID when user is part of a team
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  workspaceId: string; // Teams belong to a workspace
  createdBy: string; // User ID of creator (must be admin)
  createdAt: string;
  updatedAt: string;
  maxMembers: number; // Maximum team members (default: 8)
  memberCount: number; // Current number of members
}

export interface Workspace {
  id: string;
  name: string;
  owner: string;
  members: string[];
  createdAt: string;
}

export interface TeamPresence {
  userId: string;
  userName: string;
  lastActive: string;
  isOnline: boolean;
  currentTask?: string;
}

// Activity Types
export interface Activity {
  id: string;
  workspaceId: string;
  userId: string;
  taskId: string;
  taskTitle?: string;
  action: 'created' | 'updated' | 'deleted' | 'completed' | 'commented';
  timestamp: number;
  details?: string;
}

// Analytics Types
export interface AnalyticsData {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageCompletionTime: number; // in days
  tasksByPriority: Record<TaskPriority, number>;
  tasksByProject: Record<string, number>;
  productivityTrend: ProductivityDataPoint[];
  timeTracking: TimeTrackingAnalytics;
}

export interface ProductivityDataPoint {
  date: string;
  completed: number;
  created: number;
}

export interface TimeTrackingAnalytics {
  totalTime: number; // in seconds
  taskBreakdown: Record<string, number>;
  dailyAverage: number;
  weeklyTotal: number;
}

// Filter and View Types
export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  projects?: string[];
  folders?: string[]; // Filter by folder names (tags)
  assignedTo?: string[];
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  searchQuery?: string;
}

export interface ViewConfig {
  groupBy: 'none' | 'status' | 'priority' | 'project' | 'assignee';
  sortBy: 'dueDate' | 'priority' | 'createdAt' | 'title';
  sortOrder: 'asc' | 'desc';
  showCompleted: boolean;
}

// Settings Types
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;
  sync: SyncSettings;
  accessibility: AccessibilitySettings;
  calendar: CalendarSettings;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  email: boolean;
  reminderMinutes: number[];
}

export interface SyncSettings {
  autoSync: boolean;
  syncInterval: number; // in minutes
  offlineMode: boolean;
  lastSync: string | null;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
  screenReader: boolean;
  keyboardNavigation: boolean;
}

export interface CalendarSettings {
  provider: 'none' | 'google' | 'outlook' | 'apple' | 'caldav';
  syncEnabled: boolean;
  calendarId?: string;
}

export interface CategoryHours {
  work: { start: string; end: string; enabled: boolean };
  personal: { start: string; end: string; enabled: boolean };
  projects: { start: string; end: string; enabled: boolean };
}

export interface HoursSettings {
  weekdayHours: CategoryHours;
  weekendHours: CategoryHours;
  respectHours: boolean;
}

export interface RolloverSettings {
  autoRollover: boolean;
  askBeforeRolling: boolean;
}

// Export Types
export type ExportFormat = 'pdf' | 'csv' | 'ical' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeCompleted: boolean;
  includeArchived: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Template Types
export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  tasks: Partial<Task>[];
  category: string;
  createdAt: string;
}

// Subscription Types
export type SubscriptionTier = 'free' | 'pro';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: 'active' | 'inactive' | 'trial' | 'canceled' | 'cancelled' | 'expired';
  startDate: string | null;
  endDate: string | null;
  cancelAtPeriodEnd: boolean;
  billingPeriod?: 'monthly' | 'yearly' | null; // Track billing period for Pro tier
  /** Where the subscription was purchased (stripe, app_store, play_store, etc.). */
  purchaseStore?: string | null;
  /** RevenueCat customer portal for managing or cancelling a web (card) subscription. */
  managementUrl?: string | null;
}

// Award Types
export type AwardCategory = 'completion' | 'streak' | 'speed' | 'focus' | 'special';

export interface Award {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or icon name
  category: AwardCategory;
  requirement: number; // e.g., 10 tasks completed
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  color: string;
}

export interface UserAward {
  awardId: string;
  earnedAt: string;
  progress?: number; // For progressive awards
}

export interface AwardProgress {
  awardId: string;
  currentProgress: number;
  targetProgress: number;
  percentage: number;
}

export interface SubscriptionFeatures {
  unlimitedTasks: boolean;
  customTags: boolean;
  aiScheduler: boolean;
  taskHours: boolean;
  analytics: boolean;
  taskRollover: boolean;
  pomodoroTimer: boolean;
  teamFeatures: boolean;
  calendarSync: boolean;
  // Feature limits (optional - undefined means unlimited)
  aiSchedulerLimit?: number; // 3 for free, undefined (unlimited) for pro
  analyticsDaysLimit?: number; // null/undefined for free, 30 for monthly, undefined (unlimited) for yearly
  teamMembersLimit?: number; // 0 for free/monthly, undefined (unlimited) for yearly
  recurringTasksLimit?: number; // 5 for monthly, undefined (unlimited) for yearly
  calendarSyncLimit?: number; // 1 for monthly, undefined (unlimited) for yearly
  // Yearly-only features
  recurringTasks?: boolean; // true for pro (both monthly and yearly), false for free
  taskTemplates?: boolean; // true for yearly, false otherwise
  taskDependencies?: boolean; // true for yearly, false otherwise
  multipleWorkspaces?: boolean; // true for yearly, false otherwise
}

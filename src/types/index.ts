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
  status: 'active' | 'inactive' | 'trial' | 'canceled';
  startDate: string | null;
  endDate: string | null;
  cancelAtPeriodEnd: boolean;
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
  calendar: boolean; // Deprecated - use calendarSync instead
  customTags: boolean;
  aiScheduler: boolean;
  taskHours: boolean;
  analytics: boolean;
  taskRollover: boolean;
  pomodoroTimer: boolean;
  teamFeatures: boolean;
  calendarSync: boolean;
}

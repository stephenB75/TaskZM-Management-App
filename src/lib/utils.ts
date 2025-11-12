import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { logger } from './logger';
import type { Task, TaskPriority, TaskStatus, RecurrenceConfig } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date utilities
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeAMPM(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getWeekDates(startDate?: Date): Date[] {
  const start = startDate || new Date();
  const dates: Date[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  
  return dates;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

// Task utilities
export function getPriorityColor(priority: TaskPriority): string {
  const colors = {
    low: 'text-gray-600 bg-gray-50 border-gray-200',
    medium: 'text-blue-600 bg-blue-50 border-blue-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    urgent: 'text-red-600 bg-red-50 border-red-200',
  };
  return colors[priority];
}

export function getStatusColor(status: TaskStatus): string {
  const colors = {
    'todo': 'text-gray-600 bg-gray-50 border-gray-200',
    'in-progress': 'text-blue-600 bg-blue-50 border-blue-200',
    'done': 'text-green-600 bg-green-50 border-green-200',
    'on-hold': 'text-yellow-600 bg-yellow-50 border-yellow-200',
  };
  return colors[status];
}

export function calculateProgress(task: Task): number {
  if (!task.subtasks || task.subtasks.length === 0) {
    return task.status === 'done' ? 100 : 0;
  }
  
  const completed = task.subtasks.filter(st => st.completed).length;
  return Math.round((completed / task.subtasks.length) * 100);
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Time utilities
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function parseDuration(durationStr: string): number {
  const hoursMatch = durationStr.match(/(\d+)h/);
  const minutesMatch = durationStr.match(/(\d+)m/);
  const secondsMatch = durationStr.match(/(\d+)s/);

  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
  const seconds = secondsMatch ? parseInt(secondsMatch[1]) : 0;

  return hours * 3600 + minutes * 60 + seconds;
}

// Filter and search utilities
export function filterTasks(tasks: Task[], filters: {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  projects?: string[];
  searchQuery?: string;
}): Task[] {
  return tasks.filter(task => {
    if (filters.status && !filters.status.includes(task.status)) {
      return false;
    }
    
    if (filters.priority && !filters.priority.includes(task.priority)) {
      return false;
    }
    
    if (filters.projects && !filters.projects.includes(task.projectId)) {
      return false;
    }
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      return (
        (task.title?.toLowerCase().includes(query) || false) ||
        (task.description?.toLowerCase().includes(query) || false) ||
        (task.tags && task.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    return true;
  });
}

export function sortTasks(tasks: Task[], sortBy: 'dueDate' | 'priority' | 'createdAt' | 'title', order: 'asc' | 'desc' = 'asc'): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'dueDate':
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        break;
      case 'priority':
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
    }
    
    return order === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
}

// Export utilities
export function exportToCSV(tasks: Task[]): string {
  const headers = ['Title', 'Description', 'Status', 'Priority', 'Due Date', 'Project', 'Tags'];
  const rows = tasks.map(task => [
    task.title,
    task.description,
    task.status,
    task.priority,
    task.dueDate || '',
    task.projectId,
    (task.tags || []).join('; ')
  ]);
  
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  return csv;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Local storage utilities
export function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    logger.error('Failed to save to localStorage:', error);
  }
}

// Task dependency utilities
export function isTaskBlocked(task: Task, allTasks: Task[]): boolean {
  if (!task.dependencies || task.dependencies.length === 0) return false;
  
  return task.dependencies.some(depId => {
    const depTask = allTasks.find(t => t.id === depId);
    return depTask && depTask.status !== 'done';
  });
}

export function getIncompleteDependencies(task: Task, allTasks: Task[]): Task[] {
  if (!task.dependencies) return [];
  return task.dependencies
    .map(depId => allTasks.find(t => t.id === depId))
    .filter(t => t && t.status !== 'done') as Task[];
}

export function getCompleteDependencies(task: Task, allTasks: Task[]): Task[] {
  if (!task.dependencies) return [];
  return task.dependencies
    .map(depId => allTasks.find(t => t.id === depId))
    .filter(t => t && t.status === 'done') as Task[];
}

export function getDependentTasks(taskId: string, allTasks: Task[]): Task[] {
  return allTasks.filter(t => t.dependencies && t.dependencies.includes(taskId));
}

export function hasCircularDependency(
  taskId: string,
  newDepId: string,
  allTasks: Task[]
): boolean {
  const visited = new Set<string>();
  
  function checkCycle(currentId: string): boolean {
    if (currentId === taskId) return true;
    if (visited.has(currentId)) return false;
    
    visited.add(currentId);
    const currentTask = allTasks.find(t => t.id === currentId);
    
    return currentTask?.dependencies?.some(depId => checkCycle(depId)) || false;
  }
  
  return checkCycle(newDepId);
}

export function validateDependencies(
  task: Task,
  newDeps: string[],
  allTasks: Task[]
): { valid: boolean; error?: string } {
  // Check for self-dependency
  if (newDeps.includes(task.id)) {
    return { valid: false, error: 'A task cannot depend on itself' };
  }
  
  // Check for circular dependencies
  for (const depId of newDeps) {
    if (hasCircularDependency(task.id, depId, allTasks)) {
      return { valid: false, error: 'Circular dependency detected' };
    }
  }
  
  return { valid: true };
}

export function calculateDependencyDepth(task: Task, allTasks: Task[]): number {
  if (!task.dependencies || task.dependencies.length === 0) return 0;
  
  const visited = new Set<string>();
  
  function getDepth(currentTask: Task): number {
    if (visited.has(currentTask.id)) return 0;
    visited.add(currentTask.id);
    
    if (!currentTask.dependencies || currentTask.dependencies.length === 0) return 0;
    
    const depthsArray = currentTask.dependencies.map(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask ? getDepth(depTask) : 0;
    });
    
    return Math.max(...depthsArray) + 1;
  }
  
  return getDepth(task);
}

// Safe initials extraction
export function getInitials(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return '??';
  
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  
  return parts
    .slice(0, 2)
    .map(p => p.charAt(0))
    .join('')
    .toUpperCase();
}

// Safe first name extraction
export function getFirstName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return 'Unknown';
  
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  
  return parts.length > 0 ? parts[0] : 'Unknown';
}

/**
 * Safely prepare a task for editing in TaskDialog
 * Ensures all required fields are present and valid
 */
export function prepareTaskForDialog(task: Task | null | undefined): Task | null {
  if (!task) {
    return null;
  }

  try {
    // Validate required fields
    if (!task.id) {
      logger.error('Task missing ID:', task);
      return null;
    }

    // Create a safe copy with all required fields
    const safeTask: Task = {
      ...task,
      // Ensure required fields have values
      id: task.id,
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || new Date().toISOString(),
      createdBy: task.createdBy || '',
      projectId: task.projectId || 'default',
      // Ensure arrays are always arrays
      tags: Array.isArray(task.tags) ? task.tags : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
      // Ensure recurrence config is valid
      recurrence: task.recurrence && typeof task.recurrence === 'object' 
        ? {
            type: task.recurrence.type || 'none',
            interval: task.recurrence.interval || 1,
            daysOfWeek: Array.isArray(task.recurrence.daysOfWeek) ? task.recurrence.daysOfWeek : undefined,
            dayOfMonth: task.recurrence.dayOfMonth,
            endDate: task.recurrence.endDate || null,
          }
        : { type: 'none', interval: 1 },
      // Optional fields with safe defaults
      notes: task.notes || '',
      dueDate: task.dueDate || null,
      scheduledDate: task.scheduledDate || null,
      completedAt: task.completedAt || null,
      estimatedTime: task.estimatedTime || null,
      actualTime: task.actualTime || null,
      folderId: task.folderId || null,
    };

    return safeTask;
  } catch (error) {
    logger.error('Error preparing task for dialog:', error, task);
    return null;
  }
}

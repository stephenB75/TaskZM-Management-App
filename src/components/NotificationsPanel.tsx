import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Clock,
  AlertCircle,
  CheckCircle2,
  Timer,
  X,
  Filter,
} from "lucide-react";
import { useTasks } from "../contexts/TaskContext";
import { useNotifications } from "../contexts/NotificationContext";
import { usePomodoro } from "../contexts/PomodoroContext";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "../lib/utils";
import type { Task } from "../types";
import {
  NOTIFICATION_STORAGE_KEYS,
  NOTIFICATION_TITLES,
  NOTIFICATION_MESSAGES,
  NOTIFICATION_TYPES,
  NOTIFICATION_PANEL_TEXT,
  NOTIFICATION_TIME_FORMATS,
} from "../lib/notification-constants";

interface NotificationItem {
  id: string;
  type: 'task-overdue' | 'task-due-soon' | 'pomodoro-complete' | 'pomodoro-break' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  taskId?: string;
  priority?: Task['priority'];
}

export function NotificationsPanel() {
  const { tasks } = useTasks();
  const { badgeCount, settings } = useNotifications();
  const { getTimerState } = usePomodoro();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [readNotifications, setReadNotifications] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEYS.readNotifications) || '[]'))
  );

  // Save read notifications to localStorage
  useEffect(() => {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.readNotifications, JSON.stringify(Array.from(readNotifications)));
  }, [readNotifications]);

  // Track last seen Pomodoro session counts to detect new completions
  const [lastSeenSessions, setLastSeenSessions] = useState<Record<string, number>>(
    () => JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEYS.lastSeenPomodoroSessions) || '{}')
  );

  // Save last seen sessions to localStorage
  useEffect(() => {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.lastSeenPomodoroSessions, JSON.stringify(lastSeenSessions));
  }, [lastSeenSessions]);

  // Generate notifications from tasks
  useEffect(() => {
    const now = new Date();
    const newNotifications: NotificationItem[] = [];

    // Overdue tasks (check both dueDate and scheduledDate)
    if (settings.overdueAlerts) {
      tasks
        .filter(task => {
          if (task.status === 'done') return false;
          
          // Check dueDate first
          if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            return dueDate < today;
          }
          
          // Check scheduledDate if no dueDate
          if (task.scheduledDate) {
            const scheduledDate = new Date(task.scheduledDate);
            scheduledDate.setHours(0, 0, 0, 0);
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            return scheduledDate < today;
          }
          
          return false;
        })
        .forEach(task => {
          // Use dueDate if available, otherwise use scheduledDate
          const dateToUse = task.dueDate || task.scheduledDate;
          const dateText = dateToUse ? new Date(dateToUse).toLocaleDateString() : '';
          const notificationId = `overdue_${task.id}`;
          
          newNotifications.push({
            id: notificationId,
            type: NOTIFICATION_TYPES.taskOverdue as NotificationItem['type'],
            title: NOTIFICATION_TITLES.taskOverdue,
            message: NOTIFICATION_MESSAGES.taskWasDue(task.title, dateText),
            timestamp: new Date(dateToUse || now),
            read: readNotifications.has(notificationId),
            taskId: task.id,
            priority: task.priority,
          });
        });
    }

    // Tasks due soon (check both dueDate and scheduledDate)
    if (settings.dueDateReminders) {
      const reminderTime = new Date(now.getTime() + settings.reminderTime * 60 * 1000);
      
      tasks
        .filter(task => {
          if (task.status === 'done') return false;
          
          // Check dueDate first
          if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            return dueDate >= now && dueDate <= reminderTime;
          }
          
          // Check scheduledDate if no dueDate
          if (task.scheduledDate) {
            const scheduledDate = new Date(task.scheduledDate);
            return scheduledDate >= now && scheduledDate <= reminderTime;
          }
          
          return false;
        })
        .forEach(task => {
          // Use dueDate if available, otherwise use scheduledDate
          const dateToUse = task.dueDate || task.scheduledDate;
          if (!dateToUse) return;
          
          const targetDate = new Date(dateToUse);
          const timeUntil = Math.round((targetDate.getTime() - now.getTime()) / (1000 * 60));
          const timeText = timeUntil < NOTIFICATION_TIME_FORMATS.minutesThreshold
            ? NOTIFICATION_MESSAGES.timeMinutes(timeUntil)
            : NOTIFICATION_MESSAGES.timeHours(Math.round(timeUntil / 60));
          
          const notificationId = `due-soon_${task.id}`;
          
          newNotifications.push({
            id: notificationId,
            type: NOTIFICATION_TYPES.taskDueSoon as NotificationItem['type'],
            title: NOTIFICATION_TITLES.taskDueSoon,
            message: NOTIFICATION_MESSAGES.taskDueIn(task.title, timeText),
            timestamp: targetDate,
            read: readNotifications.has(notificationId),
            taskId: task.id,
            priority: task.priority,
          });
        });
    }

    // Pomodoro timer completions - detect new session completions
    const updatedLastSeen: Record<string, number> = { ...lastSeenSessions };
    tasks.forEach(task => {
      const timerState = getTimerState(task.id);
      const lastSeen = lastSeenSessions[task.id] || 0;
      
      if (timerState.sessionsCompleted > lastSeen) {
        // New session(s) completed
        const newSessions = timerState.sessionsCompleted - lastSeen;
        const notificationId = `pomodoro_${task.id}_${timerState.sessionsCompleted}`;
        
        if (!readNotifications.has(notificationId)) {
          newNotifications.push({
            id: notificationId,
            type: NOTIFICATION_TYPES.pomodoroComplete as NotificationItem['type'],
            title: NOTIFICATION_TITLES.pomodoroComplete,
            message: NOTIFICATION_MESSAGES.pomodoroSessionsCompleted(newSessions, task.title),
            timestamp: new Date(),
            read: false,
            taskId: task.id,
          });
        }
        
        updatedLastSeen[task.id] = timerState.sessionsCompleted;
      } else if (timerState.sessionsCompleted > 0) {
        // Keep existing notification if not read
        const notificationId = `pomodoro_${task.id}_${timerState.sessionsCompleted}`;
        if (!readNotifications.has(notificationId)) {
          newNotifications.push({
            id: notificationId,
            type: NOTIFICATION_TYPES.pomodoroComplete as NotificationItem['type'],
            title: NOTIFICATION_TITLES.pomodoroComplete,
            message: NOTIFICATION_MESSAGES.pomodoroSessionsCompleted(timerState.sessionsCompleted, task.title),
            timestamp: new Date(),
            read: false,
            taskId: task.id,
          });
        }
        updatedLastSeen[task.id] = timerState.sessionsCompleted;
      }
    });
    
    // Update last seen sessions
    if (JSON.stringify(updatedLastSeen) !== JSON.stringify(lastSeenSessions)) {
      setLastSeenSessions(updatedLastSeen);
    }

    // Sort by timestamp (newest first)
    newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Debug logging to help diagnose notification panel issues
    if (newNotifications.length > 0) {
      console.debug('NotificationsPanel: Generated notifications', {
        total: newNotifications.length,
        overdue: newNotifications.filter(n => n.type === 'task-overdue').length,
        dueSoon: newNotifications.filter(n => n.type === 'task-due-soon').length,
        pomodoro: newNotifications.filter(n => n.type === 'pomodoro-complete').length,
        unread: newNotifications.filter(n => !n.read).length,
      });
    }
    
    setNotifications(newNotifications);
  }, [tasks, settings, readNotifications, getTimerState, lastSeenSessions]);

  const filteredNotifications = notifications.filter(notif => {
    if (filterType === "all") return true;
    return notif.type === filterType;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setReadNotifications(prev => new Set([...prev, id]));
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadNotifications(prev => new Set([...prev, ...allIds]));
  };

  const clearNotification = (id: string) => {
    markAsRead(id);
    // Optionally remove from list after a delay
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 300);
  };

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'task-overdue':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'task-due-soon':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'pomodoro-complete':
      case 'pomodoro-break':
        return <Timer className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  const getPriorityColor = (priority?: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500';
      case 'high':
        return 'border-l-orange-500';
      case 'medium':
        return 'border-l-blue-500';
      case 'low':
        return 'border-l-gray-400';
      default:
        return 'border-l-gray-300';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#E4E0EF] to-[#DCD6EB] dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <AppHeader
        title={NOTIFICATION_PANEL_TEXT.title}
        panelOpen={true}
        isSidePanelHeader={true}
        description={NOTIFICATION_MESSAGES.unreadCount(unreadCount)}
        hideDesktopLogo
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            className="flex"
            disabled={unreadCount === 0}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{NOTIFICATION_PANEL_TEXT.markAllRead}</span>
            <span className="sm:hidden">{NOTIFICATION_PANEL_TEXT.markRead}</span>
          </Button>
        }
      />
      {/* Spacer for fixed header on mobile */}
      <div className="md:hidden h-[64px]" />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Filters */}
        <div className="px-4 md:px-8 py-4 border-b border-primary/10 bg-white/50 dark:bg-background/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px] h-10 bg-white dark:bg-card">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder={NOTIFICATION_PANEL_TEXT.filters.placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{NOTIFICATION_PANEL_TEXT.filters.all}</SelectItem>
                <SelectItem value={NOTIFICATION_TYPES.taskOverdue}>{NOTIFICATION_PANEL_TEXT.filters.overdue}</SelectItem>
                <SelectItem value={NOTIFICATION_TYPES.taskDueSoon}>{NOTIFICATION_PANEL_TEXT.filters.dueSoon}</SelectItem>
                <SelectItem value={NOTIFICATION_TYPES.pomodoroComplete}>{NOTIFICATION_PANEL_TEXT.filters.pomodoro}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3 pb-safe md:pb-4">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-primary/40" />
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {filterType === "all"
                    ? NOTIFICATION_PANEL_TEXT.emptyState.noNotifications
                    : NOTIFICATION_PANEL_TEXT.emptyState.noNotificationsOfType}
                </p>
                <p className="text-xs text-muted-foreground">
                  {NOTIFICATION_PANEL_TEXT.emptyState.allCaughtUp}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredNotifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className={cn(
                        "p-4 border-l-4 transition-all cursor-pointer hover:shadow-md",
                        !notification.read && "bg-primary/5 border-l-4",
                        notification.read && "opacity-60",
                        getPriorityColor(notification.priority)
                      )}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold mb-1">
                                {notification.title}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {notification.message}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-2">
                                {notification.timestamp.toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!notification.read && (
                                <Badge
                                  variant="default"
                                  className="w-2 h-2 p-0 rounded-full bg-primary"
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearNotification(notification.id);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}


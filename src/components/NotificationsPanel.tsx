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
  Award as AwardIcon,
} from "lucide-react";
import { useTasks } from "../contexts/TaskContext";
import { useNotifications } from "../contexts/NotificationContext";
import { usePomodoro } from "../contexts/PomodoroContext";
import { useAwards } from "../contexts/AwardContext";
import type { Award } from "../types";
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
import { UI_NOTIFICATIONS_PANEL_GRADIENTS } from "../lib/ui-colors";
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
  type: 'task-overdue' | 'task-due-soon' | 'pomodoro-complete' | 'pomodoro-break' | 'award-earned' | 'system' | 'toast-success' | 'toast-error' | 'toast-info' | 'toast-warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  taskId?: string;
  priority?: Task['priority'];
  awardId?: string;
}

export function NotificationsPanel() {
  const { tasks } = useTasks();
  const { badgeCount, settings, getToastNotifications, markToastAsRead, clearToastNotification, updateBadge } = useNotifications();
  const { getTimerState } = usePomodoro();
  const { earnedAwards, awards } = useAwards();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [readNotifications, setReadNotifications] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEYS.readNotifications) || '[]'))
  );
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEYS.dismissedNotifications) || '[]'))
  );

  // Save read notifications to localStorage
  useEffect(() => {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.readNotifications, JSON.stringify(Array.from(readNotifications)));
  }, [readNotifications]);

  // Save dismissed notifications to localStorage
  useEffect(() => {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.dismissedNotifications, JSON.stringify(Array.from(dismissedNotifications)));
  }, [dismissedNotifications]);

  // Track last seen Pomodoro session counts to detect new completions
  const [lastSeenSessions, setLastSeenSessions] = useState<Record<string, number>>(
    () => JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEYS.lastSeenPomodoroSessions) || '{}')
  );

  // Save last seen sessions to localStorage
  useEffect(() => {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.lastSeenPomodoroSessions, JSON.stringify(lastSeenSessions));
  }, [lastSeenSessions]);

  // Track last seen awards to detect new awards
  const [lastSeenAwards, setLastSeenAwards] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEYS.lastSeenAwards) || '[]'))
  );

  // Save last seen awards to localStorage
  useEffect(() => {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.lastSeenAwards, JSON.stringify(Array.from(lastSeenAwards)));
  }, [lastSeenAwards]);

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
          
          // Skip if notification was dismissed
          if (dismissedNotifications.has(notificationId)) {
            return;
          }
          
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
          
          // Distinguish between "due now" (within 5 minutes) and "upcoming" (more than 5 minutes away)
          const isDueNow = timeUntil <= 5;
          const timeText = timeUntil < NOTIFICATION_TIME_FORMATS.minutesThreshold
            ? NOTIFICATION_MESSAGES.timeMinutes(timeUntil)
            : NOTIFICATION_MESSAGES.timeHours(Math.round(timeUntil / 60));
          
          const notificationId = `due-soon_${task.id}`;
          
          // Skip if notification was dismissed
          if (dismissedNotifications.has(notificationId)) {
            return;
          }
          
          newNotifications.push({
            id: notificationId,
            type: NOTIFICATION_TYPES.taskDueSoon as NotificationItem['type'],
            title: isDueNow ? NOTIFICATION_TITLES.taskDueNow : NOTIFICATION_TITLES.taskUpcoming,
            message: isDueNow 
              ? NOTIFICATION_MESSAGES.taskDueNow(task.title)
              : NOTIFICATION_MESSAGES.taskUpcoming(task.title, timeText),
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
        
        // Skip if notification was dismissed
        if (!dismissedNotifications.has(notificationId) && !readNotifications.has(notificationId)) {
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
        // Keep existing notification if not read and not dismissed
        const notificationId = `pomodoro_${task.id}_${timerState.sessionsCompleted}`;
        if (!dismissedNotifications.has(notificationId) && !readNotifications.has(notificationId)) {
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

    // Add award notifications - show all earned awards (not just new ones)
    // This allows users to see their achievements in the notification panel
    earnedAwards.forEach(userAward => {
      const notificationId = `award_${userAward.awardId}`;
      
      // Skip if already dismissed
      if (dismissedNotifications.has(notificationId)) return;
      
      // Find award details from awards array
      const award = awards.find((a: Award) => a.id === userAward.awardId);
      if (award) {
        // Check if this is a new award (not in lastSeenAwards) - mark as unread
        const isNew = !lastSeenAwards.has(userAward.awardId);
        if (isNew) {
          // Mark as seen
          setLastSeenAwards(prev => new Set([...prev, userAward.awardId]));
        }
        
        newNotifications.push({
          id: notificationId,
          type: NOTIFICATION_TYPES.awardEarned as NotificationItem['type'],
          title: NOTIFICATION_TITLES.awardEarned,
          message: NOTIFICATION_MESSAGES.awardEarned(award.name),
          timestamp: new Date(userAward.earnedAt),
          read: readNotifications.has(notificationId) || !isNew,
          awardId: userAward.awardId,
        });
      }
    });

    // Add toast notifications from storage
    const toastNotifications = getToastNotifications();
    toastNotifications.forEach(toast => {
      // Skip if already dismissed
      if (dismissedNotifications.has(toast.id)) return;
      
      const notificationType = `toast-${toast.type}` as NotificationItem['type'];
      newNotifications.push({
        id: toast.id,
        type: notificationType,
        title: toast.title,
        message: toast.description || '',
        timestamp: new Date(toast.timestamp),
        read: toast.read,
      });
    });
    
    // Sort by timestamp (newest first)
    newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Debug logging to help diagnose notification panel issues
    if (newNotifications.length > 0) {
      console.debug('NotificationsPanel: Generated notifications', {
        total: newNotifications.length,
        overdue: newNotifications.filter(n => n.type === 'task-overdue').length,
        dueSoon: newNotifications.filter(n => n.type === 'task-due-soon').length,
        pomodoro: newNotifications.filter(n => n.type === 'pomodoro-complete').length,
        toast: newNotifications.filter(n => n.type.startsWith('toast-')).length,
        unread: newNotifications.filter(n => !n.read).length,
      });
    }
    
    setNotifications(newNotifications);
  }, [tasks, settings, readNotifications, dismissedNotifications, getTimerState, lastSeenSessions, getToastNotifications, earnedAwards, awards, lastSeenAwards]);

  const filteredNotifications = notifications.filter(notif => {
    if (filterType === "all") return true;
    if (filterType === "toast") {
      return notif.type.startsWith('toast-');
    }
    if (filterType === "award") {
      return notif.type === NOTIFICATION_TYPES.awardEarned;
    }
    return notif.type === filterType;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setReadNotifications(prev => new Set([...prev, id]));
    // Also mark toast notifications as read if it's a toast notification
    if (id.startsWith('toast_')) {
      markToastAsRead(id);
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadNotifications(prev => new Set([...prev, ...allIds]));
    // Also mark all toast notifications as read
    notifications.forEach(n => {
      if (n.id.startsWith('toast_')) {
        markToastAsRead(n.id);
      }
    });
    // Trigger badge update after marking all as read
    setTimeout(() => {
      updateBadge();
    }, 100);
  };

  const clearNotification = (id: string) => {
    // Mark as dismissed so it won't be regenerated
    setDismissedNotifications(prev => new Set([...prev, id]));
    markAsRead(id);
    // Clear toast notifications from storage if it's a toast notification
    if (id.startsWith('toast_')) {
      clearToastNotification(id);
    }
    // Remove from list immediately
    setNotifications(prev => prev.filter(n => n.id !== id));
    // Trigger badge update after notification is cleared
    // Use setTimeout to ensure state updates are complete
    setTimeout(() => {
      updateBadge();
    }, 100);
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
      case 'award-earned':
        return <AwardIcon className="w-4 h-4 text-yellow-500" />;
      case 'toast-success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'toast-error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'toast-warning':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'toast-info':
        return <Bell className="w-4 h-4 text-blue-500" />;
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
    <div className={`h-full flex flex-col ${UI_NOTIFICATIONS_PANEL_GRADIENTS.main.className} dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`}>
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
                <SelectItem value={NOTIFICATION_TYPES.awardEarned}>{NOTIFICATION_PANEL_TEXT.filters.award}</SelectItem>
                <SelectItem value="toast">{NOTIFICATION_PANEL_TEXT.filters.toast}</SelectItem>
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


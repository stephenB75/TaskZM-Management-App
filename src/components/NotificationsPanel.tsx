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
    () => new Set(JSON.parse(localStorage.getItem('readNotifications') || '[]'))
  );

  // Save read notifications to localStorage
  useEffect(() => {
    localStorage.setItem('readNotifications', JSON.stringify(Array.from(readNotifications)));
  }, [readNotifications]);

  // Track last seen Pomodoro session counts to detect new completions
  const [lastSeenSessions, setLastSeenSessions] = useState<Record<string, number>>(
    () => JSON.parse(localStorage.getItem('lastSeenPomodoroSessions') || '{}')
  );

  // Save last seen sessions to localStorage
  useEffect(() => {
    localStorage.setItem('lastSeenPomodoroSessions', JSON.stringify(lastSeenSessions));
  }, [lastSeenSessions]);

  // Generate notifications from tasks
  useEffect(() => {
    const now = new Date();
    const newNotifications: NotificationItem[] = [];

    // Overdue tasks
    if (settings.overdueAlerts) {
      tasks
        .filter(task => {
          if (task.status === 'done' || !task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          return dueDate < today;
        })
        .forEach(task => {
          newNotifications.push({
            id: `overdue_${task.id}`,
            type: 'task-overdue',
            title: 'Task Overdue',
            message: `${task.title} was due ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : ''}`,
            timestamp: new Date(task.dueDate || now),
            read: readNotifications.has(`overdue_${task.id}`),
            taskId: task.id,
            priority: task.priority,
          });
        });
    }

    // Tasks due soon
    if (settings.dueDateReminders) {
      const reminderTime = new Date(now.getTime() + settings.reminderTime * 60 * 1000);
      
      tasks
        .filter(task => {
          if (task.status === 'done' || !task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate >= now && dueDate <= reminderTime;
        })
        .forEach(task => {
          const dueDate = new Date(task.dueDate!);
          const timeUntil = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60));
          const timeText = timeUntil < 60 
            ? `${timeUntil} minutes` 
            : `${Math.round(timeUntil / 60)} hours`;
          
          newNotifications.push({
            id: `due-soon_${task.id}`,
            type: 'task-due-soon',
            title: 'Task Due Soon',
            message: `${task.title} is due in ${timeText}`,
            timestamp: dueDate,
            read: readNotifications.has(`due-soon_${task.id}`),
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
            type: 'pomodoro-complete',
            title: 'Pomodoro Complete',
            message: `Completed ${newSessions} session${newSessions > 1 ? 's' : ''} for "${task.title}"`,
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
            type: 'pomodoro-complete',
            title: 'Pomodoro Complete',
            message: `Completed ${timerState.sessionsCompleted} session${timerState.sessionsCompleted > 1 ? 's' : ''} for "${task.title}"`,
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
    <div className="h-full flex flex-col bg-gradient-to-b from-[#FAF9FC] to-[#F9F7FD] dark:from-gray-950 dark:to-gray-900">
      <AppHeader
        title="Notifications"
        panelOpen={true}
        isSidePanelHeader={true}
        description={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
        hideDesktopLogo
        actions={
          unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden">Mark read</span>
            </Button>
          )
        }
      />
      {/* Spacer for fixed header on mobile */}
      <div className="md:hidden h-[64px]" />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Filters */}
        <div className="px-4 md:px-8 py-4 border-b border-primary/10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px] h-10 bg-white dark:bg-gray-900">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Notifications</SelectItem>
                <SelectItem value="task-overdue">Overdue Tasks</SelectItem>
                <SelectItem value="task-due-soon">Due Soon</SelectItem>
                <SelectItem value="pomodoro-complete">Pomodoro</SelectItem>
              </SelectContent>
            </Select>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="ml-auto"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
            )}
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
                    ? "No notifications"
                    : "No notifications of this type"}
                </p>
                <p className="text-xs text-muted-foreground">
                  You're all caught up!
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


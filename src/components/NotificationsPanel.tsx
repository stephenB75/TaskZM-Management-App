import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "./Icon";
import {
  ICON_SIZE_MD,
  ICON_SIZE_XS,
  EMPTY_STATE_ICON_SIZE_LARGE,
  getCheckboxSizePxForWidth,
  getCheckboxVisualSizePxForWidth,
  VIEWPORT_BREAKPOINTS,
  MOBILE_PADDING_BOTTOM,
} from "../lib/layout-constants";
import { useTasks } from "../contexts/TaskContext";
import { useNotifications } from "../contexts/NotificationContext";
import { usePomodoro } from "../contexts/PomodoroContext";
import { useAwards } from "../contexts/AwardContext";
import type { Award } from "../types";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { UI_INBOX_GRADIENTS, UI_NOTIFICATIONS_PANEL_GRADIENTS } from "../lib/ui-colors";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { TIMING_CONSTANTS } from "../lib/timing-constants";
import { NotificationCard, type NotificationCardItem } from "./NotificationCard";
import {
  NOTIFICATION_STORAGE_KEYS,
  NOTIFICATION_TITLES,
  NOTIFICATION_MESSAGES,
  NOTIFICATION_TYPES,
  NOTIFICATION_PANEL_TEXT,
  NOTIFICATION_TIME_FORMATS,
  NOTIFICATION_FILTER_OPTIONS,
  NOTIFICATION_PANEL,
  groupNotificationsByDate,
} from "../lib/notification-constants";
import {
  getDueSoonTasks,
  getOverdueTasks,
  getTaskNotificationTargetDate,
  isTaskDueNow,
} from "../lib/notification-task-filters";

export function NotificationsPanel() {
  const { tasks } = useTasks();
  const { settings, getToastNotifications, markToastAsRead, clearToastNotification, updateBadge } = useNotifications();
  const { getTimerState } = usePomodoro();
  const { earnedAwards, awards } = useAwards();
  const shouldUseMobileLayout = useMobileLayout();
  const [notifications, setNotifications] = useState<NotificationCardItem[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [readNotifications, setReadNotifications] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEYS.readNotifications) || '[]'))
  );
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEYS.dismissedNotifications) || '[]'))
  );
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<Set<string>>(new Set());
  const [checkboxSizePx, setCheckboxSizePx] = useState(() =>
    getCheckboxSizePxForWidth(typeof window !== 'undefined' ? window.innerWidth : VIEWPORT_BREAKPOINTS.desktop),
  );
  const [visualSizePx, setVisualSizePx] = useState(() =>
    getCheckboxVisualSizePxForWidth(typeof window !== 'undefined' ? window.innerWidth : VIEWPORT_BREAKPOINTS.desktop),
  );

  useEffect(() => {
    const onResize = () => {
      setCheckboxSizePx(getCheckboxSizePxForWidth(window.innerWidth));
      setVisualSizePx(getCheckboxVisualSizePxForWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    const newNotifications: NotificationCardItem[] = [];

    // Overdue tasks
    if (settings.overdueAlerts) {
      getOverdueTasks(tasks, { dismissedNotificationIds: dismissedNotifications, now })
        .forEach(task => {
          const dateToUse = getTaskNotificationTargetDate(task);
          const dateText = dateToUse ? dateToUse.toLocaleDateString() : '';
          const notificationId = `overdue_${task.id}`;

          newNotifications.push({
            id: notificationId,
            type: NOTIFICATION_TYPES.taskOverdue as NotificationCardItem['type'],
            title: NOTIFICATION_TITLES.taskOverdue,
            message: NOTIFICATION_MESSAGES.taskWasDue(task.title, dateText),
            timestamp: new Date(dateToUse || now),
            read: readNotifications.has(notificationId),
            taskId: task.id,
            priority: task.priority,
          });
        });
    }

    // Tasks due soon
    if (settings.dueDateReminders) {
      getDueSoonTasks(tasks, settings.reminderTime, { dismissedNotificationIds: dismissedNotifications, now })
        .forEach(task => {
          const targetDate = getTaskNotificationTargetDate(task);
          if (!targetDate) return;

          const timeUntil = Math.round((targetDate.getTime() - now.getTime()) / TIMING_CONSTANTS.timeConversions.minutesToMs);
          const isDueNow = isTaskDueNow(task, now);
          const timeText = timeUntil < NOTIFICATION_TIME_FORMATS.minutesThreshold
            ? NOTIFICATION_MESSAGES.timeMinutes(timeUntil)
            : NOTIFICATION_MESSAGES.timeHours(Math.round(timeUntil / TIMING_CONSTANTS.timeConversions.hoursToMinutes));

          const notificationId = `due-soon_${task.id}`;

          newNotifications.push({
            id: notificationId,
            type: NOTIFICATION_TYPES.taskDueSoon as NotificationCardItem['type'],
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

    // Pomodoro timer completions - detect new session completions (skip completed tasks)
    const updatedLastSeen: Record<string, number> = { ...lastSeenSessions };
    tasks.forEach(task => {
      if (task.status === 'done') return;

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
            type: NOTIFICATION_TYPES.pomodoroComplete as NotificationCardItem['type'],
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
            type: NOTIFICATION_TYPES.pomodoroComplete as NotificationCardItem['type'],
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
          type: NOTIFICATION_TYPES.awardEarned as NotificationCardItem['type'],
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
      
      const notificationType = `toast-${toast.type}` as NotificationCardItem['type'];
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

  const filteredNotifications = notifications.filter((notif) => {
    if (filterType === "all") return true;
    if (filterType === "toast") return notif.type.startsWith('toast-');
    return notif.type === filterType;
  });

  const groupedNotifications = useMemo(
    () => groupNotificationsByDate(filteredNotifications),
    [filteredNotifications],
  );

  // Clear selection when notifications change (e.g., after deletion or filter change)
  useEffect(() => {
    setSelectedNotificationIds(prev => {
      const currentNotificationIds = new Set(filteredNotifications.map(n => n.id));
      const filtered = new Set([...prev].filter(id => currentNotificationIds.has(id)));
      return filtered.size !== prev.size ? filtered : prev;
    });
  }, [filteredNotifications]);

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
    // Remove from selection if it was selected
    setSelectedNotificationIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    // Trigger badge update after notification is cleared
    // Use setTimeout to ensure state updates are complete
    setTimeout(() => {
      updateBadge();
    }, 100);
  };

  const clearSelectedNotifications = () => {
    selectedNotificationIds.forEach(id => {
      clearNotification(id);
    });
    setSelectedNotificationIds(new Set());
  };

  const handleToggleSelect = (id: string) => {
    setSelectedNotificationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedNotificationIds.size === filteredNotifications.length) {
      setSelectedNotificationIds(new Set());
    } else {
      setSelectedNotificationIds(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const renderNotificationsList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: NOTIFICATION_PANEL.sectionGapPx }}>
      {filteredNotifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg',
              UI_INBOX_GRADIENTS.emptyState.className,
            )}
          >
            <Icon name="bell" size={EMPTY_STATE_ICON_SIZE_LARGE} weight="duotone" className="text-primary" />
          </div>
          <h3 className="text-xl mb-2">
            {filterType === "all"
              ? NOTIFICATION_PANEL_TEXT.emptyState.noNotifications
              : NOTIFICATION_PANEL_TEXT.emptyState.noNotificationsOfType}
          </h3>
          <p className="text-muted-foreground max-w-sm text-sm">
            {NOTIFICATION_PANEL_TEXT.emptyState.allCaughtUp}
          </p>
        </motion.div>
      ) : (
        groupedNotifications.map((group) => (
          <motion.section
            key={group.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            layout
          >
            <div
              className="flex items-baseline text-muted-foreground"
              style={{
                gap: NOTIFICATION_PANEL.sectionTitleFontSizePx - 5,
                marginBottom: NOTIFICATION_PANEL.listGapPx,
              }}
            >
              <span
                className="font-semibold uppercase tracking-wider"
                style={{
                  fontSize: NOTIFICATION_PANEL.sectionTitleFontSizePx,
                  letterSpacing: `${NOTIFICATION_PANEL.sectionTitleLetterSpacingEm}em`,
                }}
              >
                {group.label}
              </span>
              <span
                className="font-medium tabular-nums"
                style={{ fontSize: NOTIFICATION_PANEL.sectionTitleFontSizePx }}
              >
                {group.items.length}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: NOTIFICATION_PANEL.listGapPx,
              }}
            >
              <AnimatePresence mode="popLayout">
                {group.items.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ delay: index * 0.02 }}
                    layout
                  >
                    <NotificationCard
                      notification={notification}
                      selected={selectedNotificationIds.has(notification.id)}
                      onToggleSelect={() => handleToggleSelect(notification.id)}
                      onMarkAsRead={() => markAsRead(notification.id)}
                      onDismiss={() => clearNotification(notification.id)}
                      checkboxSizePx={checkboxSizePx}
                      visualSizePx={visualSizePx}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        ))
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'flex flex-col',
        UI_NOTIFICATIONS_PANEL_GRADIENTS.main.className,
        'dark:from-gray-950 dark:via-gray-900 dark:to-gray-900',
        shouldUseMobileLayout ? 'min-h-full' : 'h-full',
      )}
    >
      <AppHeader
        title={NOTIFICATION_PANEL_TEXT.title}
        panelOpen={true}
        isSidePanelHeader={true}
        description={
          unreadCount > 0
            ? NOTIFICATION_MESSAGES.unreadCount(unreadCount)
            : NOTIFICATION_PANEL_TEXT.emptyState.allCaughtUp
        }
        hideDesktopLogo
        actions={
          selectedNotificationIds.size > 0 ? (
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handleSelectAll}
                variant="outline"
                className="rounded-full px-2.5 sm:px-3"
                size="sm"
              >
                <span className="hidden sm:inline">
                  {selectedNotificationIds.size === filteredNotifications.length
                    ? NOTIFICATION_PANEL_TEXT.deselectAll
                    : NOTIFICATION_PANEL_TEXT.selectAll}
                </span>
                <span className="sm:hidden">
                  {selectedNotificationIds.size === filteredNotifications.length ? 'Deselect' : 'All'}
                </span>
              </Button>
              <Button
                onClick={clearSelectedNotifications}
                variant="destructive"
                className="rounded-full px-2.5 sm:px-3"
                size="sm"
              >
                <Icon name="trash-2" size={ICON_SIZE_MD} className="sm:mr-2" />
                <span className="hidden sm:inline">
                  {NOTIFICATION_PANEL_TEXT.clearSelected} ({selectedNotificationIds.size})
                </span>
                <span className="sm:hidden">{selectedNotificationIds.size}</span>
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="rounded-full px-3"
              disabled={unreadCount === 0}
            >
              <Icon name="check-circle" size={ICON_SIZE_XS} className="mr-2" />
              <span className="hidden sm:inline">{NOTIFICATION_PANEL_TEXT.markAllRead}</span>
              <span className="sm:hidden">{NOTIFICATION_PANEL_TEXT.markRead}</span>
            </Button>
          )
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 md:px-8 py-4 md:py-5 border-b border-primary/10 bg-white/50 dark:bg-background/50 backdrop-blur-sm flex-shrink-0">
          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
            style={{ gap: NOTIFICATION_PANEL.filterChipGapPx }}
          >
            {NOTIFICATION_FILTER_OPTIONS.map((option) => {
              const isActive = filterType === option.id;
              const count =
                option.id === 'all'
                  ? notifications.length
                  : option.id === 'toast'
                    ? notifications.filter((n) => n.type.startsWith('toast-')).length
                    : notifications.filter((n) => n.type === option.id).length;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilterType(option.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-all flex-shrink-0',
                    isActive
                      ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                      : 'border-border/60 bg-card/80 text-muted-foreground hover:border-primary/25 hover:text-foreground',
                  )}
                  style={{ height: NOTIFICATION_PANEL.filterChipHeightPx }}
                >
                  <Icon name={option.icon} size={ICON_SIZE_XS} weight={isActive ? 'duotone' : 'regular'} />
                  {option.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                        isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {!shouldUseMobileLayout ? (
            <div className="h-full overflow-y-auto overscroll-contain">
              <div className="p-4 md:px-8 pb-safe md:pb-8">{renderNotificationsList()}</div>
            </div>
          ) : (
            <div
              className="p-4 md:px-8"
              style={{
                paddingBottom:
                  typeof window !== 'undefined' &&
                  window.innerWidth < VIEWPORT_BREAKPOINTS.tablet
                    ? MOBILE_PADDING_BOTTOM
                    : undefined,
              }}
            >
              {renderNotificationsList()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


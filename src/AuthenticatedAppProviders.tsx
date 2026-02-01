import React from 'react';
import { Toaster } from './components/ui/sonner';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { TaskProvider } from './contexts/TaskContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { TeamProvider } from './contexts/TeamContext';
import { AwardProvider } from './contexts/AwardContext';
import { CalendarProvider } from './contexts/CalendarContext';
import { AIProvider } from './contexts/AIContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { PomodoroProvider } from './contexts/PomodoroContext';
import { DragDropProvider } from './contexts/DragDropContext';
import { DocumentHead } from './components/DocumentHead';
import AppContent from './AppContent';

/**
 * Wraps the logged-in app in all providers (Subscription, Task, Loading, etc.)
 * and renders DocumentHead, AppContent, and Toaster.
 * No AuthProvider or AuthScreen here; those live in AuthenticatedApp.
 */
export default function AuthenticatedAppProviders() {
  return (
    <SubscriptionProvider>
      <TaskProvider>
        <LoadingProvider>
          <TeamProvider>
            <AwardProvider>
              <CalendarProvider>
                <AIProvider>
                  <NotificationProvider>
                    <SidebarProvider>
                      <PomodoroProvider>
                        <DragDropProvider>
                          <DocumentHead />
                          <AppContent />
                          <Toaster />
                        </DragDropProvider>
                      </PomodoroProvider>
                    </SidebarProvider>
                  </NotificationProvider>
                </AIProvider>
              </CalendarProvider>
            </AwardProvider>
          </TeamProvider>
        </LoadingProvider>
      </TaskProvider>
    </SubscriptionProvider>
  );
}

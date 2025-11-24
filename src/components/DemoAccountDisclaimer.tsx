import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle, Clock, LogOut, Sparkles } from 'lucide-react';

interface DemoAccountDisclaimerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoAccountDisclaimer({
  open,
  onOpenChange,
}: DemoAccountDisclaimerProps) {
  const handleContinue = () => {
    // Mark disclaimer as seen for this session
    sessionStorage.setItem('demo_disclaimer_seen', 'true');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Prevent closing by clicking outside or pressing Escape
      // User must click the "I Understand" button
      if (!newOpen) {
        // Only allow closing if disclaimer has been seen
        const disclaimerSeen = sessionStorage.getItem('demo_disclaimer_seen');
        if (disclaimerSeen) {
          onOpenChange(false);
        }
      }
    }}>
      <DialogContent 
        className="sm:max-w-md"
        onInteractOutside={(e) => {
          // Prevent closing by clicking outside
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing by pressing Escape
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-xl font-semibold">
              Demo Account Active
            </DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              You're currently using a <strong className="text-foreground">temporary demo account</strong> with{' '}
              <strong className="text-foreground">full access</strong> to all Pro features.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Important: This account is temporary
                  </p>
                  <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1.5 list-disc list-inside">
                    <li>
                      <strong>Account will be removed</strong> when you log out
                    </li>
                    <li>
                      <strong>Automatic cleanup</strong> after 15 minutes of inactivity
                    </li>
                    <li>
                      All data will be <strong>permanently deleted</strong>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Inactivity Timer
                  </p>
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    Your account will be automatically cleaned up if inactive for more than{' '}
                    <strong>15 minutes</strong>. Stay active to keep your session!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50">
                <LogOut className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
                    Sign Out Warning
                  </p>
                  <p className="text-xs text-purple-800 dark:text-purple-200">
                    Logging out will immediately delete your demo account and all associated data.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 pb-1">
              <p className="text-xs text-muted-foreground text-center">
                To keep your data permanently, please{' '}
                <strong className="text-foreground">create a regular account</strong> or{' '}
                <strong className="text-foreground">upgrade to Pro</strong>.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white"
          >
            I Understand, Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


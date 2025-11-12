import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AlertCircle, Info, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface CalDAVCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (credentials: { email: string; appPassword: string }) => void;
}

export function CalDAVCredentialsDialog({
  open,
  onOpenChange,
  onConfirm,
}: CalDAVCredentialsDialogProps) {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && appPassword) {
      setIsSubmitting(true);
      try {
        await onConfirm({ email, appPassword });
        // Only close dialog and clear fields if successful
        setEmail('');
        setAppPassword('');
        onOpenChange(false);
      } catch (error) {
        // Error is already handled in onConfirm, just keep dialog open
        console.error('Error in CalDAV confirmation:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleOpenAppleID = () => {
    window.open('https://appleid.apple.com', '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect Apple Calendar</DialogTitle>
          <DialogDescription>
            Enter your iCloud credentials to sync with Apple Calendar
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-2">How to get an App-Specific Password:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to <button type="button" onClick={handleOpenAppleID} className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">appleid.apple.com</button> <ExternalLink className="w-3 h-3 inline ml-1" /></li>
                <li>Sign in with your Apple ID</li>
                <li>Navigate to <strong>Security</strong> → <strong>App-Specific Passwords</strong></li>
                <li>Click <strong>"Generate Password"</strong> or the <strong>"+"</strong> button</li>
                <li>Label it <strong>"TaskZM Calendar"</strong></li>
                <li>Copy and paste the generated password here (format: xxxx-xxxx-xxxx-xxxx)</li>
              </ol>
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
                <strong>Note:</strong> You must have Two-Factor Authentication enabled on your Apple ID.
              </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="icloud-email">iCloud Email</Label>
            <Input
              id="icloud-email"
              type="email"
              placeholder="your.email@icloud.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Your iCloud email address (e.g., name@icloud.com, name@me.com, name@mac.com)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-password">App-Specific Password</Label>
            <Input
              id="app-password"
              type="password"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              The app-specific password you generated (not your regular Apple ID password)
            </p>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!email || !appPassword || isSubmitting}
            >
              {isSubmitting ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


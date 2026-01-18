import React, { useState, useEffect } from 'react';
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
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
// Icons migrated to Icon component
import { Icon } from './Icon';
import { ICON_SIZE_XS, ICON_SIZE_MD, ICON_SIZE_LG } from '../lib/layout-constants';
import { toast } from '../lib/toast-wrapper';
import { useAuth } from '../contexts/AuthContext';
import { projectId } from '../utils/supabase/info';

interface AppleCalDAVSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface DiscoveredCalendar {
  href: string;
  displayName: string;
  color?: string;
  ctag?: string;
}

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/taskzm-database-function`;

export function AppleCalDAVSetupDialog({
  open,
  onOpenChange,
  onComplete,
}: AppleCalDAVSetupDialogProps) {
  const { accessToken } = useAuth();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<DiscoveredCalendar[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<DiscoveredCalendar[]>([]);

  const totalSteps = 3;

  const handleOpenAppleID = () => {
    window.open('https://appleid.apple.com', '_blank');
  };

  const handleTestConnection = async () => {
    if (!email || !appPassword) {
      setError('Please enter your email and app-specific password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BASE_URL}/calendar/apple/caldav/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, appPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setCalendars(data.calendars || []);
        setStep(2);
        toast.success('Connected successfully!');
      } else {
        setError(data.message || 'Connection failed');
      }
    } catch (err) {
      setError('Failed to connect. Please check your credentials.');
      console.error('CalDAV test error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscoverCalendars = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BASE_URL}/calendar/apple/caldav/discover`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, appPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setCalendars(data.calendars || []);
      } else {
        setError(data.error || 'Failed to discover calendars');
      }
    } catch (err) {
      setError('Failed to discover calendars');
      console.error('CalDAV discover error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCalendar = (calendar: DiscoveredCalendar) => {
    setSelectedCalendars(prev => {
      const exists = prev.find(c => c.href === calendar.href);
      if (exists) {
        return prev.filter(c => c.href !== calendar.href);
      } else {
        return [...prev, calendar];
      }
    });
  };

  const handleSaveAndSync = async () => {
    if (selectedCalendars.length === 0) {
      setError('Please select at least one calendar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Save credentials and selected calendars
      const saveResponse = await fetch(`${BASE_URL}/calendar/apple/caldav/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          appPassword, 
          selectedCalendars 
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveData.success) {
        throw new Error(saveData.error || 'Failed to save settings');
      }

      // Trigger initial sync with user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      
      const syncResponse = await fetch(`${BASE_URL}/calendar/apple/caldav/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userTimezone }),
      });

      const syncData = await syncResponse.json();

      if (syncData.success) {
        setStep(3);
        toast.success('Calendar sync complete!', {
          description: `Imported ${syncData.created} events`,
        });
      } else {
        // Still move forward if save succeeded
        setStep(3);
        toast.warning('Sync completed with some issues', {
          description: syncData.error || 'Some events may not have been imported',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
      console.error('CalDAV save/sync error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
    setStep(1);
    setEmail('');
    setAppPassword('');
    setCalendars([]);
    setSelectedCalendars([]);
    setError(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a delay to allow animation
    setTimeout(() => {
      setStep(1);
      setError(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="calendar" size={ICON_SIZE_LG} weight="duotone" />
            Connect Apple Calendar
          </DialogTitle>
          <DialogDescription>
            Import events from iCloud Calendar into TaskZM
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s ? <Icon name="check" size={ICON_SIZE_MD} /> : s}
              </div>
            ))}
          </div>

          {/* Step 1: Credentials */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Icon name="info" size={ICON_SIZE_MD} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800 dark:text-blue-300">
                    <p className="font-semibold mb-2">How to get an App-Specific Password:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Go to <button type="button" onClick={handleOpenAppleID} className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">appleid.apple.com</button> <Icon name="external-link" size={ICON_SIZE_XS} className="inline ml-1" /></li>
                      <li>Sign in with your Apple ID</li>
                      <li>Navigate to <strong>Sign-In and Security</strong> → <strong>App-Specific Passwords</strong></li>
                      <li>Click <strong>"Generate Password"</strong></li>
                      <li>Label it <strong>"TaskZM"</strong></li>
                      <li>Copy the generated password (format: xxxx-xxxx-xxxx-xxxx)</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="icloud-email">iCloud Email</Label>
                  <Input
                    id="icloud-email"
                    type="email"
                    placeholder="your.email@icloud.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="app-password">App-Specific Password</Label>
                  <Input
                    id="app-password"
                    type="password"
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Icon name="alert-circle" size={16} className="text-red-600 dark:text-red-400" />
                    <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Calendar Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select the calendars you want to import:
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscoverCalendars}
                  disabled={isLoading}
                >
                  <Icon name="refresh-cw" size={ICON_SIZE_MD} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              <ScrollArea className="h-[250px] rounded-md border p-4">
                {calendars.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No calendars found
                  </p>
                ) : (
                  <div className="space-y-3">
                    {calendars.map((calendar) => {
                      const isSelected = selectedCalendars.some(c => c.href === calendar.href);
                      return (
                        <div
                          key={calendar.href}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-primary/10 border-primary' 
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => handleToggleCalendar(calendar)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleCalendar(calendar)}
                          />
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ 
                              backgroundColor: calendar.color || '#6366f1' 
                            }}
                          />
                          <span className="text-sm font-medium flex-1">
                            {calendar.displayName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <p className="text-xs text-muted-foreground">
                {selectedCalendars.length} calendar(s) selected
              </p>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Icon name="alert-circle" size={16} className="text-red-600 dark:text-red-400" />
                    <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                <Icon name="check-circle" size={ICON_SIZE_3XL} className="text-green-600 dark:text-green-400 mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-2">Calendar Connected!</h3>
                <p className="text-sm text-muted-foreground">
                  Your iCloud Calendar events are now synced to TaskZM.
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">What happens next:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <Icon name="check" size={ICON_SIZE_XS} className="text-green-500" />
                    Events appear in your calendar view with a pastel iCloud badge
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="check" size={ICON_SIZE_XS} className="text-green-500" />
                    Events are read-only (changes sync from iCloud only)
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="check" size={ICON_SIZE_XS} className="text-green-500" />
                    Sync runs automatically to keep events up to date
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {step > 1 && step < 3 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={isLoading}
            >
              Back
            </Button>
          )}
          
          {step === 1 && (
            <Button 
              onClick={handleTestConnection} 
              disabled={isLoading || !email || !appPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Connect
                  <Icon name="arrow-right" size={ICON_SIZE_MD} className="ml-2" />
                </>
              )}
            </Button>
          )}

          {step === 2 && (
            <Button 
              onClick={handleSaveAndSync} 
              disabled={isLoading || selectedCalendars.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  Import Calendars
                  <Icon name="arrow-right" size={ICON_SIZE_MD} className="ml-2" />
                </>
              )}
            </Button>
          )}

          {step === 3 && (
            <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
              <Icon name="check" size={ICON_SIZE_MD} className="mr-2" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


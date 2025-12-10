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
import { 
  Info, 
  ExternalLink, 
  Check, 
  Copy, 
  Smartphone, 
  RefreshCw,
  ArrowRight,
  Link2,
  Calendar,
  ArrowLeftRight
} from 'lucide-react';
import { toast } from '../lib/toast-wrapper';
import { useAuth } from '../contexts/AuthContext';
import { projectId } from '../utils/supabase/info';

interface AppleCalendarSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface SyncTokenData {
  token: string;
  expiresAt: string;
  endpoints: {
    getTasks: string;
    postEvents: string;
  };
}

export function AppleCalendarSetupDialog({
  open,
  onOpenChange,
  onComplete,
}: AppleCalendarSetupDialogProps) {
  const { accessToken } = useAuth();
  const [step, setStep] = useState(1);
  const [syncData, setSyncData] = useState<SyncTokenData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const totalSteps = 3;

  // Fetch sync token when dialog opens
  useEffect(() => {
    if (open && !syncData && accessToken) {
      fetchSyncToken();
    }
  }, [open, accessToken]);

  const fetchSyncToken = async () => {
    if (!accessToken) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-65e6e67f/calendar/apple/sync-token`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get sync token');
      }

      const data = await response.json();
      setSyncData(data);
    } catch (error) {
      console.error('Error fetching sync token:', error);
      toast.error('Failed to generate sync token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
    setStep(1);
    toast.success('Apple Calendar connected!', {
      description: 'Your shortcut will sync tasks with TaskZM.',
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Connect Apple Calendar
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1">
            <ArrowLeftRight className="w-4 h-4" />
            Two-way sync using Apple Shortcuts
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
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
            ))}
          </div>

          {/* Step 1: Get API URLs */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Step 1: Your Sync URLs
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  These URLs allow your Apple Shortcut to sync with TaskZM. Keep them private!
                </p>

                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : syncData ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Get Tasks URL (TaskZM → Calendar)</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background p-2 rounded border overflow-x-auto">
                          {syncData.endpoints.getTasks}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(syncData.endpoints.getTasks, 'getTasks')}
                        >
                          {copiedField === 'getTasks' ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium">Post Events URL (Calendar → TaskZM)</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background p-2 rounded border overflow-x-auto">
                          {syncData.endpoints.postEvents}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(syncData.endpoints.postEvents, 'postEvents')}
                        >
                          {copiedField === 'postEvents' ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      Token expires: {new Date(syncData.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <Button onClick={fetchSyncToken} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Generate URLs
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Create Shortcut */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Step 2: Create the Shortcut
                </h3>
                
                <div className="space-y-3 text-xs">
                  <p className="text-muted-foreground">
                    Create a shortcut on your iPhone/iPad/Mac with these actions:
                  </p>

                  <div className="space-y-2">
                    <div className="p-3 bg-background rounded border">
                      <p className="font-medium text-foreground mb-1">Part A: Sync Tasks TO Calendar</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                        <li>Add "Get Contents of URL" → paste the <strong>Get Tasks URL</strong></li>
                        <li>Add "Get Dictionary from Input"</li>
                        <li>Add "Repeat with Each" over Dictionary Value (key: tasks)</li>
                        <li>Inside repeat: Add "Add New Event" with:
                          <ul className="list-disc list-inside ml-4">
                            <li>Title: Repeat Item → title</li>
                            <li>Start Date: Repeat Item → startDate</li>
                            <li>End Date: Repeat Item → endDate</li>
                            <li>Notes: Repeat Item → notes</li>
                          </ul>
                        </li>
                      </ol>
                    </div>

                    <div className="p-3 bg-background rounded border">
                      <p className="font-medium text-foreground mb-1">Part B: Sync Calendar TO TaskZM</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                        <li>Add "Find Calendar Events" (next 2 weeks)</li>
                        <li>Add "Repeat with Each" over Calendar Events</li>
                        <li>Build a list of event dictionaries with id, title, startDate, endDate, notes</li>
                        <li>Add "Get Contents of URL" → paste the <strong>Post Events URL</strong></li>
                        <li>Set Method to POST, Request Body to JSON with {"{"}"events": [your list]{"}"}</li>
                      </ol>
                    </div>
                  </div>

                  <p className="text-muted-foreground mt-2">
                    <strong>Tip:</strong> Name your shortcut "TaskZM Sync" and add it to your Home Screen!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Test & Complete */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Step 3: Test Your Shortcut
                </h3>
                
                <div className="space-y-3 text-xs text-muted-foreground">
                  <p>Run your shortcut to test the sync:</p>
                  
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Open the Shortcuts app</li>
                    <li>Tap your "TaskZM Sync" shortcut</li>
                    <li>Check that tasks appear in your calendar</li>
                    <li>Check that calendar events appear in TaskZM</li>
                  </ol>

                  <div className="p-3 bg-background rounded border mt-3">
                    <p className="font-medium text-foreground mb-1">Optional: Automate It!</p>
                    <p>Set up a Personal Automation to run the shortcut:</p>
                    <ul className="list-disc list-inside ml-2 mt-1">
                      <li>Every morning at 8 AM</li>
                      <li>When you open the TaskZM app</li>
                      <li>When you arrive/leave a location</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Two-way sync enabled:</strong> Tasks created in TaskZM will sync to your Apple Calendar, 
                  and calendar events will sync back to TaskZM as tasks.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          )}
          
          {step < totalSteps ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !syncData}>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-2" />
              Complete Setup
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


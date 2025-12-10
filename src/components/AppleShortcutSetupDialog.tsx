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
import { Info, ExternalLink, Check, Copy, Smartphone, Monitor } from 'lucide-react';
import { toast } from '../lib/toast-wrapper';
import { 
  TASKZM_SHORTCUT_NAME, 
  isAppleShortcutsSupported,
  SHORTCUT_INSTRUCTIONS 
} from '../lib/apple-shortcuts';

interface AppleShortcutSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function AppleShortcutSetupDialog({
  open,
  onOpenChange,
  onComplete,
}: AppleShortcutSetupDialogProps) {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const isSupported = isAppleShortcutsSupported();

  const handleCopyName = () => {
    navigator.clipboard.writeText(TASKZM_SHORTCUT_NAME);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenShortcuts = () => {
    // Open Shortcuts app on macOS/iOS
    window.open('shortcuts://', '_self');
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
    setStep(1);
    toast.success('Apple Calendar connected via Shortcuts!', {
      description: 'Tasks will sync to your Apple Calendar when you tap the sync button.',
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSupported ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            Connect Apple Calendar
          </DialogTitle>
          <DialogDescription>
            Use Apple Shortcuts to sync tasks with your Apple Calendar
          </DialogDescription>
        </DialogHeader>

        {!isSupported && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Apple Shortcuts works best on iPhone, iPad, or Mac. You can still set it up here and use it on your Apple device.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {[1, 2, 3].map((s) => (
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

          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-sm mb-2">Step 1: Open Shortcuts App</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Open the Shortcuts app on your iPhone, iPad, or Mac to create the TaskZM Calendar shortcut.
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleOpenShortcuts}
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Shortcuts App
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-sm mb-3">Step 2: Create the Shortcut</h3>
                
                <div className="space-y-3 text-xs text-muted-foreground">
                  <p><strong>1.</strong> Tap the <strong>+</strong> button to create a new shortcut</p>
                  
                  <p><strong>2.</strong> Add these actions in order:</p>
                  
                  <div className="ml-4 space-y-2 bg-background/50 p-3 rounded border">
                    <p className="font-medium text-foreground">Action 1: "Shortcut Input"</p>
                    <p className="text-muted-foreground">Search for "Shortcut Input" and add it</p>
                  </div>
                  
                  <div className="ml-4 space-y-2 bg-background/50 p-3 rounded border">
                    <p className="font-medium text-foreground">Action 2: "Get Dictionary from Input"</p>
                    <p className="text-muted-foreground">Search for "Dictionary" → select "Get Dictionary from Input"</p>
                  </div>
                  
                  <div className="ml-4 space-y-2 bg-background/50 p-3 rounded border">
                    <p className="font-medium text-foreground">Action 3: "Add New Event"</p>
                    <p className="text-muted-foreground">
                      Search for "Add New Event" and configure:
                    </p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>Title → tap and select "Dictionary Value" → key: <code className="bg-muted px-1 rounded">title</code></li>
                      <li>Start Date → "Dictionary Value" → key: <code className="bg-muted px-1 rounded">startDate</code></li>
                      <li>End Date → "Dictionary Value" → key: <code className="bg-muted px-1 rounded">endDate</code></li>
                      <li>Notes → "Dictionary Value" → key: <code className="bg-muted px-1 rounded">notes</code></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-sm mb-3">Step 3: Name Your Shortcut</h3>
                
                <p className="text-xs text-muted-foreground mb-3">
                  Name your shortcut <strong>exactly</strong> as shown below (case-sensitive):
                </p>
                
                <div className="flex items-center gap-2 p-3 bg-background rounded-lg border">
                  <code className="flex-1 text-lg font-mono font-semibold">{TASKZM_SHORTCUT_NAME}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyName}
                    className="flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground mt-3">
                  Tap "Done" in the Shortcuts app to save your shortcut.
                </p>
              </div>
              
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-green-800 dark:text-green-300">
                    Once your shortcut is saved, click "Complete Setup" below to enable Apple Calendar sync in TaskZM.
                  </p>
                </div>
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
          
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>
              Next
            </Button>
          ) : (
            <Button onClick={handleComplete}>
              Complete Setup
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


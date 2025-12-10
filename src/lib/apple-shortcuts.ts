/**
 * Apple Shortcuts Integration for Calendar Sync
 * 
 * Uses Apple Shortcuts app to add events to Apple Calendar.
 * This is more reliable than CalDAV as it doesn't depend on changing iCloud URLs.
 * 
 * The user needs to install the "TaskZM Calendar" shortcut which:
 * 1. Accepts JSON input with event details
 * 2. Creates a calendar event using the Shortcuts "Add New Event" action
 */

export const TASKZM_SHORTCUT_NAME = 'TaskZM Calendar';

export interface ShortcutEventData {
  title: string;
  notes?: string;
  startDate: string; // ISO format
  endDate: string; // ISO format
  location?: string;
  calendar?: string; // Optional calendar name
}

/**
 * Generate the URL to trigger the Apple Shortcut with event data
 */
export function generateShortcutURL(eventData: ShortcutEventData): string {
  // Encode the event data as JSON
  const inputData = JSON.stringify(eventData);
  
  // Use the shortcuts:// URL scheme
  // Format: shortcuts://run-shortcut?name=<name>&input=text&text=<data>
  const encodedName = encodeURIComponent(TASKZM_SHORTCUT_NAME);
  const encodedInput = encodeURIComponent(inputData);
  
  return `shortcuts://run-shortcut?name=${encodedName}&input=text&text=${encodedInput}`;
}

/**
 * Generate shortcut URL for a task
 */
export function generateTaskShortcutURL(task: {
  title: string;
  description?: string;
  scheduledDate?: string | Date | null;
  dueDate?: string | Date | null;
  estimatedTime?: number; // in minutes
}): string | null {
  const startDateValue = task.scheduledDate || task.dueDate;
  if (!startDateValue) {
    return null; // Can't create event without a date
  }

  const startDate = new Date(startDateValue);
  if (isNaN(startDate.getTime())) {
    return null;
  }

  // Calculate end date based on estimated time (default 30 minutes)
  const durationMinutes = task.estimatedTime || 30;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const eventData: ShortcutEventData = {
    title: task.title,
    notes: task.description || undefined,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  return generateShortcutURL(eventData);
}

/**
 * Open the shortcut URL to add an event
 * Returns true if the URL was opened successfully
 */
export function openShortcutForTask(task: {
  title: string;
  description?: string;
  scheduledDate?: string | Date | null;
  dueDate?: string | Date | null;
  estimatedTime?: number;
}): boolean {
  const url = generateTaskShortcutURL(task);
  if (!url) {
    return false;
  }

  // Open the shortcut URL
  window.open(url, '_self');
  return true;
}

/**
 * Check if the device likely supports Apple Shortcuts
 * (iOS 12+, iPadOS, macOS Monterey+)
 */
export function isAppleShortcutsSupported(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check for iOS/iPadOS
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  
  // Check for macOS (Shortcuts available on macOS Monterey 12+)
  const isMacOS = /macintosh|mac os x/.test(userAgent);
  
  return isIOS || isMacOS;
}

/**
 * Get the iCloud link for downloading the TaskZM Calendar shortcut
 * This should point to a pre-made shortcut hosted on iCloud
 */
export function getShortcutDownloadURL(): string {
  // This URL should be replaced with your actual iCloud shortcut link
  // For now, we'll provide instructions to create it manually
  return 'https://www.icloud.com/shortcuts/taskzm-calendar';
}

/**
 * Generate the shortcut file content (for creating the shortcut)
 * This is a simplified version - actual shortcut files are more complex
 */
export const SHORTCUT_INSTRUCTIONS = `
## How to Create the TaskZM Calendar Shortcut

1. Open the **Shortcuts** app on your iPhone, iPad, or Mac
2. Tap the **+** button to create a new shortcut
3. Add these actions in order:

   **a) Get Shortcut Input**
   - This receives the task data from TaskZM

   **b) Get Dictionary from Input**
   - Converts the JSON text to a dictionary

   **c) Add New Event**
   - Title: Get "title" from Dictionary
   - Start Date: Get "startDate" from Dictionary
   - End Date: Get "endDate" from Dictionary
   - Notes: Get "notes" from Dictionary

4. Name the shortcut exactly: **TaskZM Calendar**
5. Done! Now you can sync tasks from TaskZM to your Apple Calendar
`;


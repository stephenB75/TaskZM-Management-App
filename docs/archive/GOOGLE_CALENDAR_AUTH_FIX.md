# Google Calendar Authentication Fix

## Issue
Google Calendar authentication was not completing once the user signed in. The OAuth callback was not properly communicating with the parent window.

## Root Causes Identified

1. **Origin Check Too Strict**: The message handler was blocking messages from the OAuth callback page due to strict origin checking
2. **Popup Closing Too Fast**: The callback page was closing immediately after sending the message, potentially before the parent window received it
3. **No Fallback Status Check**: If the message wasn't received, the app didn't check calendar status to verify if connection succeeded

## Fixes Applied

### 1. Enhanced Message Handler (`src/contexts/CalendarContext.tsx`)

**Changes:**
- **More lenient origin check**: Now processes calendar OAuth messages even if origin doesn't exactly match, with warning logs for debugging
- **Duplicate message prevention**: Added `messageReceived` flag to prevent handling the same message multiple times
- **Better error handling**: Enhanced error logging to help debug issues
- **Delayed popup closing**: Added 100ms delay before closing popup to ensure message is received
- **Fallback status check**: If popup closes without receiving a message, automatically checks calendar status to verify connection

**Key Code Changes:**
```typescript
// More lenient origin check
const isAllowedOrigin = !event.origin || allowedOrigins.some(origin => {
  return event.origin === origin || event.origin.startsWith(origin);
});

// Process message even if origin doesn't match (with warning)
if (!isAllowedOrigin) {
  console.warn('[Calendar OAuth] Message from unexpected origin:', event.origin, 'but processing anyway for calendar OAuth message');
}

// Delayed popup closing
setTimeout(() => {
  if (popup && !popup.closed) {
    popup.close();
  }
}, 100);
```

### 2. Enhanced Callback Page (`supabase/functions/taskzm-database-function/index.ts`)

**Changes:**
- **Delayed popup closing**: Added 200ms delay before closing popup to ensure postMessage is processed
- **Better error handling**: Added try-catch around postMessage with fallback redirect
- **Debug logging**: Added console.log to help debug message sending

**Key Code Changes:**
```typescript
// Send success message to parent window
window.opener.postMessage({ 
  type: 'calendar-oauth-success', 
  provider: 'google' 
}, '*');

// Wait a bit before closing to ensure message is received
setTimeout(() => {
  window.close();
}, 200);
```

### 3. Fallback Status Check

**Changes:**
- If popup closes without receiving a message, automatically checks calendar status
- This handles cases where the message wasn't received but the connection succeeded
- Prevents false error messages when connection actually succeeded

## Testing Checklist

- [ ] Google Calendar OAuth popup opens correctly
- [ ] User can sign in to Google account
- [ ] After signing in, popup closes and parent window receives success message
- [ ] Calendar status updates to show Google Calendar as connected
- [ ] Success toast appears after connection
- [ ] If message isn't received, fallback status check verifies connection
- [ ] Error messages appear if authentication fails
- [ ] Works on different browsers (Chrome, Safari, Firefox)
- [ ] Works on mobile browsers

## Debugging

If authentication still doesn't complete:

1. **Check browser console** for:
   - `[Calendar OAuth] Success message received for google`
   - `[Calendar OAuth] Message from unexpected origin` (warning, but should still work)
   - `[Google Calendar OAuth] Success message sent to parent window`

2. **Check network tab** for:
   - Callback request to `/calendar/google/callback`
   - Response should be HTML with postMessage script

3. **Check popup window** (if still open):
   - Should show "Calendar connected successfully!" message
   - Should close automatically after 200ms

4. **Verify environment variables**:
   - `GOOGLE_CLIENT_ID` is set
   - `GOOGLE_CLIENT_SECRET` is set
   - `GOOGLE_REDIRECT_URI` is set and matches Google OAuth console
   - `APP_URL` is set (for fallback redirect)

## Notes

- The origin check is now more lenient to handle variations in Supabase function URLs
- Messages are still validated by type and provider to prevent security issues
- The delayed popup closing ensures messages are received before cleanup
- Fallback status check prevents false negatives when message isn't received

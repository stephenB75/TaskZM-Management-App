# Google Calendar OAuth Completion Fix

## Issue
Users are getting prompted to sign in, sign-in is successful, but the process doesn't complete once the user grants access to their Google account. The OAuth callback is not properly communicating completion status to the parent window.

## Root Causes Identified

1. **Critical: Error Handling Returns JSON Instead of HTML**
   - **Problem**: When `storeCalendarTokens()` fails or any error occurs in the callback, the catch block returns `c.json({ error: ... }, 500)` instead of an HTML page with postMessage
   - **Impact**: The popup shows a JSON error page instead of executing JavaScript to send a message to the parent window
   - **Result**: Parent window never receives any notification, so it appears the process didn't complete

2. **Token Storage Errors Not Communicated**
   - **Problem**: If token storage fails (e.g., KV store error, network issue), the error is caught but not communicated to the parent window
   - **Impact**: User sees success in Google OAuth but the app doesn't know about the failure

3. **Message Handler Origin Check Too Strict**
   - **Problem**: While we made it more lenient, there could still be edge cases where valid messages are blocked
   - **Impact**: Messages from callback page might not be processed

## Fixes Applied

### 1. Critical Fix: Always Return HTML with postMessage (`supabase/functions/taskzm-database-function/index.ts`)

**Changes:**
- **Wrapped token storage in try-catch**: If `storeCalendarTokens()` fails, return HTML error page with postMessage instead of letting it bubble up
- **Outer catch returns HTML**: Changed the outer catch block to return HTML with postMessage instead of JSON
- **All error paths communicate**: Every error path now sends a message to the parent window

**Key Code Changes:**
```typescript
// CRITICAL FIX: Wrap token storage in try-catch to ensure we always return HTML with postMessage
try {
  await calendarSync.storeCalendarTokens(userId, 'google', tokens);
  console.log('Google Calendar tokens stored successfully for user:', userId);
  
  // Return success HTML with postMessage
  return c.html(successHtml);
} catch (storageError) {
  // CRITICAL FIX: If token storage fails, still return HTML with error message
  // This ensures the parent window receives notification instead of showing JSON error
  console.error('Error storing Google Calendar tokens:', storageError);
  return c.html(errorHtml);
}
```

**Outer catch block:**
```typescript
} catch (error) {
  // CRITICAL FIX: Catch all errors and return HTML with postMessage instead of JSON
  // This ensures the parent window always receives notification
  console.error('Error in Google OAuth callback:', error);
  return c.html(errorHtml); // HTML with postMessage, not JSON
}
```

### 2. Enhanced Message Handler Logging (`src/contexts/CalendarContext.tsx`)

**Changes:**
- **Added debug logging**: Log all messages received for debugging
- **Enhanced success handling**: Added promise handling for `checkCalendarStatus()` with error logging
- **Better error logging**: Include origin in error logs

**Key Code Changes:**
```typescript
// Enhanced logging for debugging
console.debug('[Calendar OAuth] Message received:', {
  hasData: !!event.data,
  dataType: typeof event.data,
  messageType: event.data?.type,
  provider: event.data?.provider,
  origin: event.origin,
  expectedProvider: provider,
});
```

### 3. Improved Origin Validation

**Changes:**
- **Additional validation**: Check that message has required fields before processing
- **Better comments**: Clarified that we process calendar OAuth messages regardless of origin if they match type and provider

## Testing Checklist

- [ ] **Happy Path**: User grants access → tokens stored → success message sent → parent receives message → calendar status updates
- [ ] **Token Storage Failure**: Simulate KV store failure → error HTML returned → error message sent to parent → user sees error toast
- [ ] **Network Error**: Simulate network error during token exchange → error HTML returned → error message sent to parent
- [ ] **Missing Code/State**: User cancels or error in OAuth → error HTML returned → error message sent to parent
- [ ] **Popup Closed Early**: User closes popup before callback → fallback status check runs → calendar status verified
- [ ] **Message Not Received**: If message isn't received, fallback check verifies connection status
- [ ] **Browser Console**: Check for debug logs showing message flow
- [ ] **Network Tab**: Verify callback request returns HTML (not JSON) in all cases

## Debugging Steps

If authentication still doesn't complete:

1. **Check Browser Console** for:
   - `[Calendar OAuth] Message received:` - Shows all messages
   - `[Google Calendar OAuth] Success message sent to parent window` - From callback page
   - `[Calendar OAuth] Success message received for google` - In parent window
   - Any error messages

2. **Check Network Tab** for:
   - Callback request to `/calendar/google/callback`
   - Response should be HTML (check Content-Type: text/html)
   - Response should contain postMessage script
   - If you see JSON response, there's still an error path returning JSON

3. **Check Popup Window** (if still open):
   - Should show "Calendar connected successfully!" or error message
   - Should close automatically after 200ms
   - Check popup console for any JavaScript errors

4. **Verify Environment Variables**:
   - `GOOGLE_CLIENT_ID` is set
   - `GOOGLE_CLIENT_SECRET` is set
   - `GOOGLE_REDIRECT_URI` matches Google OAuth console exactly
   - `APP_URL` is set (for fallback redirect)

5. **Check Supabase Function Logs**:
   - Look for "Google OAuth callback received"
   - Look for "Google token exchange successful"
   - Look for "Google Calendar tokens stored successfully"
   - Look for any error messages

## Key Improvements

1. **All error paths now communicate**: Every error returns HTML with postMessage, ensuring parent window always knows what happened
2. **Better error messages**: Users see specific error messages instead of generic failures
3. **Enhanced debugging**: Comprehensive logging helps identify issues quickly
4. **Robust fallback**: If message isn't received, status check verifies actual connection state

## Notes

- The fix ensures that even if token storage fails, the parent window is notified
- All error responses are now HTML pages with postMessage scripts, not JSON
- The message handler is more lenient with origin checking but still validates message type and provider
- Fallback status check prevents false negatives when messages aren't received

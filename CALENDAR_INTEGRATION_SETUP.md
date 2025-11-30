# Calendar Integration Setup & Verification

## Overview

TaskZM supports calendar integration with:
- ✅ **Google Calendar** (OAuth)
- ✅ **Apple Calendar** (CalDAV/iCloud)
- ⏳ **Outlook Calendar** (Coming Soon - disabled in UI)

## Google Calendar Setup

### Required Environment Variables

Set these in your Supabase Edge Function environment:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-project.supabase.co/functions/v1/make-server-65e6e67f/calendar/google/callback
```

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Google Calendar API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure:
   - **Application type**: Web application
   - **Authorized redirect URIs**: 
     ```
     https://your-project.supabase.co/functions/v1/make-server-65e6e67f/calendar/google/callback
     ```
6. Copy the **Client ID** and **Client Secret**
7. Add required scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`

### Verification Steps

1. **Check OAuth Endpoint**:
   ```bash
   GET /make-server-65e6e67f/calendar/google/auth
   ```
   Should return `{ authUrl: "https://accounts.google.com/..." }`

2. **Test OAuth Flow**:
   - User clicks "Connect Google Calendar" in Settings
   - Popup opens with Google OAuth consent screen
   - User authorizes
   - Callback receives code and exchanges for tokens
   - Tokens stored in KV store

3. **Check Token Storage**:
   - Tokens stored at: `user_{userId}_calendar_google_tokens`
   - Contains: `accessToken`, `refreshToken`, `expiresAt`

## Apple Calendar (CalDAV/iCloud) Setup

### Required Information

No environment variables needed. Users provide:
- **iCloud Email**: Their Apple ID email (e.g., `name@icloud.com`)
- **App-Specific Password**: Generated from [appleid.apple.com](https://appleid.apple.com)

### User Setup Steps

1. User must have **Two-Factor Authentication** enabled on Apple ID
2. Go to [appleid.apple.com](https://appleid.apple.com)
3. Navigate to **Security** → **App-Specific Passwords**
4. Generate a new password labeled "TaskZM Calendar"
5. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)

### CalDAV Configuration

- **CalDAV URL**: `https://caldav.icloud.com`
- **Username**: iCloud email address
- **Password**: App-specific password

### Verification Steps

1. **Test CalDAV Connection**:
   ```bash
   POST /make-server-65e6e67f/calendar/apple/setup
   Body: {
     "caldavUrl": "https://caldav.icloud.com",
     "username": "user@icloud.com",
     "appPassword": "xxxx-xxxx-xxxx-xxxx"
   }
   ```
   Should return `{ success: true }`

2. **Check Credential Storage**:
   - Credentials stored at: `user_{userId}_calendar_apple_tokens`
   - Contains: `caldavUrl`, `caldavUsername`, `caldavPassword`

3. **Test Calendar Discovery**:
   - System attempts to discover calendar URL via PROPFIND
   - Tries multiple iCloud URL formats if base URL fails
   - Caches discovered URL for future use

## Integration Verification Checklist

### Backend Endpoints

- [x] `GET /calendar/google/auth` - Initiate Google OAuth
- [x] `GET /calendar/google/callback` - Handle OAuth callback
- [x] `POST /calendar/apple/setup` - Setup Apple CalDAV
- [x] `GET /calendar/status` - Check connection status
- [x] `DELETE /calendar/:provider` - Disconnect calendar
- [x] `POST /calendar/sync-task` - Sync single task
- [x] `POST /calendar/sync-all` - Sync all tasks
- [x] `GET /calendar/events/:provider` - Fetch calendar events

### Frontend Components

- [x] `CalendarContext` - Manages calendar state
- [x] `CalDAVCredentialsDialog` - Apple Calendar setup UI
- [x] Settings Panel - Calendar connection UI
- [x] TaskDialog - Automatic sync on task create/update

### Automatic Sync

- [x] Tasks with `scheduledDate` automatically sync when:
  - Task is created
  - Task is updated (if scheduled date changes)
- [x] Syncs to all connected providers (Google + Apple)
- [x] Updates existing calendar events if task already synced
- [x] Creates new calendar events for new tasks

### Manual Sync

- [x] "Sync All Tasks" button in Settings Panel
- [x] Syncs all tasks with scheduled dates
- [x] Shows sync progress and results

## Testing the Integration

### Test Google Calendar

1. **Connect**:
   - Go to Settings → Calendar Integration
   - Toggle "Google Calendar" ON
   - Complete OAuth flow in popup
   - Verify status shows as connected

2. **Create Task**:
   - Create a task with scheduled date/time
   - Task should automatically sync to Google Calendar
   - Check Google Calendar to verify event appears

3. **Update Task**:
   - Edit task's scheduled time
   - Task should update in Google Calendar
   - Verify event time changed in Google Calendar

4. **Sync All**:
   - Click "Sync All Tasks" in Settings
   - All tasks with scheduled dates should sync
   - Check sync results in toast notification

### Test Apple Calendar

1. **Connect**:
   - Go to Settings → Calendar Integration
   - Toggle "Apple Calendar" ON
   - Enter iCloud email and app-specific password
   - Verify connection succeeds

2. **Create Task**:
   - Create a task with scheduled date/time
   - Task should automatically sync to iCloud Calendar
   - Check Apple Calendar app to verify event appears

3. **Update Task**:
   - Edit task's scheduled time
   - Task should update in iCloud Calendar
   - Verify event time changed in Apple Calendar

## Troubleshooting

### Google Calendar Issues

**"OAuth not configured" error**:
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Verify `GOOGLE_REDIRECT_URI` matches Google Cloud Console
- Ensure redirect URI uses `https://` protocol

**"Failed to exchange authorization code"**:
- Check client secret is correct
- Verify redirect URI matches exactly
- Check OAuth consent screen is configured

**"Failed to create Google Calendar event"**:
- Verify access token is valid
- Check token hasn't expired (auto-refresh should handle this)
- Ensure calendar API is enabled in Google Cloud Console

### Apple Calendar Issues

**"Invalid CalDAV credentials"**:
- Verify app-specific password is correct (no spaces)
- Check Two-Factor Authentication is enabled
- Ensure iCloud email is correct

**"Failed to discover calendar URL"**:
- System tries multiple iCloud URL formats automatically
- Check network connectivity
- Verify app-specific password hasn't been revoked

**"Failed to create Apple Calendar event"**:
- Check CalDAV connection is still valid
- Verify calendar URL was discovered correctly
- Check iCloud account is active

### General Issues

**Tasks not syncing automatically**:
- Verify task has `scheduledDate` set
- Check user has Pro subscription (calendar sync is Pro feature)
- Verify at least one calendar is connected
- Check browser console for errors

**Sync All Tasks fails**:
- Check individual task sync works first
- Verify workspace access
- Check for rate limiting from calendar providers
- Review server logs for specific errors

## Environment Variables Summary

### Required for Google Calendar
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-project.supabase.co/functions/v1/make-server-65e6e67f/calendar/google/callback
```

### Not Required for Apple Calendar
- Uses user-provided credentials (CalDAV)
- No server-side environment variables needed

## Security Notes

1. **OAuth Tokens**: Stored securely in Supabase KV store
2. **CalDAV Passwords**: Stored as app-specific passwords (can be revoked)
3. **Token Refresh**: Google tokens auto-refresh before expiration
4. **Access Control**: All endpoints require user authentication
5. **Workspace Verification**: Tasks verified against user's workspace

## Next Steps

- [ ] Add Outlook Calendar support (backend ready, UI disabled)
- [ ] Add bidirectional sync (calendar → TaskZM)
- [ ] Add sync conflict resolution
- [ ] Add calendar event deletion when task is deleted
- [ ] Add sync status indicators on task cards


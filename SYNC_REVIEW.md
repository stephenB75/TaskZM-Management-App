# Database Sync Procedure Review

## Current Sync Mechanism

### Sync Intervals
- **Active Interval**: 3 minutes (180000ms) - when user is actively using the app
- **Idle Interval**: 15 minutes (900000ms) - when user is inactive
- **Activity Timeout**: 5 minutes (300000ms) - time before switching to idle
- **Debounce Interval**: 2 minutes (120000ms) - prevents rapid syncs from events
- **Full Sync Interval**: 5 minutes (300000ms) - syncs all resources (tasks, projects, folders, settings)

### Sync Triggers
1. **Automatic Polling**: Based on active/idle intervals
2. **Visibility Change**: When user switches back to tab/app (full sync)
3. **Network Online**: When network comes back online (full sync)
4. **Window Focus**: When window gains focus (tasks only, debounced)
5. **User Activity**: Mouse/keyboard/touch events (switches to active interval)

### Issues Identified

#### 1. **Sync Interval Mismatch**
- Constants define 3 minutes active, 15 minutes idle
- Code comments say 2 minutes active, 10 minutes idle
- **Impact**: Confusion and potential sync delays

#### 2. **No Immediate Sync on Updates**
- When a task is updated on Device A, it saves to server
- Device B only syncs on next polling interval (up to 3-15 minutes)
- **Impact**: Desktop and mobile can be out of sync for several minutes

#### 3. **Activity Detection Doesn't Work on Mobile**
- Activity detection uses `mousedown`, `mousemove` events
- Mobile devices primarily use `touchstart` (included but may not be sufficient)
- **Impact**: Mobile may stay in idle mode even when actively used

#### 4. **Aggressive Debouncing**
- 2-minute debounce prevents rapid syncs
- Full sync only every 5 minutes
- **Impact**: Changes may not sync quickly enough between devices

#### 5. **No Real-Time Updates**
- App uses polling instead of real-time subscriptions (WebSockets/Supabase Realtime)
- **Impact**: Maximum delay equals polling interval

#### 6. **Sync Lock May Block Updates**
- `syncLockRef` prevents concurrent syncs
- If sync is slow, subsequent syncs are skipped
- **Impact**: Updates may be missed if sync is in progress

#### 7. **No Conflict Resolution**
- Server always overwrites local data
- No handling for simultaneous edits on different devices
- **Impact**: Last write wins, potential data loss

## Recommendations

### Immediate Fixes

1. **Fix Sync Interval Constants**
   - Align constants with comments or update comments
   - Consider reducing active interval to 30-60 seconds for better sync

2. **Add Immediate Sync on Task Updates**
   - After saving a task, trigger a sync on other devices
   - Use Supabase Realtime or WebSockets for instant updates
   - Fallback to shorter polling if real-time not available

3. **Improve Mobile Activity Detection**
   - Add more touch events: `touchmove`, `touchend`
   - Use `pointer` events for better cross-device support
   - Consider using Page Visibility API more effectively

4. **Reduce Debounce Intervals**
   - Reduce DEBOUNCE_INTERVAL to 30 seconds
   - Reduce FULL_SYNC_INTERVAL to 2 minutes
   - Allow immediate sync on critical operations (task updates)

5. **Add Sync Queue**
   - Queue sync requests instead of skipping
   - Process queue sequentially to avoid conflicts
   - Retry failed syncs with exponential backoff

### Long-Term Improvements

1. **Implement Real-Time Sync**
   - Use Supabase Realtime subscriptions
   - Listen for database changes
   - Push updates to all connected devices instantly

2. **Add Conflict Resolution**
   - Use timestamps or version numbers
   - Merge non-conflicting changes
   - Prompt user for conflicting edits

3. **Optimistic Updates**
   - Update UI immediately
   - Sync in background
   - Rollback on failure

4. **Sync Status Indicator**
   - Show sync status in UI
   - Indicate when devices are out of sync
   - Allow manual sync trigger

## Testing Checklist

- [ ] Create task on desktop, verify appears on mobile within sync interval
- [ ] Update task on mobile, verify appears on desktop within sync interval
- [ ] Test with both devices active simultaneously
- [ ] Test with one device idle (should still sync)
- [ ] Test network disconnection/reconnection
- [ ] Test rapid updates (multiple tasks in quick succession)
- [ ] Test activity detection on mobile devices
- [ ] Test visibility change sync (switch tabs/apps)
- [ ] Test concurrent edits (same task on both devices)


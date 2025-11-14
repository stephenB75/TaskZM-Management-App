# Edge Functions & Egress Usage Analysis

## Executive Summary

This analysis identifies opportunities to reduce Edge Function invocations and data egress (data transfer out of Supabase) without changing app functionality.

**Current State:**
- 51 Edge Function endpoints
- Full data fetches on every sync (no delta/incremental sync)
- Auto-sync every 5 minutes + event-triggered syncs (debounced to 1 minute)
- No server-side filtering or pagination
- All data fetched even when unchanged

**Potential Savings:**
- **60-80% reduction** in egress by implementing delta sync
- **40-50% reduction** in Edge Function invocations by adding ETags/versioning
- **30-40% reduction** in response sizes by filtering unnecessary fields

---

## Current Issues

### 1. Full Data Fetch on Every Sync ⚠️ HIGH IMPACT

**Problem:**
- All endpoints (`/tasks`, `/projects`, `/folders`, `/time-tracking`) use `getByPrefix()` which fetches ALL items every time
- No way to fetch only changed items since last sync
- Even if 1 task changed, all tasks are fetched and transferred

**Code Locations:**
```typescript
// src/supabase/functions/server/index.tsx
// Line 184: Get all tasks
const tasksData = await kv.getByPrefix(`workspace_${workspaceId}_task_`);
const tasks = tasksData.map(item => item.value);
return c.json({ tasks });

// Line 574: Get all projects
const projectsData = await kv.getByPrefix(`workspace_${workspaceId}_project_`);
const projects = projectsData.map(item => item.value);

// Line 668: Get all folders
const foldersData = await kv.getByPrefix(`workspace_${workspaceId}_folder_`);
const folders = foldersData.map((item) => item.value);

// Line 541: Get all time tracking sessions
const sessionsData = await kv.getByPrefix(`workspace_${workspaceId}_time_`);
const sessions = sessionsData.map(item => item.value);
```

**Impact:**
- If user has 100 tasks, every sync transfers all 100 tasks (even if only 1 changed)
- Average task size: ~2-5KB (with description, notes, etc.)
- 100 tasks = 200-500KB per sync
- With 5-minute auto-sync + event triggers: ~12-20 syncs/hour = 2.4-10MB/hour per user

**Recommendation:**
- Implement delta sync using `updatedAt` timestamps
- Add `?since=<timestamp>` query parameter to fetch only changed items
- Client sends last sync timestamp, server returns only items modified since then

---

### 2. No ETags or Versioning ⚠️ MEDIUM IMPACT

**Problem:**
- No way to check if data changed without fetching it
- Every sync request transfers full payload even if nothing changed
- Client can't determine if sync is needed without making the request

**Impact:**
- Unnecessary Edge Function invocations when data hasn't changed
- Wasted bandwidth on "304 Not Modified" equivalent scenarios

**Recommendation:**
- Add workspace-level `lastModified` timestamp
- Client sends `If-Modified-Since` header
- Server returns `304 Not Modified` if no changes
- Reduces Edge Function invocations by 40-50% for idle users

---

### 3. No Server-Side Filtering ⚠️ MEDIUM IMPACT

**Problem:**
- All data fetched, then filtered client-side
- Archived tasks, completed tasks, etc. are still transferred
- No way to request only active/visible tasks

**Code Example:**
```typescript
// Current: Fetches ALL tasks, including archived
const tasksData = await kv.getByPrefix(`workspace_${workspaceId}_task_`);
const tasks = tasksData.map(item => item.value);
return c.json({ tasks });

// Client then filters:
const activeTasks = tasks.filter(t => !t.archived && t.status !== 'completed');
```

**Impact:**
- Transfers unnecessary data (archived tasks, completed tasks)
- Increases response size by 20-40% for typical users

**Recommendation:**
- Add query parameters: `?archived=false&status=active`
- Filter on server before serialization
- Reduces response size by 20-40%

---

### 4. No Field Selection / Sparse Fieldsets ⚠️ LOW-MEDIUM IMPACT

**Problem:**
- Full task objects returned even when only summary needed
- Description, notes, subtasks, etc. included in list views
- No way to request only specific fields

**Example Task Object:**
```typescript
{
  id: "...",
  title: "...",
  description: "...", // Often not needed in list views
  notes: "...", // Often not needed
  subtasks: [...], // Often not needed
  // ... many other fields
}
```

**Impact:**
- List views transfer 2-3x more data than needed
- Detail views still need full objects, but list views don't

**Recommendation:**
- Add `?fields=id,title,status,priority,dueDate` query parameter
- Return only requested fields for list endpoints
- Full objects for detail endpoints
- Reduces list view response size by 50-70%

---

### 5. Multiple Sync Triggers ⚠️ LOW IMPACT (Already Optimized)

**Current State:**
- Auto-sync: Every 5 minutes ✅ (Good)
- Visibility change: Debounced to 1 minute ✅ (Good)
- Focus event: Debounced to 1 minute ✅ (Good)
- Online event: Debounced to 1 minute ✅ (Good)

**Status:** ✅ Already optimized with debouncing

---

### 6. Activities Endpoint ✅ OPTIMIZED

**Current State:**
```typescript
// Line 476-480: Already limits to 50 most recent
const activitiesData = await kv.getByPrefix(`workspace_${workspaceId}_activity_`);
const activities = activitiesData
  .map(item => item.value)
  .sort((a, b) => b.timestamp - a.timestamp)
  .slice(0, 50); // ✅ Good
```

**Status:** ✅ Already optimized

---

### 7. Calendar Sync-All ✅ OPTIMIZED

**Current State:**
```typescript
// Line 1947-1954: Returns summary only, not full results
return c.json({ 
  synced: syncedCount,
  failed: failedCount,
  total: tasks.length,
  ...(failedTaskIds.length > 0 && { failedTaskIds })
});
```

**Status:** ✅ Already optimized

---

## Optimization Recommendations

### Priority 1: Implement Delta Sync (High Impact, Medium Effort)

**Implementation:**
1. Add `?since=<timestamp>` query parameter to all GET endpoints
2. Filter items where `updatedAt > since` on server
3. Client stores last sync timestamp and sends it with requests

**Expected Savings:**
- 60-80% reduction in egress for typical usage
- Minimal code changes required

**Code Changes:**
```typescript
// Server: src/supabase/functions/server/index.tsx
app.get("/make-server-65e6e67f/tasks/:workspaceId", async (c) => {
  // ... auth checks ...
  
  const since = c.req.query('since');
  const tasksData = await kv.getByPrefix(`workspace_${workspaceId}_task_`);
  
  let tasks = tasksData.map(item => item.value);
  
  // Filter by updatedAt if since parameter provided
  if (since) {
    const sinceTimestamp = new Date(since).getTime();
    tasks = tasks.filter(task => {
      const updatedAt = new Date(task.updatedAt).getTime();
      return updatedAt > sinceTimestamp;
    });
  }
  
  return c.json({ tasks });
});
```

```typescript
// Client: src/contexts/TaskContext.tsx
const syncWithServer = useCallback(async (wsId?: string, silent: boolean = false) => {
  // ... existing code ...
  
  // Get last sync timestamp
  const lastSyncKey = `last_server_sync_${targetWorkspaceId}`;
  const lastSyncTimestamp = localStorage.getItem(lastSyncKey);
  
  // Add since parameter if we have a timestamp
  const url = lastSyncTimestamp 
    ? `${API_BASE}/tasks/${targetWorkspaceId}?since=${lastSyncTimestamp}`
    : `${API_BASE}/tasks/${targetWorkspaceId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  
  // ... rest of sync logic ...
  
  // Update last sync timestamp
  localStorage.setItem(lastSyncKey, String(Date.now()));
}, [workspaceId, accessToken]);
```

---

### Priority 2: Add ETags/Versioning (Medium Impact, Low Effort)

**Implementation:**
1. Store workspace `lastModified` timestamp in KV store
2. Client sends `If-Modified-Since` header
3. Server returns `304 Not Modified` if no changes

**Expected Savings:**
- 40-50% reduction in Edge Function invocations for idle users
- Minimal bandwidth savings (headers only)

**Code Changes:**
```typescript
// Server: Update lastModified on any write operation
await kv.set(`workspace_${workspaceId}_task_${task.id}`, task);
await kv.set(`workspace_${workspaceId}_lastModified`, Date.now().toString());

// Check If-Modified-Since header
app.get("/make-server-65e6e67f/tasks/:workspaceId", async (c) => {
  // ... auth checks ...
  
  const ifModifiedSince = c.req.header('If-Modified-Since');
  const lastModified = await kv.get(`workspace_${workspaceId}_lastModified`);
  
  if (ifModifiedSince && lastModified && parseInt(lastModified) <= parseInt(ifModifiedSince)) {
    return c.json({ tasks: [], notModified: true }, 304);
  }
  
  // ... fetch and return tasks ...
});
```

---

### Priority 3: Server-Side Filtering (Medium Impact, Low Effort)

**Implementation:**
1. Add query parameters: `?archived=false&status=active`
2. Filter on server before serialization

**Expected Savings:**
- 20-40% reduction in response size for typical users

**Code Changes:**
```typescript
app.get("/make-server-65e6e67f/tasks/:workspaceId", async (c) => {
  // ... auth checks ...
  
  const archived = c.req.query('archived');
  const status = c.req.query('status');
  
  const tasksData = await kv.getByPrefix(`workspace_${workspaceId}_task_`);
  let tasks = tasksData.map(item => item.value);
  
  // Filter archived
  if (archived === 'false') {
    tasks = tasks.filter(t => !t.archived);
  }
  
  // Filter status
  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }
  
  return c.json({ tasks });
});
```

---

### Priority 4: Field Selection (Low-Medium Impact, Medium Effort)

**Implementation:**
1. Add `?fields=id,title,status,...` query parameter
2. Return only requested fields for list endpoints

**Expected Savings:**
- 50-70% reduction in list view response size

**Note:** This requires more careful implementation to maintain backward compatibility.

---

## Implementation Priority

1. **Delta Sync** - Highest impact, reasonable effort
2. **ETags/Versioning** - Good impact, low effort
3. **Server-Side Filtering** - Good impact, low effort
4. **Field Selection** - Medium impact, higher effort (can be deferred)

---

## Metrics to Track

After implementing optimizations, track:
- Edge Function invocations per user per day
- Data egress per user per day
- Average response size per endpoint
- Cache hit rate (for ETags)

---

## Current Sync Frequency

- **Auto-sync interval:** 5 minutes (300,000ms) ✅ Good
- **Debounce interval:** 60 seconds (60,000ms) ✅ Good
- **Calendar status cache:** 5 minutes ✅ Good

**Status:** Sync frequency is already well-optimized. Focus should be on reducing data transferred per sync, not reducing sync frequency.

---

## Summary

**Current Issues:**
1. ✅ Full data fetch every sync (no delta sync)
2. ✅ No ETags/versioning
3. ✅ No server-side filtering
4. ✅ No field selection

**Already Optimized:**
- ✅ Sync frequency (5 min auto, 1 min debounce)
- ✅ Activities endpoint (limited to 50)
- ✅ Calendar sync-all (returns summary only)

**Recommended Actions:**
1. Implement delta sync (Priority 1)
2. Add ETags/versioning (Priority 2)
3. Add server-side filtering (Priority 3)
4. Consider field selection (Priority 4, optional)

**Expected Overall Savings:**
- **60-80% reduction** in egress with delta sync
- **40-50% reduction** in Edge Function invocations with ETags
- **20-40% additional reduction** in response size with filtering

**Total Potential Savings: 70-85% reduction in Edge & Egress usage**


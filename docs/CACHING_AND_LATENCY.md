# Caching and Latency

Summary of caching behavior and latency-related settings so buttons and app functions stay responsive and show up-to-date data.

## API / fetch caching

- **Tasks (`getTasks`)**: Uses `cache: 'no-store'` so the browser does not reuse a cached response. Avoids tasks “disappearing” (e.g. after mark-complete when sync runs).
- **All other authenticated GETs**: `fetchWithAuthRetry` now defaults to `cache: 'no-store'` for GET requests. Direct `fetch` GETs in `api.ts` (workspaces, workspace, projects, folders, settings, subscription, team members, teams, activities, time-tracking, admin user, shared terminology, user awards) also use `cache: 'no-store'`.
- **Service worker**: Skips any request whose URL contains `supabase.co`, so Edge Function (task/workspace/calendar) traffic is never cached by the SW. Only static assets (e.g. app shell) use the runtime cache (network-first, then cache for fallback).

## In-app caches (intentional)

- **Calendar status**: 5-minute localStorage cache; cleared on connect/disconnect and when tab becomes visible with no providers.
- **Calendar events**: In-memory cache with 5-minute TTL and per–date-range key; cleared when a provider disconnects.
- **Task breakdown (AI)**: Short debounce and in-memory cache keyed by task content to avoid duplicate requests.

## Latency and debounce

- **Task updates (mark complete, edit, drag)**: Optimistic updates apply immediately; server save runs in the background. A follow-up sync runs after ~1s (`serverProcessDelay`) so other devices see changes without blocking the UI.
- **Task sync debounce**: 2s (`taskSync.debounceInterval`) so rapid actions (e.g. multiple mark-complete) don’t trigger a sync per action. Full sync (tasks + projects/folders/settings) is limited to every 30s.
- **Calendar events**: Debounced fetch (200–300 ms) when the view or date range changes to avoid rapid refetches.
- **Resize / layout**: Resize handlers (e.g. mobile layout, dashboard) are debounced so buttons and layout stay responsive during resize.

## Button and UI responsiveness

- **Mark complete / incomplete**: Uses optimistic update; no await of server before updating UI.
- **Permission checks**: Done before running the action; a denied user gets a toast and the action is not sent.
- **Heavy work**: Task breakdown and description generation use debounce and (where applicable) `setTimeout(0)` or small delays so the UI thread is not blocked.

## If you see stale data or slow buttons

1. **Stale list/data after an action**: Confirm the request is a GET and that it uses `cache: 'no-store'` (or goes through `fetchWithAuthRetry` for GETs). Add it in `api.ts` if missing.
2. **Buttons feel slow**: Check that the handler updates local state (or context) immediately and does not `await` the server before updating UI. Use optimistic updates where appropriate.
3. **Sync overwriting local state**: TaskContext preserves local tasks when the server returns an empty list (safeguard for aggressive caching). GET tasks already uses `cache: 'no-store'`.

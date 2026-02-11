# App Presence and Behavior Across Browsers

**Purpose:** Confirm the app functions the same on all supported browsers and document any intentional or unavoidable differences.

**Scope:** Chrome, Edge, Firefox, Safari (desktop and mobile), and installed PWA on each.

---

## Core behavior: same on all browsers

The following work identically regardless of browser (when the same user is signed in and the same backend is used):

| Area | Behavior |
|------|----------|
| **Auth** | Sign in / sign up / sign out, session, token handling. No browser-specific auth paths. |
| **Tasks** | Create, edit, delete, sync, folders, workspaces, drag-and-drop, today/week/dashboard views. |
| **API** | All `fetch` calls to the Edge Function (tasks, calendar status, AI description/action-plan, subscription) use the same endpoints and headers. |
| **Server AI** | Description and action-plan generation call the same backend; if `OPENAI_API_KEY` is set, behavior is the same. No browser-specific server logic. |
| **UI layout** | Responsive breakpoints, sidebar, panels, dialogs, forms. No browser-specific layout branches. |
| **Storage (normal mode)** | `localStorage` and `sessionStorage` for preferences, cache, tour state, etc. Same keys and behavior. |
| **PWA install** | Manifest and service worker are registered when the browser supports them; install prompt (Chrome/Edge) or Add to Home Screen (Safari) follow platform norms but the installed app is the same. |
| **Theme / accessibility** | Single theme and a11y path; no browser-specific styling or a11y logic. |

So for normal use (non–private mode, popups allowed where needed), **the app is intended to function the same on all browsers**.

---

## Intentional or unavoidable differences by browser

These are the only areas where behavior or “presence” can differ by browser. None of them change core task or auth behavior.

### 1. Browser AI (local AI fallback)

- **What:** Optional use of the **Browser AI API** (`window.ai` or `navigator.ai`) for description/term extraction when server AI is not used or fails.
- **Where:** `src/lib/browser-ai-api.ts` — `isBrowserAIAvailable()` checks `window.ai` and `navigator.ai`.
- **By browser:**
  - **Chrome (with built-in AI):** May expose `navigator.ai` → Browser AI can be used.
  - **Edge / other Chromium:** Depends on whether the API is enabled.
  - **Firefox / Safari:** Typically no `window.ai` / `navigator.ai` → Browser AI not available; app uses **local non-AI fallback** (term extraction + domain terminology).
- **Impact:** When Browser AI is unavailable, description/breakdown still work; they use the same server AI when configured, and otherwise the same local fallback. **Core function is the same; only the quality/source of local AI can differ.**

### 2. Notifications (permission and instructions)

- **What:** Web Push / `Notification` API and the way users enable notifications.
- **Where:** `src/components/SettingsPanel.tsx` (notification permission UI) and notification context.
- **By browser:** The app shows **browser-specific instructions** when notifications are blocked (Chrome/Edge, Firefox, Safari) so users can enable them in the right place. Safari requires enabling in Safari settings, not via the in-page prompt.
- **Impact:** Same feature (notifications); only the **instructions** and where the user grants permission differ. Behavior once permission is granted is the same.

### 3. Calendar OAuth (popup)

- **What:** Google/Outlook calendar connect opens a popup (`window.open`) for OAuth.
- **Where:** `src/contexts/CalendarContext.tsx` — `window.open(..., 'calendar_oauth_...')`.
- **By browser:** Some browsers (especially Safari and strict popup blockers) may block the popup. The app already handles this and can show a message like “Your browser blocked the popup window…”
- **Impact:** If the popup is blocked, connect flow cannot complete in that tab until the user allows popups. Core app and calendar **after** connect are the same.

### 4. Haptic feedback (vibrate)

- **What:** Short vibration on bottom nav tap (e.g. “Today”, “Week”).
- **Where:** `src/components/BottomNav.tsx` — `if ('vibrate' in navigator) navigator.vibrate(...)`.
- **By browser:** `navigator.vibrate` is not supported in Safari (desktop or iOS). The code checks `'vibrate' in navigator`, so it simply does nothing there.
- **Impact:** Purely additive; no vibration in Safari, no error. Rest of nav behavior is identical.

### 5. Service worker (updates and offline)

- **What:** Registration and update flow in `src/main.tsx` and `src/lib/service-worker-update.ts`.
- **By browser:** Registration is guarded by `'serviceWorker' in navigator`. All modern browsers in scope support it; behavior may differ slightly (e.g. when the new worker takes control). The app explicitly avoids auto-reload on controller change so behavior stays consistent.
- **Impact:** Same intent (background updates, optional offline) across browsers; minor implementation differences only.

### 6. localStorage in private / restricted mode

- **What:** Many features use `localStorage` (and some `sessionStorage`) for preferences, cache, and tour state.
- **By browser:** In Safari (and some others) private mode, `localStorage` can throw or behave like a no-op. The code uses try/catch in some places (e.g. AuthContext) but not everywhere.
- **Impact:** In private/restricted mode, the app may not persist preferences or cache locally; core tasks and auth still work against the server. This is an environment restriction, not a desktop-vs-mobile or Chrome-vs-Safari feature split.

---

## Verification checklist (per browser)

To confirm “app functions the same for all browsers,” validate the same set of flows on each:

- [ ] **Chrome (desktop)** – Sign in, create/edit task, AI description, calendar connect (popup), notifications, PWA install.
- [ ] **Edge (desktop)** – Same as Chrome (Chromium base).
- [ ] **Firefox (desktop)** – Same flows; no Browser AI expected; notifications instructions differ.
- [ ] **Safari (desktop)** – Same flows; no Browser AI, no vibrate; notification instructions Safari-specific; watch for popup blocking on calendar.
- [ ] **Chrome (Android)** – Same as desktop; vibrate may work; PWA Add to Home Screen.
- [ ] **Safari (iOS)** – Same flows; standalone detection via `navigator.standalone`; no vibrate; calendar popup in separate window.

---

## Conclusion

- **Core app behavior is the same across browsers:** tasks, auth, API, server AI, UI, and storage (in normal mode) do not branch on browser.
- **Documented differences are limited to:** (1) optional Browser AI availability, (2) browser-specific notification instructions, (3) popup blocking for calendar OAuth, (4) vibrate only where supported, (5) service worker details, (6) localStorage in private mode. None of these change the core task or auth model.
- For a formal “presence on all browsers” statement: the app is **present and intended to function the same** on Chrome, Edge, Firefox, and Safari (desktop and mobile). The only intentional variations are the ones listed above, and they are either additive (vibrate, Browser AI) or instructional (notifications) or environment-related (popups, private mode).

For minimum versions and API-level compatibility, see `docs/archive/BROWSER_COMPATIBILITY_REVIEW.md`.

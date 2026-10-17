# TaskZM Management App

A neurodivergent-friendly task management application with AI-assisted planning, team collaboration, calendar sync, and productivity tools. Built as a Progressive Web App with React, TypeScript, and Supabase.

**Live:** [app.taskzm.com](https://app.taskzm.com)  
**Version:** 1.0.21 — *Task changes persist after refresh* (February 20, 2026)

---

## Table of Contents

- [Features](#features)
  - [Task Management](#task-management)
  - [Views](#views)
  - [AI Features](#ai-features)
  - [Team Collaboration](#team-collaboration)
  - [Calendar Integration](#calendar-integration)
  - [Productivity Tools](#productivity-tools)
  - [Analytics & Gamification](#analytics--gamification)
  - [Progressive Web App](#progressive-web-app)
  - [Notifications](#notifications)
  - [Settings & Customisation](#settings--customisation)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Testing](#testing)
- [Design](#design)

---

## Features

### Task Management

- **Full task lifecycle** — create, edit, schedule, complete, and archive tasks with title, description, status, priority, due date, scheduled date, estimated/actual time, notes, subtasks, tags, and assignees.
- **Statuses:** Todo, In-Progress, Done, On-Hold.
- **Priorities:** Low, Medium, High, Urgent.
- **Rich text descriptions** with a built-in editor.
- **Folders** — organise tasks into colour-coded folders with full CRUD, persisted to the server.
- **Inbox** — a triage area for unscheduled tasks.
- **Archive** — browse completed task history.
- **Task dependencies** — mark tasks as blocking others, with automatic "Next Up" badge when blockers are cleared.
- **Task templates** — save and reuse task patterns (Pro Yearly).
- **Recurring tasks** — daily, weekly, or monthly recurrence with configurable interval, days-of-week, day-of-month, and optional end date. Series-based occurrence system.
- **Auto task rollover** — incomplete, non-recurring, past-due tasks are automatically moved back to the inbox (Pro).
- **Drag and drop** — powered by `@dnd-kit`. Drag task cards between Kanban columns or reorder in the Today Agenda. Drop actions enforce daily hour limits, category hour windows, and detect time conflicts with other tasks and calendar events.
- **Context menus** — right-click tasks for quick actions.

### Views

| View | Description |
|---|---|
| **7-Day Kanban (Week View)** | Drag-and-drop weekly planning board. Configurable week start (Sunday or Monday). |
| **Month Calendar View** | Full calendar grid for long-range planning. Toggle between Week and Month with a single switch. |
| **Today Agenda** | Timeline of today's tasks ordered by time, with one-row-per-item layout. |
| **Inbox** | Side panel listing all unscheduled tasks for triage. |
| **Folders** | Side panel with folder list and detail views. |
| **Archive** | Completed task history. |
| **Dashboard** | Main landing view combining the Kanban board with side panels. |
| **Mobile / Tablet** | Fully responsive layouts with bottom navigation bar, mobile-optimised headers, safe-area handling, and swipe gestures. |

### AI Features

- **AI Scheduler** — automatically schedules unscheduled tasks by analysing action verbs, complexity, priority, and estimated duration. Respects configurable daily work hour limits (5/8/10 hrs), category hour windows (Work / Personal / Projects), existing calendar events, and time conflicts. Distributes work across a 14-day window.
- **AI Re-Scheduler** — one-click reschedule for a specific day, week, or month. Unschedules existing tasks first, then reschedules with the same rules as the AI Scheduler.
- **AI Recommendations Panel** — surface scheduling suggestions in a slide-out drawer.
- **AI Description Generator** — generates task descriptions using multiple sources:
  - Browser AI API (`window.ai`) for local on-device inference.
  - OpenAI API (`gpt-4o-mini`) via a Supabase Edge Function.
  - Local terminology matching with domain detection (Business, Home, Personal, World).
  - Returns up to 6 description variations at different detail levels.
- **Action Plan Generator** — creates step-by-step action plans with time distribution based on task domain and effort score.
- **Task Breakdown** — real-time analysis as you type: domain detection, keyword/phrase extraction, verb/noun analysis, effort scoring.

### Team Collaboration

- **Workspaces** — every user gets a workspace on signup; workspace-level teams are supported.
- **Multi-team support** — create additional teams (up to 8 members each).
- **Role-based access** — Admin, Member, and Viewer roles.
- **Invitations** — invite users by email with expiring invitation tokens; accept/decline flow with a dedicated invite acceptance page.
- **Team panel** — manage workspace team and additional teams from a single panel.

### Calendar Integration

| Provider | Connection | Features |
|---|---|---|
| **Google Calendar** | OAuth 2.0 | Two-way sync, event import, recurring event support |
| **Apple Calendar** | CalDAV credentials | Event import, recurring event support |
| **Outlook Calendar** | OAuth 2.0 (Azure) | Event import |

Imported calendar events display as cards on the Kanban board with proper timezone handling, recurring event indicators, and a local event cache for performance.

### Productivity Tools

- **Pomodoro Timer** — global tick with configurable work duration (5–120 min), pause/resume from the task card or dialog, time tracked to `actualTime`, timer history and stats. Available on free tier with basic features; advanced Pomodoro on Pro.
- **Keyboard shortcuts** — quick access to common actions with a shortcuts dialog.
- **Emoji picker** — decorate tasks with emoji.

### Analytics & Gamification

- **Analytics Panel** — charts (via Recharts) for task completion trends and insights. Export reports as PDF (html2canvas + jsPDF). 30-day history on Pro Monthly; unlimited on Pro Yearly.
- **Awards system** — 23+ achievements across completion and streak categories:
  - *Completion:* First Steps (1), Getting Started (10), Task Warrior (25), Productivity Champion (50), Century Club (100), Elite Achiever (250), Legendary (500).
  - *Streaks:* Momentum (3-day), Week Warrior (7), Fortnight (14), Month (30), Quarter (90), Year (365).
  - *Rarity tiers:* Common, Rare, Epic, Legendary.
- **Award celebrations** — confetti animation and celebration sound on unlock.
- **Progress tracking** — award state persisted to the server.

### Progressive Web App

- Installable on iOS, Android, and desktop (standalone display, portrait-primary orientation).
- Full **offline support** via a Service Worker with cache-first for core assets and network-first for API calls.
- **App shortcuts** — "Today's Tasks" and "Add Task" from the home screen icon.
- **Chunk error recovery** — lazy-loaded route chunks retry on failure with automatic page reload after a cooldown.

### Notifications

- **In-app toasts** (Sonner) rendered above dialogs.
- **Browser notifications** with permission management.
- **App icon badge counts** for due and overdue tasks.
- **Native notifications** via Capacitor on iOS/Android.
- **Notification panel** with filters.
- **Configurable reminders** — choose reminder lead time and check interval.

### Settings & Customisation

- **Theme** — Light, Dark, or System (follows OS preference). Persisted to `localStorage`.
- **Profile** — edit name and avatar (avatar selection dialog with prebuilt avatars).
- **AI settings** — auto-scheduling toggle, priority-based scheduling, daily hour limit.
- **Category hours** — configure Work / Personal / Projects time windows for weekdays and weekends.
- **Week start day** — Sunday or Monday.
- **Subscription management** — view current plan, upgrade, cancel, refresh status.
- **Database sync** — auto-sync every 30 seconds with relative timestamp display.
- **Onboarding tour** — guided walkthrough (react-joyride) auto-triggered for new users.

### Subscription Tiers

| | Free | Pro Monthly ($3.99/mo) | Pro Yearly ($39.99/yr) |
|---|---|---|---|
| Tasks | Unlimited | Unlimited | Unlimited |
| 7-Day Kanban & Month View | Yes | Yes | Yes |
| Custom Tags | Yes | Yes | Yes |
| AI Scheduler | 3 suggestions/week | Unlimited | Unlimited |
| Calendar Sync | — | 1 connection | Unlimited |
| Task Hours & Time Tracking | — | Yes | Yes |
| Auto Task Rollover | — | Yes | Yes |
| Advanced Pomodoro | — | Yes | Yes |
| Analytics | — | 30-day history | Unlimited history |
| Recurring Tasks | — | Up to 5 active | Unlimited |
| Task Templates | — | — | Yes |
| Task Dependencies | — | — | Yes |
| Team Collaboration | — | — | Yes |
| Multiple Workspaces | — | — | Yes |
| Priority Support | — | — | Yes |

Payments are processed through RevenueCat and Stripe.

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite (SWC) | Build tooling and dev server |
| Tailwind CSS | Utility-first styling |
| Radix UI / shadcn-ui | Accessible component primitives (50+ components) |
| @dnd-kit | Drag and drop |
| Motion (Framer Motion) | Animations |
| Recharts | Data visualisation |
| Capacitor | Native iOS/Android shell with local notifications |

### Backend

| Technology | Purpose |
|---|---|
| Supabase | Auth, PostgreSQL database, Edge Functions, Storage |
| Hono | HTTP router for the Edge Function |
| Deno | Edge Function runtime |
| OpenAI API | Server-side AI description generation |

### Payments

| Technology | Purpose |
|---|---|
| RevenueCat | Subscription management |
| Stripe | Payment processing |

### Testing & Automation

| Technology | Purpose |
|---|---|
| Playwright | End-to-end tests and automated screenshots |

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **npm**
- A Supabase project (for full functionality)

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the development server (http://localhost:3000)
npm run dev

# 3. Build for production
npm run build
```

### Demo Account

Click **Try Demo Account** on the login screen. A temporary account is created with Pro-tier access so you can explore all features. Demo accounts are automatically cleaned up after 15 minutes of inactivity.

---

## Environment Variables

Create a `.env` file in the project root (see `.env.example`).

### Frontend (Vite)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_PROJECT_REF` | Optional | Override the default Supabase project ref (for staging) |
| `VITE_SUPABASE_ANON_KEY` | Optional | Override the default Supabase anon key |
| `VITE_REVENUECAT_WEB_PUBLIC_KEY` | For payments | RevenueCat Web public key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | For payments | Stripe publishable key |

### Backend (Supabase Edge Function Secrets)

Set these in the Supabase Dashboard under **Project Settings > Edge Functions > Secrets**, not in `.env`.

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Optional | Enables server-side AI description generation |
| `GOOGLE_CLIENT_ID` | For Google Calendar | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For Google Calendar | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | For Google Calendar | Google OAuth redirect URI |
| `OUTLOOK_CLIENT_ID` | For Outlook Calendar | Azure application client ID |
| `OUTLOOK_CLIENT_SECRET` | For Outlook Calendar | Azure client secret |
| `OUTLOOK_REDIRECT_URI` | For Outlook Calendar | Outlook OAuth redirect URI |
| `REVENUECAT_WEBHOOK_SECRET` | For payments | RevenueCat webhook auth token |
| `STRIPE_SECRET_KEY` | For payments | Stripe secret key |
| `APP_URL` | For payments | Public app URL |

If `OPENAI_API_KEY` is not set, the app falls back to local-only description building.

---

## Project Structure

```
TaskZM-Management-App/
├── src/
│   ├── App.tsx                    # Root component (ErrorBoundary > ThemeProvider > Auth)
│   ├── AppContent.tsx             # Main app layout, view routing, loading screen
│   ├── main.tsx                   # Entry point, PWA bootstrap
│   ├── server.js                  # Production Node.js server for PWA
│   ├── components/
│   │   ├── DashboardView.tsx      # Dashboard with Kanban + panels
│   │   ├── SevenDayKanban.tsx     # 7-day Kanban board
│   │   ├── MonthCalendarView.tsx  # Month calendar grid
│   │   ├── TodayAgendaView.tsx    # Today timeline
│   │   ├── InboxView.tsx          # Inbox panel
│   │   ├── FoldersPanel.tsx       # Folders panel
│   │   ├── ArchiveView.tsx        # Completed tasks
│   │   ├── TaskDialog.tsx         # Task create/edit dialog
│   │   ├── DraggableTaskCard.tsx  # Drag-and-drop task card
│   │   ├── AIRecommendationPanel.tsx
│   │   ├── AnalyticsPanel.tsx     # Charts and reports
│   │   ├── SettingsPanel.tsx      # App settings
│   │   ├── TeamPanel.tsx          # Team management
│   │   ├── PomodoroTimer.tsx      # Focus timer
│   │   ├── AuthScreen.tsx         # Login / signup
│   │   ├── AppSidebar.tsx         # Side navigation
│   │   ├── BottomNav.tsx          # Mobile bottom navigation
│   │   └── ui/                    # 50+ shadcn/ui primitives
│   ├── contexts/                  # 13 React context providers
│   │   ├── TaskContext.tsx        # Task CRUD, sync, rollover
│   │   ├── AuthContext.tsx        # Authentication state
│   │   ├── DragDropContext.tsx    # Drag-and-drop with conflict resolution
│   │   ├── CalendarContext.tsx    # Calendar connections and sync
│   │   ├── TeamContext.tsx        # Teams, workspaces, invitations
│   │   ├── SubscriptionContext.tsx # Feature gating
│   │   └── ...                    # AI, Awards, Loading, Notifications, etc.
│   ├── hooks/                     # Custom hooks
│   │   ├── useAIScheduler.ts     # AI scheduling logic
│   │   └── ...
│   ├── lib/                       # Utilities and constants
│   │   ├── api.ts                # API client
│   │   ├── ai-config.ts          # AI scheduler configuration
│   │   ├── feature-gates.ts      # Feature access checks
│   │   └── ...
│   └── public/
│       ├── manifest.json          # PWA manifest
│       └── service-worker.js      # Offline caching
├── supabase/
│   └── functions/
│       └── taskzm-database-function/  # Hono-based Edge Function
│           ├── index.ts               # API routes (tasks, teams, calendar, etc.)
│           ├── kv_store.tsx           # Key-value persistence layer
│           ├── calendar-sync.tsx      # Calendar sync logic
│           ├── google-calendar-sync.tsx
│           ├── apple-caldav-sync.tsx
│           ├── email-service.tsx
│           └── cleanup-utils.tsx      # Demo account cleanup
├── tests/
│   ├── demo-auth.setup.ts        # Playwright demo-user auth
│   └── screenshots.spec.ts       # Automated screenshot capture
├── scripts/                       # Deployment, diagnostics, migrations
├── docs/                          # Guidelines and compliance docs
├── playwright.config.ts
├── railway.toml                   # Railway deployment config
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server on port 3000 |
| `npm run build` | Production build (auto-bumps service worker cache) |
| `npm run screenshots` | Run Playwright tests to capture app screenshots |
| `npm run deploy-functions` | Deploy the Supabase Edge Function |
| `npm run generate-icons` | Generate app icons with padding |
| `npm run check-keys` | Verify Supabase configuration |

---

## Deployment

### Production Hosting — Railway

The app is hosted on [Railway](https://railway.app) with Nixpacks:

| Setting | Value |
|---|---|
| Builder | Nixpacks |
| Build command | `cd src && npm ci && npm run build` |
| Start command | `cd src && node server.js` |
| Node version | 20 |
| Port | 4173 |

The production server (`src/server.js`) is a custom Node.js HTTP server that serves static assets from `dist/` with proper MIME types, handles SPA routing (all non-static routes serve `index.html`), and sets PWA-appropriate cache headers.

### Edge Functions — Supabase

A single Edge Function (`taskzm-database-function`) handles all backend API routes. Deploy with:

```bash
supabase functions deploy taskzm-database-function --project-ref <your-project-ref>
```

Or use the convenience script:

```bash
npm run deploy-functions
```

### Deployment Workflow

See **[docs/PLATFORM_SYNC.md](docs/PLATFORM_SYNC.md)** for web + iOS + Android sync.

1. After `src/` changes: `npm run sync:platforms` (build + Capacitor sync).
2. Push to `main` branch for Railway web deploy (~5–7 minutes).
3. For App Store / Play builds: bump `src/lib/version.ts`, run `npm run mobile:build`, then archive in Xcode / Android Studio.
4. Deploy Edge Functions separately: `npm run deploy-functions`

---

## Testing

### Playwright — E2E & Screenshots

The test suite logs in as a demo user and captures screenshots of key app views.

```bash
# Run the full screenshot suite
npm run screenshots
```

**Configuration:** `playwright.config.ts`

| Setting | Value |
|---|---|
| Target | `https://app.taskzm.com` (override with `PLAYWRIGHT_BASE_URL`) |
| Browser | Chromium, headless |
| Viewport | 1280 × 720 |

**Test projects:**

1. **setup** — creates a demo account, logs in, saves auth state.
2. **screenshots** — uses saved auth to capture: Dashboard Week View, Dashboard Month View, Inbox Side Panel, Today Agenda Side Panel, AI Re-Scheduler Dialog.

### Utility Scripts

The `scripts/` directory contains build, release and setup tools:

- `bump-build-number.js`, `sync-ios-xcode-version.js`, `sync-android-version.js` — version and build numbers
- `sync-all-platforms.sh`, `write-build-info.js`, `update-service-worker-cache.js` — build and platform sync
- `ios-fresh-build.sh`, `patch-capacitor-wkprocesspool.cjs` — iOS build helpers
- `deploy-functions.sh`, `setup-google-calendar-secrets.sh` — Supabase Edge Functions and secrets
- `generate-icons-with-padding.js`, `generate-people-avatars.mjs` — app icon and avatar assets

---

## Design

- **Figma:** [TaskZM Design File](https://www.figma.com/design/2LaboW1D8tdWzo4S28kP/TaskZM-Management-App)
- **Changelog:** See `src/lib/version.ts` for the full version history.

# TaskZM Complete Documentation

**Version 1.0.9** — Complete Application Documentation  
**Last Updated:** January 2025  
**Status:** ✅ Production Ready

> 📝 **Maintenance Note:** This document is the central source of truth for all TaskZM documentation. It should be updated whenever new features, improvements, or changes are made to the application. See the [Documentation Maintenance](#documentation-maintenance) section for guidelines.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Quick Start](#quick-start)
4. [Architecture & Tech Stack](#architecture--tech-stack)
5. [Development Guidelines](#development-guidelines)
6. [AI Scheduling System](#ai-scheduling-system)
7. [Team & Permissions](#team--permissions)
8. [Deployment](#deployment)
9. [PWA & Browser Compatibility](#pwa--browser-compatibility)
10. [Project Structure](#project-structure)
11. [Status & Version History](#status--version-history)
12. [Recent Improvements & Updates](#recent-improvements--updates)
13. [Documentation Maintenance](#documentation-maintenance)
14. [Attributions](#attributions)

---

## Overview

TaskZM is a neurodivergent-friendly task management application with AI-assisted planning. It provides a comprehensive solution for organizing tasks, scheduling, team collaboration, and productivity tracking.

### Key Characteristics
- **Neurodivergent-Friendly Design**: Minimal visual clutter, smooth animations, clear feedback
- **AI-Powered Scheduling**: Intelligent task scheduling with calendar integration
- **Team Collaboration**: Workspace-based team management with role-based permissions
- **Progressive Web App**: Installable on iOS, Android, and desktop
- **Offline Support**: Works without internet connection
- **Cross-Platform**: Responsive design for all device sizes

---

## Features

### Core Features (Free Tier)
- 📅 **Today Agenda** - Timeline view of your daily tasks
- 🗓️ **7-Day Kanban** - Visual weekly planning board
- 📆 **Month Calendar** - Full calendar view with task management
- 📥 **Inbox** - Unscheduled task collection
- 📦 **Archive** - Completed task history
- 🏷️ **Custom Tags & Categories** - Organize tasks your way
- ⏰ **Pomodoro Timer** - Focus timer with sound alerts
- 🏆 **Awards System** - 23 achievements to unlock
- 🌙 **Dark Mode** - System-aware theming
- 🔒 **Offline Mode** - Works without internet

### Pro Features ($3.99/month)
- 🤖 **AI Scheduler** - Smart task scheduling with category hours
- 📊 **Analytics** - Task completion insights and trends
- ⏱️ **Task Hours** - Time tracking per category
- 🔄 **Calendar Sync** - External calendar integration (Google Calendar, Apple Calendar)
- 👥 **Team Collaboration** - Workspace-based team management
- 🔗 **Task Dependencies** - Link tasks and track dependencies

### Additional Features
- 📱 **PWA** - Install on iOS, Android, and desktop
- ⚡ **Auto-Sync** - 30-second cloud synchronization
- 🎨 **Customizable** - Personalize your workspace
- 🔔 **Notifications** - Stay updated on team activity
- 📁 **Folders** - Organize tasks into projects

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory:

```bash
# Supabase (Required for backend features)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Payments (Optional - for Pro tier)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

**Note:** Environment variables for Railway should be configured in the Railway dashboard, not in `.env`

### 3. Start Development Server
```bash
npm run dev
```
Visit `http://localhost:3000`

### 4. Build for Production
```bash
npm run build
```

---

## Architecture & Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4.0** - Styling
- **Motion (Framer Motion)** - Animations
- **Vite 6** - Build tool

### Backend
- **Supabase** - Backend-as-a-Service
  - Edge Functions (API)
  - Authentication
  - Database (PostgreSQL)
  - Real-time subscriptions

### Payments
- **Stripe** - Payment processing
- **RevenueCat** - Subscription management

### Deployment
- **Railway** - Hosting platform
- **Domain:** www.taskzm.com

### Design System

**Neurodivergent-Friendly Colors:**
- 🌿 **Mint** (#B8E6D5) - Work, Primary
- 💜 **Lavender** (#E6D5F0) - Personal
- 🍑 **Peach** (#FDD5B4) - Projects
- 🌤️ **Sky Blue** (#C9E4F7) - Accents
- 🦄 **Lilac** (#D4C5F9) - Accents

**Design Principles:**
- Minimal visual clutter
- Smooth animations (60 FPS)
- Clear feedback on all actions
- Accessible contrast ratios
- Keyboard navigation support

---

## Development Guidelines

### Code Quality Standards

#### TypeScript
- **Target:** ES2020
- **Strict Mode:** Enabled
- **Type Safety:** All components should be properly typed
- **Error Handling:** Use type guards for union types

#### Code Organization
- **Components:** One component per file
- **Hooks:** Custom hooks in `src/hooks/`
- **Utilities:** Shared utilities in `src/lib/`
- **Constants:** Centralized in `src/lib/*-constants.ts`
- **Types:** Shared types in `src/types/index.ts`

#### Best Practices
- ✅ Use constants instead of hardcoded values
- ✅ Extract duplicate code to utilities
- ✅ Use proper error handling with try-catch
- ✅ Log errors using `logger` utility
- ✅ Follow responsive design patterns
- ✅ Test on multiple devices and browsers

### Context Providers

All 12 context providers use type-safe default factory functions:
- `AuthContext` - Authentication state
- `TaskContext` - Task management
- `SubscriptionContext` - Subscription status
- `TeamContext` - Team management
- `CalendarContext` - Calendar integration
- `AIContext` - AI settings
- `ThemeContext` - Theme management
- `DragDropContext` - Drag and drop state
- `PomodoroContext` - Pomodoro timer
- `AwardContext` - Awards system
- `NotificationContext` - Notifications
- `SidebarContext` - Sidebar state
- `LoadingContext` - Loading state management

### Constants Management

**Layout Constants** (`src/lib/layout-constants.ts`):
- Spacing, typography, colors, dimensions
- Viewport breakpoints
- Animation constants

**Business Constants** (`src/lib/business-constants.ts`):
- Time calculations
- Date formatting
- Business hours

**AI Constants** (`src/lib/ai-config.ts`):
- Scheduling parameters
- Priority weights
- Category hours

---

## AI Scheduling System

### Overview

The AI Scheduler intelligently places tasks in the calendar based on:
- Task category (Work, Personal, Projects)
- Category hours (time windows for each category)
- Existing tasks and calendar events
- Task priority and status
- Recurring task patterns

### Core Principles

#### 1. Task Type Differentiation

**Recurring Tasks:**
- Identification: `recurrence.type !== 'none'`
- Behavior: Appear on multiple days based on recurrence pattern
- Scheduling: Time assigned applies to ALL occurrences
- Conflict Detection: Check all occurrence days using `isDateInRecurrence()`

**Regular Tasks:**
- Identification: `recurrence.type === 'none'` or no recurrence
- Behavior: Appear on one specific date
- Scheduling: Single date and time
- Conflict Detection: Direct date comparison

#### 2. Finding Available Time Slots

**Process:**
1. Identify target date
2. Get all tasks for date (existing + plan + recurring)
3. Filter valid tasks (exclude midnight/00:00:00 times)
4. Check category hours
5. Find available slot using `findNextAvailableSlot()`
6. Verify no conflicts

**Conflict Detection:**
- Time overlap: Two tasks conflict if time ranges overlap
- Same start time: Tasks with same start time (within 1 minute) conflict
- Calendar events: External calendar events must be checked
- All tasks: Check existing tasks, plan tasks, recurring tasks, and calendar events

#### 3. Chronological Order

- Tasks must be scheduled in chronological order (earliest to latest)
- Use `findNextAvailableSlot()` which automatically places tasks after existing tasks
- Maintain chronological order while spreading tasks throughout the day/week/month

#### 4. Category Hours Rules

**Categories:**
- **Work**: Business and professional tasks
- **Personal**: Personal and family tasks
- **Projects**: Project-related tasks

**Rules:**
1. Respect category hours if enabled
2. Use `getCategoryTimeSlot()` to find time within category hours
3. Time distribution priority:
   - Category hours (priority 1)
   - Time distribution using `DEFAULT_TIME_SLOTS` (priority 2)
   - Gap finding (priority 3)
4. Never schedule before category start or after category end

#### 5. Calendar Event Integration

**Critical Requirements:**
- ✅ Calendar events are fetched from Google Calendar and Apple Calendar
- ✅ Tasks must NOT be scheduled at the same time as calendar events
- ✅ Calendar events are checked via `findNextAvailableSlot()` with `calendarEvents` option
- ✅ Calendar events are NOT included in the 5-hour daily limit calculation
- ✅ Calendar events are external commitments - tasks must avoid conflicts

**Implementation:**
- Calendar events are fetched at the start of `generateSchedulePlan()`
- All calls to `findNextAvailableSlot()` include `calendarEvents` parameter
- Conflict detection checks for overlaps, same start time, and times within 1 minute

#### 6. Daily Limits

- **Maximum:** 5 hours per day (TASKS ONLY)
- **Important:** Calendar events do NOT count toward the 5-hour limit
- Tasks exceeding limit are moved to next day
- Days exceeding limit are tracked in `daysExceedingLimit` array

### Key Functions

- `getUnscheduledTasks()` - Get tasks that need scheduling
- `calculateFirstOccurrenceDate()` - Calculate first occurrence for recurring tasks
- `isDateInRecurrence()` - Check if recurring task applies to a date
- `getCategoryTimeSlot()` - Get time within category hours
- `findNextAvailableSlot()` - Find next available time slot without conflicts
- `getCategoryHoursForTask()` - Get category hours for a task
- `getTaskCategory()` - Determine task category from tags

### Validation Checklist

Before scheduling a task, verify:
- [ ] Task type correctly identified (recurring vs regular)
- [ ] Target date is today or in the future
- [ ] All tasks for the date are visible (existing + plan + recurring)
- [ ] Calendar events for the date are checked for conflicts
- [ ] No tasks scheduled at the same time as calendar events
- [ ] Category hours are respected
- [ ] Time distribution is applied using available time slots
- [ ] No time conflicts exist (with tasks AND calendar events)
- [ ] Task fits within category end time
- [ ] Task is in chronological order
- [ ] Daily hour limit is not exceeded (5 hours for TASKS only)

---

## Team & Permissions

### Team Structure

**Workspace-Based Collaboration:**
- All team members belong to a shared workspace
- Workspace ID stored in `TaskContext`
- All tasks, team members, and settings scoped to workspace

**Team Member Roles:**
1. **Admin** - Full access
   - Create, edit, delete tasks
   - Assign tasks
   - Manage team members
   - View analytics

2. **Member** - Standard access
   - Create, edit, delete tasks
   - Assign tasks
   - View analytics
   - Cannot manage team members

3. **Viewer** - Read-only access
   - View tasks and analytics
   - Cannot create, edit, delete, or assign tasks
   - Cannot manage team members

### Permission Enforcement

**Implementation Levels:**
1. **Context Level** - `TaskContext` functions check permissions before executing
2. **Component Level** - UI components check permissions before allowing actions
3. **UI Level** - Form fields and buttons disabled based on permissions

**Permission Hook:**
- `usePermissions()` - Returns permission object with role-based flags
- `usePermissionCheck()` - Returns helper function to check permissions with toast notifications

**Files Modified:**
- `src/hooks/usePermissions.ts` - Permission hook
- `src/contexts/TaskContext.tsx` - Permission checks in task operations
- `src/components/TaskDialog.tsx` - Permission checks and disabled form fields
- `src/components/DraggableTaskCard.tsx` - Permission check for toggle complete
- `src/components/InboxView.tsx` - Permission checks for creation/deletion

### Task Visibility

**Current Implementation:**
- ✅ ALL tasks in a workspace are visible to ALL team members
- ✅ Task assignment (`assignedTo` field) is for organization, not visibility control
- ✅ Task dependencies are visible to all team members
- ⚠️ No task-level privacy (all tasks are shared)

**Task Dependencies:**
- Tasks have `dependencies` field (array of task IDs)
- Dependencies visible in TaskDialog
- Dependency status (complete/incomplete) displayed
- Feature requires Pro Yearly subscription

### Team Management Features

- ✅ Add team members (single or bulk invite)
- ✅ Remove team members (with validation for assigned tasks)
- ✅ Update member roles
- ✅ Invitation system with email-based invites
- ✅ Invitation status tracking (pending, accepted, declined, expired)
- ✅ Search/filter team members
- ✅ Task statistics per member

---

## Deployment

### Railway Deployment

**Quick Deploy:**
```bash
chmod +x deploy.sh
./deploy.sh
```

Railway automatically builds and deploys to **www.taskzm.com** in 5-7 minutes.

**Environment Variables (Railway Dashboard):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (optional)

### Build Process

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Build:**
   ```bash
   npm run build
   ```

3. **Output:**
   - `dist/` folder contains production build
   - All assets optimized and minified
   - Service worker generated

### Deployment Checklist

- [ ] Environment variables configured in Railway
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Service worker registered
- [ ] PWA manifest valid
- [ ] HTTPS enabled (required for PWA)
- [ ] Domain configured (www.taskzm.com)
- [ ] Test on production URL

---

## PWA & Browser Compatibility

### Progressive Web App Features

**Status:** ✅ Fully Configured

**Features:**
- ✅ Installable on iOS, Android, and desktop
- ✅ Offline support with service worker
- ✅ HTTPS enabled (required for PWA)
- ✅ App manifest configured
- ✅ Icons optimized (192x192, 512x512)

**Installation:**
- **iOS:** Safari → Share → "Add to Home Screen"
- **Android:** Chrome → "Install TaskZM"
- **Desktop:** Browser menu → "Install TaskZM"

### Browser Compatibility

**Minimum Supported:**
- Chrome: 80+
- Firefox: 75+
- Safari: 13.1+
- Edge: 80+
- Mobile Safari: 13.1+
- Chrome Mobile: 80+

**Features by Browser:**

| Feature | Chrome/Edge | Firefox | Safari Desktop | Safari iOS |
|---------|------------|---------|----------------|------------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Manifest | ✅ | ✅ | ✅ | ✅ |
| Install Prompt | ✅ | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual |
| Offline Support | ✅ | ✅ | ✅ | ✅ |
| Push Notifications | ✅ | ✅ | ❌ | ❌ |
| Background Sync | ✅ | ⚠️ Limited | ❌ | ❌ |

**Known Limitations:**
- iOS Safari: Push notifications not supported (iOS limitation)
- Firefox: No automatic install prompt (manual installation)
- Safari Desktop: Push notifications not supported

### PWA Configuration

**Manifest (`/manifest.json`):**
- Name, short name, description configured
- Start URL: `/`
- Display mode: `standalone`
- Theme color: `#9D87C3`
- Icons: 192x192 and 512x512
- Shortcuts configured

**Service Worker (`/service-worker.js`):**
- Caches core assets on install
- Network-first strategy with cache fallback
- Background sync configured
- Push notifications handler implemented

---

## Project Structure

```
taskzm/
├── src/
│   ├── components/          # React components (90+)
│   │   ├── ui/              # shadcn components (42)
│   │   └── *.tsx            # Feature components
│   ├── contexts/            # React contexts (13)
│   ├── hooks/               # Custom hooks (9)
│   ├── lib/                 # Utilities (47 files)
│   │   ├── *-constants.ts   # Constants files
│   │   ├── *-utils.ts       # Utility functions
│   │   └── *.ts             # Other utilities
│   ├── guidelines/          # Development guidelines
│   │   ├── AI_SCHEDULING_GUIDELINES.md
│   │   ├── CONFLICTS_ANALYSIS.md
│   │   └── Guidelines.md
│   ├── types/               # TypeScript types
│   ├── styles/             # Global CSS
│   ├── public/              # Static assets (PWA files)
│   └── supabase/           # Backend functions
├── scripts/                # Utility scripts
├── tests/                  # Test files
├── package.json            # Dependencies
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── railway.toml            # Railway deployment config
```

### Key Directories

**Components:**
- `components/ui/` - Reusable UI components (shadcn)
- `components/*.tsx` - Feature-specific components

**Contexts:**
- All context providers in `contexts/`
- Type-safe default factories in `lib/context-defaults.ts`

**Utilities:**
- `lib/layout-constants.ts` - Layout and spacing constants
- `lib/business-constants.ts` - Business logic constants
- `lib/ai-config.ts` - AI scheduling configuration
- `lib/time-conflict.ts` - Conflict detection logic

---

## Status & Version History

### Current Version: 1.0.9

**Release Date:** January 15, 2025  
**Status:** ✅ Production Ready

**Recent Improvements:**
- ✅ Circular dependencies resolved
- ✅ Type safety enhancements
- ✅ Comprehensive logging infrastructure
- ✅ Enhanced error handling
- ✅ Context providers updated with type-safe defaults
- ✅ Calendar event conflict detection verified
- ✅ Responsive design improvements for tablets
- ✅ Hardcoded values eliminated (constants used throughout)
- ✅ Mobile layout hook implementation (`useMobileLayout`)
- ✅ Kanban highlighted column color enhancements
- ✅ Header spacing fixes for mobile/tablet devices
- ✅ Empty state UI improvements with consistent spacing
- ✅ Settings panel spacing standardization
- ✅ Mobile layout hook implementation (`useMobileLayout`)
- ✅ Kanban highlighted column color enhancements
- ✅ Header spacing fixes for mobile/tablet devices
- ✅ Empty state UI improvements with consistent spacing
- ✅ Settings panel spacing standardization

### Version History

**Version 1.0.3** - Analytics Motion Sync (November 24, 2025)
- Analytics panel crash resolved
- Dark mode header updates instantly
- Today Agenda drag-and-drop parity
- Demo account analytics verified

**Version 1.0.9** - TypeScript & Architecture Improvements (January 15, 2025)
- TypeScript errors fixed (33 → 0 in main components)
- Duplicate code extracted to utilities
- Circular dependencies resolved
- Context providers standardized

### Build Status

- ✅ TypeScript compilation: Passing
- ✅ Build process: Working
- ✅ Dependencies: Up to date
- ✅ Production deployment: Active at www.taskzm.com

### Known Issues

- ⚠️ 239 TypeScript errors remain (mostly in UI components and type definitions)
- ⚠️ Large bundle size (2.5MB) - consider code splitting

---

## Recent Improvements & Updates

### January 2025 Updates

#### Responsive Design Enhancements
- ✅ **Tablet Support**: Implemented `useMobileLayout()` hook for consistent tablet responsiveness
  - Tablets (768px-1279px) now use one-column mobile layout in both portrait and landscape
  - Proper header height adjustments for tablets
  - Hamburger menu functional on tablets with full menu options
- ✅ **Mobile Header Spacing**: Fixed header spacing issues on mobile devices
  - Removed gaps above header
  - Proper safe area inset handling for notched devices
  - Consistent padding across all views

#### UI/UX Improvements
- ✅ **Kanban Highlighted Column**: Enhanced visual prominence of "today" column
  - Deeper, more vibrant colors for highlighted column
  - Increased border opacity and thickness
  - Enhanced shadow effects for better visibility
  - Separate styling for light and dark modes
- ✅ **Empty State UI**: Standardized empty state design
  - Consistent spacing constants across all views
  - Proper icon sizing (small for Today Agenda, large for Inbox)
  - Improved visual hierarchy and messaging
- ✅ **Settings Panel**: Standardized spacing throughout
  - Consistent spacing constants for all accordion items
  - Proper responsive padding for mobile/tablet vs desktop
  - Improved visual organization

#### Code Quality
- ✅ **Hardcoded Values Elimination**: Replaced all hardcoded spacing/color values with constants
  - All spacing values use `layout-constants.ts`
  - All color values use `kanban-constants.ts` or `color-theme.ts`
  - All text sizes use `text-size-constants.ts`
  - Improved maintainability and consistency
- ✅ **Calendar Event Conflict Detection**: Verified and documented
  - All scheduling paths check calendar events
  - 8 instances of `findNextAvailableSlot()` with `calendarEvents` parameter
  - Comprehensive conflict detection (overlaps, same start time, within 1 minute)
  - Tasks never scheduled at same time as calendar events

#### Architecture Improvements
- ✅ **Mobile Layout Hook**: Created `useMobileLayout()` hook
  - Centralized logic for determining mobile vs desktop layout
  - Consistent across all components
  - Supports tablets in all orientations
- ✅ **Constants Organization**: Enhanced constant files
  - New constants for empty states
  - New constants for kanban styling
  - New constants for settings panel spacing

---

## Documentation Maintenance

### Keeping This Document Updated

This document serves as the **central source of truth** for all TaskZM documentation. It should be updated whenever:

1. **New Features Added**
   - Add to appropriate section (Features, AI Scheduling, Team & Permissions, etc.)
   - Update version history
   - Add to recent improvements section

2. **Architecture Changes**
   - Update Architecture & Tech Stack section
   - Update Project Structure if directories change
   - Document new patterns or conventions

3. **Bug Fixes or Improvements**
   - Add to Recent Improvements & Updates section
   - Update relevant technical sections if behavior changes
   - Update version history with date

4. **Configuration Changes**
   - Update Deployment section for deployment changes
   - Update Environment Setup for new variables
   - Update PWA section for manifest/service worker changes

5. **Code Quality Improvements**
   - Update Development Guidelines if standards change
   - Update Status & Version History
   - Document new utilities or patterns

### Update Checklist

When making updates:
- [ ] Update "Last Updated" date at top
- [ ] Add entry to Recent Improvements & Updates section
- [ ] Update relevant technical sections
- [ ] Update version history if version changes
- [ ] Verify all links and cross-references still work
- [ ] Check table of contents matches new sections

### Document Structure

The document is organized into logical sections:
1. **Overview & Features** - High-level app information
2. **Quick Start** - Getting started guide
3. **Architecture** - Technical details
4. **Development Guidelines** - Code standards
5. **Feature-Specific Sections** - Detailed feature documentation
6. **Deployment & Compatibility** - Deployment and browser info
7. **Status & History** - Current state and changelog
8. **Maintenance** - How to keep docs updated

### Version Control

- Document version matches app version when possible
- Major changes get new version number
- Minor updates increment date only
- All changes tracked in Recent Improvements section

---

## Attributions

### Third-Party Libraries

**shadcn/ui Components:**
- Used under [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)
- Components from [shadcn/ui](https://ui.shadcn.com/)

**Unsplash Photos:**
- Used under [Unsplash license](https://unsplash.com/license)
- Photos from [Unsplash](https://unsplash.com)

### Design System

**Figma Design:**
- Original project available at [Figma](https://www.figma.com/design/2LaboW1D8ZWtdWzo4S28kP/TaskZM-Management-App)

---

## Additional Resources

### Payment Configuration
- See `STRIPE_CHECKOUT_CONFIGURATION.md` for Stripe setup
- RevenueCat Web Billing integration details

### Team Structure
- See `TEAM_STRUCTURE_ANALYSIS.md` for detailed team implementation
- Workspace-based collaboration details

### Timezone Handling
- See `TIMEZONE_AND_GUIDELINES_STATUS.md` for timezone implementation
- UTC conversion and display logic

### Browser Compatibility
- See `BROWSER_COMPATIBILITY_REVIEW.md` for detailed browser support
- PWA verification details

### TypeScript Fixes
- See `TYPESCRIPT_FIXES_AND_DUPLICATE_EXTRACTION_SUMMARY.md` for fixes
- Code quality improvements

---

## Support & Contributing

### Getting Help

1. Check this documentation first
2. Review component-specific documentation
3. Check error logs in browser console
4. Review GitHub issues (if applicable)

### Contributing

1. Read development guidelines
2. Follow code quality standards
3. Test thoroughly on multiple devices
4. Submit PR with clear description

### Testing Checklist

- [ ] Test on desktop browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Test offline functionality
- [ ] Test PWA installation
- [ ] Test all user roles (Admin, Member, Viewer)
- [ ] Test AI scheduling with calendar events
- [ ] Test team collaboration features
- [ ] Verify no console errors

---

**Built with ❤️ for neurodivergent users**

*TaskZM - Your friendly task manager* 🎯✨

---

**Last Updated:** January 2025  
**Documentation Version:** 1.0  
**Maintained by:** TaskZM Development Team

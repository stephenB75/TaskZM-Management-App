# TaskZM Management App

A neurodivergent-friendly task management application with AI-assisted planning, team collaboration, calendar sync, and productivity tools. Built with React, TypeScript, and Supabase.

**Version**: 1.0.17 — *Notifications, Badging & Settings Spacing* (January 23, 2026)

## Features

- **Tasks & Projects**: Create, organize, schedule, and complete tasks across projects, folders, and views
- **Scheduling & Week View**: 7-day Kanban, Today Agenda, and calendar sync (Google, Apple)
- **Team Collaboration**: Multi-team support, invites, and shared workspaces with role-based access
- **Notifications**: In-app toasts (above dialogs), due/overdue alerts, and badge counts
- **Productivity**: Pomodoro timer, analytics, AI scheduler, and AI description generation
- **Adaptive UI**: Responsive layouts for desktop, tablet, and mobile with synced headers and panels

## Running the app

1. **Install dependencies**

   ```bash
   npm i
   ```

2. **Start the development server**

   ```bash
   npm run dev
   ```

3. **Build for production**

   ```bash
   npm run build
   ```

**Server-side AI (optional):** AI task description generation uses the Supabase Edge Function. To enable it, set `OPENAI_API_KEY` in your project’s Edge Function secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets). If unset, the app uses local-only description building.

## Project & docs

- **Design**: [Figma](https://www.figma.com/design/2LaboW1D8tdWzo4S28kP/TaskZM-Management-App)
- **App state**: See `APP_STATE_1.0.17.md` and `src/lib/version.ts` for current version and changelog

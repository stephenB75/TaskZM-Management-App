# TaskZM — App Store Listing (v2.0.0)

Copy for App Store Connect. Build: `20261015-1` (bump with `npm run bump:build` before upload, then `npm run mobile:build`). See [`MOBILE_RELEASE.md`](MOBILE_RELEASE.md) for the build and submission steps.

## App information

| Field | Value |
|---|---|
| Name (30 max) | TaskZM: Planner & To-Do |
| Subtitle (30 max) | AI scheduling for your day |
| Primary category | Productivity |
| Secondary category | Business |
| Age rating | 4+ |
| Bundle ID | `com.app.taskzm.com` |

### Keywords (100 max)

```
agenda,to do,todo list,tasks,schedule,calendar,pomodoro,focus,gtd,productivity,reminders,habit
```

### Promotional text (170 max, editable without review)

```
TaskZM 2.0 is here: a cleaner timeline, swipe-to-complete, iCloud calendar sync, and reliable reminders. Plan your day in seconds and let the AI fill the gaps.
```

## Description

```
TaskZM is getting things done in its simplest form. Capture tasks, see your day on one timeline, and let the auto scheduler find time for what matters — around your calendar, not on top of it.

PLAN YOUR DAY
• A single timeline for today with tasks and calendar events side by side
• A week view to see what's coming and rebalance your load
• Inbox for quick capture, so nothing slips through
• Swipe a task right to mark it done

SCHEDULE AUTOMATICALLY
• The auto scheduler places tasks into open time slots
• Respects your working hours for each category and your existing calendar events
• Adds breathing room between back-to-back tasks
• Unfinished tasks from past days roll over to your inbox (recurring tasks keep their own schedule)

STAY FOCUSED
• Built-in Pomodoro timer on any task, with focus minutes logged automatically
• Reminders for upcoming and due tasks, delivered as iOS notifications
• Face ID app lock to keep your plans private

CONNECT YOUR CALENDARS
• Sync with iCloud, Google, and Outlook calendars
• Imported events appear on your timeline and block out busy time

ORGANIZE YOUR WAY
• Folders, priorities, categories, and custom tags
• Recurring tasks and task dependencies
• Analytics to see where your time goes
• Achievements to celebrate your streaks

WORK WITH YOUR TEAM
• Invite teammates, assign tasks, and share workspaces with role-based access

WORKS EVERYWHERE
• Your tasks sync across iPhone, iPad, Android, and the web at app.taskzm.com
• Light and dark mode, optimized for every screen size including foldables

TASKZM PRO
Free includes unlimited tasks, custom tags, the Pomodoro timer, and 3 auto-scheduler runs per week. Pro unlocks:
• Unlimited auto scheduling
• Calendar sync
• Recurring tasks
• Task hours by category and automatic rollover
• Analytics
Pro Yearly adds unlimited calendar connections and recurring tasks, team collaboration, task templates, task dependencies, multiple workspaces, and full analytics history.

Pro Monthly: $3.99/month. Pro Yearly: $39.99/year.
Payment is charged to your Apple ID at confirmation of purchase. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your Apple ID account settings.

Terms of Use: [TERMS URL]
Privacy Policy: [PRIVACY URL]
```

## What's New in 2.0.0

```
TaskZM 2.0 — a fresh new look.

• Redesigned timeline and week view with calendar events alongside your tasks
• Swipe a task right to mark it done
• Calendar events now match your app colors
• Archive matches the rest of the app
• iCloud calendar sync is faster and more reliable
• Reliable reminders and notifications on iPhone
• Face ID app lock fixed
• Pomodoro timer is easier to find, right inside each task
• New inclusive profile avatars
• Better layouts for foldable phones and larger screens
• Smoother sign in and sign up
• Stability fixes for task creation and syncing
```

## App Review notes

```
Sign-in: Reviewers can use the "Try Demo Account" button on the sign-in screen (no credentials needed), or this test account:
  Email: [REVIEW EMAIL]
  Password: [REVIEW PASSWORD]

Subscriptions: Pro Monthly and Pro Yearly are auto-renewable subscriptions handled via StoreKit (RevenueCat). Open Settings → Subscription to view plans; "Restore Purchases" is on the same screen.

Permissions:
• Notifications — task reminders for upcoming and due tasks.
• Face ID — optional app lock, off by default (Settings → Security).
• Calendar sync — optional; connects iCloud (CalDAV app-specific password), Google, or Outlook accounts from Settings → Calendar Integrations.

Account deletion: Settings → Account → Delete Account.
```

## App Privacy answers

Based on the in-app privacy policy (`src/components/PrivacyPolicyDialog.tsx`). Confirm against production before submitting.

- **Data used to track you:** none. No ads and no third-party tracking.
- **Data linked to you, used for app functionality:**
  - Contact info: name and email.
  - User content: tasks, notes, and imported calendar events.
  - Identifiers: user ID.
  - Purchases: subscription status.
- **Diagnostics:** answer yes only if crash or analytics reporting is enabled in production.

## Before submitting

- [ ] Host Privacy Policy, Terms of Use, and Support pages and replace the `[… URL]` placeholders. Apple requires a working privacy policy URL, and the Terms link is required for subscriptions.
- [ ] Align the contact email domain: the privacy policy uses `privacy@taskzm.app`, while the app is on `taskzm.com`.
- [ ] Add the review test account, or confirm the demo account works on the production build.
- [ ] Confirm prices match the App Store Connect subscription products (defaults in `src/lib/subscription-constants.ts`).
- [ ] Bump the build number and run `npm run mobile:build`.

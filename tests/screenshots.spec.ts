import { test, type Page } from '@playwright/test';

// Screenshots are taken against production (https://app.taskzm.com) by default, after logging in as a demo user.
// Override with PLAYWRIGHT_BASE_URL (e.g. http://localhost:3000) to capture a different environment.
// Auth is performed by the "setup" project (demo-auth.setup.ts) and reused via storage state.

// Sidebar button order (0-indexed): Dashboard, Notifications, Today Agenda, Inbox, Folders, Team, Analytics, Archive, Settings
const SIDEBAR_INDEX = { dashboard: 0, notifications: 1, todayAgenda: 2, inbox: 3, folders: 4, team: 5, analytics: 6, archive: 7, settings: 8 } as const;

/**
 * Wait until the app is past the loading screen and the main UI is interactive.
 *
 * The demo disclaimer dialog appears on every page load because sessionStorage
 * (where "demo_disclaimer_seen" is stored) is not preserved by Playwright's
 * storageState. The dialog shows after auth completes + a 1-second delay,
 * so we must wait generously for it.
 */
async function waitForAppReady(page: Page) {
  const sidebar = page.locator('[data-tour="sidebar"]');
  await sidebar.waitFor({ state: 'visible', timeout: 30_000 });

  // Pre-set sessionStorage so the disclaimer doesn't appear at all
  await page.evaluate(() => {
    try { sessionStorage.setItem('demo_disclaimer_seen', 'true'); } catch {}
  });

  // If the disclaimer already appeared before we could set sessionStorage, dismiss it
  const disclaimerButton = page.getByRole('button', { name: /I Understand, Continue/i });
  try {
    await disclaimerButton.waitFor({ state: 'visible', timeout: 5_000 });
    await disclaimerButton.click();
    await disclaimerButton.waitFor({ state: 'hidden', timeout: 5_000 });
  } catch {
    // Already dismissed or never appeared
  }

  // Brief settle time for animations / lazy-loaded content
  await page.waitForTimeout(500);
}

/**
 * Navigate to a view by clicking the Nth sidebar button.
 */
async function navigateToView(page: Page, index: number) {
  const button = page.locator('[data-tour="sidebar"] button').nth(index);
  await button.waitFor({ state: 'visible', timeout: 10_000 });
  await button.click();
}

test.describe('App screenshots', () => {
  test.setTimeout(60_000);

  test('Dashboard Week View', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    const kanban = page.locator('[data-tour="kanban-board"]');
    await kanban.waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/dashboard-week-view.png', fullPage: true });
  });

  test('Dashboard Month View', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('[data-tour="kanban-board"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Click the Week/Month toggle switch inside the toggle container
    const viewToggle = page.locator('[data-tour="calendar-month-view-toggle"]').locator('..').getByRole('switch');
    await viewToggle.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/dashboard-month-view.png', fullPage: true });
  });

  test('Inbox Side Panel', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, SIDEBAR_INDEX.inbox);
    await page.locator('[data-tour="inbox-panel"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/inbox-side-panel.png', fullPage: true });
  });

  test('Today Agenda Side Panel', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, SIDEBAR_INDEX.todayAgenda);
    await page.locator('[data-tour="today-panel"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/today-agenda-side-panel.png', fullPage: true });
  });

  test('AI Re-Scheduler Dialog', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('[data-tour="kanban-board"]').waitFor({ state: 'visible', timeout: 15_000 });

    const rescheduleButton = page.locator('[data-tour="re-schedule"]').first();
    await rescheduleButton.waitFor({ state: 'visible', timeout: 10_000 });
    await rescheduleButton.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/ai-rescheduler-dialog.png' });
  });
});

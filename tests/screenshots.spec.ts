import { test, type Page } from '@playwright/test';

// Screenshots are taken against production (https://app.taskzm.com) by default, after logging in as a demo user.
// Override with PLAYWRIGHT_BASE_URL (e.g. http://localhost:3000) to capture a different environment.
// Auth is performed by the "setup" project (demo-auth.setup.ts) and reused via storage state.

/**
 * Wait until the app is past the loading screen and the main UI is interactive.
 * Waits for the sidebar (always present when authenticated) and dismisses the
 * demo-account disclaimer dialog if it appears.
 */
async function waitForAppReady(page: Page) {
  const sidebar = page.locator('[data-tour="sidebar"]');
  await sidebar.waitFor({ state: 'visible', timeout: 30_000 });

  const disclaimerButton = page.getByRole('button', { name: /I Understand, Continue/i });
  try {
    await disclaimerButton.waitFor({ state: 'visible', timeout: 3_000 });
    await disclaimerButton.click();
    await disclaimerButton.waitFor({ state: 'hidden', timeout: 3_000 });
  } catch {
    // Not shown — already dismissed or not a demo user
  }
}

/**
 * Navigate to a view by clicking the corresponding sidebar button.
 * The app doesn't support URL-based view routing, so we must use the sidebar.
 */
async function navigateToView(page: Page, viewLabel: string) {
  const sidebarButton = page.locator('[data-tour="sidebar"]').getByRole('button', { name: viewLabel });
  await sidebarButton.click();
}

test.describe('App screenshots', () => {
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

    // Toggle from Week to Month by clicking the "Month" label or the switch
    const monthLabel = page.locator('text=Month').first();
    await monthLabel.click();
    // Wait for the month calendar to render
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/dashboard-month-view.png', fullPage: true });
  });

  test('Inbox Side Panel', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'Inbox');
    await page.locator('[data-tour="inbox-panel"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/inbox-side-panel.png', fullPage: true });
  });

  test('Today Agenda Side Panel', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'Today Agenda');
    await page.locator('[data-tour="today-panel"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/today-agenda-side-panel.png', fullPage: true });
  });

  test('AI Re-Scheduler Dialog', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('[data-tour="kanban-board"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Click the Re-schedule button in the dashboard header
    const rescheduleButton = page.locator('[data-tour="re-schedule"]');
    await rescheduleButton.waitFor({ state: 'visible', timeout: 10_000 });
    await rescheduleButton.click();

    // Wait for the dialog to appear
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/ai-rescheduler-dialog.png' });
  });
});

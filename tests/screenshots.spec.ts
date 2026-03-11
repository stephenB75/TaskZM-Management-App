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
  // The sidebar is rendered once auth + workspace init finishes
  const sidebar = page.locator('[data-tour="sidebar"]');
  await sidebar.waitFor({ state: 'visible', timeout: 30_000 });

  // Dismiss the demo disclaimer if it pops up on this page load
  const disclaimerButton = page.getByRole('button', { name: /I Understand, Continue/i });
  try {
    await disclaimerButton.waitFor({ state: 'visible', timeout: 3_000 });
    await disclaimerButton.click();
    await disclaimerButton.waitFor({ state: 'hidden', timeout: 3_000 });
  } catch {
    // Not shown — already dismissed or not a demo user
  }
}

test.describe('App screenshots', () => {
  test('Dashboard desktop - Kanban view', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('[data-tour="kanban-board"]').waitFor({ state: 'visible', timeout: 15_000 });
    // Allow lazy-loaded task cards / animations to settle
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/dashboard-desktop.png', fullPage: true });
  });

  test('Kanban board only', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    const kanban = page.locator('[data-tour="kanban-board"]');
    await kanban.waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1000);
    await kanban.screenshot({ path: 'screenshots/kanban-board.png' });
    console.log('Kanban screenshot saved to screenshots/kanban-board.png');
  });

  test('Inbox view', async ({ page }) => {
    await page.goto('/?view=inbox');
    await waitForAppReady(page);
    await page.locator('[data-tour="inbox-panel"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/inbox-desktop.png', fullPage: true });
  });

  test('Folders view', async ({ page }) => {
    await page.goto('/?view=folders');
    await waitForAppReady(page);
    // Wait for the side panel to render (folders, today, inbox all use the same panel area)
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/folders-desktop.png', fullPage: true });
  });
});

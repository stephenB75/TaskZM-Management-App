import { test } from '@playwright/test';

// Screenshots are taken against production (https://app.taskzm.com) by default, after logging in as a demo user.
// Override with PLAYWRIGHT_BASE_URL (e.g. http://localhost:3000) to capture a different environment.
// Auth is performed by the "setup" project (demo-auth.setup.ts) and reused via storage state.

test.describe('App screenshots', () => {
  test('Dashboard desktop - Kanban view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-tour="kanban-board"], [data-kanban-view="true"]', { timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/dashboard-desktop.png', fullPage: true });
  });

  test('Kanban board only', async ({ page }) => {
    await page.goto('/');
    const kanbanSelector = '[data-tour="kanban-board"], [data-kanban-view="true"]';
    await page.waitForSelector(kanbanSelector, { timeout: 10000 });
    await page.waitForTimeout(1000);
    const kanbanElement = page.locator(kanbanSelector).first();
    if (await kanbanElement.isVisible()) {
      await kanbanElement.screenshot({ path: 'screenshots/kanban-board.png' });
      console.log('Kanban screenshot saved to screenshots/kanban-board.png');
    }
  });

  test('Inbox view', async ({ page }) => {
    await page.goto('/?view=inbox');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/inbox-desktop.png', fullPage: true });
  });

  test('Folders view', async ({ page }) => {
    await page.goto('/?view=folders');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/folders-desktop.png', fullPage: true });
  });
});



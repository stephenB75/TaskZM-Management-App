import { test } from '@playwright/test';

// NOTE: Make sure `npm run dev` is running on http://localhost:3000 before running these tests.

test.describe('App screenshots', () => {
  test('Dashboard desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/dashboard-desktop.png', fullPage: true });
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



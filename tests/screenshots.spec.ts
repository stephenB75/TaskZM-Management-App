import { test } from '@playwright/test';

// NOTE: Make sure `npm run dev` is running on http://localhost:3000 before running these tests.

test.describe('App screenshots', () => {
  test('Dashboard desktop - Kanban view', async ({ page }) => {
    await page.goto('/');
    // Wait for auth to complete (either login or if already logged in)
    await page.waitForTimeout(3000);
    
    // Check if we need to log in
    const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Login")');
    if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // If login screen, we can't take a proper screenshot without credentials
      // For now, just take what we have
      console.log('Login screen detected - screenshot may not show kanban');
    } else {
      // Wait for dashboard to load and kanban to be visible
      await page.waitForSelector('[data-tour="kanban-board"], [data-kanban-view="true"]', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000); // Additional wait for kanban to fully render
    }
    
    await page.screenshot({ path: 'screenshots/dashboard-desktop.png', fullPage: true });
  });
  
  test('Kanban board only', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Wait for kanban to be visible
    const kanbanSelector = '[data-tour="kanban-board"], [data-kanban-view="true"]';
    try {
      await page.waitForSelector(kanbanSelector, { timeout: 5000 });
      await page.waitForTimeout(1000);
      
      // Take screenshot of just the kanban area
      const kanbanElement = await page.locator(kanbanSelector).first();
      if (await kanbanElement.isVisible()) {
        await kanbanElement.screenshot({ path: 'screenshots/kanban-board.png' });
        console.log('Kanban screenshot saved to screenshots/kanban-board.png');
      }
    } catch (e) {
      console.log('Kanban not found, skipping kanban-specific screenshot');
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



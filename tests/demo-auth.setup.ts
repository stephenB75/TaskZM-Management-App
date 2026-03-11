import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authDir = path.join(process.cwd(), 'playwright', '.auth');
const authFile = path.join(authDir, 'demo-user.json');

test.describe.configure({ mode: 'serial' });

test('log in as demo user and save auth state', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const demoButton = page.getByRole('button', { name: /Try Demo Account/i });
  await demoButton.click();

  // Wait for the loading screen to disappear and real app content to appear.
  // The sidebar is always rendered once the user is authenticated and the app
  // has finished initialising, so it's a reliable gate.
  const sidebar = page.locator('[data-tour="sidebar"]');
  await sidebar.waitFor({ state: 'visible', timeout: 30_000 });

  // Dismiss the demo-account disclaimer dialog if it appears
  const disclaimerButton = page.getByRole('button', { name: /I Understand, Continue/i });
  try {
    await disclaimerButton.waitFor({ state: 'visible', timeout: 5_000 });
    await disclaimerButton.click();
    await disclaimerButton.waitFor({ state: 'hidden', timeout: 3_000 });
  } catch {
    // Disclaimer may not appear if it was already acknowledged
  }

  // Confirm the dashboard finished rendering (kanban board on desktop)
  const kanbanBoard = page.locator('[data-tour="kanban-board"]');
  await kanbanBoard.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
});

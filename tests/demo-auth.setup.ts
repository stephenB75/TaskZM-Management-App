import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authDir = path.join(process.cwd(), 'playwright', '.auth');
const authFile = path.join(authDir, 'demo-user.json');

test.describe.configure({ mode: 'serial' });

test('log in as demo user and save auth state', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const demoButton = page.getByRole('button', { name: /Try Demo Account/i });
  await demoButton.click();

  await page.waitForTimeout(8000);

  const kanbanOrApp = page.locator('[data-tour="kanban-board"], [data-kanban-view="true"], main');
  await kanbanOrApp.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

  const disclaimerButton = page.getByRole('button', { name: /I Understand, Continue/i });
  if (await disclaimerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await disclaimerButton.click();
    await page.waitForTimeout(1000);
  }

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
});

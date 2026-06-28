import { test, expect, type Page } from '@playwright/test';
import { buildAppTourStepDefs } from '../src/lib/app-tour-constants';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function prepareMobileApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.evaluate(() => {
    try {
      sessionStorage.setItem('demo_disclaimer_seen', 'true');
      localStorage.removeItem('taskzm_tour_completed');
    } catch {
      /* ignore */
    }
  });

  const bottomNav = page.locator('[data-tour="bottom-nav"]');
  await bottomNav.waitFor({ state: 'visible', timeout: 30_000 });

  const disclaimerButton = page.getByRole('button', { name: /I Understand, Continue/i });
  try {
    await disclaimerButton.waitFor({ state: 'visible', timeout: 3_000 });
    await disclaimerButton.click();
  } catch {
    /* already dismissed */
  }

  await page.waitForTimeout(500);
}

async function startTourFromSettings(page: Page) {
  await page.locator('[data-tour="bottom-nav-settings"]').click();
  await page.locator('[data-tour="settings-panel"]').waitFor({ state: 'visible', timeout: 15_000 });

  const startTourButton = page.getByRole('button', { name: /Start Tour|Restart Tour/i }).first();
  await startTourButton.waitFor({ state: 'visible', timeout: 10_000 });
  await startTourButton.click();

  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible({ timeout: 15_000 });
}

test.describe('Mobile app tour', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('mobile step definitions exclude desktop-only steps', () => {
    const steps = buildAppTourStepDefs(true);
    const targets = steps.map((step) => step.target);

    expect(steps.some((step) => step.desktopOnly)).toBe(false);
    expect(targets).toContain('[data-tour="bottom-nav"]');
    expect(targets).toContain('[data-tour="kanban"]');
    expect(targets).toContain('[data-tour="ai-scheduler-section"]');
    expect(targets).toContain('[data-tour="ai-schedule-preview-dialog"]');
    expect(targets).not.toContain('[data-tour-header-actions="desktop"] [data-tour="week-month-toggle"]');
    expect(steps.length).toBeGreaterThanOrEqual(20);
  });

  test('completes full mobile tour without stalling', async ({ page }) => {
    test.setTimeout(180_000);

    await prepareMobileApp(page);
    await startTourFromSettings(page);

    const nextButton = page.getByRole('button', { name: 'Next' });
    const finishButton = page.getByRole('button', { name: /Get Started/i });
    const maxSteps = buildAppTourStepDefs(true).length + 2;

    for (let i = 0; i < maxSteps; i += 1) {
      const hasFinish = await finishButton.isVisible().catch(() => false);
      if (hasFinish) {
        await finishButton.click();
        break;
      }

      await expect(nextButton).toBeVisible({ timeout: 20_000 });
      await expect(nextButton).toBeEnabled({ timeout: 20_000 });
      await nextButton.click();
      await page.waitForTimeout(350);
    }

    await expect(page.getByText('Tour completed!')).toBeVisible({ timeout: 15_000 });
  });

  test('highlights key mobile targets during tour progression', async ({ page }) => {
    test.setTimeout(120_000);

    await prepareMobileApp(page);
    await startTourFromSettings(page);

    const nextButton = page.getByRole('button', { name: 'Next' });
    const finishButton = page.getByRole('button', { name: /Get Started/i });

    const expectSpotlightNear = async (selector: string) => {
      await page.waitForTimeout(600);
      const target = page.locator(selector).first();
      await expect(target).toBeVisible({ timeout: 20_000 });
      const tooltip = page.locator('[class*="react-joyride"]').filter({ has: page.getByRole('button', { name: /Next|Get Started/i }) });
      await expect(tooltip.first()).toBeVisible({ timeout: 20_000 });
    };

    // Welcome → bottom nav intro
    await nextButton.click();
    await expectSpotlightNear('[data-tour="bottom-nav"]');

    // Advance through bottom nav icon steps (today, week, inbox, settings)
    for (let i = 0; i < 4; i += 1) {
      await nextButton.click();
      await page.waitForTimeout(300);
    }

    // Week view kanban
    await nextButton.click();
    await expectSpotlightNear('[data-tour="kanban"]');

    // AI scheduler section (opens AI panel)
    await nextButton.click();
    await expectSpotlightNear('[data-tour="ai-scheduler-section"]');

    // Schedule preview demo dialog
    await nextButton.click();
    await expectSpotlightNear('[data-tour="ai-schedule-preview-dialog"]');

    // Month view
    await nextButton.click();
    await expectSpotlightNear('[data-tour="month-calendar-view"]');

    // Re-schedule section
    await nextButton.click();
    await expectSpotlightNear('[data-tour="ai-reschedule-section"]');

    // Re-schedule demo dialog
    await nextButton.click();
    await expectSpotlightNear('[data-tour="reschedule-dialog"]');

    // Finish remaining steps quickly
    for (let i = 0; i < 15; i += 1) {
      if (await finishButton.isVisible().catch(() => false)) {
        await finishButton.click();
        break;
      }
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(250);
      }
    }

    await expect(page.getByText('Tour completed!')).toBeVisible({ timeout: 15_000 });
  });
});

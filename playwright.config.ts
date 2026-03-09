import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.taskzm.com';
const authFile = 'playwright/.auth/demo-user.json';

export default defineConfig({
  testDir: 'tests',
  projects: [
    { name: 'setup', testMatch: /demo-auth\.setup\.ts/ },
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { storageState: authFile },
      dependencies: ['setup'],
    },
  ],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    baseURL,
  },
  reporter: [['list']],
});



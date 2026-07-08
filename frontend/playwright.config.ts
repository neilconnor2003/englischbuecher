// playwright.config.ts
// Place this in your frontend project root (same folder as package.json)

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,  // run tests in parallel — much faster
  forbidOnly: !!process.env.CI,
  retries: 0,
  
  // Give each individual test 45 seconds
  timeout: 45000,
  
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/playwright-report', open: 'never' }],
  ],
  
  use: {
    baseURL: process.env.TEST_URL || 'https://englischbuecher.de',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Run mobile tests separately when needed:
    // { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});
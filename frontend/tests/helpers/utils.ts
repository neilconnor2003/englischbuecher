// tests/helpers/utils.ts
// Shared utilities for all tests

import { Page, expect } from '@playwright/test';

/**
 * Wait for the page to be fully loaded (no spinner, no loading state)
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 30000 });
}

/**
 * Dismiss cookie consent banner if it appears
 */
export async function dismissCookieBanner(page: Page) {
  try {
    const acceptBtn = page.locator('button:has-text("Accept all"), button:has-text("Alle akzeptieren")');
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
    }
  } catch {
    // Banner not present — that's fine
  }
}

/**
 * Check page has no JavaScript errors
 */
export async function checkNoJSErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', err => {
    // Ignore known third-party errors
    if (
      err.message.includes('CitrixBcr') ||
      err.message.includes('Tracking Prevention') ||
      err.message.includes('401') // unauthenticated requests are expected
    ) return;
    errors.push(err.message);
  });
  return errors;
}

/**
 * Check that key elements exist on the page
 */
export async function checkKeyElements(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    await expect(page.locator(selector).first()).toBeVisible({ timeout: 10000 });
  }
}

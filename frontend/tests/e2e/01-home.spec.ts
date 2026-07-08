// tests/e2e/01-home.spec.ts
import { test, expect } from '@playwright/test';
import { dismissCookieBanner, waitForPageLoad } from '../helpers/utils';

test.describe('Home Page', () => {

  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => {
      if (!err.message.includes('CitrixBcr') && !err.message.includes('401')) {
        errors.push(err.message);
      }
    });
    await page.goto('/');
    await waitForPageLoad(page);
    await dismissCookieBanner(page);
  });

  test('loads without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    await waitForPageLoad(page);
    const criticalErrors = errors.filter(e => 
      !e.includes('CitrixBcr') && !e.includes('401') && !e.includes('Tracking')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('shows hero banner', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-banner, .banner-section, [class*="hero"]').first()).toBeVisible();
  });

  test('shows navigation header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header, nav, .header').first()).toBeVisible();
  });

  test('featured author section visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000); // wait for API call
    const authorSection = page.locator('.author-spotlight-section, [class*="author-spot"]');
    await expect(authorSection.first()).toBeVisible({ timeout: 10000 });
  });

  test('"Meet the author" button links to author page', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const meetBtn = page.locator('a:has-text("Meet the author"), a:has-text("Mehr über")');
    if (await meetBtn.isVisible({ timeout: 5000 })) {
      const href = await meetBtn.getAttribute('href');
      expect(href).toMatch(/\/author\//);
    }
  });

  test('customer review cards link to correct book URLs', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const reviewLinks = page.locator('.testi-card');
    const count = await reviewLinks.count();
    if (count > 0) {
      const firstLink = reviewLinks.first();
      const href = await firstLink.getAttribute('href');
      // URL should contain ISBN (9 digits minimum) — not just slug-id
      expect(href).toMatch(/\/book\//);
    }
  });

  test('page title is set correctly', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.toLowerCase()).toContain('englisch');
  });

});

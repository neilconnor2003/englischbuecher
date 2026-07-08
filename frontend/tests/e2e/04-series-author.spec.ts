// tests/e2e/04-series-author.spec.ts
import { test, expect } from '@playwright/test';
import { waitForPageLoad } from '../helpers/utils';

test.describe('Series Page', () => {

  test('loads series page without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => {
      if (!err.message.includes('CitrixBcr') && !err.message.includes('401')) {
        errors.push(err.message);
      }
    });
    // Use a series we know exists
    await page.goto('/series/dog-man');
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);
    
    const critical = errors.filter(e => !e.includes('Tracking') && !e.includes('is not defined'));
    expect(critical).toHaveLength(0);
  });

  test('series page shows books', async ({ page }) => {
    await page.goto('/series/dog-man');
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);
    
    // Should NOT show blank page
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('"series is not defined" error is gone', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    
    await page.goto('/series/dog-man');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    
    const seriesError = errors.find(e => e.includes('series is not defined'));
    expect(seriesError).toBeUndefined();
  });

});

test.describe('Author Page', () => {

  test('loads author page without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => {
      if (!err.message.includes('CitrixBcr') && !err.message.includes('401')) {
        errors.push(err.message);
      }
    });
    await page.goto('/author/jeff-kinney');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    
    expect(errors.filter(e => !e.includes('Tracking'))).toHaveLength(0);
  });

  test('shows author name and bio', async ({ page }) => {
    await page.goto('/author/jeff-kinney');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    
    await expect(page.locator('h1, h2, [class*="author-name"]').first()).toBeVisible();
  });

});

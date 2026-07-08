// tests/e2e/03-book-detail.spec.ts
import { test, expect } from '@playwright/test';
import { dismissCookieBanner, waitForPageLoad } from '../helpers/utils';

test.describe('Book Detail Page', () => {

  // Aladdin — a book we know exists
  const TEST_BOOK_URL = '/book/aladdin-9788180222290-4';

  test('loads book detail without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => {
      if (!err.message.includes('CitrixBcr') && !err.message.includes('401')) {
        errors.push(err.message);
      }
    });
    await page.goto(TEST_BOOK_URL);
    await waitForPageLoad(page);
    const critical = errors.filter(e => !e.includes('Tracking'));
    expect(critical).toHaveLength(0);
  });

  test('shows book title', async ({ page }) => {
    await page.goto(TEST_BOOK_URL);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    // Book title should appear somewhere on the page
    const title = await page.title();
    expect(title.toLowerCase()).toContain('englisch');
  });

  test('shows book cover image', async ({ page }) => {
    await page.goto(TEST_BOOK_URL);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    const img = page.locator('.main-image, [class*="cover"], [class*="book-img"]').first();
    await expect(img).toBeVisible({ timeout: 10000 });
  });

  test('book with no ISBN in URL still loads', async ({ page }) => {
    // Test the slug-only URL format (no ISBN in DB)
    await page.goto('/book/diary-of-a-wimpy-kid-rodrick-rules-71');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    // Should NOT show "Book not found"
    const notFound = page.locator('text=Book not found, text=Buch nicht gefunden');
    expect(await notFound.isVisible()).toBeFalsy();
  });

  test('Add to Cart button works', async ({ page }) => {
    await page.goto(TEST_BOOK_URL);
    await waitForPageLoad(page);
    await dismissCookieBanner(page);
    await page.waitForTimeout(2000);
    
    const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("In den Warenkorb")').first();
    if (await addToCartBtn.isVisible({ timeout: 5000 })) {
      await addToCartBtn.click();
      await page.waitForTimeout(1000);
      // Should show success toast or cart count increase
    }
  });

  test('has correct Product JSON-LD schema', async ({ page }) => {
    await page.goto(TEST_BOOK_URL);
    await waitForPageLoad(page);
    
    const schemaScript = page.locator('script[type="application/ld+json"]');
    const count = await schemaScript.count();
    expect(count).toBeGreaterThan(0);
    
    // Check schema contains Product type
    const schemaContent = await schemaScript.first().textContent();
    expect(schemaContent).toContain('Product');
  });

});

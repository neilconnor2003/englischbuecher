// tests/e2e/02-books.spec.ts
import { test, expect } from '@playwright/test';
import { dismissCookieBanner, waitForPageLoad } from '../helpers/utils';

test.describe('Books Listing Page', () => {

  test('loads book listing page', async ({ page }) => {
    await page.goto('/books');
    await waitForPageLoad(page);
    await dismissCookieBanner(page);
    await expect(page).toHaveTitle(/EnglischBuecher/i);
  });

  test('shows book cards', async ({ page }) => {
    await page.goto('/books');
    await waitForPageLoad(page);
    // Wait for books to load
    const bookCards = page.locator('[class*="book-card"], .book-card, [class*="BookCard"]');
    await expect(bookCards.first()).toBeVisible({ timeout: 15000 });
  });

  test('search filters work', async ({ page }) => {
    await page.goto('/books?q=dog');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    const cards = page.locator('[class*="book-card"], .book-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking a book card navigates to book detail', async ({ page }) => {
    await page.goto('/books');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    await dismissCookieBanner(page);
    
    const firstCard = page.locator('[class*="book-card"], .book-card').first();
    await firstCard.click();
    await page.waitForURL(/\/book\//);
    expect(page.url()).toContain('/book/');
  });

  test('sort dropdown works', async ({ page }) => {
    await page.goto('/books');
    await waitForPageLoad(page);
    const sortSelect = page.locator('select.filter-native-select').last();
    if (await sortSelect.isVisible({ timeout: 5000 })) {
      await sortSelect.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
      // Should still show books after sort
      const cards = page.locator('[class*="book-card"], .book-card');
      expect(await cards.count()).toBeGreaterThan(0);
    }
  });

});

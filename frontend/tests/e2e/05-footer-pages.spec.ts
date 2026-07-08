// tests/e2e/05-footer-pages.spec.ts
import { test, expect } from '@playwright/test';
import { waitForPageLoad } from '../helpers/utils';

const footerPages = [
  { name: 'About', url: '/about' },
  { name: 'Contact', url: '/contact' },
  { name: 'FAQ', url: '/faq' },
  { name: 'Privacy', url: '/privacy' },
  { name: 'Terms', url: '/terms' },
  { name: 'Shipping', url: '/shipping' },
  { name: 'Returns', url: '/returns' },
  { name: 'Revocation', url: '/revocation' },
  { name: 'Imprint', url: '/imprint' },
];

test.describe('Footer Pages', () => {

  for (const p of footerPages) {
    test(`${p.name} page loads without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', err => {
        if (!err.message.includes('CitrixBcr') && !err.message.includes('401')) {
          errors.push(err.message);
        }
      });
      
      await page.goto(p.url);
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);
      
      // No JS errors
      expect(errors.filter(e => !e.includes('Tracking'))).toHaveLength(0);
      
      // Page has content (not blank)
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.trim().length).toBeGreaterThan(50);
    });
  }

  test('Privacy page does not show "NA" sections', async ({ page }) => {
    await page.goto('/privacy');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    
    const bodyText = await page.locator('body').textContent();
    // Should not render the literal text "NA" as a section
    expect(bodyText).not.toMatch(/^NA$/m);
  });

});

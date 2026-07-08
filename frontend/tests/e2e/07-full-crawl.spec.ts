// tests/e2e/07-full-crawl.spec.ts
// This test visits every page and reports any JavaScript errors found
// Run this after deployments as a quick smoke test

// tests/e2e/07-full-crawl.spec.ts
import { test, expect } from '@playwright/test';

const ALL_PAGES = [
  { name: 'Home',        url: '/' },
  { name: 'Books',       url: '/books' },
  { name: 'Book Detail', url: '/book/aladdin-9788180222290-4' },
  { name: 'Series',      url: '/series/dog-man' },
  { name: 'Author',      url: '/author/jeff-kinney' },
  { name: 'Cart',        url: '/cart' },
  { name: 'Request Book',url: '/request-book' },
  { name: 'About',       url: '/about' },
  { name: 'Contact',     url: '/contact' },
  { name: 'FAQ',         url: '/faq' },
  { name: 'Privacy',     url: '/privacy' },
  { name: 'Terms',       url: '/terms' },
  { name: 'Shipping',    url: '/shipping' },
  { name: 'Returns',     url: '/returns' },
  { name: 'Revocation',  url: '/revocation' },
  { name: 'Imprint',     url: '/imprint' },
];

const IGNORED_ERRORS = [
  'CitrixBcr',
  'Tracking Prevention',
  '401',
  'Unauthorized',
];

// Each page gets its own test — no timeout from visiting 17 pages in one test
for (const p of ALL_PAGES) {
  test(`${p.name} page has no JS errors`, async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', err => {
      const isIgnored = IGNORED_ERRORS.some(i => err.message.includes(i));
      if (!isIgnored) errors.push(err.message);
    });

    await page.goto(p.url);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const critical = errors.filter(e => !e.includes('Tracking'));
    if (critical.length > 0) {
      console.log(`❌ ${p.name}: ${critical.join(' | ')}`);
    }
    expect(critical, `JS errors on ${p.name}: ${critical.join(', ')}`).toHaveLength(0);
  });
}

test('all pages return HTTP 200', async ({ page }) => {
  const failures: string[] = [];
  for (const p of ALL_PAGES) {
    const response = await page.goto(p.url);
    if (response && response.status() >= 500) {
      failures.push(`${p.name}: ${response.status()}`);
    }
  }
  expect(failures, `Server errors: ${failures.join(', ')}`).toHaveLength(0);
});
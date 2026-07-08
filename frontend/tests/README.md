# EnglischBücher — Playwright E2E Tests

## What is this?

Playwright is a free, open-source automated testing tool by Microsoft. 
It opens a real browser, clicks through your website, and reports any errors — like a robot tester.

## Setup (one time)

In your frontend project folder, run:

```bash
# Install Playwright
npm install --save-dev @playwright/test

# Install browsers (Chromium + Firefox + WebKit)
npx playwright install chromium
```

That's it. No account needed, completely free.

## Running tests

```bash
# Run all tests against the live production site
npx playwright test

# Run only the quick crawl test (fastest — checks all pages in ~60 seconds)
npx playwright test 07-full-crawl

# Run a specific test file
npx playwright test 01-home

# Run in headed mode (see the browser as tests run — great for debugging)
npx playwright test --headed

# Run against dev instead of prod
TEST_URL=https://dev--englischbuecher.netlify.app npx playwright test

# View the HTML test report after running
npx playwright show-report tests/playwright-report
```

## What the tests cover

| File | What it tests |
|------|---------------|
| `01-home.spec.ts` | Home page loads, hero banner, featured author button, review card URLs |
| `02-books.spec.ts` | Book listing loads, search works, clicking card navigates to detail |
| `03-book-detail.spec.ts` | Book detail loads, cover shows, add to cart works, JSON-LD schema |
| `04-series-author.spec.ts` | Series page (including "series is not defined" bug check), author page |
| `05-footer-pages.spec.ts` | All 9 footer pages load without errors, Privacy page doesn't show "NA" |
| `06-cart-checkout.spec.ts` | Cart loads, add to cart, request book page |
| `07-full-crawl.spec.ts` | **Quick smoke test** — visits all 17 pages, reports any JS errors |

## Recommended workflow

1. **After every deployment** — run `npx playwright test 07-full-crawl`
   - Takes ~60 seconds
   - Catches crashes like the "series is not defined" bug immediately

2. **Weekly** — run `npx playwright test` (all tests)
   - Takes ~5 minutes
   - Full regression check

3. **When fixing a bug** — run the specific test file for that page
   - Immediate confirmation the fix worked

## Adding new tests

Create a new file in `tests/e2e/` following the same pattern:

```typescript
import { test, expect } from '@playwright/test';

test('my new test', async ({ page }) => {
  await page.goto('/some-page');
  await expect(page.locator('h1')).toBeVisible();
});
```

## CI/CD Integration (optional, free with GitHub Actions)

Add this file as `.github/workflows/playwright.yml` to auto-run tests on every push:

```yaml
name: Playwright Tests
on:
  push:
    branches: [main, dev]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install chromium
      - run: npx playwright test 07-full-crawl
        env:
          TEST_URL: https://englischbuecher.de
```

This will automatically run the crawl test after every deploy and email you if something is broken.

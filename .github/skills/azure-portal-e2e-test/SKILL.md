---
name: azure-portal-e2e-test
description: Write and run Playwright E2E tests for Azure Portal pages. Use this skill when asked to create, write, or generate E2E tests, Playwright tests, or UI tests for Azure Portal.
---

# Write Azure Portal E2E Tests

Use this skill to create Playwright E2E tests for Azure Portal. Follow these steps strictly.

## Workflow

1. **RECON FIRST** — Always run the `/azure-portal-recon` skill first to discover actual page structure, selectors, and take screenshots.
2. **VIEW SCREENSHOTS** — Check the `screenshots/` folder to see the visual state of the page.
3. **WRITE** — Create the test file at `tests/generated.spec.ts` using discovered selectors.
3. **RUN** — Execute the test with Playwright.
4. **FIX** — If it fails, use the `/azure-portal-debug` skill to analyze and fix. Retry up to 5 times.

## Running a Test

```powershell
npx playwright test tests/generated.spec.ts --project=chromium --reporter=list --timeout=120000 --workers=1 --max-failures=1
```

## Test Template

Always use this structure for Azure Portal tests:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Azure Portal - [Description]', () => {
  test.setTimeout(120000); // Azure Portal needs long timeouts

  test('should [what it verifies]', async ({ page }) => {
    // 1. Navigate to the page
    await page.goto('THE_URL_FROM_USER');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Wait for React to initialize

    // 2. Find the React iframe (frame names are EMPTY, find by URL)
    const reactFrame = page.frames().find(f => f.url().includes('reactblade'));
    if (!reactFrame) throw new Error('React frame not found');

    // 3. Locate elements within the React frame
    // Use EXACT selectors and text from reconnaissance results!
    const element = reactFrame.locator('.ms-MessageBar-content');
    await element.waitFor({ state: 'visible', timeout: 30000 });

    // 4. Assert
    await expect(element).toContainText('exact text from recon');
  });
});
```

## Azure Portal Specifics

### Iframe Handling
- Azure Portal loads content in React iframes
- Frame names are **EMPTY** — never use `frameLocator` with name
- Find frames by URL: `page.frames().find(f => f.url().includes('reactblade'))`
- ALL element interactions must target the correct frame, not the main page

### Common Selectors
| Element | Selector |
|---|---|
| Message Bar | `.ms-MessageBar-content` |
| Button by text | `button:has-text("Text")` |
| Fluent UI Button | `.ms-Button` |
| Link by text | `a:has-text("Text")` |
| Role-based | `getByRole('button', { name: 'Save' })` |

### Timeouts
- `test.setTimeout(120000)` — always set for Azure Portal tests
- Element wait: `{ timeout: 30000 }` — for `waitFor()` calls
- Initial React load: `page.waitForTimeout(5000)` — after navigation

### Portal Helper Utilities
Available at `tests/utils/portalHelpers.ts`. Import when needed:

```typescript
import { waitForPortalFrame, findVisibleInAnyFrame, dumpFrames } from '../utils/portalHelpers';
```

- `waitForPortalFrame(page, { urlIncludes: 'reactblade' })` — robust frame waiting with retries
- `findVisibleInAnyFrame(page, selector)` — find element across all frames
- `dumpFrames(page)` — debug: log all frames to console

## Important Rules

1. **NEVER guess selectors** — always use recon data
2. **NEVER match text from user description** — verify with recon
3. **ALWAYS handle iframes** — elements are inside React frames
4. **ALWAYS use long timeouts** — Azure Portal is slow to load
5. **ALWAYS set `test.setTimeout(120000)`** at the describe or test level

---
name: azure-portal-recon
description: Run page reconnaissance on Azure Portal URLs to discover frame structure, elements, and selectors before writing tests. Use this skill when asked to explore, scan, or recon an Azure Portal page, or before writing any E2E test.
---

# Azure Portal Page Reconnaissance

Use this skill to discover what's on an Azure Portal page before writing tests. This prevents guessing selectors.

## How to Run Reconnaissance

Run the recon Playwright test with the target URL:

```
RECON_URL="<target-url>" npx playwright test tests/recon.spec.ts --project=chromium --reporter=list
```

On Windows, set the env var first:

```powershell
$env:RECON_URL = "<target-url>"
npx playwright test tests/recon.spec.ts --project=chromium --reporter=list
```

## Output

After running, these files are created:

### Screenshots (`screenshots/` folder)
- **`recon-fullpage-<timestamp>.png`** — Full page screenshot (scrollable content)
- **`recon-viewport-<timestamp>.png`** — Visible viewport screenshot
- **`recon-react-frame-<timestamp>.png`** — Screenshot of the React iframe content (where most Azure Portal UI lives)

View these screenshots to visually understand the page layout before writing tests. They show exactly what buttons, banners, and elements are visible.

### Reconnaissance Data (`artifacts/` folder)

1. **`artifacts/page-recon-summary.md`** — Human-readable summary with:
   - Frame structure table (which frames exist, which are React frames)
   - Key elements found per frame
   - Recommended test approach code snippet

2. **`artifacts/page-recon.json`** — Detailed JSON with:
   - All frames (name, URL, isReactFrame)
   - Main page elements (selector, count, text samples)
   - Iframe elements per frame (selector, count, text samples, aria-labels, roles)
   - Accessibility snapshot

## What to Look For in Results

1. **React frames**: Look for frames where `isReactFrame: true`. This is where most Azure Portal content lives. These frames have empty names — identify them by URL containing `reactblade`.

2. **Element selectors**: The recon captures actual selectors and their text content. Use these EXACT selectors in tests instead of guessing.

3. **Button text**: The recon shows exact button labels (e.g., `"Your feedback"`, `"View the previous version"`). Use these in `button:has-text("...")` selectors.

4. **Message bars**: Look for `.ms-MessageBar-content` elements — these are Fluent UI notification banners.

## After Reconnaissance

1. **View the screenshots** in the `screenshots/` folder to see the current visual state of the page.
2. Read `artifacts/page-recon-summary.md` for discovered selectors and frame structure.
3. Use the discovered selectors to write your test. Do NOT guess selectors from the user's description — always verify against recon data and screenshots.

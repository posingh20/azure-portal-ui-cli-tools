---
name: azure-portal-e2e-patterns
description: Hard-won patterns and pitfalls for writing Playwright E2E tests against the Azure Portal. Consult this BEFORE writing any portal test to avoid common mistakes.
---

# Azure Portal E2E Testing Patterns & Pitfalls

Lessons learned from writing Playwright tests against the live Azure Portal (specifically the DCR create wizard in the Azure Monitor extension).

## Frame Architecture

Azure Portal renders React views inside **nested iframes**. A single blade can spawn additional iframes when context panes open.

| Scenario | Frame URL Pattern | Notes |
|---|---|---|
| Main create form | `sandbox-1.reactblade-ms.portal.azure.net` | First React iframe |
| Context pane (e.g., "Add data source") | `sandbox-2.reactblade-ms.portal.azure.net` | Second iframe, appears on button click |
| Additional panes | `sandbox-N.reactblade-ms.portal.azure.net` | Each new pane may get its own iframe |

**Key rules:**
- Frame `name` attributes are **EMPTY** — never use `page.frameLocator('[name="..."]')`
- Find frames by URL: `page.frames().find(f => f.url().includes('reactblade'))`
- Use `waitForPortalFrame()` with `requiredSelector` to distinguish between multiple React iframes
- **Re-acquire frame references** after navigating between blades or closing panes — DOM references go stale

```typescript
// CORRECT: Use requiredSelector to find the right iframe
const createFrame = await waitForPortalFrame(page, {
  urlIncludes: 'reactblade',
  requiredSelector: 'text="Collect and deliver"',  // unique to the create form
  timeout: 60000,
  debug: true,
});

const paneFrame = await waitForPortalFrame(page, {
  urlIncludes: 'reactblade',
  requiredSelector: 'text="Data source type"',  // unique to the data source pane
  timeout: 30000,
  debug: true,
});
```

## Fluent UI Component Interaction Patterns

### Fluent Dropdown (`[role="combobox"]` with `aria-haspopup="listbox"`)

This is the most problematic component. **`.click()` hangs silently** on Fluent Dropdowns inside iframes after DOM mutations (add/delete operations).

**What works:**
```typescript
// CORRECT: Focus + Enter to open Fluent Dropdown
const dropdown = f.locator('[role="combobox"][aria-label="Event Log Selection Mode:"]');
await dropdown.focus();
await page.waitForTimeout(500);
await dropdown.press('Enter');
await page.waitForTimeout(1000);

// Then click the option
await f.locator('[role="option"]:has-text("Custom")').first().click();
```

**What fails:**
```typescript
// FAILS: .click() hangs after DOM mutations
await dropdown.click();  // ❌ Hangs indefinitely

// FAILS: dispatchEvent doesn't trigger Fluent's event handlers
await dropdown.dispatchEvent('click');  // ❌ Dropdown doesn't open

// FAILS: evaluate el.click() — same problem
await dropdown.evaluate(el => el.click());  // ❌ No effect
```

**Important:** `.click()` works FINE for the **initial** interaction with a Fluent Dropdown (before any DOM mutations). It only breaks after add/delete operations modify the DOM tree. Always use `focus()` + `press('Enter')` for reliability.

### Fluent Checkboxes (`.ms-Checkbox`)

Fluent UI checkboxes render as native `<input type="checkbox">` wrapped inside `.ms-Checkbox` divs. Both clicking the input and the wrapper work, but the wrapper is more reliable.

```typescript
// CORRECT: Click the .ms-Checkbox wrapper
const checkboxes = f.locator('.ms-Checkbox');
await checkboxes.nth(0).click();  // First checkbox

// ALSO WORKS: Click the input directly
const inputs = f.locator('input[type="checkbox"]');
await inputs.nth(0).click();
```

**Note:** There are NO `[role="checkbox"]` elements for Windows Event Logs — Fluent v8 uses native inputs. Performance Counters uses `[role="checkbox"]` (Fluent v9). Check which version the component uses!

### Fluent Buttons

Standard Fluent buttons work with normal `.click()`:

```typescript
// Primary button (blue)
const saveBtn = f.locator('button:has-text("Save")').first();

// Exact text match for "Add" (avoids matching "Add destination", "Add new data source")
const addBtn = f.locator('button').filter({ hasText: /^Add$/ }).first();

// Icon button (e.g., trash/delete) — click the icon element directly
const trashBtn = f.locator('[data-icon-name="Delete"]');
await trashBtn.last().click();
```

**Pitfall:** `button:has-text("Add")` matches **any** button containing "Add" as substring — "Add destination", "Add new data source", etc. Use `.filter({ hasText: /^Add$/ })` for exact match.

### Fluent Combobox for Data Source Type

The data source type dropdown is also `[role="combobox"]` but without `aria-label`. Distinguish it from the mode dropdown:

```typescript
// Data source type — first combobox in the pane
const dsTypeDropdown = f.locator('[role="combobox"]').first();

// Mode dropdown — has specific aria-label
const modeDropdown = f.locator('[role="combobox"][aria-label="Event Log Selection Mode:"]');
```

## Data Source Pane Patterns

### Windows Event Logs

| Element | Selector | Notes |
|---|---|---|
| Mode dropdown | `[role="combobox"][aria-label="Event Log Selection Mode:"]` | Options: Basic, Custom (NO "None") |
| Category checkboxes | `.ms-Checkbox` (12 total) | Application(5), Security(2), System(5) |
| Custom input | `input[type="text"]` (first in pane) | Placeholder not set |
| Add button | `button` filter `/^Add$/` | Adds typed text as custom event log |
| Delete button | `[data-icon-name="Delete"]` | Trash icon in Action column |

**Dropdown options available:** Basic, Custom — there is **NO "None"** option for Windows Event Logs.

### Performance Counters

| Element | Selector | Notes |
|---|---|---|
| Mode dropdown | `[role="combobox"]` filter `hasText: 'Basic'` | Options: Basic, Custom, None |
| Category checkboxes | `[role="checkbox"]` | Fluent role-based checkboxes (different from Event Logs!) |
| Counter specifier input | `input[placeholder="Enter custom counter specifier"]` | |
| Add button | `button` filter `/^Add$/` | ⚠️ Click registers but doesn't add — see known issues |

**Known issue:** The "Add" button for custom performance counters does not respond to Playwright clicks (`.click()`, `evaluate`, `dispatchEvent`, `press('Enter')`, mouse coordinates). The input value is not cleared and no counter is added. This may be a React synthetic event issue specific to this component.

### Linux Syslogs

| Element | Selector | Notes |
|---|---|---|
| Facility checkboxes | `[role="checkbox"]` (26 total) | 25 facilities + 1 "select all" header |
| Bulk log level dropdown | `[role="combobox"]` filter `hasText: 'None'` | "Set minimum log level for selected facilities" — default "None" |
| Per-facility log level dropdowns | `[role="combobox"]` filter `hasText: 'LOG_DEBUG'` | 25 dropdowns, one per facility |
| Facility names | `text="LOG_AUTH"`, `text="LOG_CRON"`, etc. | Prefixed with `LOG_` (e.g., LOG_ALERT, LOG_AUTH, LOG_CRON, LOG_DAEMON) |

**Key behaviors:**
- Default log level per facility is **LOG_DEBUG** (lowest level, captures everything)
- Log level hierarchy: Emergency > Alert > Critical > Error > Warning > Notice > Info > Debug
- Selecting a level includes all levels above it (e.g., LOG_ERR = Error + Critical + Alert + Emergency)
- **Save is disabled** until facilities are checked AND a destination is configured
- There are **27 total comboboxes**: 1 data source type + 1 bulk level + 25 per-facility
- Checkboxes are `[role="checkbox"]` (Fluent v9 style, same as Performance Counters)
- The first `[role="checkbox"]` is the "select all" header

**Log level dropdown options:** LOG_DEBUG, LOG_INFO, LOG_NOTICE, LOG_WARNING, LOG_ERR, LOG_CRIT, LOG_ALERT, LOG_EMERG

### Checkbox Type Summary

Different data source types use different checkbox implementations:

| Data Source | Checkbox Selector | Count | Notes |
|---|---|---|---|
| Windows Event Logs | `.ms-Checkbox` / `input[type="checkbox"]` | 12 | Fluent v8 native inputs |
| Performance Counters | `[role="checkbox"]` | varies | Fluent v9 role-based |
| Linux Syslogs | `[role="checkbox"]` | 26 | Fluent v9 role-based (25 facilities + select all) |

**Always probe** for the right checkbox type when writing a new test:
```typescript
const native = await f.locator('input[type="checkbox"]').count();
const fluent = await f.locator('.ms-Checkbox').count();
const role = await f.locator('[role="checkbox"]').count();
console.log(`Checkboxes — native: ${native}, .ms-Checkbox: ${fluent}, role: ${role}`);
```

### Destination Tab

| Element | Selector | Notes |
|---|---|---|
| Destination tab | `text="Destination"` | Inside the data source pane |
| Add destination button | `text="Add destination"` | Opens inline form |
| Default type (Event Logs) | `text="Log Analytics Workspaces"` | NOT "Azure Monitor Logs" |
| Default type (Perf Counters) | `text="Azure Monitor Metrics"` | |
| Default type (Linux Syslogs) | `text="Log Analytics Workspaces"` | Same as Event Logs |
| Apply button | `button:has-text("Apply")` | Requires workspace selection to work |
| Cancel button | `button:has-text("Cancel")` | Returns to destination list |

**Save button** requires BOTH data source selections AND a configured destination to become enabled.

## Common Pitfalls

### 1. `.click()` hangs on Fluent Dropdowns after DOM changes
**Solution:** Use `focus()` + `press('Enter')` instead. See Fluent Dropdown section above.

### 2. Stale frame references
After closing/opening panes, the frame reference becomes stale. Always re-acquire:
```typescript
// After saving and closing the data source pane:
f = await waitForPortalFrame(page, {
  urlIncludes: 'reactblade',
  requiredSelector: 'text="Collect and deliver"',
  timeout: 30000,
});
```

### 3. `fill()` vs `type()` for React inputs
`fill()` sets the value programmatically but may not trigger React's `onChange` handler. Use `type()` with a delay for reliable state updates:
```typescript
// PREFERRED: type() triggers React onChange per keystroke
await input.click();
await input.type('MyCustomEventLog!', { delay: 50 });

// RISKY: fill() may not trigger React state updates
await input.fill('MyCustomEventLog!');
```

### 4. Auth state reuse
Auth is stored in `playwright/.auth/user.json`. Remove `dependencies: ['setup']` from the chromium project in `playwright.config.ts` to skip re-authentication:
```typescript
// playwright.config.ts
{
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'playwright/.auth/user.json',
  },
  // dependencies: ['setup'],  // REMOVE to skip re-auth
},
```

### 5. Test timeouts
Azure Portal is slow. Set generous timeouts:
```typescript
test.setTimeout(600000);  // 10 minutes for complex workflows
// Element waits: 5-15 seconds
// Page transitions: waitForTimeout(3000-5000)
// After clicking buttons that open panes: waitForTimeout(5000)
```

### 6. Screenshot every step
Portal UI is complex. Screenshot after every action to debug failures:
```typescript
await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-checkboxes-selected.png` });
```

### 7. Multiple comboboxes in same frame
When a frame has multiple `[role="combobox"]` elements, use `aria-label` or `filter({ hasText })` to disambiguate:
```typescript
// BAD: Matches first combobox (might be wrong one)
f.locator('[role="combobox"]').first();

// GOOD: Use aria-label
f.locator('[role="combobox"][aria-label="Event Log Selection Mode:"]');

// GOOD: Use text content filter
f.locator('[role="combobox"]').filter({ hasText: 'Basic' }).first();
```

### 8. Fluent v8 vs v9 differences
Different data source types use different Fluent versions within the **same pane**:
- **Windows Event Logs**: Fluent v8 — native `<input type="checkbox">`, `.ms-Checkbox` wrappers
- **Performance Counters**: Fluent v9 — `[role="checkbox"]`, no `.ms-Checkbox` class
- **Linux Syslogs**: Fluent v9 — `[role="checkbox"]`, 26 checkboxes (25 facilities + select all)

Always recon the specific component to verify which version is in use.

### 9. DCR create form defaults
- **Platform type** defaults to "All" (Windows + Linux) — no need to change it for Linux Syslogs
- The Basics tab doesn't show a visible "Windows" or "Linux" label — the platform type is embedded in the subscription/resource group description text
- Navigate directly to `DcrCreate.ReactView` URL to skip any KO form banners

### 10. Panes with many comboboxes (e.g., Linux Syslogs)
Linux Syslogs has **27 comboboxes** in one pane (1 data source type + 1 bulk level + 25 per-facility). Use `.filter({ hasText })` to target the right one:
```typescript
// Bulk level dropdown (shows "None")
f.locator('[role="combobox"]').filter({ hasText: 'None' }).first();

// Per-facility dropdowns (show "LOG_DEBUG")
f.locator('[role="combobox"]').filter({ hasText: 'LOG_DEBUG' });
// Returns 25 dropdowns — use .first(), .nth(N), or .last()
```

### 11. "Add new data source" vs "Add data source"
The button in the main create form grid says **"Add new data source"**, NOT "Add data source". The pane footer has **"Save"** (not "Add data source").

### 12. Direct React URL bypasses KO form
Use the direct React view URL to skip the Knockout form and banner click:
```
https://ms.portal.azure.com/#view/Microsoft_Azure_Monitoring/DcrCreate.ReactView
```

## Recommended Test Structure

```typescript
import { test, expect, Frame } from '@playwright/test';
import { waitForPortalFrame } from '../utils/portalHelpers';
import * as fs from 'fs';

const DCR_CREATE_URL = 'https://ms.portal.azure.com/#view/Microsoft_Azure_Monitoring/DcrCreate.ReactView';
const SCREENSHOTS_DIR = 'screenshots/my-test';

test.describe('Azure Portal - [Feature Name]', () => {
  test.setTimeout(600000);

  test('should [description]', async ({ page }) => {
    await fs.promises.mkdir(SCREENSHOTS_DIR, { recursive: true });

    // Helper functions for frame acquisition
    async function getCreateFrame(): Promise<Frame> {
      return await waitForPortalFrame(page, {
        urlIncludes: 'reactblade',
        requiredSelector: 'text="Collect and deliver"',
        timeout: 60000,
        debug: true,
      });
    }

    async function getPaneFrame(): Promise<Frame> {
      return await waitForPortalFrame(page, {
        urlIncludes: 'reactblade',
        requiredSelector: 'text="Data source type"',
        timeout: 30000,
        debug: true,
      });
    }

    // Navigate
    await page.goto(DCR_CREATE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(10000);

    let f = await getCreateFrame();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-loaded.png` });

    // ... test steps with screenshots at each step
    // ... re-acquire frames after pane transitions
    // ... use focus()+Enter for dropdowns after DOM mutations
  });
});
```

---
name: azure-portal-vendor-tests
description: Step-by-step guide for creating Playwright E2E vendor tests for Azure Portal using Copilot CLI. Use this when asked to write, create, or automate vendor/E2E tests from ADO test cases.
---

# Creating Vendor Tests for Azure Portal with Copilot CLI

This guide teaches Copilot CLI (and humans) how to create Playwright E2E vendor tests for the Azure Portal DCR (Data Collection Rules) create wizard — or any Azure Portal React view.

## Prerequisites

### 1. Clone & Install

```powershell
git clone https://github.com/posingh20/azure-portal-ui-cli-tools.git
cd azure-portal-ui-cli-tools
npm install
```

### 2. Configure Auth

Create a `.env` file from the example:

```powershell
cp .env.example .env
# Edit .env with your Azure Portal credentials:
#   EMAIL=your-email@microsoft.com
#   PASSWORD=your-password
```

### 3. First-Time Authentication

```powershell
npm run auth
# This opens a browser, logs in, and saves auth state to playwright/.auth/user.json
# You only need to do this once — auth state persists across test runs.
```

### 4. Verify Setup

```powershell
npm test
# Runs all tests in tests/ directory
```

---

## Workflow: ADO Test Case → Playwright Test

### Step 1: Fetch the ADO Test Case

```powershell
az boards work-item show --id <WORK_ITEM_ID> --org https://msazure.visualstudio.com
```

Parse the `Microsoft.VSTS.TCM.Steps` XML field to extract the test steps. Each `<step>` has:
- **Action** (first `<parameterizedString>`) — what to do
- **Expected Result** (second `<parameterizedString>`) — what to verify

### Step 2: Write the Test File

Create `tests/<feature-name>.spec.ts` following this template:

```typescript
import { test, expect, Frame } from '@playwright/test';
import { waitForPortalFrame } from '../utils/portalHelpers';
import * as fs from 'fs';

const DCR_CREATE_URL = 'https://ms.portal.azure.com/#view/Microsoft_Azure_Monitoring/DcrCreate.ReactView';
const SCREENSHOTS_DIR = 'screenshots/<feature-name>';

test.describe('Azure Portal - <Feature Name> (React)', () => {
  test.setTimeout(600000); // 10 minutes — portal is slow

  test('should validate <feature> data source behavior', async ({ page }) => {
    await fs.promises.mkdir(SCREENSHOTS_DIR, { recursive: true });

    // Frame helpers — re-use these in every test
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

    // Step 1: Navigate and verify basics
    await page.goto(DCR_CREATE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(10000);
    let f = await getCreateFrame();

    // ... implement steps from ADO test case ...
  });
});
```

### Step 3: Run and Iterate

```powershell
# Run a specific test
npx playwright test tests/<feature-name>.spec.ts --project=chromium --reporter=list --workers=1 --max-failures=1

# Run all tests
npm test

# Run with visible browser (debugging)
npm run test:headed
```

### Step 4: Screenshot on Every Step

Take screenshots after each significant action for debugging:

```typescript
await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-step-description.png` });
```

---

## Core Patterns

### Portal Frame Architecture

Azure Portal renders React views in **nested iframes**. You MUST work within the correct frame.

| Scenario | Frame | How to Find |
|---|---|---|
| DCR create form (tabs, basics) | sandbox-1 | `requiredSelector: 'text="Collect and deliver"'` |
| Data source pane (add/edit) | sandbox-2 | `requiredSelector: 'text="Data source type"'` |
| Re-opened edit pane | sandbox-3 | Same selector, new iframe spawned |

**Critical rules:**
- Frame `name` attributes are **EMPTY** — never use `page.frameLocator('[name="..."]')`
- Always use `waitForPortalFrame()` with `requiredSelector` to find the right iframe
- **Re-acquire frame references** after pane transitions (save, close, re-open)

### Navigating the DCR Create Wizard

```typescript
// 1. Open create wizard
await page.goto(DCR_CREATE_URL);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(10000);
let f = await getCreateFrame();

// 2. Verify telemetry type (defaults to "Windows or Linux")
const telemetryType = await f.locator('text=/Windows|Linux/i').first().textContent();

// 3. Go to Collect and deliver tab
await f.locator('text="Collect and deliver"').first().click();
await page.waitForTimeout(3000);

// 4. Click +Add data source (opens pane in new iframe)
await f.locator('text="Add new data source"').first().click();
await page.waitForTimeout(5000);

// 5. Switch to pane frame
f = await getPaneFrame();
```

### Selecting a Data Source Type

The data source type dropdown is the **first** `[role="combobox"]` in the pane:

```typescript
const dsTypeDropdown = f.locator('[role="combobox"]').first();
await dsTypeDropdown.click();
await page.waitForTimeout(1000);

// Select by visible text
await f.locator('[role="option"]:has-text("Windows Event Logs")').first().click();
await page.waitForTimeout(3000);
```

**Available data source types:** Windows Event Logs, Linux Syslog, Performance Counters, Firewall logs, and others.

### Configuring a Destination

```typescript
// 1. Switch to Destination tab
await f.locator('text="Destination"').first().click();
await page.waitForTimeout(3000);

// 2. Click "Add destination"
await f.locator('text="Add destination"').first().click();
await page.waitForTimeout(2000);

// 3. Verify default destination type (plain text, not a combobox)
await expect(f.locator('text="Log Analytics Workspaces"').first()).toBeVisible();

// 4. Select subscription (index 0 combobox) and workspace (index 1 combobox)
const combos = f.locator('[role="combobox"]');
// Subscription dropdown
await combos.nth(0).focus();
await combos.nth(0).press('Enter');
await page.waitForTimeout(2000);
await f.locator('[role="option"]:has-text("H&S_Observability")').first().click();
await page.waitForTimeout(5000);

// Workspace dropdown
await combos.nth(1).focus();
await combos.nth(1).press('Enter');
await page.waitForTimeout(3000);
await f.locator('[role="option"]:has-text("e2eloganalyticsworkspace1")').first().click();
await page.waitForTimeout(2000);

// 5. Click Apply to confirm
await f.locator('button:has-text("Apply")').first().click();
await page.waitForTimeout(3000);
```

### Saving a Data Source

After configuring both data source AND destination:

```typescript
// Switch back to Data source tab to verify selections persisted
await f.locator('text="Data source"').first().click();
await page.waitForTimeout(3000);

// Click Save
const saveBtn = f.locator('button:has-text("Save")').first();
await expect(saveBtn).toBeEnabled({ timeout: 10000 });
await saveBtn.click();
await page.waitForTimeout(5000);

// Switch back to create form frame to verify in table
f = await getCreateFrame();
await expect(f.locator('text=/YourDataSource/i').first()).toBeVisible({ timeout: 10000 });
```

### Re-opening a Saved Data Source

```typescript
// Click the data source row in the table
await f.locator('text=/YourDataSource/i').first().click();
await page.waitForTimeout(5000);

// Pane reopens in a NEW iframe (sandbox-3)
f = await getPaneFrame();

// In edit mode: data source type is plain text (not a combobox)
await expect(f.locator('text="Your Data Source Name"').first()).toBeVisible();
```

---

## Checkbox Patterns by Data Source

| Data Source | Checkbox Selector | Count | Notes |
|---|---|---|---|
| Windows Event Logs | `.ms-Checkbox` | 12 | Fluent v8 checkboxes |
| Linux Syslogs | `[role="checkbox"]` | 26 | 25 facilities + select all header |
| Firewall Logs | `.ms-Checkbox` | 3 | Domain, Private, Public |
| Performance Counters | `[role="checkbox"]` | varies | Fluent role-based |

**Detection pattern** (use when unsure):

```typescript
const fluentCb = await f.locator('.ms-Checkbox').count();
const roleCb = await f.locator('[role="checkbox"]').count();
const selector = fluentCb > 0 ? '.ms-Checkbox' : '[role="checkbox"]';
```

---

## Fluent Dropdown Critical Bug

**Problem:** `.click()` hangs indefinitely on Fluent `[role="combobox"]` dropdowns AFTER DOM mutations (add/delete operations).

**Fix:** Use `focus()` + `press('Enter')` instead of `.click()`:

```typescript
// ❌ HANGS after DOM changes
await dropdown.click();

// ✅ ALWAYS WORKS
await dropdown.focus();
await dropdown.press('Enter');
await page.waitForTimeout(1000);
await f.locator('[role="option"]:has-text("Your Option")').first().click();
```

**When it matters:** Any dropdown interaction AFTER a checkbox toggle, add, delete, or tab switch. First interactions before DOM changes work fine with `.click()`.

---

## Destination Defaults by Data Source

| Data Source | Default Destination Type |
|---|---|
| Windows Event Logs | Log Analytics Workspaces |
| Linux Syslogs | Log Analytics Workspaces |
| Firewall Logs | Log Analytics Workspaces |
| Performance Counters | Azure Monitor Metrics |

---

## Test Environment

### Subscription & Workspace for Tests

Use these pre-configured test resources:

- **Subscription:** `H&S_Observability_AzureMonitorDCRUX_UXTest`
- **Workspace:** `e2eloganalyticsworkspace1`

### Auth State

Auth persists in `playwright/.auth/user.json`. To re-authenticate:

```powershell
npm run auth
```

---

## Common Pitfalls

### 1. Stale Frame References

After saving, closing, or re-opening a pane, the old frame reference is invalid. Always re-acquire:

```typescript
// After save
f = await getCreateFrame();

// After re-opening pane
f = await getPaneFrame();
```

### 2. Destination Type Is Plain Text, Not a Combobox

On the destination form, "Destination type *" shows "Log Analytics Workspaces" as **plain text**. The comboboxes are only subscription (index 0) and workspace (index 1).

### 3. Apply Before Save

When adding a destination: select subscription → select workspace → click **Apply** → then switch back to Data source tab → click **Save**.

### 4. Edit Mode Shows Plain Text Data Source Type

When re-opening a saved data source, the type is plain text (not a dropdown). Don't look for `[role="combobox"]` — use `text="Firewall Logs"` etc.

### 5. `type()` Over `fill()` for React Inputs

```typescript
// ✅ Triggers React onChange properly
await input.type('my text', { delay: 50 });

// ❌ May not trigger React handlers
await input.fill('my text');
```

### 6. Generous Timeouts Everywhere

Azure Portal is slow. Always add waits after:
- Navigation: `10000ms`
- Tab switches: `3000ms`
- Dropdown selections: `1000-3000ms`
- Pane open/close: `5000ms`
- After Apply/Save: `3000-5000ms`
- Subscription change (triggers workspace reload): `5000ms`

---

## Example: Complete Test from ADO Test Case

See these reference implementations in `tests/`:

| File | ADO Test Case | Data Source |
|---|---|---|
| `windows-event-logs.spec.ts` | #31150288 | Windows Event Logs |
| `linux-syslogs.spec.ts` | #31150289 | Linux Syslogs |
| `firewall-logs.spec.ts` | #31150291 | Firewall Logs |
| `create-dcr.spec.ts` | — | Performance Counters (partial) |

Each follows the same structure: navigate → verify basics → open pane → select data source → verify checkboxes → configure destination → save → re-open → verify persistence.

---

## Quick Reference: npm Scripts

```powershell
npm run auth          # First-time login, saves auth state
npm test              # Run all tests (headless)
npm run test:headed   # Run all tests with visible browser
```

## Quick Reference: Playwright Commands

```powershell
# Run specific test
npx playwright test tests/firewall-logs.spec.ts --project=chromium --reporter=list --workers=1

# Run with max 1 failure (fast feedback)
npx playwright test tests/my-test.spec.ts --project=chromium --reporter=list --workers=1 --max-failures=1

# Debug mode (step through)
npx playwright test tests/my-test.spec.ts --project=chromium --debug
```

---

## Creating & Updating ADO Test Case Work Items

For creating or updating ADO Test Case work items with test steps, see the dedicated skill: **`ado-test-case-create`** (`.github/skills/ado-test-case-create/SKILL.md`).

The `az boards` CLI strips XML attribute quotes, so use `utils/update-ado-test-steps.js` instead:

```powershell
node utils/update-ado-test-steps.js <WORK_ITEM_ID> my-steps.xml
```

---
name: azure-portal-debug
description: Debug and fix failing Playwright E2E tests for Azure Portal. Use this skill when a Playwright test fails, when asked to debug test failures, or when iteratively fixing tests.
---

# Debug Azure Portal E2E Test Failures

Use this skill when a Playwright test fails and you need to diagnose and fix it.

## Step 1: Read the Test Output

When a test fails, the Playwright output contains:
- **Error message** with the exact failure reason
- **Expected vs Received** values for assertion failures
- **Locator** that failed (which selector didn't match)
- **Call log** with the sequence of actions attempted
- **Source code** context showing which line failed

Parse these carefully before making changes.

## Step 2: Check Failure Artifacts

Playwright saves artifacts to `test-results/`:

```powershell
# List what's in test-results
Get-ChildItem -Recurse test-results
```

Look for:
- **Screenshots** (`*.png`) — show the UI state at failure time. View these to see what was actually on screen.
- **Traces** (`*.zip`) — detailed execution trace
- **`error-context.md`** or **`test-failed.txt`** — additional error context

Also check saved context logs:
```powershell
Get-ChildItem artifacts\agent-context\
```
Read the most recent `context-*.md` file for detailed failure information.

## Step 3: Diagnose Common Issues

### "React frame not found"
**Cause**: The page hasn't loaded the React iframe yet.
**Fix**: Increase the initial wait time after navigation:
```typescript
await page.waitForTimeout(8000); // Was 5000, increase
```
Or use a more robust frame finder:
```typescript
import { waitForPortalFrame } from '../utils/portalHelpers';
const reactFrame = await waitForPortalFrame(page, {
  urlIncludes: 'reactblade',
  timeout: 60000
});
```

### "Element not found" / "Timeout waiting for selector"
**Cause**: Wrong selector, wrong frame, or element hasn't appeared.
**Fixes**:
1. Verify you're searching in the React frame, not the main page
2. Run `/azure-portal-recon` to check actual selectors
3. Increase the `waitFor` timeout
4. Try a different selector (text-based, role-based, or class-based)

### "Multiple elements matched"
**Cause**: Selector is too broad.
**Fix**: Use `.first()` or a more specific selector:
```typescript
const button = reactFrame.locator('button:has-text("Your feedback")').first();
```

### "Expected text not found"
**Cause**: Text on the page doesn't match what you expected.
**Fix**: Run `/azure-portal-recon` to capture actual text content, then update the assertion.

### "Timeout exceeded" (test-level)
**Cause**: `test.setTimeout()` too low for Azure Portal.
**Fix**: Set `test.setTimeout(120000)` or higher.

### Assertion failures with Expected vs Received
Read the Expected and Received values carefully:
- If Received is empty → element exists but has no text (wrong element targeted)
- If Received is different text → update assertion to match actual text
- If Received is `undefined` → element not found (wrong selector)

## Step 4: Fix and Retry

1. Edit the test file based on diagnosis
2. Re-run:
   ```powershell
   npx playwright test tests/generated.spec.ts --project=chromium --reporter=list --timeout=120000 --workers=1 --max-failures=1
   ```
3. Repeat up to 5 times max

## Step 5: Nuclear Option

If the test keeps failing after multiple fixes, run reconnaissance again:
```powershell
$env:RECON_URL = "<the-url>"
npx playwright test tests/recon.spec.ts --project=chromium --reporter=list
```
Then read `artifacts/page-recon-summary.md` and rewrite the test from scratch using fresh selector data.

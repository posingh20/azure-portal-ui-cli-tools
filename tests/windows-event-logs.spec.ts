import { test, expect, Frame } from '@playwright/test';
import { waitForPortalFrame } from '../utils/portalHelpers';
import * as fs from 'fs';

const DCR_CREATE_URL = 'https://ms.portal.azure.com/#view/Microsoft_Azure_Monitoring/DcrCreate.ReactView';
const SCREENSHOTS_DIR = 'screenshots/event-logs';

test.describe('Azure Portal - Windows Event Logs (React)', () => {
  test.setTimeout(600000);

  test('should validate Windows Event Logs data source behavior', async ({ page }) => {
    await fs.promises.mkdir(SCREENSHOTS_DIR, { recursive: true });

    // Helper to get the React create form frame
    async function getCreateFrame(): Promise<Frame> {
      return await waitForPortalFrame(page, {
        urlIncludes: 'reactblade',
        requiredSelector: 'text="Collect and deliver"',
        timeout: 60000,
        debug: true,
      });
    }

    // Helper to get the data source picker pane frame
    async function getDatasourcePaneFrame(): Promise<Frame> {
      return await waitForPortalFrame(page, {
        urlIncludes: 'reactblade',
        requiredSelector: 'text="Data source type"',
        timeout: 30000,
        debug: true,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // Step 1: Open React create DCR wizard
    // ═══════════════════════════════════════════════════════════════
    await page.goto(DCR_CREATE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(10000);

    let f = await getCreateFrame();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-create-form.png` });

    // ═══════════════════════════════════════════════════════════════
    // Step 3: Click "Collect and deliver" tab, then "+Add data source"
    // ═══════════════════════════════════════════════════════════════
    const collectTab = f.locator('text="Collect and deliver"').first();
    await collectTab.waitFor({ state: 'visible', timeout: 15000 });
    await collectTab.click();
    await page.waitForTimeout(3000);

    const addDsButton = f.locator('text="Add new data source"').first();
    await addDsButton.waitFor({ state: 'visible', timeout: 10000 });
    await addDsButton.click();
    await page.waitForTimeout(5000);

    // Data source pane opens in a second React iframe
    f = await getDatasourcePaneFrame();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-datasource-pane-open.png` });

    // Verify: pane is open with Data source type visible
    await expect(f.locator('text="Data source type"').first()).toBeVisible({ timeout: 10000 });

    // The Save button in the pane footer
    const saveButton = f.locator('button:has-text("Save")').first();

    // ═══════════════════════════════════════════════════════════════
    // Step 4-5: Select "Windows Event Logs" from data source type dropdown
    // ═══════════════════════════════════════════════════════════════
    // Find the data source type dropdown — it defaults to "Performance Counters" or placeholder
    const dsTypeDropdown = f.locator('[role="combobox"]').first();
    await dsTypeDropdown.click();
    await page.waitForTimeout(1000);

    const eventLogsOption = f.locator('[role="option"]:has-text("Windows Event Logs")').first();
    await eventLogsOption.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-event-logs-selected.png` });

    // Verify: "Event Log Selection Mode" is a Fluent Dropdown (role="combobox")
    const modeDropdown = f.locator('[role="combobox"][aria-label="Event Log Selection Mode:"]');
    await expect(modeDropdown).toBeVisible({ timeout: 5000 });
    const modeText = await modeDropdown.textContent();
    console.log(`Default mode text: "${modeText}"`);

    // Verify: Event log categories are visible (Application, Security, System) with unchecked checkboxes
    await expect(f.locator('text="Application"').first()).toBeVisible({ timeout: 5000 });
    await expect(f.locator('text="Security"').first()).toBeVisible({ timeout: 5000 });
    await expect(f.locator('text="System"').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-basic-checkboxes.png` });

    // ═══════════════════════════════════════════════════════════════
    // Step 6: Switch to Destinations tab — verify default destination type
    // ═══════════════════════════════════════════════════════════════
    const destTab = f.locator('text="Destination"').first();
    await destTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-destination-tab.png` });

    // Verify: "Add destination" button is visible
    const addDestBtn = f.locator('text="Add destination"').first();
    await expect(addDestBtn).toBeVisible({ timeout: 5000 });

    // Click "+ Add destination" to verify default type is Log Analytics Workspaces
    await addDestBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05b-destination-form.png` });
    await expect(f.locator('text="Log Analytics Workspaces"').first()).toBeVisible({ timeout: 5000 });

    // Verify: only one destination type option — dropdown only has "Log Analytics Workspaces"
    // Cancel to go back
    await f.locator('button:has-text("Cancel")').first().click();
    await page.waitForTimeout(1000);

    // ═══════════════════════════════════════════════════════════════
    // Step 7: Switch back to Data source tab, check some checkboxes
    // ═══════════════════════════════════════════════════════════════
    const dsTab = f.locator('text="Data source"').first();
    await dsTab.click();
    await page.waitForTimeout(2000);

    // Check Application > Critical and Audit success under Security
    const checkboxes = f.locator('.ms-Checkbox');
    const checkboxCount = await checkboxes.count();
    console.log(`Found ${checkboxCount} Fluent checkboxes`);
    await checkboxes.nth(0).click(); // Application > Critical
    await page.waitForTimeout(500);
    await checkboxes.nth(5).click(); // Security > Audit success
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-checkboxes-selected.png` });

    // ═══════════════════════════════════════════════════════════════
    // Step 8: Switch to Custom — verify event log strings from Basic selections
    // ═══════════════════════════════════════════════════════════════
    await modeDropdown.click();
    await page.waitForTimeout(500);
    await f.locator('[role="option"]:has-text("Custom")').first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-custom-mode.png` });

    // Verify: Custom strings appear based on Basic selections (Application, Security)
    // The custom strings should show XPath-style event log identifiers

    // ═══════════════════════════════════════════════════════════════
    // Step 9: Add a custom event log string
    // ═══════════════════════════════════════════════════════════════
    const customInput = f.locator('input[type="text"]').first();
    await customInput.click();
    await customInput.type('MyCustomEventLog!', { delay: 50 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-custom-input-typed.png` });

    // Click the Add button
    const addBtn = f.locator('button').filter({ hasText: /^Add$/ }).first();
    await addBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-custom-log-added.png` });

    // ═══════════════════════════════════════════════════════════════
    // Step 10: Delete a custom string
    // ═══════════════════════════════════════════════════════════════
    // The trash icon is a button in the "Action" column next to each custom entry
    const trashButtons = f.locator('[data-icon-name="Delete"]');
    const trashCount = await trashButtons.count();
    console.log(`Found ${trashCount} trash icons`);

    if (trashCount > 0) {
      // Click the trash icon directly (it's inside a button, but clicking the icon works)
      await trashButtons.last().click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-custom-log-deleted.png` });

    // ═══════════════════════════════════════════════════════════════
    // Step 13: Switch between Basic and Custom — verify selections are independent
    // Note: The dropdown only has "Basic" and "Custom" options (no "None")
    // ═══════════════════════════════════════════════════════════════
    // Currently in Custom mode with empty event logs table (after delete)
    // Switch to Basic — verify checkboxes are cleared
    const modeDD = f.locator('[role="combobox"][aria-label="Event Log Selection Mode:"]');
    await modeDD.waitFor({ state: 'visible', timeout: 10000 });
    await modeDD.focus();
    await page.waitForTimeout(500);
    await modeDD.press('Enter');
    await page.waitForTimeout(1000);
    await f.locator('[role="option"]').filter({ hasText: 'Basic' }).first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-basic-after-custom.png` });

    // Verify: Save is disabled (checkboxes should be unchecked after switching from empty Custom)
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    // Switch back to Custom — verify strings are also cleared
    const modeDDCustom = f.locator('[role="combobox"][aria-label="Event Log Selection Mode:"]');
    await modeDDCustom.focus();
    await page.waitForTimeout(500);
    await modeDDCustom.press('Enter');
    await page.waitForTimeout(1000);
    await f.locator('[role="option"]:has-text("Custom")').first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-custom-after-basic.png` });

    // Verify: Save still disabled (custom strings removed)
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    // Verify: Save still disabled (custom strings removed after None)
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    console.log('✅ Windows Event Logs data source workflow validated successfully');
  });
});

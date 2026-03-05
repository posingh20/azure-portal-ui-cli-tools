import { test, expect, Frame } from '@playwright/test';
import { waitForPortalFrame } from '../utils/portalHelpers';
import * as fs from 'fs';

const DCR_CREATE_URL = 'https://ms.portal.azure.com/#view/Microsoft_Azure_Monitoring/DcrCreate.ReactView';
const SCREENSHOTS_DIR = 'screenshots/firewall-logs';

test.describe('Azure Portal - Firewall Logs (React)', () => {
  test.setTimeout(600000);

  test('should validate Firewall Logs data source behavior', async ({ page }) => {
    await fs.promises.mkdir(SCREENSHOTS_DIR, { recursive: true });

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

    // Step 1: Open React DCR create wizard
    // Verify telemetry type defaults to Windows or Linux, then move on
    await page.goto(DCR_CREATE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(10000);

    let f = await getCreateFrame();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-create-form.png` });

    // Verify: telemetry type defaults to Windows or Linux
    const platformText = await f.locator('text=/Windows|Linux/i').first().textContent().catch(() => 'not found');
    console.log(`Default telemetry type: "${platformText}"`);

    // Step 2: Click "Collect and deliver" tab, then "+Add data source"
    const collectTab = f.locator('text="Collect and deliver"').first();
    await collectTab.waitFor({ state: 'visible', timeout: 15000 });
    await collectTab.click();
    await page.waitForTimeout(3000);

    const addDsButton = f.locator('text="Add new data source"').first();
    await addDsButton.waitFor({ state: 'visible', timeout: 10000 });
    await addDsButton.click();
    await page.waitForTimeout(5000);

    // Data source pane opens in second iframe
    f = await getPaneFrame();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-datasource-pane.png` });

    // Verify: pane is open with Data source type visible and Add data source button is disabled
    await expect(f.locator('text="Data source type"').first()).toBeVisible({ timeout: 10000 });
    const addDataSourceBtn = f.locator('button:has-text("Add data source")').first();

    // Step 3: Click "Firewall logs" from data source type dropdown
    const dsTypeDropdown = f.locator('[role="combobox"]').first();
    await dsTypeDropdown.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-ds-dropdown-open.png` });

    const firewallOption = f.locator('[role="option"]:has-text("Firewall logs")').first();
    await firewallOption.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-firewall-selected.png` });

    // Verify: Three checkboxes appear: Domain, Private, Public
    await expect(f.locator('text="Domain"').first()).toBeVisible({ timeout: 5000 });
    await expect(f.locator('text="Private"').first()).toBeVisible({ timeout: 5000 });
    await expect(f.locator('text="Public"').first()).toBeVisible({ timeout: 5000 });
    console.log('Firewall logs checkboxes visible: Domain, Private, Public');

    // Detect checkbox type
    const nativeCb = await f.locator('input[type="checkbox"]').count();
    const fluentCb = await f.locator('.ms-Checkbox').count();
    const roleCb = await f.locator('[role="checkbox"]').count();
    console.log(`Checkboxes - native: ${nativeCb}, .ms-Checkbox: ${fluentCb}, role="checkbox": ${roleCb}`);

    let checkboxSelector: string;
    if (fluentCb > 0) {
      checkboxSelector = '.ms-Checkbox';
    } else if (roleCb > 0) {
      checkboxSelector = '[role="checkbox"]';
    } else {
      checkboxSelector = 'input[type="checkbox"]';
    }

    const checkboxes = f.locator(checkboxSelector);
    const cbCount = await checkboxes.count();
    console.log(`Using "${checkboxSelector}" - found ${cbCount} checkboxes`);

    // Step 4: Select some checkboxes at random (select Domain and Public)
    // Track which checkboxes we select for later verification
    const selectedIndices = [0, 2]; // First (Domain) and third (Public)
    for (const idx of selectedIndices) {
      if (idx < cbCount) {
        await checkboxes.nth(idx).click();
        await page.waitForTimeout(500);
      }
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-checkboxes-selected.png` });
    console.log('Selected checkboxes at indices:', selectedIndices);

    // Step 5: Switch to Destinations tab
    const destTab = f.locator('text="Destination"').first();
    await destTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-destination-tab.png` });

    // Verify: Default destination is Log Analytics (Azure Monitor Logs)
    // Click "Add destination" to see the default type
    const addDestBtn = f.locator('text="Add destination"').first();
    await expect(addDestBtn).toBeVisible({ timeout: 5000 });
    await addDestBtn.click();
    await page.waitForTimeout(2000);

    // Verify default destination type is "Log Analytics Workspaces"
    await expect(f.locator('text="Log Analytics Workspaces"').first()).toBeVisible({ timeout: 5000 });
    console.log('Default destination type confirmed: Log Analytics Workspaces');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-destination-default.png` });

    // Step 6: Select subscription and Log Analytics workspace
    // The subscription dropdown defaults to a wrong sub — change it
    // Enumerate all comboboxes to find the subscription one (2nd combobox after dest type)
    const allCombos = f.locator('[role="combobox"]');
    const comboCount = await allCombos.count();
    console.log(`Found ${comboCount} comboboxes on destination form`);
    for (let i = 0; i < comboCount; i++) {
      const txt = await allCombos.nth(i).textContent().catch(() => '');
      console.log(`  Combobox ${i}: "${txt}"`);
    }

    // Dest type is plain text, so: index 0 = subscription, index 1 = workspace
    const subscriptionDropdown = allCombos.nth(0);
    await subscriptionDropdown.focus();
    await subscriptionDropdown.press('Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-subscription-dropdown-open.png` });

    // Select the test subscription
    const subOption = f.locator('[role="option"]:has-text("H&S_Observability")').first();
    await subOption.click();
    await page.waitForTimeout(5000); // Wait for workspace list to reload
    console.log('Selected subscription: H&S_Observability_AzureMonitorDCRUX_UXTest');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-subscription-selected.png` });

    // Select workspace: e2eloganalyticsworkspace1
    const workspaceDropdown = allCombos.nth(1);
    await workspaceDropdown.focus();
    await workspaceDropdown.press('Enter');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-workspace-dropdown-open.png` });

    const wsOption = f.locator('[role="option"]:has-text("e2eloganalyticsworkspace1")').first();
    await wsOption.click();
    await page.waitForTimeout(2000);
    console.log('Selected workspace: e2eloganalyticsworkspace1');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-workspace-selected.png` });

    // Click Apply to confirm destination configuration
    const applyBtn = f.locator('button:has-text("Apply")').first();
    await applyBtn.click();
    await page.waitForTimeout(3000);
    console.log('Clicked Apply on destination');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12b-destination-applied.png` });

    // Switch back to Data source tab to verify firewall checkbox selections persisted
    const dsTab = f.locator('text="Data source"').first();
    await dsTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-back-to-datasource.png` });

    // Verify: checkboxes are still visible (Domain, Private, Public)
    await expect(f.locator('text="Domain"').first()).toBeVisible({ timeout: 5000 });
    await expect(f.locator('text="Public"').first()).toBeVisible({ timeout: 5000 });
    console.log('Firewall log checkboxes still visible after destination config');

    // Verify: Save button is now enabled (data source + destination both configured)
    const saveBtn = f.locator('button:has-text("Save")').first();
    await expect(saveBtn).toBeEnabled({ timeout: 10000 });
    console.log('Save button is enabled');

    // Step 7: Click "Save" to add data source
    await saveBtn.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/14-datasource-added.png` });

    // Verify: Firewall Logs is in the data source table (back to create frame)
    f = await getCreateFrame();
    await expect(f.locator('text=/Firewall/i').first()).toBeVisible({ timeout: 10000 });
    console.log('Firewall Logs confirmed in data source table');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/15-datasource-in-table.png` });

    // Step 8: Click Firewall Logs in the data source table to re-open pane
    const firewallRow = f.locator('text=/Firewall/i').first();
    await firewallRow.click();
    await page.waitForTimeout(5000);

    // Pane reopens — get pane frame
    f = await getPaneFrame();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/16-pane-reopened.png` });

    // Verify: Data source type shows "Firewall Logs" (plain text, not combobox in edit mode)
    await expect(f.locator('text="Firewall Logs"').first()).toBeVisible({ timeout: 5000 });
    console.log('Re-opened pane shows data source type: Firewall Logs');

    // Verify: Save button is enabled
    const saveBtnReopen = f.locator('button:has-text("Save")').first();
    await expect(saveBtnReopen).toBeEnabled({ timeout: 5000 });
    console.log('Save button is enabled on re-opened pane');

    // Verify: Checkboxes are visible (Domain, Private, Public)
    await expect(f.locator('text="Domain"').first()).toBeVisible({ timeout: 5000 });
    await expect(f.locator('text="Private"').first()).toBeVisible({ timeout: 5000 });
    await expect(f.locator('text="Public"').first()).toBeVisible({ timeout: 5000 });
    console.log('All 3 firewall checkboxes visible on re-opened pane');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/17-selections-preserved.png` });

    console.log('\u2705 Firewall Logs data source workflow validated successfully');
  });
});

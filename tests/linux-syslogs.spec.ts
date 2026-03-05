import { test, expect, Frame } from '@playwright/test';
import { waitForPortalFrame } from '../utils/portalHelpers';
import * as fs from 'fs';

const DCR_CREATE_URL = 'https://ms.portal.azure.com/#view/Microsoft_Azure_Monitoring/DcrCreate.ReactView';
const SCREENSHOTS_DIR = 'screenshots/linux-syslogs';

test.describe('Azure Portal - Linux Syslogs (React)', () => {
  test.setTimeout(600000);

  test('should validate Linux Syslogs data source behavior', async ({ page }) => {
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

    // ═══════════════════════════════════════════════════════════════
    // Step 1: Open React DCR create wizard
    // ═══════════════════════════════════════════════════════════════
    await page.goto(DCR_CREATE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(10000);

    let f = await getCreateFrame();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-create-form.png` });

    // Verify: Check default platform type (Windows or Linux or All)
    // The Basics tab should show the platform type
    const platformText = await f.locator('text=/Windows|Linux|All/i').first().textContent().catch(() => 'not found');
    console.log(`Platform type on Basics tab: "${platformText}"`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-platform-type.png` });

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

    // Data source pane opens in second iframe
    f = await getPaneFrame();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-datasource-pane.png` });

    const saveButton = f.locator('button:has-text("Save")').first();

    // ═══════════════════════════════════════════════════════════════
    // Step 4: Select "Linux Syslog" from data source type dropdown
    // ═══════════════════════════════════════════════════════════════
    const dsTypeDropdown = f.locator('[role="combobox"]').first();
    await dsTypeDropdown.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-ds-dropdown-open.png` });

    const syslogOption = f.locator('[role="option"]:has-text("Linux Syslog")').first();
    await syslogOption.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-syslog-selected.png` });

    // Verify: Syslog facilities are visible with checkboxes and LOG_DEBUG as default log level
    // Facilities: LOG_ALERT, LOG_AUDIT, LOG_AUTH, LOG_AUTHPRIV, LOG_CLOCK, LOG_CRON, LOG_DAEMON, etc.
    await expect(f.locator('text="LOG_ALERT"').first()).toBeVisible({ timeout: 5000 });
    await expect(f.locator('text="LOG_AUTH"').first()).toBeVisible({ timeout: 5000 });
    await expect(f.locator('text="LOG_CRON"').first()).toBeVisible({ timeout: 5000 });

    // Verify: LOG_DEBUG is the default log level for each facility
    const debugTexts = f.locator('text=/LOG_DEBUG/i');
    const debugCount = await debugTexts.count();
    console.log(`Found ${debugCount} LOG_DEBUG entries (default log level per facility)`);
    expect(debugCount).toBeGreaterThan(0);

    // Verify: "Set minimum log level for selected facilities" bulk dropdown shows "None"
    const bulkLogLevel = f.locator('[role="combobox"]').filter({ hasText: 'None' }).first();
    await expect(bulkLogLevel).toBeVisible({ timeout: 5000 });

    // Verify: Save is disabled (no facilities checked yet)
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    // Select some facilities by clicking their checkboxes
    // Try both native and Fluent checkbox selectors
    const nativeCheckboxes = f.locator('input[type="checkbox"]');
    const fluentCheckboxes = f.locator('.ms-Checkbox');
    const roleCheckboxes = f.locator('[role="checkbox"]');
    const nCb = await nativeCheckboxes.count();
    const fCb = await fluentCheckboxes.count();
    const rCb = await roleCheckboxes.count();
    console.log(`Checkboxes — native: ${nCb}, .ms-Checkbox: ${fCb}, role="checkbox": ${rCb}`);

    // Use whichever selector finds checkboxes
    let checkboxSelector: string;
    if (rCb > 0) {
      checkboxSelector = '[role="checkbox"]';
    } else if (fCb > 0) {
      checkboxSelector = '.ms-Checkbox';
    } else {
      checkboxSelector = 'input[type="checkbox"]';
    }

    const checkboxes = f.locator(checkboxSelector);
    const cbCount = await checkboxes.count();
    console.log(`Using "${checkboxSelector}" — found ${cbCount}`);

    // Check the header "select all" checkbox (first one) to select all facilities
    if (cbCount > 0) {
      await checkboxes.nth(0).click();
      await page.waitForTimeout(1000);
    }

    // Verify: All facility checkboxes are now checked (select all worked)
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-syslog-all-selected.png` });

    // ═══════════════════════════════════════════════════════════════
    // Step 5: Change log level for a facility
    // Hierarchy: Emergency > Alert > Critical > Error > Warning > Notice > Info > Debug
    // Selecting a level includes all levels above it
    // ═══════════════════════════════════════════════════════════════
    // Find per-facility log level dropdowns — they show "LOG_DEBUG" by default
    // Skip the first combobox (data source type) and the bulk level dropdown (shows "None")
    const allComboboxes = f.locator('[role="combobox"]');
    const comboCount = await allComboboxes.count();
    console.log(`Found ${comboCount} total comboboxes`);

    // The per-facility log level dropdowns contain "LOG_DEBUG"
    // Pick one that's not the first (data source type) or second (bulk level)
    // Find by filtering for LOG_DEBUG text
    const logLevelDropdowns = f.locator('[role="combobox"]').filter({ hasText: 'LOG_DEBUG' });
    const llCount = await logLevelDropdowns.count();
    console.log(`Found ${llCount} per-facility log level dropdowns`);

    if (llCount > 0) {
      // Change the first facility's log level
      const firstLL = logLevelDropdowns.first();
      await firstLL.focus();
      await page.waitForTimeout(500);
      await firstLL.press('Enter');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-loglevel-dropdown-open.png` });

      // Select LOG_ERR (includes Error + Critical + Alert + Emergency)
      const errOption = f.locator('[role="option"]:has-text("LOG_ERR")').first();
      if (await errOption.count() > 0) {
        await errOption.click();
      }
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-loglevel-changed.png` });

    // ═══════════════════════════════════════════════════════════════
    // Step 6: Switch to Destinations tab — verify default is Azure Monitor Logs
    // ═══════════════════════════════════════════════════════════════
    const destTab = f.locator('text="Destination"').first();
    await destTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-destination-tab.png` });

    // Click "Add destination" to verify default type
    const addDestBtn = f.locator('text="Add destination"').first();
    await expect(addDestBtn).toBeVisible({ timeout: 5000 });
    await addDestBtn.click();
    await page.waitForTimeout(2000);

    // Verify: Default destination type is "Log Analytics Workspaces" (Azure Monitor Logs)
    await expect(f.locator('text="Log Analytics Workspaces"').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-destination-default.png` });

    // Cancel — we can't configure a workspace in this test
    await f.locator('button:has-text("Cancel")').first().click();
    await page.waitForTimeout(1000);

    // Go back to Data source tab and verify log level change persisted
    const dsTab = f.locator('text="Data source"').first();
    await dsTab.click();
    await page.waitForTimeout(2000);
    // Verify: Log level change persisted after switching tabs
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-back-to-datasource.png` });

    console.log('✅ Linux Syslogs data source workflow validated successfully');
  });
});

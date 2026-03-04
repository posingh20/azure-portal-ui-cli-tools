import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const email = process.env.EMAIL;
  const password = process.env.PASSWORD;
  const portalUrl = 'https://ms.portal.azure.com';

  if (!email || !password) {
    throw new Error('EMAIL and PASSWORD must be set in .env file');
  }

  await page.goto(portalUrl);

  await page.fill('input[type="email"]', email);
  await page.click('input[type="submit"]');

  await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  await page.fill('input[type="password"]', password);
  await page.click('input[type="submit"]');

  // Handle "Stay signed in?" dialog
  try {
    await page.waitForSelector('input[type="submit"][value="Yes"]', { timeout: 5000 });
    await page.click('input[type="submit"][value="Yes"]');
  } catch {
    console.log('Stay signed in dialog did not appear, continuing...');
  }

  await page.waitForURL(/.*portal\.azure\.com.*/, { timeout: 60000 });
  await page.context().storageState({ path: authFile });
});

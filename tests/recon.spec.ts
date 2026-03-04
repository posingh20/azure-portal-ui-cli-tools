/**
 * Page Reconnaissance Script
 *
 * Navigates to a URL and captures page context including:
 * - Frame structure (names, URLs)
 * - Visible elements and their selectors
 * - Text content
 * - Accessibility snapshot
 *
 * Usage: npx playwright test tests/recon.spec.ts --project=chromium
 *   Set RECON_URL env var to target a specific URL.
 */
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TARGET_URL = process.env.RECON_URL || 'https://portal.azure.com';

test.describe('Page Reconnaissance', () => {
  test.setTimeout(300000);

  test('capture page context', async ({ page }) => {
    const reconData: any = {
      url: TARGET_URL,
      timestamp: new Date().toISOString(),
      frames: [],
      mainPageElements: [],
      frameElements: {},
      accessibilitySnapshot: null
    };

    await page.goto(TARGET_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(8000);

    // 1. Capture frame structure
    console.log('\n=== FRAME STRUCTURE ===');
    for (const frame of page.frames()) {
      const frameInfo = {
        name: frame.name(),
        url: frame.url().substring(0, 200),
        isReactFrame: frame.url().includes('reactblade') || frame.url().includes('React')
      };
      reconData.frames.push(frameInfo);
      console.log(`Frame: name="${frameInfo.name}" isReact=${frameInfo.isReactFrame}`);
      console.log(`  URL: ${frameInfo.url}`);
    }

    // 2. Capture key elements from main page
    console.log('\n=== MAIN PAGE ELEMENTS ===');
    const mainSelectors = [
      '.ms-MessageBar',
      '.ms-MessageBar-content',
      '[class*="MessageBar"]',
      'button',
      '[data-automation-id]',
      '[aria-label]'
    ];

    for (const selector of mainSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        const info = { selector, count, samples: [] as string[] };
        for (let i = 0; i < Math.min(count, 3); i++) {
          const text = await page.locator(selector).nth(i).textContent().catch(() => '');
          if (text) info.samples.push(text.substring(0, 100));
        }
        reconData.mainPageElements.push(info);
        console.log(`${selector}: ${count} elements`);
        info.samples.forEach(s => console.log(`  - "${s}"`));
      }
    }

    // 3. Capture elements from React iframes
    console.log('\n=== IFRAME ELEMENTS ===');
    for (const frame of page.frames()) {
      const url = frame.url();
      if (url.includes('reactblade') || url.includes('React')) {
        console.log(`\nScanning React frame: ${frame.name() || '(unnamed)'}`);
        reconData.frameElements[frame.name() || 'unnamed'] = [];

        const iframeSelectors = [
          '.ms-MessageBar',
          '.ms-MessageBar-content',
          '.ms-MessageBar-text',
          'button',
          '[class*="Button"]',
          'a[href]',
          'h1, h2, h3',
          '[role="button"]',
          '[role="link"]',
          '[data-testid]'
        ];

        for (const selector of iframeSelectors) {
          try {
            const count = await frame.locator(selector).count();
            if (count > 0) {
              const info = { selector, count, samples: [] as string[] };
              for (let i = 0; i < Math.min(count, 5); i++) {
                const el = frame.locator(selector).nth(i);
                const text = await el.textContent().catch(() => '');
                const ariaLabel = await el.getAttribute('aria-label').catch(() => '');
                const role = await el.getAttribute('role').catch(() => '');
                if (text || ariaLabel) {
                  info.samples.push(`${text?.substring(0, 80) || ''} [aria-label="${ariaLabel || ''}" role="${role || ''}"]`);
                }
              }
              reconData.frameElements[frame.name() || 'unnamed'].push(info);
              console.log(`  ${selector}: ${count} elements`);
              info.samples.forEach(s => console.log(`    - ${s}`));
            }
          } catch {
            // Frame might have navigated
          }
        }
      }
    }

    // 4. Accessibility snapshot
    console.log('\n=== ACCESSIBILITY SNAPSHOT ===');
    try {
      const snapshot = await page.accessibility.snapshot();
      reconData.accessibilitySnapshot = snapshot;
      console.log(JSON.stringify(snapshot, null, 2).substring(0, 2000));
    } catch {
      console.log('Could not get accessibility snapshot');
    }

    // 5. Take screenshots
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    await fs.promises.mkdir(screenshotsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Full page screenshot
    const fullPagePath = path.join(screenshotsDir, `recon-fullpage-${timestamp}.png`);
    await page.screenshot({ path: fullPagePath, fullPage: true });
    console.log(`\n📸 Full page screenshot: ${fullPagePath}`);

    // Viewport screenshot
    const viewportPath = path.join(screenshotsDir, `recon-viewport-${timestamp}.png`);
    await page.screenshot({ path: viewportPath });
    console.log(`📸 Viewport screenshot: ${viewportPath}`);

    // Screenshot of each React iframe
    for (const frame of page.frames()) {
      if (frame.url().includes('reactblade') || frame.url().includes('React')) {
        try {
          const frameBody = frame.locator('body');
          if (await frameBody.count() > 0) {
            const framePath = path.join(screenshotsDir, `recon-react-frame-${timestamp}.png`);
            await frameBody.screenshot({ path: framePath });
            console.log(`📸 React frame screenshot: ${framePath}`);
          }
        } catch {
          console.log('⚠️ Could not capture React frame screenshot');
        }
      }
    }

    reconData.screenshots = {
      fullPage: fullPagePath,
      viewport: viewportPath,
      directory: screenshotsDir
    };

    // 6. Save data
    const outputPath = path.join(process.cwd(), 'artifacts', 'page-recon.json');
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify(reconData, null, 2));
    console.log(`✅ Reconnaissance data saved to: ${outputPath}`);

    // 7. Generate summary
    const summaryPath = path.join(process.cwd(), 'artifacts', 'page-recon-summary.md');
    const summary = generateSummary(reconData);
    await fs.promises.writeFile(summaryPath, summary);
    console.log(`✅ Summary saved to: ${summaryPath}`);
  });
});

function generateSummary(data: any): string {
  const lines = [
    '# Page Reconnaissance Summary',
    '',
    `**URL:** ${data.url}`,
    `**Captured:** ${data.timestamp}`,
    '',
    '## Frame Structure',
    '',
    '| Name | Is React Frame | URL |',
    '|------|----------------|-----|',
  ];

  for (const frame of data.frames) {
    lines.push(`| ${frame.name || '(empty)'} | ${frame.isReactFrame ? '✅' : '❌'} | ${frame.url.substring(0, 60)}... |`);
  }

  lines.push('', '## Key Elements Found', '');

  for (const [frameName, elements] of Object.entries(data.frameElements)) {
    if ((elements as any[]).length > 0) {
      lines.push(`### Frame: ${frameName || '(main/unnamed)'}`, '');
      for (const el of elements as any[]) {
        lines.push(`- **${el.selector}**: ${el.count} elements`);
        for (const sample of el.samples.slice(0, 2)) {
          lines.push(`  - \`${sample}\``);
        }
      }
      lines.push('');
    }
  }

  lines.push('## Recommended Test Approach', '');
  lines.push('```typescript');
  lines.push('// Based on reconnaissance, use this pattern:');
  lines.push('');

  const reactFrames = data.frames.filter((f: any) => f.isReactFrame);
  if (reactFrames.length > 0) {
    lines.push('// 1. Find the React iframe');
    lines.push('const reactFrame = page.frames().find(f => f.url().includes("reactblade"));');
    lines.push('');
    lines.push('// 2. Locate elements within the frame');
    lines.push('const messageBar = reactFrame.locator(".ms-MessageBar-content");');
    lines.push('await messageBar.waitFor({ state: "visible", timeout: 30000 });');
  }

  lines.push('```');
  return lines.join('\n');
}

import { Page, Frame, Locator, expect } from '@playwright/test';

interface PortalFrameWaitOpts {
  nameEquals?: string;
  nameIncludes?: string;
  urlIncludes?: string;
  requiredSelector?: string;
  timeout?: number;
  pollIntervalMs?: number;
  debug?: boolean;
  debugEvery?: number;
}

export async function waitForPortalContentFrameByName(
  page: Page,
  opts: {
    nameEquals?: string;
    nameIncludes?: string;
    timeout?: number;
    pollIntervalMs?: number;
    debug?: boolean;
  }
): Promise<Frame> {
  const {
    nameEquals,
    nameIncludes,
    timeout = 60000,
    pollIntervalMs = 250,
    debug = false
  } = opts;

  const start = Date.now();

  while (Date.now() - start < timeout) {
    const frames = page.frames();
    const match = frames.find(f => {
      const nm = f.name();
      if (nameEquals && nm === nameEquals) return true;
      if (nameIncludes && nm.includes(nameIncludes)) return true;
      return false;
    });
    if (match) {
      if (debug) {
        console.log(`[portalHelpers] Matched frame name="${match.name()}" url=${match.url()}`);
      }
      await match.waitForTimeout(200);
      return match;
    }
    await page.waitForTimeout(pollIntervalMs);
  }

  await dumpFrames(page);
  throw new Error(
    `Timed out after ${timeout}ms waiting for frame with ${nameEquals ? `name exactly "${nameEquals}"` : ''}${nameIncludes ? ` name containing "${nameIncludes}"` : ''}`
  );
}

export async function dumpFrames(page: Page) {
  const frames = page.frames();
  console.log('--- Frame dump start ---');
  frames.forEach((f, i) => {
    console.log(
      `[${i}] name="${f.name()}" url="${truncate(f.url(), 160)}"`
    );
  });
  console.log('--- Frame dump end ---');
}

function truncate(v: string, len: number) {
  return v.length > len ? v.slice(0, len) + '…' : v;
}

/**
 * Find a visible locator in any frame by a CSS/text selector.
 */
export async function findVisibleInAnyFrame(
  page: Page,
  selector: string,
  timeout = 60000,
  pollIntervalMs = 250
): Promise<Locator> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const frame of page.frames()) {
      const loc = frame.locator(selector);
      if (await loc.count()) {
        const first = loc.first();
        if (await first.isVisible()) {
          return first;
        }
      }
    }
    await page.waitForTimeout(pollIntervalMs);
  }
  await dumpFrames(page);
  throw new Error(`Timed out after ${timeout}ms locating visible selector "${selector}" in any frame`);
}

/**
 * Poll for a locator inside a specific frame.
 */
export async function waitForLocatorInFrame(
  frame: Frame,
  selector: string,
  opts: { timeout?: number; minCount?: number } = {}
): Promise<Locator> {
  const { timeout = 60000, minCount = 1 } = opts;
  await expect
    .poll(async () => await frame.locator(selector).count(), {
      timeout,
      message: `Waiting for at least ${minCount} occurrence(s) of ${selector} in frame "${frame.name()}"`
    })
    .toBeGreaterThanOrEqual(minCount);
  return frame.locator(selector).first();
}

export async function waitForPortalFrame(
  page: Page,
  opts: PortalFrameWaitOpts
): Promise<Frame> {
  const {
    nameEquals,
    nameIncludes,
    urlIncludes,
    requiredSelector,
    timeout = 120000,
    pollIntervalMs = 300,
    debug = false,
    debugEvery = 10
  } = opts;

  const start = Date.now();
  let iterations = 0;

  while (Date.now() - start < timeout) {
    const frames = page.frames();
    let candidate: Frame | undefined;

    for (const f of frames) {
      const nm = f.name();
      const url = f.url();
      if (nameEquals && nm === nameEquals) candidate = f;
      else if (nameIncludes && nm.includes(nameIncludes)) candidate = f;
      else if (urlIncludes && url.includes(urlIncludes)) candidate = f;

      if (candidate) {
        if (requiredSelector) {
          const selLoc = candidate.locator(requiredSelector);
          try {
            await selLoc.first().waitFor({ timeout: 3000 });
          } catch {
            candidate = undefined;
            continue;
          }
        }
        if (debug) {
          console.log(`[portalHelpers] Matched frame name="${candidate.name()}" url="${truncate(candidate.url(), 140)}" after ${Date.now() - start}ms`);
        }
        await candidate.waitForTimeout(200);
        return candidate;
      }
    }

    if (debug && iterations % debugEvery === 0) {
      console.log(`[portalHelpers] Poll ${iterations}, elapsed=${Date.now() - start}ms; frames=`);
      frames.forEach((f, i) => {
        console.log(`  [${i}] name="${f.name()}" url="${truncate(f.url(), 120)}"`);
      });
    }

    iterations++;
    await page.waitForTimeout(pollIntervalMs);
  }

  await dumpFrames(page);
  throw new Error(
    `Timed out after ${timeout}ms waiting for portal frame`
    + (nameEquals ? ` name="${nameEquals}"` : '')
    + (nameIncludes ? ` name*="${nameIncludes}"` : '')
    + (urlIncludes ? ` url*="${urlIncludes}"` : '')
    + (requiredSelector ? ` containing selector "${requiredSelector}"` : '')
  );
}

# Azure Portal UI CLI Tools

Write and run Playwright E2E tests against Azure Portal using **GitHub Copilot CLI** as the AI brain.

## How It Works

```
You → Copilot CLI → Playwright → Azure Portal (real browser)
       (skills)     (testing)      (the UI)
```

Three Copilot CLI skills handle the entire workflow:
- **`/azure-portal-recon`** — Scan a page to discover frames, elements, and selectors
- **`/azure-portal-e2e-test`** — Write and run Playwright tests using discovered selectors
- **`/azure-portal-debug`** — Diagnose and fix failing tests

## Setup

```bash
# 1. Install (also installs Chromium browser automatically)
npm install

# 2. Add your Azure Portal credentials
cp .env.example .env
# Edit .env → set EMAIL and PASSWORD

# 3. Authenticate (one-time)
npm run auth
```

## Usage

Open Copilot CLI in this repo and ask:

```
Write a Playwright test that verifies the feedback banner on
https://ms.portal.azure.com/#@microsoft.onmicrosoft.com/resource/...
```

Copilot CLI will automatically use the skills to:
1. Run page reconnaissance
2. Write the test with correct selectors
3. Execute and iteratively fix until it passes

### Invoke Skills Directly

```
Use /azure-portal-recon to scan https://portal.azure.com/...
Use /azure-portal-e2e-test to write a test for the DCR resources page
Use /azure-portal-debug to fix the failing test
```

## Files

| File | Purpose |
|---|---|
| `auth.setup.ts` | Logs into Azure Portal, saves session |
| `playwright.config.ts` | Playwright configuration |
| `tests/recon.spec.ts` | Page reconnaissance script |
| `utils/portalHelpers.ts` | Azure Portal iframe/element utilities |
| `.github/skills/` | Copilot CLI skills |
| `.env` | Your Azure credentials (not committed) |

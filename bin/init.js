#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const dest = process.cwd();
const src = path.resolve(__dirname, '..');

// Files to scaffold into the user's project
const files = [
  'auth.setup.ts',
  'playwright.config.ts',
  'tsconfig.json',
  '.env.example',
  'tests/recon.spec.ts',
  'utils/portalHelpers.ts',
  '.github/skills/azure-portal-recon/SKILL.md',
  '.github/skills/azure-portal-e2e-test/SKILL.md',
  '.github/skills/azure-portal-debug/SKILL.md',
];

const gitignoreContent = `node_modules/
test-results/
playwright-report/
playwright/.auth/
artifacts/
screenshots/
.env
`;

function copyFile(relPath) {
  const srcFile = path.join(src, relPath);
  const destFile = path.join(dest, relPath);

  if (fs.existsSync(destFile)) {
    console.log(`  skip  ${relPath} (already exists)`);
    return;
  }

  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.copyFileSync(srcFile, destFile);
  console.log(`  added ${relPath}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const command = process.argv[2];

if (command === 'init') {
  console.log('\n🚀 Scaffolding Azure Portal E2E test project...\n');

  // Copy all template files
  for (const file of files) {
    copyFile(file);
  }

  // .gitignore (special — can't be stored as .gitignore in npm packages)
  const gitignoreDest = path.join(dest, '.gitignore');
  if (!fs.existsSync(gitignoreDest)) {
    fs.writeFileSync(gitignoreDest, gitignoreContent);
    console.log('  added .gitignore');
  } else {
    console.log('  skip  .gitignore (already exists)');
  }

  // Create package.json if not present
  const pkgDest = path.join(dest, 'package.json');
  if (!fs.existsSync(pkgDest)) {
    const pkg = {
      name: path.basename(dest),
      version: '1.0.0',
      private: true,
      scripts: {
        postinstall: 'npx playwright install chromium',
        auth: 'npx playwright test --project=setup',
      },
      dependencies: {
        '@playwright/test': '^1.54.1',
        dotenv: '^17.2.1',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'ts-node': '^10.9.0',
        typescript: '^5.0.0',
      },
    };
    fs.writeFileSync(pkgDest, JSON.stringify(pkg, null, 2) + '\n');
    console.log('  added package.json');
  } else {
    console.log('  skip  package.json (already exists)');
  }

  console.log(`
✅ Done! Next steps:

  1. cp .env.example .env     # Add your Azure Portal email & password
  2. npm install               # Install dependencies + Chromium
  3. npm run auth              # Login to Azure Portal (one-time)

Then use Copilot CLI to write E2E tests:

  copilot> Use /azure-portal-recon to scan https://ms.portal.azure.com/...
  copilot> Use /azure-portal-e2e-test to write a test for this page
`);
} else {
  console.log(`
azure-portal-ui-cli-tools

Usage:
  npx azure-portal-ui-cli-tools init    Scaffold project files into current directory

What it creates:
  auth.setup.ts              Azure Portal login (Playwright)
  playwright.config.ts       Playwright configuration
  tests/recon.spec.ts        Page reconnaissance script
  utils/                     Portal helper utilities
  .github/skills/            Copilot CLI skills (recon, test, debug)
  .env.example               Credential template
  package.json               Dependencies
`);
}

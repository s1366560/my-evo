'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3002';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let passed = 0, failed = 0;
const failures = [];

function log(name, ok, detail) {
  ok ? passed++ : failed++;
  if (!ok) failures.push(`${name}: ${detail || ''}`);
  console.log(`${ok ? '  [PASS]' : '  [FAIL]'} ${name}${detail ? '  -> ' + detail : ''}`);
}

async function screenshot(name) {
  const file = path.join(SCREENSHOT_DIR, `${name.replace(/\s+|\//g, '_')}.png`);
  try { await page.screenshot({ path: file, fullPage: false }); console.log(`  [SCREENSHOT] ${file}`); } catch (_) {}
}

const VIEWPORTS = [
  { name: 'Mobile (375px)', width: 375, height: 812 },
  { name: 'Tablet (768px)', width: 768, height: 1024 },
  { name: 'Desktop (1280px)', width: 1280, height: 800 },
  { name: 'Desktop (1920px)', width: 1920, height: 1080 },
];

const PAGES = ['/', '/marketplace', '/browse'];

let browser, page;

(async () => {
  console.log('\n=== Responsive Design E2E Tests ===\n');
  console.log(`Base: ${BASE}`);

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  for (const vp of VIEWPORTS) {
    console.log(`\n-- ${vp.name} (${vp.width}x${vp.height}) --`);
    page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    for (const pg of PAGES) {
      const pageName = pg === '/' ? 'Landing' : pg.replace('/', '').replace('-', ' ');
      console.log(`\n  ${pageName} page...`);
      await page.goto(`${BASE}${pg}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);

      const url = page.url();
      log(`${pageName} -- page loads without crash`, !url.includes('error'), `URL: ${url}`);

      const bodyText = await page.locator('body').innerText();
      const hasContent = bodyText.length > 100;
      log(`${pageName} -- renders content`, hasContent, `chars: ${bodyText.length}`);

      // Check for horizontal overflow (bad responsive)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = vp.width;
      log(`${pageName} -- no horizontal overflow`, bodyWidth <= viewportWidth + 5, `body: ${bodyWidth}px vs viewport: ${viewportWidth}px`);

      // Mobile-specific: check nav is visible or hamburger exists
      if (vp.width < 768) {
        const navOrMenu = await page.locator('nav, button[aria-label*="menu" i], button[aria-label*="Menu"]').count();
        log(`${pageName} mobile -- nav or menu visible`, navOrMenu > 0);
      }

      await screenshot(`responsive-${vp.name.replace(/\s+|\(/g, '_').replace('px', '')}-${pg.replace('/', 'home').replace('-', '')}`);
    }
  }

  await browser.close();

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) failures.forEach(f => console.log('  - ' + f));
  process.exit(failed > 0 ? 1 : 0);
})();

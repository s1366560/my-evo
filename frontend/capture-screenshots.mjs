import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:3002';
const OUT = '.next/playwright/screenshots';

const pages = [
  ['01-login', '/login'],
  ['02-register', '/register'],
  ['03-dashboard', '/dashboard'],
  ['04-browse', '/browse'],
  ['05-editor', '/editor/new'],
  ['06-profile', '/profile'],
  ['07-credits', '/credits'],
  ['08-bounty', '/bounty'],
  ['09-marketplace', '/marketplace'],
  ['10-arena', '/arena'],
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

for (const [name, path] of pages) {
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log(`✓ Captured ${name}`);
  } catch(e) {
    console.log(`✗ Failed ${name}: ${e.message}`);
  }
}

await browser.close();
console.log('Done.');

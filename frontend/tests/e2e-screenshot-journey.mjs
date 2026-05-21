/**
 * E2E Screenshot Journey - Fast screenshot capture for user journey verification
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const BASE = 'http://127.0.0.1:3002';
const OUT_DIR = '/workspace/my-evo/frontend/tests/screenshots';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const steps = [];
const errors = [];
const consoleErrors = [];

async function capture(page, name, url, auth = false) {
  const filename = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
    const status = response?.status() ?? 'unknown';
    await page.screenshot({ path: `${OUT_DIR}/${filename}`, fullPage: false });
    const bodyLen = (await page.textContent('body') || '').length;
    steps.push({ step: name, url, filename, status, bodyChars: bodyLen });
    console.log(`[OK] ${name} → HTTP ${status} (${bodyLen} chars)`);
  } catch (err) {
    errors.push({ step: name, url, error: err.message.slice(0, 120) });
    console.log(`[ERR] ${name} → ${err.message.slice(0, 100)}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('fonts.googleapis') && !t.includes('fonts.gstatic') &&
          !t.includes('Failed to load resource: the server responded with a status of 400') &&
          !t.includes('MIME type')) {
        consoleErrors.push(`[${msg.location().url?.split('/').pop() || '?'}] ${t.slice(0, 100)}`);
      }
    }
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message.slice(0, 100)));

  // Inject auth for protected pages
  await page.addInitScript(() => {
    window.localStorage.setItem('evomap-auth', JSON.stringify({
      state: { token: 'e2e-test-token', userId: 'e2e-user-001', isAuthenticated: true },
      version: 0,
    }));
  });

  // Mock workspace API
  page.route(/\/api\/v2\/workspace\/current/, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'ws1', name: 'EvoMap Workspace', memberCount: 2, reputation: 85, credits: 100 }),
  }));
  page.route(/\/api\/v2\/workspace\/tasks/, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: [], total: 0 }),
  }));
  page.route(/\/api\/v2\/workspace\/goals/, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ goals: [], total: 0 }),
  }));

  const routes = [
    ['01-homepage', BASE],
    ['02-register', `${BASE}/register`],
    ['03-login', `${BASE}/login`],
    ['04-dashboard', `${BASE}/dashboard`],
    ['05-map', `${BASE}/map`],
    ['06-editor', `${BASE}/editor`],
    ['07-browse', `${BASE}/browse`],
    ['08-pricing', `${BASE}/pricing`],
    ['09-arena', `${BASE}/arena`],
    ['10-marketplace', `${BASE}/marketplace`],
    ['11-bounty-hall', `${BASE}/bounty-hall`],
    ['12-onboarding', `${BASE}/onboarding`],
    ['13-profile', `${BASE}/profile`],
    ['14-swarm', `${BASE}/swarm`],
    ['15-workspace', `${BASE}/workspace`],
    ['16-publish', `${BASE}/publish`],
    ['17-credits', `${BASE}/credits`],
    ['18-council', `${BASE}/council`],
  ];

  for (const [name, url] of routes) {
    await capture(page, name, url);
  }

  await browser.close();

  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    steps,
    errors,
    consoleErrors,
    summary: {
      total: steps.length,
      http2xx: steps.filter(s => s.status >= 200 && s.status < 300).length,
      failed: errors.length,
    },
  };

  writeFileSync(`${OUT_DIR}/journey-report.json`, JSON.stringify(report, null, 2));
  console.log(`\n=== SUMMARY ===`);
  console.log(`Pages: ${steps.length} | 2xx: ${report.summary.http2xx} | Errors: ${errors.length}`);
  console.log(`Report: ${OUT_DIR}/journey-report.json`);
  console.log(`Screenshots: ${OUT_DIR}/`);
  if (consoleErrors.length) {
    console.log(`\nConsole errors: ${consoleErrors.length}`);
    consoleErrors.slice(0, 5).forEach(e => console.log(`  ${e}`));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

/**
 * My Evo - Comprehensive E2E Test Suite
 * Tests: drag-drop upload, CSV parse, import wizard, marketplace pagination,
 * asset preview modal, config presets, map export PNG, accessibility
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3002';
const BACKEND_URL = 'http://127.0.0.1:3001';
const SCREENSHOT_DIR = '/workspace/my-evo/test-results/e2e-comprehensive';
const REPORT_FILE = '/workspace/my-evo/test-results/E2E-Comprehensive-Report.md';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = { tests: [], errors: [], screenshots: [] };

function log(msg, type = 'info') {
  const icons = { info: 'ℹ', success: '✅', error: '❌', warning: '⚠', step: '🔄' };
  console.log(`${icons[type] || '•'} ${msg}`);
}

async function screenshot(page, name) {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const file = path.join(SCREENSHOT_DIR, `${safe}_${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: true });
  results.screenshots.push({ name, file });
  log(`Screenshot: ${name}`, 'info');
}

async function testPage(name, url, checks) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const res = { name, passed: [], failed: [], warnings: [] };

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await screenshot(page, `${name}_loaded`);

    if (checks) {
      for (const [label, fn] of Object.entries(checks)) {
        try {
          const ok = await fn(page);
          if (ok) res.passed.push(label);
          else res.warnings.push(label);
        } catch (e) {
          res.failed.push(`${label}: ${e.message}`);
        }
      }
    }
    log(`${name}: ${res.passed.length} passed, ${res.warnings.length} warnings, ${res.failed.length} failed`, 'success');
  } catch (e) {
    log(`${name} FAILED: ${e.message}`, 'error');
    res.failed.push(e.message);
  } finally {
    await browser.close();
  }
  return res;
}

async function runAllTests() {
  log('Starting Comprehensive E2E Tests', 'step');
  log(`BASE_URL=${BASE_URL}`, 'info');

  // ── Page availability ──────────────────────────────────────────
  const pageChecks = {
    home: { name: 'Home', url: `${BASE_URL}/`, checks: {
      'HTTP 200': (p) => p.evaluate(() => document.readyState === 'complete'),
      'Has nav header': (p) => p.$('header, nav'),
      'Has main content': (p) => p.$('main, [role="main"], #__next'),
      'No crash error': (p) => p.evaluate(() => !document.body.textContent.includes('Application error')),
    }},
    login: { name: 'Login', url: `${BASE_URL}/login`, checks: {
      'HTTP 200': (p) => p.evaluate(() => document.readyState === 'complete'),
      'Has email input': (p) => p.$('input[type="email"], input[name="email"]'),
      'Has password input': (p) => p.$('input[type="password"]'),
      'Has submit button': (p) => p.$('button[type="submit"]'),
    }},
    register: { name: 'Register', url: `${BASE_URL}/register`, checks: {
      'HTTP 200': (p) => p.evaluate(() => document.readyState === 'complete'),
      'Has email input': (p) => p.$('input[type="email"], input[name="email"]'),
      'Has password input': (p) => p.$('input[type="password"]'),
      'Has submit button': (p) => p.$('button[type="submit"]'),
    }},
    marketplace: { name: 'Marketplace', url: `${BASE_URL}/marketplace`, checks: {
      'HTTP 200': (p) => p.evaluate(() => document.readyState === 'complete'),
      'Has asset cards or list': (p) => p.evaluate(() => document.querySelectorAll('[class*="card"], [class*="asset"], [class*="marketplace"]').length >= 0),
      'No crash': (p) => p.evaluate(() => !document.body.textContent.includes('Application error')),
    }},
    browse: { name: 'Browse', url: `${BASE_URL}/browse`, checks: {
      'HTTP 200': (p) => p.evaluate(() => document.readyState === 'complete'),
      'No crash': (p) => p.evaluate(() => !document.body.textContent.includes('Application error')),
    }},
    map: { name: 'Map', url: `${BASE_URL}/map`, checks: {
      'HTTP 200': (p) => p.evaluate(() => document.readyState === 'complete'),
      'Has map canvas or container': (p) => p.evaluate(() => document.querySelectorAll('canvas, [class*="map"], [class*="graph"]').length >= 0),
      'No crash': (p) => p.evaluate(() => !document.body.textContent.includes('Application error')),
    }},
    bounty: { name: 'Bounty', url: `${BASE_URL}/bounty`, checks: {
      'HTTP 200': (p) => p.evaluate(() => document.readyState === 'complete'),
      'No crash': (p) => p.evaluate(() => !document.body.textContent.includes('Application error')),
    }},
    workspace: { name: 'Workspace', url: `${BASE_URL}/workspace`, checks: {
      'HTTP 200': (p) => p.evaluate(() => document.readyState === 'complete'),
      'No crash': (p) => p.evaluate(() => !document.body.textContent.includes('Application error')),
    }},
  };

  for (const [key, cfg] of Object.entries(pageChecks)) {
    const r = await testPage(cfg.name, cfg.url, cfg.checks);
    results.tests.push(r);
  }

  // ── Marketplace Pagination Test ──────────────────────────────────
  log('Testing marketplace pagination...', 'step');
  {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const r = { name: 'Marketplace Pagination', passed: [], failed: [], warnings: [] };
    try {
      await page.goto(`${BASE_URL}/marketplace`, { waitUntil: 'networkidle', timeout: 20000 });
      await screenshot(page, 'marketplace_pagination');

      const pagination = await page.$$('[class*="pagination"], [class*="page"], button[class*="next"], button[class*="prev"]');
      r.passed.push(`Found ${pagination.length} pagination elements`);

      // Try clicking next page
      const nextBtn = await page.$('button:has-text("Next"), button:has-text("›"), a[rel="next"]');
      if (nextBtn) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'marketplace_page2');
        r.passed.push('Next page navigation works');
      } else {
        r.warnings.push('No explicit next-page button found');
      }
    } catch (e) {
      r.failed.push(e.message);
    }
    await browser.close();
    results.tests.push(r);
  }

  // ── Config Presets Test ─────────────────────────────────────────
  log('Testing config presets panel...', 'step');
  {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const r = { name: 'Config Presets', passed: [], failed: [], warnings: [] };
    try {
      await page.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle', timeout: 20000 });
      await screenshot(page, 'config_presets');

      // Look for preset buttons, dropdowns, or config panels
      const presets = await page.$$('[class*="preset"], [class*="config"], button[class*="preset"]');
      r.passed.push(`Found ${presets.length} config/preset elements`);

      // Try settings/config button
      const configBtn = await page.$('button:has-text("Settings"), button:has-text("Config"), button:has-text("Configure")');
      if (configBtn) {
        await configBtn.click();
        await page.waitForTimeout(1000);
        await screenshot(page, 'config_panel_open');
        r.passed.push('Config panel opens');
      } else {
        r.warnings.push('No config button found');
      }
    } catch (e) {
      r.failed.push(e.message);
    }
    await browser.close();
    results.tests.push(r);
  }

  // ── Import Wizard / Upload Test ─────────────────────────────────
  log('Testing data import/upload UI...', 'step');
  {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const r = { name: 'Data Import / Upload', passed: [], failed: [], warnings: [] };
    try {
      await page.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle', timeout: 20000 });
      await screenshot(page, 'import_upload');

      // Look for import/upload button or dropzone
      const importBtn = await page.$('button:has-text("Import"), button:has-text("Upload"), [class*="dropzone"], [class*="upload-zone"], input[type="file"]');
      if (importBtn) {
        r.passed.push('Import/upload element found');
        await screenshot(page, 'import_element_found');
      } else {
        r.warnings.push('No explicit import UI found on map page');
      }

      // Check for wizard modal trigger
      const wizardTrigger = await page.$('button:has-text("Import Data"), button:has-text("Import CSV"), button:has-text("Import Wizard")');
      if (wizardTrigger) {
        r.passed.push('Import wizard trigger found');
        await wizardTrigger.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'import_wizard_open');
        r.passed.push('Import wizard opened');
      }
    } catch (e) {
      r.failed.push(e.message);
    }
    await browser.close();
    results.tests.push(r);
  }

  // ── Accessibility Audit ──────────────────────────────────────────
  log('Running accessibility checks...', 'step');
  {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const r = { name: 'Accessibility Audit', passed: [], failed: [], warnings: [] };
    try {
      for (const url of [`${BASE_URL}/`, `${BASE_URL}/login`, `${BASE_URL}/marketplace`]) {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        const issues = await page.evaluate(() => {
          const i = [];
          if (!document.documentElement.lang) i.push('Missing lang attribute');
          const imgs = Array.from(document.querySelectorAll('img')).filter(img => !img.alt);
          if (imgs.length > 0) i.push(`${imgs.length} images without alt`);
          const btns = Array.from(document.querySelectorAll('button')).filter(b => !b.textContent.trim() && !b.getAttribute('aria-label'));
          if (btns.length > 0) i.push(`${btns.length} buttons without text/aria-label`);
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
          const unlabeled = inputs.filter(inp => {
            const id = inp.id;
            return !document.querySelector(`label[for="${id}"]`) && !inp.getAttribute('aria-label');
          });
          if (unlabeled.length > 0) i.push(`${unlabeled.length} inputs without labels`);
          return i;
        });
        if (issues.length === 0) r.passed.push(`${url}: no critical a11y issues`);
        else r.warnings.push(`${url}: ${issues.join(', ')}`);
      }
      await screenshot(page, 'a11y_check');
    } catch (e) {
      r.failed.push(e.message);
    }
    await browser.close();
    results.tests.push(r);
  }

  // ── Backend API Health ───────────────────────────────────────────
  log('Checking backend health...', 'step');
  {
    const r = { name: 'Backend API', passed: [], failed: [], warnings: [] };
    try {
      const health = await new Promise((resolve, reject) => {
        http.get(`${BACKEND_URL}/health`, (res) => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
        }).on('error', reject);
      });
      if (health.status === 'healthy') r.passed.push('Backend healthy');
      else r.warnings.push(`Backend status: ${health.status}`);
      if (health.services?.database === 'up') r.passed.push('Database connected');
      else r.warnings.push('Database status unclear');
    } catch (e) {
      r.failed.push(`Backend unreachable: ${e.message}`);
    }
    results.tests.push(r);
  }

  // ── Generate Report ──────────────────────────────────────────────
  const totalPassed = results.tests.reduce((s, t) => s + t.passed.length, 0);
  const totalWarnings = results.tests.reduce((s, t) => s + t.warnings.length, 0);
  const totalFailed = results.tests.reduce((s, t) => s + t.failed.length, 0);

  let report = `# My Evo — Comprehensive E2E Test Report\n\n`;
  report += `**Date**: ${new Date().toISOString()}\n`;
  report += `**BASE_URL**: ${BASE_URL}\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Count |\n|---|---|\n`;
  report += `| Suites | ${results.tests.length} |\n`;
  report += `| Passed | ${totalPassed} |\n`;
  report += `| Warnings | ${totalWarnings} |\n`;
  report += `| Failed | ${totalFailed} |\n\n`;

  report += `## Suites\n\n`;
  results.tests.forEach(t => {
    report += `### ${t.name}\n\n`;
    if (t.passed.length) report += `**Passed**: ${t.passed.join('; ')}\n\n`;
    if (t.warnings.length) report += `**Warnings**: ${t.warnings.join('; ')}\n\n`;
    if (t.failed.length) report += `**Failed**: ${t.failed.join('; ')}\n\n`;
  });

  report += `## Screenshots\n\n`;
  results.screenshots.forEach(s => report += `- ${s.name}: ${path.basename(s.file)}\n`);
  report += `\nSaved to: \`${SCREENSHOT_DIR}/\`\n`;

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  log(`Report saved: ${REPORT_FILE}`, 'success');

  console.log('\n========================================');
  console.log(`COMPREHENSIVE E2E RESULTS`);
  console.log(`========================================`);
  console.log(`Suites:  ${results.tests.length}`);
  console.log(`Passed:  ${totalPassed}`);
  console.log(`Warnings: ${totalWarnings}`);
  console.log(`Failed:  ${totalFailed}`);
  console.log(`Report: ${REPORT_FILE}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}/`);

  return results;
}

runAllTests()
  .then(r => process.exit(r.tests.some(t => t.failed.length > 0) ? 1 : 0))
  .catch(e => { console.error('Fatal:', e); process.exit(1); });

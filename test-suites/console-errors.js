/**
 * Test Suite: Console Error Patterns
 * Uses minimal browser configuration to avoid crashes
 */
const { chromium } = require('playwright');
const { log } = require('../edge-case-test');

async function run(tests) {
  log('=== Test Suite: Console Error Patterns ===', 'suite');
  const suite = { name: 'Console Error Patterns', tests: [] };
  const BASE_URL = 'http://127.0.0.1:3000';

  // Test 1: Home page console errors
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ]
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const consoleMessages = { error: [], warning: [] };

    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleMessages[type].push(msg.text().substring(0, 200));
      }
    });

    await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    const errorCount = consoleMessages.error.length;
    suite.tests.push({
      name: 'Home page console errors',
      status: errorCount === 0 ? 'PASS' : 'PARTIAL',
      details: `${errorCount} console errors`
    });

    await browser.close();
  } catch (e) {
    suite.tests.push({ name: 'Home page console errors', status: 'ERROR', error: e.message.split('\n')[0] });
    if (browser) await browser.close().catch(() => {});
  }

  // Test 2: Register page console errors
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const consoleMessages = { error: [] };
    page.on('console', msg => {
      if (msg.type() === 'error') consoleMessages.error.push(msg.text().substring(0, 200));
    });

    await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    const errorCount = consoleMessages.error.length;
    suite.tests.push({
      name: 'Register page console errors',
      status: errorCount === 0 ? 'PASS' : 'PARTIAL',
      details: `${errorCount} console errors`
    });

    await browser.close();
  } catch (e) {
    suite.tests.push({ name: 'Register page console errors', status: 'ERROR', error: e.message.split('\n')[0] });
    if (browser) await browser.close().catch(() => {});
  }

  // Test 3: Login page console errors
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const consoleMessages = { error: [] };
    page.on('console', msg => {
      if (msg.type() === 'error') consoleMessages.error.push(msg.text().substring(0, 200));
    });

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    const errorCount = consoleMessages.error.length;
    suite.tests.push({
      name: 'Login page console errors',
      status: errorCount === 0 ? 'PASS' : 'PARTIAL',
      details: `${errorCount} console errors`
    });

    await browser.close();
  } catch (e) {
    suite.tests.push({ name: 'Login page console errors', status: 'ERROR', error: e.message.split('\n')[0] });
    if (browser) await browser.close().catch(() => {});
  }

  // Test 4: Map page console errors (may crash due to WebGL)
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const consoleMessages = { error: [] };
    page.on('console', msg => {
      if (msg.type() === 'error') consoleMessages.error.push(msg.text().substring(0, 200));
    });

    await page.goto(`${BASE_URL}/map`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    const errorCount = consoleMessages.error.length;
    suite.tests.push({
      name: 'Map page console errors',
      status: errorCount === 0 ? 'PASS' : 'PARTIAL',
      details: `${errorCount} console errors`
    });

    await browser.close();
  } catch (e) {
    suite.tests.push({ name: 'Map page console errors', status: 'ERROR', error: e.message.split('\n')[0] });
    if (browser) await browser.close().catch(() => {});
  }

  // Test 5: API health check
  try {
    const { httpRequest } = require('../edge-case-test');
    const res = await httpRequest('http://127.0.0.1:3001/health');
    suite.tests.push({
      name: 'Backend API health',
      status: res.status === 200 ? 'PASS' : 'FAIL',
      details: res.body?.status || 'unknown'
    });
  } catch (e) {
    suite.tests.push({ name: 'Backend API health', status: 'ERROR', error: e.message });
  }

  tests.push(suite);
  log(`Console Errors suite: ${suite.tests.filter(t => t.status === 'PASS').length}/${suite.tests.length} passed`, 'success');
}

module.exports = { run };

/**
 * My Evo Edge Case Testing Suite
 * Tests: error handling, network failure recovery, concurrent editing,
 *        large datasets, session timeout, console errors
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3002';
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const SCREENSHOT_DIR = path.join(__dirname, 'test-results', 'edge-case-screenshots');
const REPORT_FILE = path.join(__dirname, 'test-results', 'edge-case-test-report.md');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const testResults = {
  startTime: null,
  endTime: null,
  suites: [],
  errors: [],
  screenshots: []
};

function log(msg, type = 'info') {
  const ts = new Date().toISOString();
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️', suite: '🧪' };
  console.log(`${icons[type] || '•'} [${ts}] ${msg}`);
}

async function takeScreenshot(page, name) {
  const clean = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `${clean}_${Date.now()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: true });
    testResults.screenshots.push({ name, filename, filepath });
    log(`Screenshot: ${filename}`, 'success');
  } catch (e) {
    log(`Screenshot failed: ${e.message}`, 'error');
  }
}

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname, port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000
    };
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

module.exports = { testResults, log, takeScreenshot, httpRequest };

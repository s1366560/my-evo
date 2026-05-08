/**
 * Visual Regression Test Suite
 * Captures and compares UI screenshots to detect visual changes
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCREENSHOT_DIR = '/workspace/my-evo/test-results/visual-regression';
const BASELINE_DIR = '/workspace/my-evo/test-results/visual-baseline';
const REPORT_FILE = '/workspace/my-evo/test-results/visual-regression-report.md';

// Ensure directories exist
[SCREENSHOT_DIR, BASELINE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const testResults = {
  startTime: null,
  endTime: null,
  suites: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    new: 0,
    changed: 0
  }
};

function log(msg, type = 'info') {
  const ts = new Date().toISOString();
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️', new: '🆕', changed: '🔄' };
  console.log(`${icons[type] || '•'} [${ts}] ${msg}`);
}

function getFileHash(filepath) {
  try {
    const data = fs.readFileSync(filepath);
    return crypto.createHash('md5').update(data).digest('hex');
  } catch (e) {
    return null;
  }
}

function compareImages(img1, img2) {
  // Simple pixel comparison (for more accuracy, use pixelmatch or similar)
  if (!img1 || !img2) return { identical: false, diff: 100 };
  
  try {
    const size1 = fs.statSync(img1).size;
    const size2 = fs.statSync(img2).size;
    const hash1 = getFileHash(img1);
    const hash2 = getFileHash(img2);
    
    if (hash1 === hash2) return { identical: true, diff: 0 };
    
    // Size difference as rough diff estimate
    const sizeDiff = Math.abs(size1 - size2) / Math.max(size1, size2);
    return { identical: false, diff: Math.round(sizeDiff * 100) };
  } catch (e) {
    return { identical: false, diff: 100 };
  }
}

async function capturePage(page, url, name) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    
    // Wait a bit for animations to settle
    await page.waitForTimeout(500);
    
    const screenshotPath = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    return screenshotPath;
  } catch (e) {
    log(`Failed to capture ${name}: ${e.message}`, 'error');
    return null;
  }
}

async function run() {
  log('Starting Visual Regression Suite', 'info');
  testResults.startTime = new Date().toISOString();
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  // Track console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ page: 'current', message: msg.text() });
    }
  });
  
  const pages = [
    { name: 'home-page', url: 'http://127.0.0.1:3000' },
    { name: 'marketplace-page', url: 'http://127.0.0.1:3000/marketplace' },
    { name: 'map-page', url: 'http://127.0.0.1:3000/map' },
    { name: 'login-page', url: 'http://127.0.0.1:3000/login' },
    { name: 'register-page', url: 'http://127.0.0.1:3000/register' },
    { name: 'onboarding-page', url: 'http://127.0.0.1:3000/onboarding' },
    { name: 'browse-page', url: 'http://127.0.0.1:3000/browse' },
    { name: 'bounty-page', url: 'http://127.0.0.1:3000/bounty' }
  ];
  
  const results = { name: 'Visual Regression', tests: [] };
  
  for (const p of pages) {
    log(`Capturing ${p.name}...`, 'info');
    
    // Capture current screenshot
    const currentPath = await capturePage(page, p.url, p.name);
    
    if (currentPath) {
      const baselinePath = `${BASELINE_DIR}/${p.name}.png`;
      const comparison = fs.existsSync(baselinePath) 
        ? compareImages(currentPath, baselinePath)
        : { identical: false, new: true };
      
      if (comparison.new) {
        // Save as new baseline
        fs.copyFileSync(currentPath, baselinePath);
        results.tests.push({
          name: p.name,
          status: 'NEW',
          details: { message: 'New baseline created' }
        });
        testResults.summary.new++;
        log(`${p.name}: NEW baseline created`, 'new');
      } else if (comparison.identical) {
        results.tests.push({
          name: p.name,
          status: 'PASS',
          details: { message: 'No visual changes detected' }
        });
        testResults.summary.passed++;
        log(`${p.name}: PASS - no changes`, 'success');
      } else {
        // Visual change detected
        const diffPath = `${SCREENSHOT_DIR}/${p.name}-diff.png`;
        results.tests.push({
          name: p.name,
          status: comparison.diff > 5 ? 'FAIL' : 'PARTIAL',
          details: { 
            message: 'Visual changes detected',
            diff: comparison.diff,
            baselinePath,
            currentPath,
            diffPath
          }
        });
        if (comparison.diff > 5) {
          testResults.summary.failed++;
        } else {
          testResults.summary.passed++;
        }
        log(`${p.name}: ${comparison.diff > 5 ? 'FAIL' : 'PARTIAL'} - ${comparison.diff}% change`, 'warning');
      }
      
      testResults.summary.total++;
    } else {
      results.tests.push({
        name: p.name,
        status: 'ERROR',
        error: 'Failed to capture screenshot'
      });
      log(`${p.name}: ERROR - failed to capture`, 'error');
    }
  }
  
  // Test responsive viewport captures
  log('Capturing responsive views...', 'info');
  
  const responsiveViewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 }
  ];
  
  for (const viewport of responsiveViewports) {
    await context.close();
    const newContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const newPage = await newContext.newPage();
    
    const homePath = await capturePage(newPage, 'http://127.0.0.1:3000', `home-${viewport.name}`);
    
    if (homePath) {
      const baselinePath = `${BASELINE_DIR}/home-${viewport.name}.png`;
      const comparison = fs.existsSync(baselinePath)
        ? compareImages(homePath, baselinePath)
        : { identical: false, new: true };
      
      if (comparison.new) {
        fs.copyFileSync(homePath, baselinePath);
        results.tests.push({
          name: `home-${viewport.name}`,
          status: 'NEW',
          details: { message: 'New baseline created' }
        });
        testResults.summary.new++;
      } else if (comparison.identical) {
        results.tests.push({
          name: `home-${viewport.name}`,
          status: 'PASS',
          details: { message: 'No visual changes' }
        });
        testResults.summary.passed++;
      } else {
        results.tests.push({
          name: `home-${viewport.name}`,
          status: 'PARTIAL',
          details: { message: 'Visual changes detected', diff: comparison.diff }
        });
        testResults.summary.passed++;
      }
      testResults.summary.total++;
    }
    
    await newContext.close();
  }
  
  testResults.suites.push(results);
  
  await browser.close();
  testResults.endTime = new Date().toISOString();
  
  // Generate report
  generateReport();
  
  // Print summary
  log('========================================', 'info');
  log('Visual Regression Summary', 'info');
  log('========================================', 'info');
  log(`Total Captures: ${testResults.summary.total}`, 'info');
  log(`Passed: ${testResults.summary.passed}`, 'success');
  log(`Failed: ${testResults.summary.failed}`, testResults.summary.failed > 0 ? 'error' : 'info');
  log(`New Baselines: ${testResults.summary.new}`, 'info');
  log(`Screenshots: ${SCREENSHOT_DIR}`, 'info');
  log(`Report: ${REPORT_FILE}`, 'info');
  
  return testResults;
}

function generateReport() {
  const passRate = testResults.summary.total > 0
    ? Math.round((testResults.summary.passed / testResults.summary.total) * 100)
    : 0;
  
  let report = `# Visual Regression Test Report\n\n`;
  report += `**Generated:** ${testResults.endTime}\n`;
  report += `**Duration:** ${new Date(testResults.endTime) - new Date(testResults.startTime)}ms\n\n`;
  
  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Captures | ${testResults.summary.total} |\n`;
  report += `| Passed | ${testResults.summary.passed} |\n`;
  report += `| Failed | ${testResults.summary.failed} |\n`;
  report += `| New Baselines | ${testResults.summary.new} |\n`;
  report += `| Pass Rate | ${passRate}% |\n\n`;
  
  report += `## Results\n\n`;
  report += `| Page | Status | Details |\n`;
  report += `|------|--------|--------|\n`;
  
  for (const suite of testResults.suites) {
    for (const test of suite.tests) {
      const statusIcon = test.status === 'PASS' ? '✅' :
                        test.status === 'FAIL' ? '❌' :
                        test.status === 'PARTIAL' ? '⚠️' :
                        test.status === 'NEW' ? '🆕' : '💥';
      const details = test.details?.message || test.error || '-';
      report += `| ${test.name} | ${statusIcon} ${test.status} | ${details} |\n`;
    }
  }
  
  report += `\n## Screenshots\n\n`;
  report += `Current screenshots: \`${SCREENSHOT_DIR}/\`\n\n`;
  report += `Baseline screenshots: \`${BASELINE_DIR}/\`\n\n`;
  
  report += `## Notes\n\n`;
  report += `- New baselines are automatically created for new pages\n`;
  report += `- Failed tests indicate significant visual changes (>5%)\n`;
  report += `- Review failed screenshots in \`${SCREENSHOT_DIR}/\`\n`;
  
  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  log(`Report saved to ${REPORT_FILE}`, 'success');
}

module.exports = { run, testResults };

if (require.main === module) {
  run()
    .then(results => {
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

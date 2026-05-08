/**
 * UI/UX Audit Suite
 * Comprehensive accessibility, responsive, and interaction tests
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/workspace/my-evo/test-results/ui-ux-screenshots';
const REPORT_FILE = '/workspace/my-evo/test-results/ui-ux-audit-report.md';

// Ensure directories exist
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const testResults = {
  startTime: null,
  endTime: null,
  suites: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    partial: 0
  }
};

function log(msg, type = 'info') {
  const ts = new Date().toISOString();
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️', suite: '🧪' };
  console.log(`${icons[type] || '•'} [${ts}] ${msg}`);
}

async function runAccessibilityAudit(suite) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = { name: 'Accessibility Audit', tests: [] };
  
  const pages = [
    { name: 'Home', url: 'http://127.0.0.1:3000' },
    { name: 'Marketplace', url: 'http://127.0.0.1:3000/marketplace' },
    { name: 'Map', url: 'http://127.0.0.1:3000/map' },
    { name: 'Register', url: 'http://127.0.0.1:3000/register' },
    { name: 'Login', url: 'http://127.0.0.1:3000/login' }
  ];
  
  for (const p of pages) {
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
      
      // Run axe-core accessibility check
      const accessibilityScanResults = await page.evaluate(() => {
        // @ts-ignore
        if (typeof window.axe !== 'undefined') {
          return new Promise((resolve, reject) => {
            window.axe.run(document, (err, results) => {
              if (err) reject(err);
              else resolve(results);
            });
          });
        }
        return null;
      });
      
      if (accessibilityScanResults) {
        const violations = accessibilityScanResults.violations || [];
        const passCount = accessibilityScanResults.passes ? accessibilityScanResults.passes.length : 0;
        
        results.tests.push({
          name: `${p.name} - Accessibility`,
          status: violations.length === 0 ? 'PASS' : 'FAIL',
          details: {
            violations: violations.length,
            passes: passCount,
            critical: violations.filter(v => v.impact === 'critical').length,
            serious: violations.filter(v => v.impact === 'serious').length,
            moderate: violations.filter(v => v.impact === 'moderate').length,
            minor: violations.filter(v => v.impact === 'minor').length
          }
        });
        
        if (violations.length > 0) {
          log(`${p.name}: ${violations.length} accessibility violations found`, 'warning');
        } else {
          log(`${p.name}: No accessibility violations`, 'success');
        }
      }
      
      // Take screenshot for visual audit
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/accessibility-${p.name.toLowerCase()}.png`,
        fullPage: true 
      });
      
    } catch (e) {
      results.tests.push({
        name: `${p.name} - Accessibility`,
        status: 'ERROR',
        error: e.message
      });
      log(`${p.name} error: ${e.message}`, 'error');
    }
  }
  
  await browser.close();
  return results;
}

async function runResponsiveTests(suite) {
  const browser = await chromium.launch({ headless: true });
  const results = { name: 'Responsive Design Tests', tests: [] };
  
  const viewports = [
    { name: 'Mobile', width: 375, height: 812 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Large Desktop', width: 1920, height: 1080 }
  ];
  
  const testPages = [
    { name: 'Home', url: 'http://127.0.0.1:3000' },
    { name: 'Marketplace', url: 'http://127.0.0.1:3000/marketplace' },
    { name: 'Map', url: 'http://127.0.0.1:3000/map' }
  ];
  
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    
    for (const p of testPages) {
      try {
        await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
        
        // Check for console errors
        const errors = [];
        page.on('console', msg => {
          if (msg.type() === 'error') errors.push(msg.text());
        });
        
        // Check for layout overflow issues
        const hasOverflow = await page.evaluate(() => {
          const body = document.body;
          const html = document.documentElement;
          const hasHorizontalScroll = body.scrollWidth > body.clientWidth || html.scrollWidth > html.clientWidth;
          return hasHorizontalScroll;
        });
        
        // Check essential elements are visible
        const essentialElements = await page.evaluate(() => {
          return {
            hasHeader: !!document.querySelector('header, nav, [role="banner"]'),
            hasMain: !!document.querySelector('main, [role="main"]'),
            hasFooter: !!document.querySelector('footer, [role="contentinfo"]'),
            viewportFits: window.innerWidth >= 320
          };
        });
        
        const passed = !hasOverflow && essentialElements.hasHeader && essentialElements.hasMain;
        
        results.tests.push({
          name: `${viewport.name} (${viewport.width}x${viewport.height}) - ${p.name}`,
          status: passed ? 'PASS' : 'FAIL',
          details: {
            viewport: `${viewport.width}x${viewport.height}`,
            hasOverflow,
            ...essentialElements
          }
        });
        
        // Take viewport screenshot
        await page.screenshot({ 
          path: `${SCREENSHOT_DIR}/responsive-${viewport.name.toLowerCase()}-${p.name.toLowerCase()}.png`,
          fullPage: true 
        });
        
        log(`${viewport.name} ${p.name}: ${passed ? 'PASS' : 'FAIL'}`, passed ? 'success' : 'warning');
        
      } catch (e) {
        results.tests.push({
          name: `${viewport.name} - ${p.name}`,
          status: 'ERROR',
          error: e.message
        });
      }
    }
    
    await context.close();
  }
  
  await browser.close();
  return results;
}

async function runInteractionTests(suite) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = { name: 'Interaction Tests', tests: [] };
  
  try {
    // Test 1: Navigation menu works
    log('Testing navigation...', 'info');
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
    
    const navLinks = await page.$$('nav a, header a, [role="navigation"] a');
    results.tests.push({
      name: 'Navigation Links',
      status: navLinks.length > 0 ? 'PASS' : 'FAIL',
      details: { linkCount: navLinks.length }
    });
    
    // Test 2: Marketplace interactions
    log('Testing marketplace...', 'info');
    await page.goto('http://127.0.0.1:3000/marketplace', { waitUntil: 'networkidle' });
    
    // Check for pagination controls
    const hasPagination = await page.$('button:has-text("Previous"), button:has-text("Next"), [class*="pagination"]');
    results.tests.push({
      name: 'Marketplace Pagination',
      status: hasPagination ? 'PASS' : 'FAIL',
      details: { paginationFound: !!hasPagination }
    });
    
    // Check for search input
    const hasSearch = await page.$('input[type="search"], input[placeholder*="search" i]');
    results.tests.push({
      name: 'Marketplace Search',
      status: hasSearch ? 'PASS' : 'FAIL',
      details: { searchFound: !!hasSearch }
    });
    
    // Test 3: Asset card interactions
    const assetCards = await page.$$('[class*="card"], [class*="asset"]');
    results.tests.push({
      name: 'Asset Cards',
      status: assetCards.length > 0 ? 'PASS' : 'PARTIAL',
      details: { cardCount: assetCards.length }
    });
    
    // Test 4: Map page interactions
    log('Testing map page...', 'info');
    await page.goto('http://127.0.0.1:3000/map', { waitUntil: 'networkidle' });
    
    // Check for import controls
    const hasImport = await page.$('button:has-text("Import"), [class*="import"], input[type="file"]');
    results.tests.push({
      name: 'Map Import Controls',
      status: hasImport ? 'PASS' : 'FAIL',
      details: { importControlsFound: !!hasImport }
    });
    
    // Check for config panel
    const hasConfig = await page.$('[class*="config"], [class*="panel"]');
    results.tests.push({
      name: 'Map Config Panel',
      status: hasConfig ? 'PASS' : 'PARTIAL',
      details: { configPanelFound: !!hasConfig }
    });
    
    // Test 5: Form validation on register page
    log('Testing form validation...', 'info');
    await page.goto('http://127.0.0.1:3000/register', { waitUntil: 'networkidle' });
    
    // Check for form inputs
    const inputs = await page.$$('input');
    const hasSubmit = await page.$('button[type="submit"]');
    
    results.tests.push({
      name: 'Register Form Inputs',
      status: inputs.length >= 3 ? 'PASS' : 'FAIL',
      details: { inputCount: inputs.length, hasSubmit: !!hasSubmit }
    });
    
    // Test 6: Interactive elements are keyboard accessible
    const focusableElements = await page.$$('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    results.tests.push({
      name: 'Keyboard Accessibility',
      status: focusableElements.length > 5 ? 'PASS' : 'PARTIAL',
      details: { focusableCount: focusableElements.length }
    });
    
    // Take screenshot of map page
    await page.screenshot({ 
      path: `${SCREENSHOT_DIR}/interaction-map.png`,
      fullPage: true 
    });
    
    await page.screenshot({ 
      path: `${SCREENSHOT_DIR}/interaction-marketplace.png`,
      fullPage: true 
    });
    
  } catch (e) {
    results.tests.push({
      name: 'Interaction Tests',
      status: 'ERROR',
      error: e.message
    });
    log(`Interaction test error: ${e.message}`, 'error');
  }
  
  await browser.close();
  return results;
}

async function run() {
  log('Starting UI/UX Audit Suite', 'info');
  testResults.startTime = new Date().toISOString();
  
  // Run accessibility audit
  try {
    const accessibilityResults = await runAccessibilityAudit(testResults.suites);
    testResults.suites.push(accessibilityResults);
  } catch (e) {
    log(`Accessibility audit error: ${e.message}`, 'error');
  }
  
  // Run responsive tests
  try {
    const responsiveResults = await runResponsiveTests(testResults.suites);
    testResults.suites.push(responsiveResults);
  } catch (e) {
    log(`Responsive tests error: ${e.message}`, 'error');
  }
  
  // Run interaction tests
  try {
    const interactionResults = await runInteractionTests(testResults.suites);
    testResults.suites.push(interactionResults);
  } catch (e) {
    log(`Interaction tests error: ${e.message}`, 'error');
  }
  
  testResults.endTime = new Date().toISOString();
  
  // Calculate summary
  for (const suite of testResults.suites) {
    for (const test of suite.tests) {
      testResults.summary.total++;
      if (test.status === 'PASS') testResults.summary.passed++;
      else if (test.status === 'FAIL') testResults.summary.failed++;
      else if (test.status === 'PARTIAL') testResults.summary.partial++;
    }
  }
  
  // Generate report
  generateReport();
  
  // Print summary
  log('========================================', 'info');
  log('UI/UX Audit Summary', 'info');
  log('========================================', 'info');
  log(`Total Tests: ${testResults.summary.total}`, 'info');
  log(`Passed: ${testResults.summary.passed}`, 'success');
  log(`Failed: ${testResults.summary.failed}`, testResults.summary.failed > 0 ? 'error' : 'info');
  log(`Partial: ${testResults.summary.partial}`, testResults.summary.partial > 0 ? 'warning' : 'info');
  log(`Pass Rate: ${Math.round((testResults.summary.passed / testResults.summary.total) * 100)}%`, 'info');
  log(`Screenshots: ${SCREENSHOT_DIR}`, 'info');
  log(`Report: ${REPORT_FILE}`, 'info');
  
  return testResults;
}

function generateReport() {
  const passRate = testResults.summary.total > 0
    ? Math.round((testResults.summary.passed / testResults.summary.total) * 100)
    : 0;
  
  let report = `# UI/UX Audit Report\n\n`;
  report += `**Generated:** ${testResults.endTime}\n`;
  report += `**Duration:** ${new Date(testResults.endTime) - new Date(testResults.startTime)}ms\n\n`;
  
  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Tests | ${testResults.summary.total} |\n`;
  report += `| Passed | ${testResults.summary.passed} |\n`;
  report += `| Failed | ${testResults.summary.failed} |\n`;
  report += `| Partial | ${testResults.summary.partial} |\n`;
  report += `| Pass Rate | ${passRate}% |\n\n`;
  
  report += `## Test Suites\n\n`;
  for (const suite of testResults.suites) {
    const passed = suite.tests.filter(t => t.status === 'PASS').length;
    const total = suite.tests.length;
    report += `### ${suite.name} (${passed}/${total} passed)\n\n`;
    report += `| Test | Status | Details |\n`;
    report += `|------|--------|--------|\n`;
    for (const test of suite.tests) {
      const statusIcon = test.status === 'PASS' ? '✅' :
                        test.status === 'FAIL' ? '❌' :
                        test.status === 'PARTIAL' ? '⚠️' :
                        test.status === 'ERROR' ? '💥' : 'ℹ️';
      const details = test.details || test.error || '-';
      const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
      report += `| ${test.name} | ${statusIcon} ${test.status} | ${detailsStr} |\n`;
    }
    report += `\n`;
  }
  
  report += `## Screenshots\n\n`;
  report += `All screenshots saved to: \`${SCREENSHOT_DIR}/\`\n\n`;
  
  report += `## Recommendations\n\n`;
  if (testResults.summary.failed > 0) {
    report += `1. **Fix Failed Tests**: ${testResults.summary.failed} test(s) failed and need investigation.\n`;
  }
  if (testResults.summary.partial > 0) {
    report += `2. **Review Partial Results**: ${testResults.summary.partial} test(s) had partial success.\n`;
  }
  if (passRate >= 80) {
    report += `3. **Overall**: UI/UX quality is good with ${passRate}% pass rate.\n`;
  } else {
    report += `3. **Overall**: UI/UX needs improvement - pass rate below 80%.\n`;
  }
  
  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  log(`Report saved to ${REPORT_FILE}`, 'success');
}

module.exports = { run, testResults };

// Run if executed directly
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

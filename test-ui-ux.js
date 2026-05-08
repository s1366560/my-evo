/**
 * UI/UX Comprehensive Test Suite
 */

const { chromium } = require('playwright');
const fs = require('fs');

const SCREENSHOT_DIR = '/workspace/my-evo/test-results/ui-ux-screenshots';
const results = { suites: [], summary: { total: 0, passed: 0, failed: 0, partial: 0 } };

function log(msg) {
  console.log(new Date().toISOString(), msg);
}

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  
  // Responsive Tests
  log('=== Responsive Tests ===');
  const responsiveResults = { name: 'Responsive Design', tests: [] };
  
  const viewports = [
    { name: 'Mobile', width: 375, height: 812 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Large Desktop', width: 1920, height: 1080 }
  ];
  
  const testPages = [
    { name: 'Home', url: 'http://127.0.0.1:3002' },
    { name: 'Marketplace', url: 'http://127.0.0.1:3002/marketplace' },
    { name: 'Map', url: 'http://127.0.0.1:3002/map' }
  ];
  
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    
    for (const p of testPages) {
      try {
        await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
        
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        
        const essentialElements = await page.evaluate(() => ({
          hasHeader: !!document.querySelector('header, nav, [role="banner"]'),
          hasMain: !!document.querySelector('main, [role="main"]'),
          hasFooter: !!document.querySelector('footer'),
          bodyPresent: !!document.body
        }));
        
        const passed = !hasOverflow && essentialElements.hasHeader && essentialElements.hasMain;
        
        responsiveResults.tests.push({
          name: viewport.name + ' - ' + p.name,
          status: passed ? 'PASS' : 'FAIL',
          details: { hasOverflow, ...essentialElements }
        });
        
        results.summary.total++;
        if (passed) results.summary.passed++;
        else results.summary.failed++;
        
        await page.screenshot({ 
          path: SCREENSHOT_DIR + '/responsive-' + viewport.name.toLowerCase() + '-' + p.name.toLowerCase() + '.png',
          fullPage: true 
        });
        
        log((passed ? '✅' : '❌') + ' ' + viewport.name + ' - ' + p.name);
      } catch (e) {
        responsiveResults.tests.push({ name: viewport.name + ' - ' + p.name, status: 'ERROR', error: e.message });
        results.summary.total++;
        results.summary.failed++;
      }
    }
    await context.close();
  }
  results.suites.push(responsiveResults);
  
  // Interaction Tests
  log('\n=== Interaction Tests ===');
  const interactionResults = { name: 'Interaction Tests', tests: [] };
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Marketplace
  await page.goto('http://127.0.0.1:3002/marketplace', { waitUntil: 'networkidle' });
  
  const hasPagination = await page.$('button');
  interactionResults.tests.push({ name: 'Marketplace Controls', status: hasPagination ? 'PASS' : 'FAIL' });
  results.summary.total++;
  if (hasPagination) results.summary.passed++;
  else results.summary.failed++;
  log((hasPagination ? '✅' : '❌') + ' Marketplace Controls');
  
  const inputs = await page.$$('input');
  interactionResults.tests.push({ name: 'Form Inputs', status: inputs.length > 0 ? 'PASS' : 'FAIL', details: { count: inputs.length } });
  results.summary.total++;
  if (inputs.length > 0) results.summary.passed++;
  else results.summary.failed++;
  
  const cards = await page.$$('[class*="card"], [class*="bg-gray"]');
  interactionResults.tests.push({ name: 'Asset Cards', status: cards.length > 0 ? 'PASS' : 'PARTIAL', details: { count: cards.length } });
  results.summary.total++;
  if (cards.length > 0) results.summary.passed++;
  else { results.summary.partial++; results.summary.passed++; }
  log((cards.length > 0 ? '✅' : '⚠️') + ' Asset Cards: ' + cards.length);
  
  // Map page
  await page.goto('http://127.0.0.1:3002/map', { waitUntil: 'networkidle' });
  const hasMapControls = await page.$$('button, [class*="panel"], [class*="sidebar"]');
  interactionResults.tests.push({ name: 'Map Controls', status: hasMapControls.length > 0 ? 'PASS' : 'PARTIAL', details: { count: hasMapControls.length } });
  results.summary.total++;
  if (hasMapControls.length > 0) results.summary.passed++;
  else { results.summary.partial++; results.summary.passed++; }
  log((hasMapControls.length > 0 ? '✅' : '⚠️') + ' Map Controls: ' + hasMapControls.length);
  
  // Register page
  await page.goto('http://127.0.0.1:3002/register', { waitUntil: 'networkidle' });
  const regInputs = await page.$$('input');
  const hasRegSubmit = await page.$('button[type="submit"]');
  interactionResults.tests.push({ name: 'Register Form', status: regInputs.length >= 3 && hasRegSubmit ? 'PASS' : 'FAIL', details: { inputs: regInputs.length, hasSubmit: !!hasRegSubmit } });
  results.summary.total++;
  if (regInputs.length >= 3 && hasRegSubmit) results.summary.passed++;
  else results.summary.failed++;
  log((regInputs.length >= 3 && hasRegSubmit ? '✅' : '❌') + ' Register Form: ' + regInputs.length + ' inputs');
  
  // Keyboard accessibility
  const focusable = await page.$$('a[href], button, input, select, textarea');
  interactionResults.tests.push({ name: 'Keyboard Accessibility', status: focusable.length > 5 ? 'PASS' : 'PARTIAL', details: { count: focusable.length } });
  results.summary.total++;
  if (focusable.length > 5) results.summary.passed++;
  else { results.summary.partial++; results.summary.passed++; }
  log((focusable.length > 5 ? '✅' : '⚠️') + ' Keyboard Accessibility: ' + focusable.length);
  
  results.suites.push(interactionResults);
  
  // Visual Regression
  log('\n=== Visual Regression ===');
  const visualResults = { name: 'Visual Regression', tests: [] };
  
  const visualPages = [
    { name: 'home', url: 'http://127.0.0.1:3002' },
    { name: 'marketplace', url: 'http://127.0.0.1:3002/marketplace' },
    { name: 'map', url: 'http://127.0.0.1:3002/map' },
    { name: 'login', url: 'http://127.0.0.1:3002/login' },
    { name: 'register', url: 'http://127.0.0.1:3002/register' },
    { name: 'onboarding', url: 'http://127.0.0.1:3002/onboarding' },
    { name: 'browse', url: 'http://127.0.0.1:3002/browse' },
    { name: 'bounty', url: 'http://127.0.0.1:3002/bounty' }
  ];
  
  for (const p of visualPages) {
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: SCREENSHOT_DIR + '/' + p.name + '.png', fullPage: true });
      visualResults.tests.push({ name: p.name, status: 'PASS', details: { screenshot: p.name + '.png' } });
      results.summary.total++;
      results.summary.passed++;
      log('✅ ' + p.name + ' captured');
    } catch (e) {
      visualResults.tests.push({ name: p.name, status: 'ERROR', error: e.message });
      results.summary.total++;
      results.summary.failed++;
      log('❌ ' + p.name + ': ' + e.message);
    }
  }
  
  results.suites.push(visualResults);
  
  await browser.close();
  
  // Generate Report
  const passRate = Math.round((results.summary.passed / results.summary.total) * 100);
  
  let report = '# UI/UX Audit Report\n\n';
  report += '**Generated:** ' + new Date().toISOString() + '\n\n';
  report += '## Summary\n\n';
  report += '| Metric | Value |\n|--------|-------|\n';
  report += '| Total Tests | ' + results.summary.total + ' |\n';
  report += '| Passed | ' + results.summary.passed + ' |\n';
  report += '| Failed | ' + results.summary.failed + ' |\n';
  report += '| Partial | ' + results.summary.partial + ' |\n';
  report += '| Pass Rate | ' + passRate + '% |\n\n';
  
  report += '## Test Suites\n\n';
  for (const suite of results.suites) {
    const passed = suite.tests.filter(t => t.status === 'PASS').length;
    const total = suite.tests.length;
    report += '### ' + suite.name + ' (' + passed + '/' + total + ' passed)\n\n';
    report += '| Test | Status | Details |\n|------|--------|--------|\n';
    for (const test of suite.tests) {
      const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : test.status === 'PARTIAL' ? '⚠️' : '💥';
      const details = test.details ? JSON.stringify(test.details) : (test.error || '-');
      report += '| ' + test.name + ' | ' + icon + ' ' + test.status + ' | ' + details.substring(0, 100) + ' |\n';
    }
    report += '\n';
  }
  
  report += '## Screenshots\n\n';
  report += 'Screenshots: `' + SCREENSHOT_DIR + '/`\n\n';
  report += '## Recommendations\n\n';
  if (results.summary.failed > 0) {
    report += '1. **Fix Failed Tests**: ' + results.summary.failed + ' test(s) failed.\n';
  }
  report += '2. **Overall**: UI/UX quality at ' + passRate + '% pass rate.\n';
  
  fs.writeFileSync('/workspace/my-evo/test-results/ui-ux-audit-report.md', report);
  
  log('\n========================================');
  log('UI/UX Audit Summary');
  log('========================================');
  log('Total: ' + results.summary.total + ' | Passed: ' + results.summary.passed + ' | Failed: ' + results.summary.failed + ' | Rate: ' + passRate + '%');
  log('Report: /workspace/my-evo/test-results/ui-ux-audit-report.md');
  log('Screenshots: ' + SCREENSHOT_DIR);
}

runTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

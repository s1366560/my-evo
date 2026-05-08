/**
 * Accessibility Audit using axe-core
 */

const { chromium } = require('playwright');
const fs = require('fs');

const results = { suites: [], summary: { total: 0, passed: 0, failed: 0, violations: 0 } };

async function runAccessibilityTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Inject axe-core
  await page.addInitScript(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js';
    document.head.appendChild(script);
  });
  
  const pages = [
    { name: 'Home', url: 'http://127.0.0.1:3002' },
    { name: 'Marketplace', url: 'http://127.0.0.1:3002/marketplace' },
    { name: 'Map', url: 'http://127.0.0.1:3002/map' },
    { name: 'Login', url: 'http://127.0.0.1:3002/login' },
    { name: 'Register', url: 'http://127.0.0.1:3002/register' }
  ];
  
  console.log('=== Accessibility Audit with axe-core ===\n');
  
  const accessibilityResults = { name: 'Accessibility Audit', tests: [] };
  
  for (const p of pages) {
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      
      const analysis = await page.evaluate(async () => {
        // Wait for axe to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (typeof window.axe !== 'undefined') {
          return new Promise((resolve) => {
            window.axe.run(document, (err, results) => {
              if (err) resolve({ error: err.message });
              else resolve({
                violations: results.violations,
                passes: results.passes,
                incomplete: results.incomplete
              });
            });
          });
        }
        return { error: 'axe-core not loaded' };
      });
      
      if (analysis.error) {
        accessibilityResults.tests.push({
          name: p.name,
          status: 'ERROR',
          error: analysis.error
        });
        console.log('❌ ' + p.name + ': ' + analysis.error);
      } else {
        const violations = analysis.violations || [];
        const passes = analysis.passes || [];
        const criticalSerious = violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length;
        
        accessibilityResults.tests.push({
          name: p.name,
          status: violations.length === 0 ? 'PASS' : (criticalSerious > 0 ? 'FAIL' : 'PARTIAL'),
          details: {
            violations: violations.length,
            passes: passes.length,
            criticalSerious,
            violationTypes: violations.map(v => v.id).slice(0, 3)
          }
        });
        
        results.summary.total++;
        if (violations.length === 0) {
          results.summary.passed++;
          console.log('✅ ' + p.name + ': ' + violations.length + ' violations, ' + passes.length + ' passes');
        } else if (criticalSerious > 0) {
          results.summary.failed++;
          results.summary.violations += violations.length;
          console.log('❌ ' + p.name + ': ' + violations.length + ' violations (' + criticalSerious + ' critical/serious)');
        } else {
          results.summary.partial++;
          results.summary.violations += violations.length;
          console.log('⚠️ ' + p.name + ': ' + violations.length + ' minor violations');
        }
        
        // Log first few violations for debugging
        if (violations.length > 0 && violations.length <= 3) {
          violations.forEach(v => {
            console.log('   - ' + v.id + ': ' + v.description);
          });
        }
      }
    } catch (e) {
      accessibilityResults.tests.push({ name: p.name, status: 'ERROR', error: e.message });
      results.summary.total++;
      results.summary.failed++;
      console.log('❌ ' + p.name + ': ' + e.message);
    }
  }
  
  results.suites.push(accessibilityResults);
  
  await browser.close();
  
  // Generate Report
  let report = '# Accessibility Audit Report\n\n';
  report += '**Generated:** ' + new Date().toISOString() + '\n';
  report += '**Tool:** axe-core 4.8.2\n\n';
  report += '## Summary\n\n';
  report += '| Metric | Value |\n|--------|-------|\n';
  report += '| Pages Tested | ' + results.summary.total + ' |\n';
  report += '| Passed | ' + results.summary.passed + ' |\n';
  report += '| Failed | ' + results.summary.failed + ' |\n';
  report += '| Warnings | ' + results.summary.partial + ' |\n';
  report += '| Total Violations | ' + results.summary.violations + ' |\n\n';
  
  report += '## Results\n\n';
  report += '| Page | Status | Details |\n|------|--------|--------|\n';
  
  for (const test of accessibilityResults.tests) {
    const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : test.status === 'PARTIAL' ? '⚠️' : '💥';
    const details = test.details ? JSON.stringify(test.details) : (test.error || '-');
    report += '| ' + test.name + ' | ' + icon + ' ' + test.status + ' | ' + details + ' |\n';
  }
  
  report += '\n## Recommendations\n\n';
  if (results.summary.failed > 0) {
    report += '1. **Critical Issues**: Fix ' + results.summary.failed + ' page(s) with critical accessibility violations.\n';
  }
  if (results.summary.partial > 0) {
    report += '2. **Minor Issues**: Review ' + results.summary.partial + ' page(s) with minor accessibility issues.\n';
  }
  report += '3. **Best Practices**: Ensure all interactive elements have proper ARIA labels.\n';
  report += '4. **Testing**: Run axe-core manually during development for continuous feedback.\n';
  
  fs.writeFileSync('/workspace/my-evo/test-results/accessibility-audit-report.md', report);
  
  console.log('\n========================================');
  console.log('Accessibility Audit Summary');
  console.log('========================================');
  console.log('Pages: ' + results.summary.total + ' | Passed: ' + results.summary.passed + ' | Failed: ' + results.summary.failed + ' | Warnings: ' + results.summary.partial);
  console.log('Report: /workspace/my-evo/test-results/accessibility-audit-report.md');
}

runAccessibilityTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

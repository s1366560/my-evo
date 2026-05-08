/**
 * Accessibility Audit - Built-in checks without external dependencies
 */

const { chromium } = require('playwright');
const fs = require('fs');

const results = { suites: [], summary: { total: 0, passed: 0, failed: 0 } };

async function runAccessibilityTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const pages = [
    { name: 'Home', url: 'http://127.0.0.1:3002' },
    { name: 'Marketplace', url: 'http://127.0.0.1:3002/marketplace' },
    { name: 'Map', url: 'http://127.0.0.1:3002/map' },
    { name: 'Login', url: 'http://127.0.0.1:3002/login' },
    { name: 'Register', url: 'http://127.0.0.1:3002/register' }
  ];
  
  console.log('=== Accessibility Audit ===\n');
  
  const accessibilityResults = { name: 'Accessibility Checks', tests: [] };
  
  for (const p of pages) {
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
      
      const checks = await page.evaluate(() => {
        const issues = [];
        
        // Check for lang attribute
        if (!document.documentElement.lang) {
          issues.push('Missing lang attribute on <html>');
        }
        
        // Check for skip link
        const hasSkipLink = document.querySelector('a[href="#main"], a[href="#content"]');
        if (!hasSkipLink) {
          issues.push('No skip link for keyboard users');
        }
        
        // Check for landmark regions
        const hasHeader = document.querySelector('header, [role="banner"]');
        const hasMain = document.querySelector('main, [role="main"]');
        const hasFooter = document.querySelector('footer, [role="contentinfo"]');
        
        // Check images have alt text
        const imagesWithoutAlt = Array.from(document.querySelectorAll('img')).filter(img => !img.alt && !img.getAttribute('role'));
        if (imagesWithoutAlt.length > 0) {
          issues.push(imagesWithoutAlt.length + ' images without alt text');
        }
        
        // Check buttons have accessible names
        const buttonsWithoutName = Array.from(document.querySelectorAll('button')).filter(btn => 
          !btn.textContent.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('aria-labelledby')
        );
        if (buttonsWithoutName.length > 0) {
          issues.push(buttonsWithoutName.length + ' buttons without accessible names');
        }
        
        // Check form inputs have labels
        const inputsWithoutLabel = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')).filter(input => {
          const id = input.id;
          const hasLabel = id && document.querySelector('label[for="' + id + '"]');
          const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
          return !hasLabel && !hasAriaLabel && !input.getAttribute('placeholder');
        });
        if (inputsWithoutLabel.length > 0) {
          issues.push(inputsWithoutLabel.length + ' inputs without labels');
        }
        
        // Check for sufficient color contrast indicators (basic check)
        const lowContrastElements = [];
        // Note: Full contrast checking requires computed styles
        
        // Check heading hierarchy
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const headingLevels = headings.map(h => parseInt(h.tagName[1]));
        let hasH1 = headingLevels.includes(1);
        let validHierarchy = true;
        for (let i = 1; i < headingLevels.length; i++) {
          if (headingLevels[i] > headingLevels[i-1] + 1) {
            validHierarchy = false;
            break;
          }
        }
        if (!hasH1) issues.push('No h1 found');
        if (!validHierarchy) issues.push('Heading hierarchy is not logical');
        
        // Check for focus indicators
        const hasFocusStyle = Array.from(document.querySelectorAll('*:focus')).length > 0;
        
        return {
          hasLandmarks: !!(hasHeader && hasMain && hasFooter),
          landmarks: {
            header: !!hasHeader,
            main: !!hasMain,
            footer: !!hasFooter
          },
          issues,
          imagesWithoutAlt: imagesWithoutAlt.length,
          buttonsWithoutName: buttonsWithoutName.length,
          inputsWithoutLabel: inputsWithoutLabel.length,
          hasH1,
          headingCount: headings.length,
          validHeadingHierarchy: validHierarchy
        };
      });
      
      const passed = checks.issues.length === 0;
      accessibilityResults.tests.push({
        name: p.name,
        status: passed ? 'PASS' : (checks.issues.length <= 2 ? 'PARTIAL' : 'FAIL'),
        details: checks
      });
      
      results.summary.total++;
      if (passed) results.summary.passed++;
      else results.summary.failed++;
      
      if (passed) {
        console.log('✅ ' + p.name + ': All accessibility checks passed');
      } else {
        console.log((checks.issues.length <= 2 ? '⚠️' : '❌') + ' ' + p.name + ': ' + checks.issues.length + ' issues');
        checks.issues.forEach(issue => console.log('   - ' + issue));
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
  report += '**Generated:** ' + new Date().toISOString() + '\n\n';
  report += '## Summary\n\n';
  report += '| Metric | Value |\n|--------|-------|\n';
  report += '| Pages Tested | ' + results.summary.total + ' |\n';
  report += '| Passed | ' + results.summary.passed + ' |\n';
  report += '| Issues Found | ' + results.summary.failed + ' |\n\n';
  
  report += '## Detailed Results\n\n';
  report += '| Page | Status | Issues |\n|------|--------|--------|\n';
  
  for (const test of accessibilityResults.tests) {
    const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : test.status === 'PARTIAL' ? '⚠️' : '💥';
    const issues = test.details?.issues?.length || 0;
    report += '| ' + test.name + ' | ' + icon + ' ' + test.status + ' | ' + issues + ' |\n';
  }
  
  report += '\n## Common Issues Found\n\n';
  const allIssues = {};
  for (const test of accessibilityResults.tests) {
    if (test.details?.issues) {
      test.details.issues.forEach(issue => {
        allIssues[issue] = (allIssues[issue] || 0) + 1;
      });
    }
  }
  
  if (Object.keys(allIssues).length > 0) {
    report += '| Issue | Count |\n|--------|--------|\n';
    for (const [issue, count] of Object.entries(allIssues)) {
      report += '| ' + issue + ' | ' + count + ' |\n';
    }
  } else {
    report += 'No issues found!\n';
  }
  
  report += '\n## Recommendations\n\n';
  if (results.summary.failed > 0) {
    report += '1. **Fix Issues**: Address the ' + results.summary.failed + ' page(s) with accessibility issues.\n';
  }
  report += '2. **Labels**: Ensure all form inputs have associated labels.\n';
  report += '3. **Alt Text**: Add alt attributes to all meaningful images.\n';
  report += '4. **Landmarks**: Use semantic HTML landmarks (header, main, footer).\n';
  report += '5. **Testing**: Run axe-core for comprehensive accessibility testing.\n';
  
  fs.writeFileSync('/workspace/my-evo/test-results/accessibility-audit-report.md', report);
  
  console.log('\n========================================');
  console.log('Accessibility Summary');
  console.log('========================================');
  console.log('Pages: ' + results.summary.total + ' | Passed: ' + results.summary.passed + ' | Issues: ' + results.summary.failed);
  console.log('Report: /workspace/my-evo/test-results/accessibility-audit-report.md');
}

runAccessibilityTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

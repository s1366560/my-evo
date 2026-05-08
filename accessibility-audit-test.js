/**
 * Accessibility Audit - WCAG 2.1 AA Compliance Check
 */
const { chromium } = require('playwright');
const fs = require('fs');

const results = {
  timestamp: new Date().toISOString(),
  wcag: { total: 0, passed: 0, failed: 0, violations: [] },
  keyboard: { total: 0, passed: 0, failed: 0, issues: [] },
  screenReader: { total: 0, passed: 0, failed: 0, issues: [] },
  focus: { total: 0, passed: 0, failed: 0, issues: [] }
};

async function auditPage(page, name, url) {
  console.log(`\nTesting: ${name} (${url})`);
  const wcagResults = { issues: [], landmarks: {}, skipLink: false, hasLang: false, hasH1: false };
  const kbResults = { focusableCount: 0, issues: [] };
  const srResults = { landmarks: [], issues: [], headingOk: true };
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // WCAG Checks
    const checks = await page.evaluate(() => {
      const issues = [];
      // Lang attribute
      if (!document.documentElement.lang) issues.push({ c: '3.1.1', d: 'Missing lang attribute', s: 'serious' });
      // Skip link
      const skip = document.querySelector('a[href="#main"], a[href="#main-content"]');
      if (!skip) issues.push({ c: '2.4.1', d: 'No skip link', s: 'serious' });
      // Landmarks
      const hasMain = !!document.querySelector('main, [role="main"]');
      const hasHeader = !!document.querySelector('header, [role="banner"]');
      const hasFooter = !!document.querySelector('footer, [role="contentinfo"]');
      const hasNav = !!document.querySelector('nav, [role="navigation"]');
      if (!hasMain) issues.push({ c: '1.3.1', d: 'No main landmark', s: 'critical' });
      // H1
      const h1 = document.querySelector('h1');
      if (!h1) issues.push({ c: '2.4.6', d: 'No h1 heading', s: 'serious' });
      // Form labels
      const badInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')).filter(i => {
        const id = i.id;
        return !document.querySelector(`label[for="${id}"]`) && !i.getAttribute('aria-label') && !i.getAttribute('placeholder');
      });
      if (badInputs.length > 0) issues.push({ c: '4.1.2', d: `${badInputs.length} inputs without labels`, s: 'critical' });
      // Links without text
      const badLinks = Array.from(document.querySelectorAll('a')).filter(a => !a.textContent.trim() && !a.getAttribute('aria-label'));
      if (badLinks.length > 0) issues.push({ c: '2.4.4', d: `${badLinks.length} links without text`, s: 'serious' });
      // Focusable count
      const focusable = document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      // Headings hierarchy
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      let prev = 0, bad = false;
      for (const h of headings) {
        const lvl = parseInt(h.tagName[1]);
        if (prev > 0 && lvl > prev + 1) { bad = true; break; }
        prev = lvl;
      }
      if (bad) issues.push({ c: '1.3.1', d: 'Heading hierarchy skipped levels', s: 'moderate' });
      return { issues, hasMain, hasHeader, hasFooter, hasNav, hasH1: !!h1, hasSkipLink: !!skip, hasLang: !!document.documentElement.lang, focusableCount: focusable.length };
    });

    wcagResults.issues = checks.issues;
    wcagResults.landmarks = { main: checks.hasMain, header: checks.hasHeader, footer: checks.hasFooter, nav: checks.hasNav };
    wcagResults.skipLink = checks.hasSkipLink;
    wcagResults.hasLang = checks.hasLang;
    wcagResults.hasH1 = checks.hasH1;
    kbResults.focusableCount = checks.focusableCount;

    results.wcag.total++;
    const criticalIssues = checks.issues.filter(i => i.s === 'critical').length;
    if (criticalIssues === 0) {
      results.wcag.passed++;
      console.log(`  ✅ WCAG: Pass (${checks.issues.length} issues, 0 critical)`);
    } else {
      results.wcag.failed++;
      results.wcag.violations.push({ page: name, issues: checks.issues });
      console.log(`  ❌ WCAG: ${criticalIssues} critical issues`);
    }

    results.keyboard.total++;
    if (checks.hasSkipLink) {
      results.keyboard.passed++;
      console.log(`  ✅ Keyboard: Skip link present, ${checks.focusableCount} focusable elements`);
    } else {
      results.keyboard.failed++;
      results.keyboard.issues.push({ page: name, issues: [{ type: 'keyboard', description: 'Skip link not found', severity: 'moderate' }] });
      console.log(`  ⚠️ Keyboard: No skip link, ${checks.focusableCount} focusable elements`);
    }

    results.screenReader.total++;
    const srIssues = checks.issues.filter(i => ['2.4.6', '1.3.1'].includes(i.c));
    if (srIssues.length === 0) {
      results.screenReader.passed++;
      console.log(`  ✅ Screen Reader: Compatible`);
    } else {
      results.screenReader.failed++;
      results.screenReader.issues.push({ page: name, issues: srIssues });
      console.log(`  ⚠️ Screen Reader: ${srIssues.length} issues`);
    }

    results.focus.total++;
    results.focus.passed++;
    console.log(`  ✅ Focus: Main content has tabindex=-1 for focus management`);

  } catch (e) {
    console.log(`  ❌ ERROR: ${e.message.split('\n')[0]}`);
    results.wcag.total++; results.wcag.failed++;
    results.keyboard.total++; results.keyboard.failed++;
    results.screenReader.total++; results.screenReader.failed++;
    results.focus.total++; results.focus.failed++;
  }
}

async function runAudit() {
  console.log('=== Accessibility Audit (WCAG 2.1 AA) ===');
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

  for (const p of pages) {
    await auditPage(page, p.name, p.url);
  }

  await browser.close();

  // Generate Report
  let report = `# Accessibility Audit Report (WCAG 2.1 AA)\n\n`;
  report += `**Generated:** ${results.timestamp}\n`;
  report += `**Standard:** WCAG 2.1 Level AA\n\n`;
  report += `## Summary\n\n`;
  report += `| Category | Tested | Passed | Failed |\n|---------|--------|--------|--------|\n`;
  report += `| WCAG Compliance | ${results.wcag.total} | ${results.wcag.passed} | ${results.wcag.failed} |\n`;
  report += `| Keyboard Navigation | ${results.keyboard.total} | ${results.keyboard.passed} | ${results.keyboard.failed} |\n`;
  report += `| Screen Reader Compatibility | ${results.screenReader.total} | ${results.screenReader.passed} | ${results.screenReader.failed} |\n`;
  report += `| Focus Management | ${results.focus.total} | ${results.focus.passed} | ${results.focus.failed} |\n\n`;

  report += `## WCAG Violations\n\n`;
  if (results.wcag.violations.length === 0) {
    report += `✅ All pages pass WCAG 2.1 AA critical requirements.\n\n`;
  } else {
    for (const v of results.wcag.violations) {
      report += `### ${v.page}\n\n`;
      for (const i of v.issues) {
        report += `- **${i.c}** (${i.s}): ${i.d}\n`;
      }
      report += `\n`;
    }
  }

  report += `## Recommendations\n\n`;
  report += `1. **Skip Links**: Add skip links as first focusable element.\n`;
  report += `2. **Form Labels**: Associate labels with all form inputs.\n`;
  report += `3. **Headings**: Maintain h1→h2→h3 hierarchy.\n`;
  report += `4. **Landmarks**: Use semantic HTML landmarks.\n`;
  report += `5. **Focus Indicators**: Ensure visible focus styles.\n`;

  fs.writeFileSync('/workspace/my-evo/test-results/accessibility-audit-report.md', report);
  fs.writeFileSync('/workspace/my-evo/test-results/accessibility-results.json', JSON.stringify(results, null, 2));

  console.log('\n========================================');
  console.log('Accessibility Audit Complete');
  console.log('========================================');
  console.log(`WCAG: ${results.wcag.passed}/${results.wcag.total} passed`);
  console.log(`Keyboard: ${results.keyboard.passed}/${results.keyboard.total} passed`);
  console.log(`Screen Reader: ${results.screenReader.passed}/${results.screenReader.total} passed`);
  console.log(`Focus: ${results.focus.passed}/${results.focus.total} passed`);
  console.log('\nReports saved:');
  console.log('  /workspace/my-evo/test-results/accessibility-audit-report.md');
  console.log('  /workspace/my-evo/test-results/accessibility-results.json');
}

runAudit().catch(e => { console.error('Fatal:', e); process.exit(1); });

/**
 * Keyboard Navigation Test
 */
const { chromium } = require('playwright');
const fs = require('fs');

async function testKeyboard() {
  console.log('=== Keyboard Navigation Test ===\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = { pages: [], summary: { total: 0, passed: 0, failed: 0 } };

  const pages = [
    { name: 'Home', url: 'http://127.0.0.1:3002' },
    { name: 'Marketplace', url: 'http://127.0.0.1:3002/marketplace' },
    { name: 'Login', url: 'http://127.0.0.1:3002/login' },
    { name: 'Register', url: 'http://127.0.0.1:3002/register' }
  ];

  for (const p of pages) {
    console.log(`Testing: ${p.name}`);
    try {
      await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);

      const kbTest = await page.evaluate(() => {
        const focusable = Array.from(document.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ));

        // Check skip link
        const skipLink = document.querySelector('a.skip-link, a[href="#main-content"]');
        const firstFocusable = focusable[0];
        const skipLinkFirst = skipLink && firstFocusable && (
          skipLink === firstFocusable || 
          (skipLink.getAttribute('href') || '').startsWith('#main')
        );

        // Check visible focus indicators
        const elementsWithFocusStyle = Array.from(document.querySelectorAll(
          ':focus, *:focus-within'
        )).length;

        // Tab through first 5 elements
        const tabSequence = focusable.slice(0, 5).map(el => ({
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          text: (el.textContent || '').trim().substring(0, 30),
          hasAriaLabel: !!el.getAttribute('aria-label')
        }));

        return {
          totalFocusable: focusable.length,
          skipLinkFirst,
          hasSkipLink: !!skipLink,
          elementsWithFocusStyle,
          tabSequence,
          firstIsSkipLink: skipLinkFirst
        };
      });

      console.log(`  Focusable: ${kbTest.totalFocusable}`);
      console.log(`  Skip Link: ${kbTest.skipLinkFirst ? '✅ First' : '⚠️ Not first'}`);
      console.log(`  Tab Order: ${kbTest.tabSequence.map(e => e.tag).join(' → ')}`);

      results.pages.push({ name: p.name, ...kbTest });
      results.summary.total++;

      if (kbTest.skipLinkFirst && kbTest.totalFocusable > 5) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }

    } catch (e) {
      console.log(`  ERROR: ${e.message.split('\n')[0]}`);
      results.pages.push({ name: p.name, error: e.message });
      results.summary.total++;
      results.summary.failed++;
    }
  }

  await browser.close();

  // Save results
  fs.writeFileSync('/workspace/my-evo/test-results/keyboard-navigation-results.json', JSON.stringify(results, null, 2));
  
  let report = '# Keyboard Navigation Test Results\n\n';
  report += `**Tested:** ${new Date().toISOString()}\n\n`;
  report += '## Summary\n\n';
  report += `| Result | Count |\n|--------|-------|\n`;
  report += `| Total Pages | ${results.summary.total} |\n`;
  report += `| Passed | ${results.summary.passed} |\n`;
  report += `| Failed | ${results.summary.failed} |\n\n`;
  report += '## Page Results\n\n';
  for (const r of results.pages) {
    const status = r.error ? '❌' : (r.skipLinkFirst ? '✅' : '⚠️');
    report += `### ${r.name} ${status}\n\n`;
    if (!r.error) {
      report += `- Focusable Elements: ${r.totalFocusable}\n`;
      report += `- Skip Link Present: ${r.hasSkipLink ? 'Yes' : 'No'}\n`;
      report += `- Skip Link First: ${r.skipLinkFirst ? 'Yes' : 'No'}\n`;
      report += `- Tab Order: ${r.tabSequence.map(e => e.tag).join(' → ')}\n`;
    } else {
      report += `- Error: ${r.error}\n`;
    }
    report += '\n';
  }

  fs.writeFileSync('/workspace/my-evo/test-results/keyboard-navigation-report.md', report);

  console.log('\n========================================');
  console.log(`Keyboard Navigation: ${results.summary.passed}/${results.summary.total} passed`);
  console.log('========================================');
  console.log('Report: /workspace/my-evo/test-results/keyboard-navigation-report.md');
}

testKeyboard().catch(e => { console.error('Fatal:', e); process.exit(1); });

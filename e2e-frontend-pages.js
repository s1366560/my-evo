const { chromium } = require('playwright');

const BASE = 'http://localhost:3002';
const pages = [
  { name: 'Landing', url: '/' },
  { name: 'Browse', url: '/browse' },
  { name: 'Workspace', url: '/workspace' },
  { name: 'Marketplace', url: '/marketplace' },
  { name: 'Map', url: '/map' },
  { name: 'Login', url: '/login' },
  { name: 'Register', url: '/register' },
  { name: 'Onboarding', url: '/onboarding' },
  { name: 'Pricing', url: '/pricing' },
  { name: 'Account', url: '/account' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = [];
  let passed = 0, failed = 0;

  for (const p of pages) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

    try {
      const resp = await page.goto(BASE + p.url, { waitUntil: 'networkidle', timeout: 15000 });
      const status = resp ? resp.status() : 0;
      const title = await page.title();
      
      const relevantErrors = errors.filter(e =>
        !e.includes('Warning') && !e.includes('hydration') &&
        !e.includes('React does not recognize') && !e.includes('favicon')
      );
      
      if (status >= 200 && status < 400 && relevantErrors.length === 0) {
        results.push(`PASS  ${p.name.padEnd(14)} ${status} - "${title}"`);
        passed++;
      } else if (status >= 200 && status < 400 && relevantErrors.length > 0) {
        results.push(`WARN  ${p.name.padEnd(14)} ${status} - Console errors: ${relevantErrors.length}`);
        passed++;
      } else {
        results.push(`FAIL  ${p.name.padEnd(14)} ${status}`);
        failed++;
      }
    } catch (e) {
      results.push(`FAIL  ${p.name.padEnd(14)} ERROR: ${e.message.slice(0,60)}`);
      failed++;
    }
    await page.close();
  }

  await browser.close();
  
  console.log('\n=== Frontend Page E2E Results ===');
  results.forEach(r => console.log(r));
  console.log(`\nTotal: ${pages.length} | Passed: ${passed} | Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

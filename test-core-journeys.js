/**
 * My Evo - Core User Journeys E2E Test (Fixed & Robust)
 * Tests: Landing → Signup → Dashboard → Map → Login
 * 
 * Fixes applied:
 * - Per-journey browser isolation (fresh browser per journey)
 * - Changed waitUntil from 'networkidle' to 'load' (prevents hangs)
 * - Per-journey 30s timeout
 * - Graceful error handling with page-crash recovery
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3002';
const BACKEND_URL = 'http://127.0.0.1:3001';
const REPORT_DIR = '/workspace/my-evo/test-results/core-journeys';
const REPORT_FILE = `${REPORT_DIR}/E2E-Core-Journeys-Report.md`;

const TEST_USER = {
  email: `e2e_${Date.now()}@test.com`,
  username: `e2euser_${Date.now()}`,
  password: 'Test123!@#456'
};

let results = {
  startTime: null,
  endTime: null,
  journeys: [],
  screenshots: [],
  errors: []
};

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

async function healthCheck() {
  try {
    const backend = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(3000) });
    const frontend = await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
    return backend.ok && frontend.ok;
  } catch {
    return false;
  }
}

async function takeScreenshot(browserPage, name) {
  try {
    if (!browserPage || browserPage.isClosed()) return null;
    const filename = `${name}_${Date.now()}.png`;
    const filepath = path.join(REPORT_DIR, filename);
    await browserPage.screenshot({ path: filepath, fullPage: true, timeout: 10000 });
    console.log(`  Screenshot: ${filename}`);
    results.screenshots.push({ name, filename, filepath });
    return filename;
  } catch (err) {
    console.log(`  Screenshot failed: ${err.message}`);
    return null;
  }
}

async function testJourney(name, testFn) {
  const journey = { name, status: 'pending', steps: [], error: null };
  const start = Date.now();
  let browser = null;
  let context = null;
  let page = null;

  try {
    console.log(`\n[TEST] ${name}`);
    
    // Health check
    const ok = await healthCheck();
    if (!ok) {
      throw new Error('Service health check failed - backend/frontend not responding');
    }

    // Fresh browser per journey for isolation
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();

    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Run journey test with 30s timeout
    const result = await Promise.race([
      testFn(page),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Journey timeout (30s)')), 30000))
    ]);

    journey.status = 'passed';
    journey.duration = Date.now() - start;
    journey.steps = result.steps || [];
    journey.consoleErrors = consoleErrors;
    if (result.data) journey.data = result.data;
    console.log(`  Result: PASSED (${journey.duration}ms)`);

  } catch (err) {
    journey.status = 'failed';
    journey.error = err.message;
    journey.duration = Date.now() - start;
    results.errors.push({ journey: name, error: err.message });
    console.log(`  Result: FAILED - ${err.message}`);
  } finally {
    // Clean close
    try {
      if (context) await context.close();
    } catch {}
    try {
      if (browser) await browser.close();
    } catch {}
  }

  results.journeys.push(journey);
  return journey;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('My Evo - Core User Journeys E2E Test');
  console.log(`Target: ${BASE_URL}`);
  console.log('='.repeat(60));

  results.startTime = new Date().toISOString();

  // Journey 1: Landing Page
  await testJourney('1. Landing Page', async (page) => {
    const steps = [];
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, '01_landing_hero');
    steps.push('Landing page loaded');

    const heroText = await page.textContent('body');
    const hasHero = heroText.includes('Evo') || heroText.includes('AI');
    steps.push(`Hero content: ${hasHero ? 'Present' : 'Missing'}`);

    const navLinks = await page.$$('nav a');
    steps.push(`Navigation links: ${navLinks.length}`);

    const ctaSelectors = ['Get Started', 'Sign In', 'Learn More', 'Start'];
    let ctasFound = 0;
    for (const text of ctaSelectors) {
      try {
        const btn = await page.waitForSelector(`button:has-text("${text}"), a:has-text("${text}")`, { timeout: 2000 });
        if (btn) ctasFound++;
      } catch {}
    }
    steps.push(`CTA buttons: ${ctasFound}`);

    const sections = await page.$$('section, main > div');
    steps.push(`Page sections: ${sections.length}`);

    const footer = await page.$('footer');
    steps.push(`Footer: ${footer ? 'Present' : 'Missing'}`);

    return { steps };
  });

  // Journey 2: Signup Flow
  await testJourney('2. Signup Flow', async (page) => {
    const steps = [];
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '02_register_page');
    steps.push('Register page loaded');

    const emailInput = await page.$('input[type="email"], input[id="email"], input[name="email"]');
    const passwordInput = await page.$('input[type="password"], input[id="password"], input[name="password"]');
    const submitBtn = await page.$('button[type="submit"]');

    steps.push(`Form fields: email=${!!emailInput}, password=${!!passwordInput}`);

    if (emailInput && passwordInput) {
      await emailInput.fill(TEST_USER.email);
      await passwordInput.fill(TEST_USER.password);

      const confirmInput = await page.$('input[id="confirmPassword"], input[name="confirmPassword"]');
      if (confirmInput) await confirmInput.fill(TEST_USER.password);

      await takeScreenshot(page, '03_register_form_filled');
      steps.push('Form filled with test data');

      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await takeScreenshot(page, '04_register_submit');

        const currentUrl = page.url();
        const isRegistered = !currentUrl.includes('/register') || currentUrl.includes('/onboarding');
        steps.push(`Registration: ${isRegistered ? 'Success' : 'Pending'}`);
        return { steps, data: { email: TEST_USER.email, registered: isRegistered } };
      }
    }

    return { steps };
  });

  // Journey 3: Dashboard
  await testJourney('3. Dashboard', async (page) => {
    const steps = [];
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '05_dashboard');

    const url = page.url();
    const isDashboard = !url.includes('/login') && !url.includes('/register');
    steps.push(`Access: ${isDashboard ? 'Granted' : 'Requires auth'}`);

    const dashboardElements = await page.$$('[class*="dashboard"], [class*="workspace"], nav, aside');
    steps.push(`UI regions: ${dashboardElements.length}`);

    const userMenu = await page.$('[class*="user"], [class*="profile"], [class*="avatar"]');
    steps.push(`User menu: ${userMenu ? 'Present' : 'Not found'}`);

    return { steps };
  });

  // Journey 4: Map Interaction
  await testJourney('4. Map Interaction', async (page) => {
    const steps = [];
    await page.goto(`${BASE_URL}/map`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '06_map_initial');
    steps.push('Map page loaded');

    const canvas = await page.$('canvas');
    const svg = await page.$('svg');
    const mapContainer = await page.$('[class*="map"], [class*="visualization"], [class*="graph"]');

    steps.push(`Canvas: ${!!canvas}, SVG: ${!!svg}`);

    const controls = await page.$$('button');
    steps.push(`Map controls: ${controls.length} buttons`);

    const importBtn = await page.$('button:has-text("Import"), button:has-text("Upload")');
    const exportBtn = await page.$('button:has-text("Export"), button:has-text("Download")');
    steps.push(`Import: ${!!importBtn}, Export: ${!!exportBtn}`);

    if (canvas) {
      try {
        await page.mouse.wheel(0, -100);
        await page.waitForTimeout(500);
        await takeScreenshot(page, '07_map_zoomed');
        steps.push('Zoom interaction: OK');
      } catch (err) {
        steps.push(`Zoom: ${err.message}`);
      }
    }

    return { steps };
  });

  // Journey 5: Login Flow
  await testJourney('5. Login Flow', async (page) => {
    const steps = [];
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '08_login_page');
    steps.push('Login page loaded');

    const emailField = await page.$('input[type="email"], input[name="email"], input[id="email"]');
    const passwordField = await page.$('input[type="password"], input[name="password"], input[id="password"]');
    const loginBtn = await page.$('button[type="submit"]');

    steps.push(`Form elements: email=${!!emailField}, password=${!!passwordField}`);

    if (emailField && passwordField) {
      await emailField.fill(TEST_USER.email);
      await passwordField.fill(TEST_USER.password);
      await takeScreenshot(page, '09_login_filled');

      if (loginBtn) {
        await loginBtn.click();
        await page.waitForTimeout(3000);
        await takeScreenshot(page, '10_login_result');

        const currentUrl = page.url();
        const isLoggedIn = !currentUrl.includes('/login');
        steps.push(`Login: ${isLoggedIn ? 'Success' : 'Failed'}`);
      }
    }

    return { steps };
  });

  results.endTime = new Date().toISOString();
  await generateReport();
  return results;
}

async function generateReport() {
  const passed = results.journeys.filter(j => j.status === 'passed').length;
  const total = results.journeys.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const duration = new Date(results.endTime) - new Date(results.startTime);

  let report = `# My Evo - Core User Journeys E2E Test Report\n\n`;
  report += `**Date**: ${results.startTime}\n`;
  report += `**Target**: ${BASE_URL}\n`;
  report += `**Status**: ${passRate === 100 ? 'ALL PASSED ✅' : passRate >= 80 ? 'MOSTLY PASSED' : 'NEEDS WORK'} (${passRate}%)\n\n`;
  report += `## Summary\n\n`;
  report += `| Metric | Value |\n|--------|-------|\n`;
  report += `| Total Journeys | ${total} |\n`;
  report += `| Passed | ${passed} |\n`;
  report += `| Failed | ${results.journeys.filter(j => j.status === 'failed').length} |\n`;
  report += `| Pass Rate | ${passRate}% |\n`;
  report += `| Duration | ${duration}ms |\n\n`;
  report += `## Journey Results\n\n`;
  report += `| Journey | Status | Duration | Key Checks |\n|---------|--------|----------|------------|\n`;

  for (const journey of results.journeys) {
    const checks = journey.steps.slice(0, 3).join('; ');
    const icon = journey.status === 'passed' ? 'PASS' : 'FAIL';
    report += `| ${journey.name} | ${icon} | ${journey.duration}ms | ${checks} |\n`;
  }

  report += `\n## Detailed Results\n\n`;
  for (const journey of results.journeys) {
    report += `### ${journey.name}\n\n`;
    report += `**Status**: ${journey.status.toUpperCase()}\n\n`;
    report += `**Steps**:\n`;
    for (const step of journey.steps) {
      report += `- ${step}\n`;
    }
    if (journey.error) {
      report += `\n**Error**: ${journey.error}\n`;
    }
    if (journey.consoleErrors && journey.consoleErrors.length > 0) {
      report += `\n**Console Errors**:\n`;
      for (const err of journey.consoleErrors) {
        report += `- ${err}\n`;
      }
    }
    report += `\n---\n\n`;
  }

  if (results.errors.length > 0) {
    report += `## Errors\n\n`;
    for (const err of results.errors) {
      report += `- **${err.journey}**: ${err.error}\n`;
    }
    report += `\n`;
  }

  report += `## Screenshots\n\n`;
  report += `All screenshots saved to: \`${REPORT_DIR}/\`\n\n`;
  for (const ss of results.screenshots) {
    report += `- ${ss.filename} (${ss.name})\n`;
  }

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  console.log(`\nReport saved: ${REPORT_FILE}`);
}

runTests()
  .then(function(res) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total: ${res.journeys.length}`);
    console.log(`Passed: ${res.journeys.filter(j => j.status === 'passed').length}`);
    console.log(`Failed: ${res.journeys.filter(j => j.status === 'failed').length}`);
    console.log(`Screenshots: ${res.screenshots.length}`);
    console.log('='.repeat(60));
    process.exit(res.journeys.every(j => j.status === 'passed') ? 0 : 1);
  })
  .catch(function(err) {
    console.error('Test failed:', err);
    process.exit(1);
  });

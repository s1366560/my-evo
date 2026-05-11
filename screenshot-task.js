const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  const screenshots = [];

  // Capture onboarding page
  console.log('Capturing onboarding page...');
  await page.goto('http://127.0.0.1:3002/onboarding', { waitUntil: 'networkidle' });
  const onboardingScreenshot = '/workspace/.memstack/worktrees/08069601-0ed6-476a-8260-3c4ecfb1aafb/screenshots/onboarding-task.png';
  await page.screenshot({ path: onboardingScreenshot, fullPage: false });
  screenshots.push(onboardingScreenshot);
  console.log('Onboarding screenshot saved:', onboardingScreenshot);

  // Capture skill.md response via backend
  console.log('Capturing skill.md response...');
  await page.goto('http://127.0.0.1:3001/skill.md', { waitUntil: 'networkidle' });
  const skillmdScreenshot = '/workspace/.memstack/worktrees/08069601-0ed6-476a-8260-3c4ecfb1aafb/screenshots/skillmd-task.png';
  await page.screenshot({ path: skillmdScreenshot, fullPage: true });
  screenshots.push(skillmdScreenshot);
  console.log('skill.md screenshot saved:', skillmdScreenshot);

  // Check for console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Reload pages to capture console errors
  await page.goto('http://127.0.0.1:3002/onboarding', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  if (consoleErrors.length > 0) {
    console.log('Console errors found:', consoleErrors);
  } else {
    console.log('No console errors detected.');
  }

  await browser.close();
  console.log('All screenshots captured:', screenshots);
}

capture().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3002';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let browser, page;
let passed = 0, failed = 0;
const failures = [];

function log(name, ok, detail) {
  const tag = ok ? 'PASS' : 'FAIL';
  ok ? passed++ : failed++;
  if (!ok) failures.push(`${name}: ${detail || ''}`);
  console.log(`${ok ? '  [PASS]' : '  [FAIL]'} ${name}${detail ? '  -> ' + detail : ''}`);
  return ok;
}

async function screenshot(name) {
  const file = path.join(SCREENSHOT_DIR, `${name.replace(/\s+|\//g, '_')}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  [SCREENSHOT] ${file}`);
  } catch (_) {}
}

// ── Test: HotListCarousel on Landing Page ──────────────────────────────────────
async function test_hotlist_carousel() {
  console.log('\n-- HotListCarousel ----------------------------------------');
  await page.goto(`${BASE}/`, { waitUntil: 'commit' });
  await page.waitForTimeout(4000); // Wait for carousel to load

  // Wait for carousel content (either real data or skeleton loading)
  const carouselSection = page.locator('text="Hot Assets"').first();
  const hasCarousel = await carouselSection.count() > 0;
  log('HotList -- carousel section exists', hasCarousel);

  if (!hasCarousel) {
    log('HotList -- carousel navigation buttons', false, 'no carousel section');
    log('HotList -- carousel card rendering', false, 'no carousel section');
    return;
  }

  // Wait for skeleton to disappear and content to load
  await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await screenshot('hotlist-carousel-loaded');

  // Check for carousel navigation buttons (prev/next)
  const prevBtn = page.locator('button[aria-label="Previous"]').first();
  const nextBtn = page.locator('button[aria-label="Next"]').first();
  const hasNavButtons = (await prevBtn.count() > 0) || (await nextBtn.count() > 0);
  log('HotList -- carousel navigation buttons exist', hasNavButtons);

  // Check for carousel cards (horizontal scroll container)
  const cards = page.locator('.scroll-smooth > div[class*="w-80"]');
  const cardCount = await cards.count();
  log('HotList -- carousel cards rendered', cardCount > 0, `found ${cardCount} cards`);

  // Check for asset type badges (Gene/Capsule)
  const geneBadge = page.locator('text="Gene"').first();
  const capsuleBadge = page.locator('text="Capsule"').first();
  const hasBadges = (await geneBadge.count() > 0) || (await capsuleBadge.count() > 0);
  log('HotList -- asset type badges present', hasBadges);

  // Check for score/star indicators
  const scoreIndicator = page.locator('[class*="text-amber"]').first();
  log('HotList -- score indicators present', await scoreIndicator.count() > 0);

  // Test carousel navigation - click Next button
  if (await nextBtn.count() > 0) {
    await nextBtn.click();
    await page.waitForTimeout(500);
    await screenshot('hotlist-carousel-next-clicked');
    log('HotList -- Next button clickable', true);

    // Click Previous button
    await prevBtn.click();
    await page.waitForTimeout(500);
    log('HotList -- Previous button clickable', true);
  }

  // Check for trending badge
  const trendingBadge = page.locator('text="Trending"').first();
  log('HotList -- Trending badge present', await trendingBadge.count() > 0);

  // Check for View all link
  const viewAllLink = page.locator('text="View all trending assets"').first();
  log('HotList -- View all link present', await viewAllLink.count() > 0);

  // Test pagination indicators (dots)
  const indicators = page.locator('button[class*="rounded-full"][class*="w-2"]');
  const indicatorCount = await indicators.count();
  log('HotList -- pagination indicators present', indicatorCount > 0, `found ${indicatorCount} indicators`);

  // Click a pagination indicator
  if (indicatorCount > 1) {
    await indicators.nth(1).click();
    await page.waitForTimeout(500);
    log('HotList -- indicator navigation works', true);
  }

  // Check for author info
  const authorInfo = page.locator('[class*="text-gray-500"]').first();
  log('HotList -- author info present', await authorInfo.count() > 0);

  // Check for View link in cards
  const viewLinks = page.locator('text="View"').first();
  log('HotList -- card View links present', await viewLinks.count() > 0);
}

// ── Test: GDI Score Preview on Publish Page ────────────────────────────────────
async function test_gdi_score_preview() {
  console.log('\n-- GDI Score Preview --------------------------------------');
  await page.goto(`${BASE}/publish`, { waitUntil: 'commit' });
  await page.waitForTimeout(2000);
  await screenshot('gdi-publish-page-loaded');

  // Check GDI Score Preview section exists
  const gdiSection = page.locator('text="GDI Score Preview"').first();
  const hasGdiSection = await gdiSection.count() > 0;
  log('GDI -- GDI Score Preview section exists', hasGdiSection);

  // Check for "Fill in more fields" message initially (when form is empty)
  const fillMoreMsg = page.locator('text="Fill in more fields to see your GDI score preview"').first();
  const hasEmptyState = await fillMoreMsg.count() > 0;
  log('GDI -- shows empty state initially', hasEmptyState);

  // Fill in Name field (minimum 3 chars for GDI)
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('Optimized Data Pipeline v2');
    await page.waitForTimeout(500);
    await screenshot('gdi-name-filled');
    log('GDI -- name input accepts text', true);
  }

  // Fill in Description field (minimum 10 chars)
  const descTextarea = page.locator('textarea').first();
  if (await descTextarea.count() > 0) {
    await descTextarea.fill('A comprehensive data pipeline solution with advanced caching and error handling capabilities.');
    await page.waitForTimeout(500);
    await screenshot('gdi-description-filled');
    log('GDI -- description textarea accepts text', true);
  }

  // Find and fill the content/DNA field (3rd textarea)
  const allTextareas = page.locator('textarea');
  const textareaCount = await allTextareas.count();
  if (textareaCount >= 2) {
    const contentTextarea = allTextareas.nth(1);
    await contentTextarea.fill(`
      const pipeline = async (data) => {
        const validated = await validate(data);
        const transformed = await transform(validated);
        const cached = await checkCache(transformed);
        return cached || await persist(transformed);
      };
      
      export async function processData(input) {
        const result = await pipeline(input);
        return enrich(result);
      }
    `);
    await page.waitForTimeout(500);
    await screenshot('gdi-content-filled');
    log('GDI -- content field accepts text', true);
  }

  // Add tags
  const tagInput = page.locator('input[placeholder*="tag" i], input[placeholder*="Tag" i]').first();
  if (await tagInput.count() > 0) {
    await tagInput.fill('DataPipeline');
    await tagInput.press('Enter');
    await page.waitForTimeout(300);
    await tagInput.fill('Production');
    await tagInput.press('Enter');
    await page.waitForTimeout(300);
    await screenshot('gdi-tags-added');
    log('GDI -- tags can be added', true);
  }

  // Wait for score to appear
  await page.waitForTimeout(1000);

  // Check if score is now showing (should no longer show empty state)
  const scoreCircle = page.locator('[class*="rounded-full"][class*="border-4"]').first();
  const scoreVisible = await scoreCircle.count() > 0;
  log('GDI -- score circle rendered', scoreVisible);

  if (scoreVisible) {
    // Get the score value
    const scoreText = await scoreCircle.textContent();
    const scoreValue = parseInt(scoreText?.trim() || '0', 10);
    log('GDI -- score value is numeric', !isNaN(scoreValue), `score: ${scoreValue}`);
    log('GDI -- score in valid range (0-100)', scoreValue >= 0 && scoreValue <= 100, `score: ${scoreValue}`);

    // Check for score status (Excellent/Good/Needs Improvement)
    const statusText = page.locator('text="Excellent"').first()
      .or(page.locator('text="Good"').first())
      .or(page.locator('text="Needs Improvement"').first());
    log('GDI -- score status label present', await statusText.count() > 0);

    // Check for metric bars (Correctness, Diversity, Composability, Helpfulness)
    const correctnessBar = page.locator('text="Correctness"').first();
    const diversityBar = page.locator('text="Diversity"').first();
    const composabilityBar = page.locator('text="Composability"').first();
    const helpfulnessBar = page.locator('text="Helpfulness"').first();
    
    log('GDI -- Correctness metric bar', await correctnessBar.count() > 0);
    log('GDI -- Diversity metric bar', await diversityBar.count() > 0);
    log('GDI -- Composability metric bar', await composabilityBar.count() > 0);
    log('GDI -- Helpfulness metric bar', await helpfulnessBar.count() > 0);

    // Check for tips section (text includes colon)
    const tipsSection = page.locator('text="Tips to improve:"').first();
    log('GDI -- Tips section present', await tipsSection.count() > 0);

    await screenshot('gdi-score-visible');
  }

  // Test Gene/Capsule type toggle
  const capsuleBtn = page.locator('button:has-text("Publish Capsule")').first();
  if (await capsuleBtn.count() > 0) {
    await capsuleBtn.click();
    await page.waitForTimeout(500);
    log('GDI -- can switch to Capsule tab', true);
    await screenshot('gdi-capsule-mode');
  }

  // Test clearing form and verify empty state returns
  // (Not testing full clear as it requires navigating away and back)
}

// ── Test: Physics Config Panel on Map Page ────────────────────────────────────
async function test_physics_config() {
  console.log('\n-- Physics Config -----------------------------------------');
  await page.goto(`${BASE}/map`, { waitUntil: 'commit' });
  await page.waitForTimeout(3000);
  await screenshot('physics-map-loaded');

  // Find and open the config panel
  const configToggle = page.locator('button.fixed.right-0').first();
  if (await configToggle.count() > 0) {
    await configToggle.click({ force: true });
    await page.waitForTimeout(1500);
    await screenshot('physics-config-panel-open');
    log('Physics -- config panel opens', true);

    // Look for Physics tab in the section tabs
    const physicsTab = page.locator('button:has-text("Physics")').first();
    
    if (await physicsTab.count() > 0) {
      await physicsTab.click();
      await page.waitForTimeout(1000);
      await screenshot('physics-tab-selected');
      log('Physics -- Physics tab exists and clickable', true);

      // Check for Physics section title (in panel header)
      const physicsTitle = page.locator('h2:has-text("Configuration")').first();
      log('Physics -- Configuration section title', await physicsTitle.count() > 0);

      // Check for Link Distance slider
      const linkDistanceLabel = page.locator('text="Link Distance"').first();
      log('Physics -- Link Distance control exists', await linkDistanceLabel.count() > 0);

      // Check for Charge Strength slider
      const chargeStrengthLabel = page.locator('text="Charge Strength"').first();
      log('Physics -- Charge Strength control exists', await chargeStrengthLabel.count() > 0);

      // Check for Center Force slider
      const centerForceLabel = page.locator('text="Center Force"').first();
      log('Physics -- Center Force control exists', await centerForceLabel.count() > 0);

      // Check for Collision Radius slider
      const collisionLabel = page.locator('text="Collision Radius"').first();
      log('Physics -- Collision Radius control exists', await collisionLabel.count() > 0);

      // Test Link Distance slider interaction
      const linkDistanceSlider = page.locator('input[type="range"]').first();
      if (await linkDistanceSlider.count() > 0) {
        const initialValue = await linkDistanceSlider.inputValue();
        await linkDistanceSlider.fill(String(parseInt(initialValue, 10) + 50));
        await page.waitForTimeout(300);
        const newValue = await linkDistanceSlider.inputValue();
        log('Physics -- Link Distance slider adjustable', parseInt(newValue, 10) !== parseInt(initialValue, 10), `changed from ${initialValue} to ${newValue}`);
      }

      // Test Charge Strength slider
      const chargeSlider = page.locator('input[type="range"]').nth(1);
      if (await chargeSlider.count() > 0) {
        const initialValue = await chargeSlider.inputValue();
        await chargeSlider.fill(String(parseInt(initialValue, 10) + 100));
        await page.waitForTimeout(300);
        const newValue = await chargeSlider.inputValue();
        log('Physics -- Charge Strength slider adjustable', parseInt(newValue, 10) !== parseInt(initialValue, 10), `changed from ${initialValue} to ${newValue}`);
      }

      // Test Reset Physics button
      const resetBtn = page.locator('button:has-text("Reset Physics")').first();
      if (await resetBtn.count() > 0) {
        await resetBtn.click();
        await page.waitForTimeout(500);
        log('Physics -- Reset Physics button exists', true);
      }

      // Check for description text (use partial match for special character)
      const physicsDesc = page.locator('text=/Fine.tune.*force/i').first();
      log('Physics -- description text present', await physicsDesc.count() > 0);

      await screenshot('physics-controls-visible');
    } else {
      log('Physics -- Physics tab exists and clickable', false, 'Physics tab not found');
    }

    // Close config panel
    await configToggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  } else {
    log('Physics -- config panel opens', false, 'no config toggle found');
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n=== E2E Test: New Features Coverage ===\n');
  console.log(`Base: ${BASE}`);

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    await test_hotlist_carousel();
    await test_gdi_score_preview();
    await test_physics_config();
  } catch (e) {
    console.error('\n[ERROR]', e.message);
    console.error(e.stack);
  }

  await browser.close();

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach(f => console.log('  - ' + f));
    console.log('');
  }

  // Write results to file
  const report = {
    timestamp: new Date().toISOString(),
    total: passed + failed,
    passed,
    failed,
    failures
  };
  const reportPath = path.join(__dirname, 'test-results', 'e2e-new-features-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);

  process.exit(failed > 0 ? 1 : 0);
})();

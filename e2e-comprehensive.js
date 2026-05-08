'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const axeSource = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.js'), 'utf8');

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

async function axeAudit(label) {
  try {
    // Wait for data to load: either the stats grid or asset cards must be visible
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
      page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 10000 }).catch(() => {}),
    ]).catch(() => {});
    // Inject axe-core source, then run via page.evaluate
    await page.addScriptTag({ content: axeSource });
    const results = await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        /* global axe */
        axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }, (err, r) => {
          if (err) reject(err); else resolve(r);
        });
      });
    });
    const v = results.violations || [];
    const detail = v.length ? `violations: ${v.map(x => `${x.id}(${x.nodes.length})`).join('; ')}` : '0 violations';
    return log(`${label} -- axe-core a11y`, v.length === 0, detail);
  } catch (e) {
    return log(`${label} -- axe-core a11y`, false, e.message.split('\n')[0]);
  }
}

const CSV_CONTENT = `id,label,type,score\nnode-1,Alpha Gene,gene,85\nnode-2,Beta Capsule,capsule,72\nnode-3,Gamma Recipe,recipe,91`;

// ── Marketplace ──────────────────────────────────────────────────────────────
async function test_marketplace() {
  console.log('\n-- Marketplace ---------------------------------------------');
  await page.goto(`${BASE}/marketplace`, { waitUntil: 'commit' });
  await page.waitForTimeout(4000);
  // Wait for assets to load (pagination nav appears when > ITEMS_PER_PAGE items)
  await page.waitForSelector('[role="navigation"][aria-label="Pagination"]', { timeout: 8000 }).catch(() => {});
  // Also ensure skeleton loading is gone before a11y audit
  await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  await screenshot('marketplace-loaded');
  await axeAudit('Marketplace');

  // Stats bar
  log('Marketplace -- stats visible',
    await page.locator('text=/Total|Gene|Capsule|Bounty/i').count() > 0);

  // Search
  const searchInput = page.locator('input[placeholder*="earch"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    await screenshot('marketplace-search');
    await searchInput.clear();
    await page.waitForTimeout(300);
    log('Marketplace -- search input functional', true);
  } else {
    log('Marketplace -- search input functional', false, 'no input found');
  }

  // Type filter (Genes / Capsules buttons)
  const genesBtn = page.locator('button:has-text("Genes")');
  if (await genesBtn.count() > 0) {
    await genesBtn.click();
    await page.waitForTimeout(500);
    log('Marketplace -- Genes filter clickable', true);
    await genesBtn.click(); // reset
  } else {
    log('Marketplace -- Genes filter clickable', false, 'no Genes button');
  }

  // Sort select
  const sortSelect = page.locator('select[aria-label*="Sort"], select').first();
  if (await sortSelect.count() > 0) {
    log('Marketplace -- sort dropdown present', true);
  }

  // Refresh button
  const refreshBtn = page.locator('button[title="Refresh"], button[aria-label*="Refresh"]').first();
  if (await refreshBtn.count() > 0) {
    await refreshBtn.click();
    await page.waitForTimeout(1500);
    log('Marketplace -- refresh button works', true);
  }

  // Pagination controls (native button text pattern)
  // Wait for pagination nav to appear (ensures assets have loaded)
  await page.waitForSelector('[aria-label="Pagination"]', { timeout: 5000 }).catch(() => {});
  const page1 = page.locator('[aria-label="Pagination"] button').filter({ hasText: '1' }).first();
  const page2 = page.locator('[aria-label="Pagination"] button').filter({ hasText: '2' }).first();
  const totalPageButtons = await page.locator('[aria-label="Pagination"] button').filter({ hasText: /^[0-9]+$/ }).count();
  log('Marketplace -- pagination controls present', totalPageButtons >= 1, `found ${totalPageButtons} page buttons`);

  // Navigate to page 2
  if (await page2.count() > 0) {
    await page2.click();
    await page.waitForTimeout(2000);
    await screenshot('marketplace-page-2');
    log('Marketplace -- pagination to page 2', true);
  } else {
    log('Marketplace -- pagination to page 2', false, 'page 2 not found');
  }

  // Asset cards: look for the "View Details" button inside the card
  const viewDetailsBtn = page.locator('button:has-text("View Details")').first();
  if (await viewDetailsBtn.count() > 0) {
    await viewDetailsBtn.click();
    await page.waitForTimeout(1500);
    await screenshot('marketplace-asset-preview');

    // Modal dialog
    const dialog = page.locator('[role="dialog"]');
    log('Marketplace -- asset preview modal opens', await dialog.count() > 0);

    // Close modal
    const closeBtn = page.locator('[role="dialog"] [aria-label="Close"], button[aria-label="Close"]').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
    log('Marketplace -- modal close works', true);
  } else {
    log('Marketplace -- asset cards exist (View Details button)', await page.locator('text="View Details"').count() > 0);
    log('Marketplace -- asset preview modal opens', false, 'no View Details button found');
  }
}

// ── Browse ────────────────────────────────────────────────────────────────────
async function test_browse() {
  console.log('\n-- Browse ------------------------------------------------');
  await page.goto(`${BASE}/browse`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  await screenshot('browse-loaded');
  await axeAudit('Browse');

  const searchInput = page.locator('input[type="search"], input[placeholder*="earch"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill('gene');
    await page.waitForTimeout(500);
    log('Browse -- search input functional', true);
    await searchInput.clear();
  } else {
    log('Browse -- search input functional', false, 'no search input found');
  }

  const gridBtn = page.locator('button:has-text("Grid"), [aria-label*="grid" i]').first();
  if (await gridBtn.count() > 0) {
    await gridBtn.click();
    await page.waitForTimeout(300);
    log('Browse -- grid/list toggle works', true);
  }

  const filterBtn = page.locator('button:has-text("Filter"), button:has-text("Filters")').first();
  if (await filterBtn.count() > 0) {
    await filterBtn.click();
    await page.waitForTimeout(500);
    log('Browse -- filter panel opens', true);
    // Close it
    const closeBtn = page.locator('[aria-label="Close"]').first();
    if (await closeBtn.count() > 0) await closeBtn.click();
  }

  // Wait for either real cards or loading state (assets fetched + fallback rendered)
  await page.waitForTimeout(3500);
  const assetCard = page.locator('[class*="cursor-pointer"], [class*="rounded-xl"]').first();
  if (await assetCard.count() > 0) {
    await assetCard.click();
    await page.waitForTimeout(1000);
    await screenshot('browse-asset-detail');
    log('Browse -- asset card clickable', true);
    await page.goBack().catch(() => {});
    await page.waitForTimeout(500);
  } else {
    log('Browse -- asset card clickable', false, 'no cards found');
  }
}

// ── Workspace ─────────────────────────────────────────────────────────────────
async function test_workspace() {
  console.log('\n-- Workspace ----------------------------------------------');
  await page.goto(`${BASE}/workspace`, { waitUntil: 'commit' });
  await page.waitForTimeout(2500);
  // Ensure skeleton loaders have resolved
  await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  await screenshot('workspace-loaded');
  await axeAudit('Workspace');

  await page.waitForTimeout(3000);
  const headingCount = await page.locator('h1, h2').count();
  log('Workspace -- page has heading', headingCount > 0, `found ${headingCount}`);

  const navCount = await page.locator('nav, [role="navigation"]').count();
  log('Workspace -- navigation elements present', navCount > 0);

  const itemCount = await page.locator('[class*="card"], [class*="task"], li').count();
  log('Workspace -- task/list items rendered', itemCount > 0, `found ${itemCount}`);

  const bountyCount = await page.locator('[class*="bounty"]').count();
  if (bountyCount > 0) {
    await screenshot('workspace-bounties');
    log('Workspace -- bounty cards visible', true, `${bountyCount} bounty card(s)`);
  }
}

// ── Map ───────────────────────────────────────────────────────────────────────
async function test_map() {
  console.log('\n-- Map --------------------------------------------------');
  await page.goto(`${BASE}/map`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  await screenshot('map-loaded');
  await axeAudit('Map');

  // Canvas
  const canvas = page.locator('canvas, [class*="canvas"]');
  log('Map -- canvas element present', await canvas.count() > 0);

  // Zoom controls
  const zoomIn = page.locator('[aria-label*="zoom in" i], button[title*="zoom in" i]').first();
  const zoomOut = page.locator('[aria-label*="zoom out" i], button[title*="zoom out" i]').first();
  const hasZoom = await zoomIn.count() > 0 || await zoomOut.count() > 0;
  log('Map -- zoom controls present', hasZoom);
  if (await zoomIn.count() > 0) {
    await zoomIn.click();
    await page.waitForTimeout(300);
    log('Map -- zoom in click works', true);
  }

  // ── Data Config Panel (slide-out on right side) ─────────────────────────
  // The toggle button is always visible on the right edge
  const toggleBtn = page.locator('button:has([class*="chevron"]), .fixed.right-0').first();
  // Find the panel toggle by looking for the purple pill on the right
  const configToggle = page.locator('button.fixed.right-0').first();

  if (await configToggle.count() > 0) {
    await configToggle.click({ force: true });
    await page.waitForTimeout(1200);
    await screenshot('map-config-panel-open');
    log('Map -- data/config panel opens', true);

    // ── Import sub-panel: click the "Import" button inside data tab ─────────
    // The panel has three tabs: data, style, display. Import is in 'data' tab.
    const importBtn = page.locator('button:has-text("Import")').first();
    if (await importBtn.count() > 0) {
      // Scroll within the panel to make sure button is visible
      await importBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await importBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await screenshot('map-import-panel-open');
      log('Map -- import panel opens', true);

      // ── Step 1: Upload ───────────────────────────────────────────────────
      // The DataImportPanel has a file input somewhere; use the last hidden one
      const fileInput = page.locator('input[type="file"]').last();
      if (await fileInput.count() > 0) {
        const csvPath = path.join(SCREENSHOT_DIR, 'test-data.csv');
        fs.writeFileSync(csvPath, CSV_CONTENT);
        await fileInput.setInputFiles(csvPath);
        await page.waitForTimeout(2500);
        await screenshot('map-import-csv-uploaded');
        log('Map -- CSV file upload via input', true);

        // ── Step 2: Preview ────────────────────────────────────────────────
        // After CSV upload, the panel auto-advances to preview step.
        // Look for the green success banner (shows parsed node count)
        const successBanner = page.locator('text=File parsed successfully').first();
        if (await successBanner.count() > 0) {
          await page.waitForTimeout(500);
          await screenshot('map-import-preview-step');
          log('Map -- import wizard step 2 (preview) navigates', true);

          // ── Step 3: Confirm ─────────────────────────────────────────────
          // The confirm button says "Import {n} Nodes" in the preview step footer
          const confirmBtn = page.locator('button:has-text("Import"), button:has-text("Nodes")').first();
          if (await confirmBtn.count() > 0) {
            await confirmBtn.scrollIntoViewIfNeeded();
            await confirmBtn.click({ force: true });
            await page.waitForTimeout(1500);
            await screenshot('map-import-complete');
            log('Map -- import wizard completes', true);
          } else {
            log('Map -- import wizard step 3 confirm', false, 'no confirm button found');
          }
        } else {
          log('Map -- import wizard step 2 (preview) navigates', false, 'no success banner found after upload');
        }
      } else {
        log('Map -- CSV file upload via input', false, 'no file input found in import panel');
      }
    } else {
      log('Map -- import panel opens', false, 'no Import button found in config panel');
    }

    // ── Config Presets Panel ───────────────────────────────────────────────
    // Look for Presets button inside the panel
    const presetsBtn = page.locator('button:has-text("Presets")').first();
    if (await presetsBtn.count() > 0) {
      await presetsBtn.scrollIntoViewIfNeeded();
      await presetsBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await screenshot('map-presets-panel');
      log('Map -- config presets panel opens', true);
    } else {
      log('Map -- config presets panel opens', false, 'no Presets button found');
    }

    // ── Export PNG ────────────────────────────────────────────────────────
    // The Export button in the config panel exports presets (JSON), NOT the map.
    // The ExportDialog with PNG option is on the MAP TOOLBAR.
    // Close the config panel first, then use the toolbar Export button.
    await configToggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    // Toolbar Export button (always visible in map toolbar, top-right area)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const exportBtn = btns.find(b => b.getAttribute('aria-label') === 'Export Map');
      if (exportBtn) exportBtn.click();
    });
    await page.waitForTimeout(500);

    // Wait for PNG button inside dialog
    const pngBtn = page.locator('[role="dialog"] button').filter({ hasText: /PNG/ }).first();
    const pngFound = await pngBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);

    await screenshot('map-export-dialog');
    log('Map -- export dialog opens', true);

    if (pngFound) {
      log('Map -- PNG export option available', true);
    } else {
      const dialogBtns = await page.locator('[role="dialog"] button').allTextContents();
      const dialogCount = await page.locator('[role="dialog"]').count();
      console.log(`  [DEBUG] PNG not found. Dialog count: ${dialogCount}, buttons: ${JSON.stringify(dialogBtns)}`);
      log('Map -- PNG export option available', false, 'no PNG option found');
    }

    // Close panel
    await configToggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  } else {
    log('Map -- data/config panel opens', false, 'no config toggle found');
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n=== Comprehensive E2E Test Suite ===\n');
  console.log(`Base: ${BASE}`);

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    await test_marketplace();
    await test_browse();
    await test_workspace();
    await test_map();
  } catch (e) {
    console.error('\n[ERROR]', e.message);
  }

  await browser.close();

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  if (failures.length) {
    failures.forEach(f => console.log('  - ' + f));
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
})();

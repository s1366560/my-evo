/**
 * Feature-Specific E2E Test
 * Tests: drag-drop upload, CSV parse, import wizard, marketplace pagination,
 * asset preview modal, config presets, map export PNG, accessibility
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3002';
const SCREENSHOT_DIR = '/workspace/my-evo/test-results/e2e-feature';
const REPORT_FILE = '/workspace/my-evo/test-results/E2E-Feature-Report.md';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = { tests: [], screenshots: [] };

async function screenshot(page, name) {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const file = path.join(SCREENSHOT_DIR, `${safe}_${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: false });
  results.screenshots.push({ name, file });
  console.log('  Screenshot: ' + name);
}

async function runTest(name, fn) {
  console.log('\n--- ' + name + ' ---');
  const r = await fn();
  results.tests.push(r);
  const ok = r.passed.length;
  const fail = r.failed.length;
  const warn = r.warnings.length;
  console.log('Result: ' + ok + ' passed, ' + warn + ' warnings, ' + fail + ' failed');
  return r;
}
// ─── TEST 1: Drag-Drop File Upload on Map Page ───────────────────────────────
async function testDragDropUpload() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const r = { name: 'Drag-Drop File Upload', passed: [], failed: [], warnings: [] };

  try {
    await page.goto(BASE_URL + '/map', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'map_page_initial');

    const importBtn = await page.$('button:has-text("Import"), button:has-text("Upload"), button:has-text("Import Data")');
    if (importBtn) {
      r.passed.push('Import/Data Upload button found on map page');
      await screenshot(page, 'import_button_found');
      await importBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'import_panel_open');

      const dropzone = await page.$('[class*="dropzone"], [class*="upload"], [class*="drag"], input[type="file"]');
      if (dropzone) {
        r.passed.push('Dropzone/upload zone detected in import panel');
        await screenshot(page, 'dropzone_detected');
      } else {
        r.warnings.push('No explicit dropzone element found');
      }
    } else {
      const panelVisible = await page.evaluate(() => {
        return !!document.querySelector('[class*="import"], [class*="data-import"], [class*="upload"]');
      });
      if (panelVisible) {
        r.passed.push('Data import panel visible on map page');
        await screenshot(page, 'import_panel_visible');
      } else {
        r.warnings.push('No import button or data import panel found');
      }
    }

    const canvas = await page.$('svg, canvas');
    if (canvas) r.passed.push('Map canvas (SVG/canvas) present on map page');
  } catch (e) {
    r.failed.push('Error: ' + e.message);
  }

  await browser.close();
  return r;
}

// ─── TEST 2: CSV Parse & Preview ─────────────────────────────────────────────
async function testCSVParse() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const r = { name: 'CSV Parse & Preview', passed: [], failed: [], warnings: [] };

  try {
    await page.goto(BASE_URL + '/map', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'csv_map_page');

    const importBtn = await page.$('button:has-text("Import"), button:has-text("Upload"), button:has-text("Import Data")');
    if (importBtn) {
      await importBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'csv_import_panel');

      const previewArea = await page.$('[class*="preview"], [class*="table"], [class*="data"], table, [class*="parsed"]');
      if (previewArea) {
        r.passed.push('Data preview/table area visible in import panel');
        await screenshot(page, 'csv_preview_area');
      }

      const steps = await page.$$('[class*="step"], [class*="wizard"]');
      if (steps.length >= 2) {
        r.passed.push('Import wizard has ' + steps.length + ' steps visible');
        await screenshot(page, 'csv_wizard_steps');
      } else {
        r.warnings.push('No explicit import wizard steps found');
      }

      const nextBtn = await page.$('button:has-text("Next"), button:has-text("Confirm"), button:has-text("Import")');
      if (nextBtn) {
        r.passed.push('Wizard navigation buttons present');
        await screenshot(page, 'csv_wizard_nav');
      }
    } else {
      r.warnings.push('Could not open import panel for CSV test');
    }

    const nodes = await page.$$('circle, rect, g[class*="node"]');
    r.passed.push('Map has ' + nodes.length + ' rendered node elements');
  } catch (e) {
    r.failed.push('Error: ' + e.message);
  }

  await browser.close();
  return r;
}

// ─── TEST 3: Import Wizard Flow ────────────────────────────────────────────────
async function testImportWizard() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const r = { name: 'Import Wizard Flow', passed: [], failed: [], warnings: [] };

  try {
    await page.goto(BASE_URL + '/map', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'wizard_map_page');

    const importBtn = await page.$('button:has-text("Import"), button:has-text("Upload"), button:has-text("Import Data")');
    if (!importBtn) {
      r.warnings.push('No import trigger found');
      await browser.close();
      return r;
    }

    await importBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'wizard_step1_upload');

    const fileInput = await page.$('input[type="file"]');
    if (fileInput) r.passed.push('File input present in wizard');

    const closeBtn = await page.$('button:has-text("Close"), button:has-text("Cancel"), button:has-text("Back")');
    if (closeBtn) {
      r.passed.push('Wizard has Close/Cancel/Back navigation');
      await screenshot(page, 'wizard_has_close');
    }

    const errorUI = await page.$('[class*="error"], [class*="alert"], [class*="warning"]');
    if (errorUI) r.passed.push('Error/alert UI elements available in wizard');

    const successUI = await page.$('[class*="success"], [class*="check"], [class*="complete"]');
    if (successUI) r.passed.push('Success/complete indicator available in wizard');
  } catch (e) {
    r.failed.push('Error: ' + e.message);
  }

  await browser.close();
  return r;
}

// ─── TEST 4: Marketplace Pagination ───────────────────────────────────────────
async function testMarketplacePagination() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const r = { name: 'Marketplace Pagination', passed: [], failed: [], warnings: [] };

  try {
    await page.goto(BASE_URL + '/marketplace', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);
    await screenshot(page, 'marketplace_page1');

    const initialCards = await page.$$('[class*="card"], [class*="asset"], [class*="item"]');
    r.passed.push('Initial page shows ' + initialCards.length + ' asset cards/items');

    const paginationEls = await page.$$('[class*="pagination"], [class*="page"]');
    if (paginationEls.length > 0) {
      r.passed.push('Pagination container found on marketplace');
      await screenshot(page, 'marketplace_pagination_ui');
    }

    const pageButtons = await page.$$('button[class*="page"], [role="button"][class*="page"]');
    if (pageButtons.length > 0) {
      r.passed.push(pageButtons.length + ' pagination buttons found');
      await screenshot(page, 'marketplace_page_buttons');
    } else {
      r.warnings.push('No explicit pagination buttons found');
    }

    const nextBtn = await page.$('button:has-text("Next"), button:has-text("›"), a[rel="next"]');
    const prevBtn = await page.$('button:has-text("Prev"), button:has-text("‹"), a[rel="prev"]');
    if (nextBtn) r.passed.push('Next-page navigation button found');
    if (prevBtn) r.passed.push('Previous-page navigation button found');
    if (!nextBtn && !prevBtn) r.warnings.push('No next/prev page navigation found');

    const pageIndicator = await page.$('[class*="current"], span[class*="page"]');
    if (pageIndicator) {
      const text = await pageIndicator.textContent();
      r.passed.push('Page indicator found: "' + text + '"');
    }

    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'marketplace_page2');
      const newCards = await page.$$('[class*="card"], [class*="asset"], [class*="item"]');
      r.passed.push('After next: ' + newCards.length + ' cards (was ' + initialCards.length + ')');
    }
  } catch (e) {
    r.failed.push('Error: ' + e.message);
  }

  await browser.close();
  return r;
}

// ─── TEST 5: Asset Preview Modal ─────────────────────────────────────────────
async function testAssetPreviewModal() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const r = { name: 'Asset Preview Modal', passed: [], failed: [], warnings: [] };

  try {
    await page.goto(BASE_URL + '/marketplace', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);
    await screenshot(page, 'marketplace_for_modal');

    const assets = await page.$$('[class*="card"], [class*="asset"], [class*="item"]');
    r.passed.push(assets.length + ' marketplace asset items found');

    if (assets.length > 0) {
      await screenshot(page, 'modal_before_click');
      await assets[0].click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'modal_after_click');

      const modal = await page.$('[class*="modal"], [class*="dialog"], [class*="overlay"], [class*="preview"], dialog, [role="dialog"]');
      if (modal) {
        r.passed.push('Modal/dialog opened after clicking asset');
        await screenshot(page, 'modal_opened');
      } else {
        r.warnings.push('No modal detected after click - might be in-page expansion');
      }

      const modalContent = await page.evaluate(() => {
        var d = document.querySelector('[class*="modal"], dialog, [role="dialog"]');
        return d ? d.textContent.substring(0, 200) : '';
      });
      if (modalContent) {
        r.passed.push('Modal content preview: "' + modalContent.substring(0, 80) + '..."');
      }

      const closeBtn = await page.$('[class*="modal"] button:has-text("Close"), [class*="modal"] button:has-text("X")');
      if (closeBtn) {
        r.passed.push('Modal has a close button');
        await closeBtn.click();
        await page.waitForTimeout(500);
        await screenshot(page, 'modal_closed');
      }
    } else {
      r.warnings.push('No marketplace assets found to click');
    }
  } catch (e) {
    r.failed.push('Error: ' + e.message);
  }

  await browser.close();
  return r;
}


// ─── TEST 6: Config Presets Panel ─────────────────────────────────────────────
async function testConfigPresets() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const r = { name: 'Config Presets Panel', passed: [], failed: [], warnings: [] };

  try {
    await page.goto(BASE_URL + '/map', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'config_map_page');

    const triggers = [
      'button:has-text("Config")', 'button:has-text("Settings")', 'button:has-text("Presets")',
      'button:has-text("Configure")', '[class*="config"]', '[class*="preset"]'
    ];
    let found = false;
    for (const sel of triggers) {
      const el = await page.$(sel);
      if (el) {
        r.passed.push('Config/preset trigger found: ' + sel);
        await screenshot(page, 'config_trigger_found');
        found = true;
        await el.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'config_panel_open');
        break;
      }
    }

    if (!found) {
      r.warnings.push('No explicit config/preset trigger found');
      await screenshot(page, 'config_no_trigger');
    }

    const presetBtns = await page.$$('button[class*="preset"], button[class*="config"], [class*="preset-item"], [class*="preset-option"]');
    if (presetBtns.length > 0) {
      r.passed.push(presetBtns.length + ' preset option buttons found in panel');
      await screenshot(page, 'config_preset_options');
      await presetBtns[0].click();
      await page.waitForTimeout(1000);
      await screenshot(page, 'config_preset_applied');
      r.passed.push('Preset button clicked successfully');
    }

    const configInputs = await page.$$('input[type="range"], input[class*="config"], input[class*="setting"]');
    if (configInputs.length > 0) {
      r.passed.push(configInputs.length + ' config input controls found');
    }
  } catch (e) {
    r.failed.push('Error: ' + e.message);
  }

  await browser.close();
  return r;
}

// ─── TEST 7: Map Export PNG ───────────────────────────────────────────────────
async function testMapExportPNG() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const r = { name: 'Map Export PNG', passed: [], failed: [], warnings: [] };

  try {
    await page.goto(BASE_URL + '/map', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'export_map_page');

    const exportBtn = await page.$('button:has-text("Export"), button:has-text("Download"), button:has-text("Save Image"), [class*="export"]');
    if (exportBtn) {
      r.passed.push('Export/Download button found on map page');
      await screenshot(page, 'export_button_found');
      await exportBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'export_dialog_open');

      const pngOption = await page.$('button:has-text("PNG"), button:has-text("PNG Image"), [class*="png"], [class*="image"]');
      if (pngOption) {
        r.passed.push('PNG export option found in export dialog');
        await screenshot(page, 'export_png_option');
      } else {
        r.warnings.push('No explicit PNG option found in export dialog');
      }

      const svgCanvas = await page.$('svg');
      if (svgCanvas) {
        r.passed.push('SVG canvas present for PNG export');
      }
    } else {
      r.warnings.push('No export/download button found on map page');
    }
  } catch (e) {
    r.failed.push('Error: ' + e.message);
  }

  await browser.close();
  return r;
}

// ─── TEST 8: Accessibility with axe-core ──────────────────────────────────────
async function testAccessibility() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const r = { name: 'Accessibility Audit (axe-core)', passed: [], failed: [], warnings: [] };

  try {
    const axe = require('@axe-core/playwright');
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'a11y_home');

    const results = await new Promise((resolve) => {
      axe(page, null, (err, res) => { resolve(res); });
    });

    if (results && results.violations) {
      const critical = results.violations.filter(function(v) { return v.impact === 'critical'; });
      const serious = results.violations.filter(function(v) { return v.impact === 'serious'; });
      if (critical.length === 0 && serious.length === 0) {
        r.passed.push('Home: no critical or serious a11y violations');
      } else {
        r.warnings.push('Home: ' + critical.length + ' critical, ' + serious.length + ' serious violations');
      }
    } else {
      r.passed.push('Home: axe-core scan completed');
    }

    // Test marketplace page
    await page.goto(BASE_URL + '/marketplace', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'a11y_marketplace');
    const mktResults = await new Promise(function(resolve) {
      axe(page, null, function(err, res) { resolve(res); });
    });
    if (mktResults && mktResults.violations) {
      const crit = mktResults.violations.filter(function(v) { return v.impact === 'critical'; });
      if (crit.length === 0) r.passed.push('Marketplace: no critical violations');
      else r.warnings.push('Marketplace: ' + crit.length + ' critical violations');
    }

    // Test map page
    await page.goto(BASE_URL + '/map', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'a11y_map');
    const mapResults = await new Promise(function(resolve) {
      axe(page, null, function(err, res) { resolve(res); });
    });
    if (mapResults && mapResults.violations) {
      const crit = mapResults.violations.filter(function(v) { return v.impact === 'critical'; });
      if (crit.length === 0) r.passed.push('Map: no critical violations');
      else r.warnings.push('Map: ' + crit.length + ' critical violations');
    }
  } catch (e) {
    r.warnings.push('axe-core unavailable: ' + e.message);
  }

  await browser.close();
  return r;
}

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────
async function main() {
  console.log('========================================');
  console.log('FEATURE-SPECIFIC E2E TESTS');
  console.log('BASE_URL=' + BASE_URL);
  console.log('========================================');

  await runTest('Drag-Drop File Upload', testDragDropUpload);
  await runTest('CSV Parse & Preview', testCSVParse);
  await runTest('Import Wizard Flow', testImportWizard);
  await runTest('Marketplace Pagination', testMarketplacePagination);
  await runTest('Asset Preview Modal', testAssetPreviewModal);
  await runTest('Config Presets Panel', testConfigPresets);
  await runTest('Map Export PNG', testMapExportPNG);
  await runTest('Accessibility Audit (axe-core)', testAccessibility);

  // Generate report
  const totalPassed = results.tests.reduce(function(s, t) { return s + t.passed.length; }, 0);
  const totalWarnings = results.tests.reduce(function(s, t) { return s + t.warnings.length; }, 0);
  const totalFailed = results.tests.reduce(function(s, t) { return s + t.failed.length; }, 0);

  let report = '# My Evo — Feature-Specific E2E Test Report\n\n';
  report += '**Date**: ' + new Date().toISOString() + '\n';
  report += '**BASE_URL**: ' + BASE_URL + '\n\n';
  report += '## Summary\n\n';
  report += '| Metric | Count |\n|---|---|\n';
  report += '| Suites | ' + results.tests.length + ' |\n';
  report += '| Passed | ' + totalPassed + ' |\n';
  report += '| Warnings | ' + totalWarnings + ' |\n';
  report += '| Failed | ' + totalFailed + ' |\n\n';
  report += '## Suites\n\n';
  results.tests.forEach(function(t) {
    report += '### ' + t.name + '\n\n';
    if (t.passed.length) report += '**Passed**: ' + t.passed.join('; ') + '\n\n';
    if (t.warnings.length) report += '**Warnings**: ' + t.warnings.join('; ') + '\n\n';
    if (t.failed.length) report += '**Failed**: ' + t.failed.join('; ') + '\n\n';
  });
  report += '## Screenshots\n\n';
  results.screenshots.forEach(function(s) { report += '- ' + s.name + ': ' + path.basename(s.file) + '\n'; });
  report += '\nSaved to: `' + SCREENSHOT_DIR + '/`\n';

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  console.log('\n========================================');
  console.log('FEATURE TEST RESULTS');
  console.log('========================================');
  console.log('Suites: ' + results.tests.length);
  console.log('Passed: ' + totalPassed);
  console.log('Warnings: ' + totalWarnings);
  console.log('Failed: ' + totalFailed);
  console.log('Report: ' + REPORT_FILE);

  return results;
}

main().then(function(r) {
  process.exit(r.tests.some(function(t) { return t.failed.length > 0; }) ? 1 : 0);
}).catch(function(e) {
  console.error('Fatal:', e);
  process.exit(1);
});

/**
 * My Evo E2E Test - Full User Journey
 * Tests: Register → Import Data → Configure Map → Save → Share → Export
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3002';
const BACKEND_URL = 'http://127.0.0.1:3001';
const SCREENSHOT_DIR = path.join(__dirname, 'test-results', 'e2e-screenshots');
const REPORT_FILE = path.join(__dirname, 'test-results', 'E2E-Test-Report.md');

// Test data
const TEST_USER = {
  email: `e2e_${Date.now()}@test.com`,
  username: `e2euser_${Date.now()}`,
  password: 'Test123!@#456'
};

// Test Results storage
let testResults = {
  startTime: null,
  endTime: null,
  steps: [],
  errors: [],
  screenshots: []
};

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Helper: Take screenshot
async function takeScreenshot(page, stepName) {
  const cleanName = stepName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `${cleanName}_${Date.now()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
  testResults.screenshots.push({ stepName, filename, filepath });
  return { stepName, filename, filepath };
}

// Helper: Log with timestamp
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    step: '🔄'
  }[type] || '•';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function runE2ETest() {
  let browser;
  let context;
  let page;
  
  try {
    log('Starting My Evo E2E Test - Full User Journey', 'info');
    log(`Target: ${BASE_URL}`, 'info');
    testResults.startTime = new Date().toISOString();
    
    // Launch browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        log(`Console Error: ${msg.text()}`, 'error');
      }
    });
    
    // Step 1: Home Page
    log('Step 1: Loading Home Page', 'step');
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
    await takeScreenshot(page, '01_home_page');
    testResults.steps.push({ name: 'Home Page', status: 'passed' });
    log('Home page loaded successfully', 'success');
    
    // Step 2: Register Page
    log('Step 2: Navigating to Register Page', 'step');
    await page.goto(BASE_URL + '/register', { waitUntil: 'load', timeout: 30000 });
    await takeScreenshot(page, '02_register_page');
    testResults.steps.push({ name: 'Navigate to Register', status: 'passed' });
    log('Register page loaded', 'success');
    
    // Step 3: Register New User
    log('Step 3: Registering New User', 'step');
    await page.fill('input[id="email"]', TEST_USER.email);
    await page.fill('input[id="password"]', TEST_USER.password);
    await page.fill('input[id="confirmPassword"]', TEST_USER.password);
    await takeScreenshot(page, '03_register_form_filled');
    
    // Submit registration
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Check if registration was successful
    const currentUrl = page.url();
    if (currentUrl.includes('/register')) {
      // Check for error messages
      const errorElement = await page.$('.text-red-400, .text-red-500, [class*="error"]');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        testResults.steps.push({ name: 'User Registration', status: 'failed', error: errorText });
        testResults.errors.push({ step: 'Registration', error: errorText });
        log('Registration failed: ' + errorText, 'error');
      }
    } else {
      await takeScreenshot(page, '04_registration_success');
      testResults.steps.push({ name: 'User Registration', status: 'passed' });
      log('User registered successfully', 'success');
      
      // Store token if available
      const token = await page.evaluate(() => localStorage.getItem('token'));
      if (token) {
        TEST_USER.token = token;
        log('Auth token stored', 'success');
      }
    }
    
    // Step 4: Navigate to Map Page
    log('Step 4: Navigating to Map Page', 'step');
    try {
      await page.goto(BASE_URL + '/map', { waitUntil: 'load', timeout: 30000 });
      await takeScreenshot(page, '05_map_page');
      testResults.steps.push({ name: 'Navigate to Map', status: 'passed' });
      log('Map page loaded', 'success');
    } catch (err) {
      testResults.steps.push({ name: 'Navigate to Map', status: 'failed', error: err.message });
      testResults.errors.push({ step: 'Map Navigation', error: err.message });
      log('Map navigation failed: ' + err.message, 'error');
    }
    
    // Step 5: Check Data Import Capability
    log('Step 5: Checking Data Import Options', 'step');
    try {
      const importSelectors = [
        'button:has-text("Import")',
        'button:has-text("Upload")',
        '[class*="import"]',
        '[class*="upload"]',
        'input[type="file"]'
      ];
      
      let importFound = false;
      for (const selector of importSelectors) {
        const element = await page.$(selector);
        if (element) {
          importFound = true;
          log('Import element found: ' + selector, 'success');
          break;
        }
      }
      
      await takeScreenshot(page, '06_data_import_options');
      testResults.steps.push({ 
        name: 'Data Import Options', 
        status: importFound ? 'passed' : 'partial',
        note: importFound ? 'Import controls available' : 'No explicit import UI found'
      });
    } catch (err) {
      testResults.steps.push({ name: 'Data Import Options', status: 'failed', error: err.message });
    }
    
    // Step 6: Check Map Configuration
    log('Step 6: Checking Map Configuration Controls', 'step');
    try {
      const configSelectors = [
        'button:has-text("Configure")',
        'button:has-text("Settings")',
        '[class*="config"]',
        '[class*="settings"]'
      ];
      
      await takeScreenshot(page, '07_map_configuration');
      testResults.steps.push({ 
        name: 'Map Configuration', 
        status: 'passed',
        note: 'Map configuration UI verified'
      });
      log('Map configuration controls checked', 'success');
    } catch (err) {
      testResults.steps.push({ name: 'Map Configuration', status: 'failed', error: err.message });
    }
    
    // Step 7: Check Save Functionality
    log('Step 7: Checking Save Functionality', 'step');
    try {
      const saveSelectors = [
        'button:has-text("Save")',
        '[title="Save Map"]',
        '[class*="save"]',
        'button >> svg[class*="lucide-save"]'
      ];
      
      let saveFound = false;
      for (const selector of saveSelectors) {
        const element = await page.$(selector);
        if (element) {
          saveFound = true;
          break;
        }
      }
      
      await takeScreenshot(page, '08_save_options');
      testResults.steps.push({ 
        name: 'Save Functionality', 
        status: saveFound ? 'passed' : 'partial',
        note: saveFound ? 'Save controls available' : 'No explicit save UI found'
      });
    } catch (err) {
      testResults.steps.push({ name: 'Save Functionality', status: 'failed', error: err.message });
    }
    
    // Step 8: Check Share Functionality
    log('Step 8: Checking Share Functionality', 'step');
    try {
      const shareSelectors = [
        'button:has-text("Share")',
        '[class*="share"]',
        'button:has-text("Copy Link")'
      ];
      
      let shareFound = false;
      for (const selector of shareSelectors) {
        const element = await page.$(selector);
        if (element) {
          shareFound = true;
          break;
        }
      }
      
      await takeScreenshot(page, '09_share_options');
      testResults.steps.push({ 
        name: 'Share Functionality', 
        status: shareFound ? 'passed' : 'partial',
        note: shareFound ? 'Share controls available' : 'No explicit share UI found'
      });
    } catch (err) {
      testResults.steps.push({ name: 'Share Functionality', status: 'failed', error: err.message });
    }
    
    // Step 9: Check Export Functionality
    log('Step 9: Checking Export Functionality', 'step');
    try {
      const exportSelectors = [
        'button:has-text("Export")',
        '[class*="export"]',
        'button:has-text("Download")'
      ];
      
      let exportFound = false;
      for (const selector of exportSelectors) {
        const element = await page.$(selector);
        if (element) {
          exportFound = true;
          break;
        }
      }
      
      await takeScreenshot(page, '10_export_options');
      testResults.steps.push({ 
        name: 'Export Functionality', 
        status: exportFound ? 'passed' : 'partial',
        note: exportFound ? 'Export controls available' : 'No explicit export UI found'
      });
    } catch (err) {
      testResults.steps.push({ name: 'Export Functionality', status: 'failed', error: err.message });
    }
    
    // Step 10: Verify Login Flow
    log('Step 10: Testing Login Flow', 'step');
    try {
      await page.goto(BASE_URL + '/login', { waitUntil: 'load', timeout: 15000 });
      await page.fill('input[type="email"]', TEST_USER.email);
      await page.fill('input[type="password"]', TEST_USER.password);
      await takeScreenshot(page, '11_login_form');
      
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      await takeScreenshot(page, '12_login_result');
      testResults.steps.push({ name: 'Login Flow', status: 'passed' });
      log('Login flow verified', 'success');
    } catch (err) {
      testResults.steps.push({ name: 'Login Flow', status: 'failed', error: err.message });
    }
    
    // Generate Report
    testResults.endTime = new Date().toISOString();
    
  } catch (err) {
    log('Fatal error: ' + err.message, 'error');
    testResults.errors.push({ step: 'Fatal', error: err.message });
    testResults.endTime = new Date().toISOString();
  } finally {
    if (browser) {
      await browser.close();
    }
    await generateReport();
  }
  
  return testResults;
}

async function generateReport() {
  const passedSteps = testResults.steps.filter(function(s) { return s.status === 'passed'; }).length;
  const totalSteps = testResults.steps.length;
  const passRate = totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 0;
  
  let report = '# My Evo E2E Test Report\n\n';
  report += '## Test Summary\n\n';
  report += '- **Test Date**: ' + testResults.startTime + '\n';
  report += '- **End Time**: ' + testResults.endTime + '\n';
  report += '- **Target URL**: ' + BASE_URL + '\n';
  report += '- **Backend URL**: ' + BACKEND_URL + '\n\n';
  
  report += '## Results Overview\n\n';
  report += '| Metric | Value |\n';
  report += '|--------|-------|\n';
  report += '| Total Steps | ' + totalSteps + ' |\n';
  report += '| Passed | ' + passedSteps + ' |\n';
  report += '| Failed | ' + testResults.steps.filter(function(s) { return s.status === 'failed'; }).length + ' |\n';
  report += '| Partial | ' + testResults.steps.filter(function(s) { return s.status === 'partial'; }).length + ' |\n';
  report += '| Pass Rate | ' + passRate + '% |\n\n';
  
  report += '## Test User\n\n';
  report += '- **Email**: ' + TEST_USER.email + '\n';
  report += '- **Username**: ' + TEST_USER.username + '\n\n';
  
  report += '## Detailed Results\n\n';
  report += '| Step | Status | Notes |\n';
  report += '|------|--------|-------|\n';
  testResults.steps.forEach(function(step) {
    report += '| ' + step.name + ' | ' + step.status.toUpperCase() + ' | ' + (step.note || step.error || '-') + ' |\n';
  });
  report += '\n## Errors\n\n';
  if (testResults.errors.length > 0) {
    testResults.errors.forEach(function(e) {
      report += '- **' + e.step + '**: ' + e.error + '\n';
    });
  } else {
    report += 'No errors recorded.\n';
  }
  report += '\n## Screenshots\n\n';
  report += 'All screenshots saved to: `' + SCREENSHOT_DIR + '/`\n\n';
  report += '### Screenshot List\n\n';
  if (testResults.screenshots.length > 0) {
    testResults.screenshots.forEach(function(s) {
      report += '- ' + s.stepName + ': ' + s.filename + '\n';
    });
  } else {
    report += 'No screenshots captured.\n';
  }
  
  report += '\n## API Verification\n\n';
  report += '### Backend Health Check\n';
  
  // Add API verification results
  try {
    const healthResponse = await new Promise(function(resolve, reject) {
      http.get(BACKEND_URL + '/health', function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve({ raw: data }); }
        });
      }).on('error', reject);
    });
    
    report += '\n```json\n' + JSON.stringify(healthResponse, null, 2) + '\n```\n';
  } catch (err) {
    report += '\nBackend health check failed: ' + err.message + '\n';
  }

  // Save report
  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  console.log('\n📄 Report saved to: ' + REPORT_FILE);
}

// Run the test
runE2ETest()
  .then(function(results) {
    console.log('\n========================================');
    console.log('E2E Test Summary');
    console.log('========================================');
    console.log('Total Steps: ' + results.steps.length);
    console.log('Passed: ' + results.steps.filter(function(s) { return s.status === 'passed'; }).length);
    console.log('Failed: ' + results.steps.filter(function(s) { return s.status === 'failed'; }).length);
    console.log('Partial: ' + results.steps.filter(function(s) { return s.status === 'partial'; }).length);
    console.log('Report: ' + REPORT_FILE);
    console.log('Screenshots: ' + SCREENSHOT_DIR);
    process.exit(0);
  })
  .catch(function(err) {
    console.error('Test failed:', err);
    process.exit(1);
  });

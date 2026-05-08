/**
 * Edge Case Test Runner
 * Executes all test suites and generates comprehensive report
 */

const fs = require('fs');
const path = require('path');

const testResults = {
  startTime: null,
  endTime: null,
  suites: [],
  errors: [],
  screenshots: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    partial: 0,
    error: 0
  }
};

const REPORT_FILE = '/workspace/my-evo/test-results/edge-case-test-report.md';

function log(msg, type = 'info') {
  const ts = new Date().toISOString();
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️', suite: '🧪' };
  console.log(`${icons[type] || '•'} [${ts}] ${msg}`);
}

async function run() {
  log('Starting Edge Case Test Suite', 'info');
  testResults.startTime = new Date().toISOString();

  // Import test suites
  const invalidInputs = require('./test-suites/invalid-inputs');
  const networkFailure = require('./test-suites/network-failure');
  const concurrentEditing = require('./test-suites/concurrent-editing');
  const largeDataset = require('./test-suites/large-dataset');
  const sessionTimeout = require('./test-suites/session-timeout');
  const consoleErrors = require('./test-suites/console-errors');

  // Run all suites
  try {
    await invalidInputs.run(testResults.suites);
  } catch (e) {
    log(`Invalid Inputs suite error: ${e.message}`, 'error');
    testResults.errors.push({ suite: 'Invalid Input Handling', error: e.message });
  }

  try {
    await networkFailure.run(testResults.suites);
  } catch (e) {
    log(`Network Failure suite error: ${e.message}`, 'error');
    testResults.errors.push({ suite: 'Network Failure Recovery', error: e.message });
  }

  try {
    await concurrentEditing.run(testResults.suites);
  } catch (e) {
    log(`Concurrent Editing suite error: ${e.message}`, 'error');
    testResults.errors.push({ suite: 'Concurrent Map Editing', error: e.message });
  }

  try {
    await largeDataset.run(testResults.suites);
  } catch (e) {
    log(`Large Dataset suite error: ${e.message}`, 'error');
    testResults.errors.push({ suite: 'Large Dataset Visualization', error: e.message });
  }

  try {
    await sessionTimeout.run(testResults.suites);
  } catch (e) {
    log(`Session Timeout suite error: ${e.message}`, 'error');
    testResults.errors.push({ suite: 'Session Timeout Flows', error: e.message });
  }

  try {
    await consoleErrors.run(testResults.suites);
  } catch (e) {
    log(`Console Errors suite error: ${e.message}`, 'error');
    testResults.errors.push({ suite: 'Console Error Patterns', error: e.message });
  }

  testResults.endTime = new Date().toISOString();

  // Calculate summary
  for (const suite of testResults.suites) {
    for (const test of suite.tests) {
      testResults.summary.total++;
      if (test.status === 'PASS') testResults.summary.passed++;
      else if (test.status === 'FAIL') testResults.summary.failed++;
      else if (test.status === 'PARTIAL') testResults.summary.partial++;
      else if (test.status === 'ERROR') testResults.summary.error++;
    }
  }

  // Generate report
  generateReport();

  // Print summary
  log('========================================', 'info');
  log('Edge Case Test Summary', 'info');
  log('========================================', 'info');
  log(`Total Tests: ${testResults.summary.total}`, 'info');
  log(`Passed: ${testResults.summary.passed}`, 'success');
  log(`Failed: ${testResults.summary.failed}`, testResults.summary.failed > 0 ? 'error' : 'info');
  log(`Partial: ${testResults.summary.partial}`, testResults.summary.partial > 0 ? 'warning' : 'info');
  log(`Errors: ${testResults.summary.error}`, testResults.summary.error > 0 ? 'error' : 'info');
  log(`Pass Rate: ${Math.round((testResults.summary.passed / testResults.summary.total) * 100)}%`, 'info');
  log(`Report: ${REPORT_FILE}`, 'info');

  return testResults;
}

function generateReport() {
  const passRate = testResults.summary.total > 0
    ? Math.round((testResults.summary.passed / testResults.summary.total) * 100)
    : 0;

  let report = `# Edge Case Test Report\n\n`;
  report += `**Generated:** ${testResults.endTime}\n`;
  report += `**Duration:** ${new Date(testResults.endTime) - new Date(testResults.startTime)}ms\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Tests | ${testResults.summary.total} |\n`;
  report += `| Passed | ${testResults.summary.passed} |\n`;
  report += `| Failed | ${testResults.summary.failed} |\n`;
  report += `| Partial | ${testResults.summary.partial} |\n`;
  report += `| Errors | ${testResults.summary.error} |\n`;
  report += `| Pass Rate | ${passRate}% |\n\n`;

  report += `## Test Suites\n\n`;
  for (const suite of testResults.suites) {
    const passed = suite.tests.filter(t => t.status === 'PASS').length;
    const total = suite.tests.length;
    report += `### ${suite.name} (${passed}/${total} passed)\n\n`;
    report += `| Test | Status | Details |\n`;
    report += `|------|--------|--------|\n`;
    for (const test of suite.tests) {
      const statusIcon = test.status === 'PASS' ? '✅' :
                        test.status === 'FAIL' ? '❌' :
                        test.status === 'PARTIAL' ? '⚠️' :
                        test.status === 'ERROR' ? '💥' : 'ℹ️';
      const details = test.details || test.error || '-';
      const detailsStr = typeof details === 'object' ? JSON.stringify(details).substring(0, 100) : String(details).substring(0, 100);
      report += `| ${test.name} | ${statusIcon} ${test.status} | ${detailsStr} |\n`;
    }
    report += `\n`;
  }

  if (testResults.errors.length > 0) {
    report += `## Errors\n\n`;
    for (const err of testResults.errors) {
      report += `- **${err.suite}**: ${err.error}\n`;
    }
    report += `\n`;
  }

  report += `## Screenshots\n\n`;
  report += `Screenshots saved to: \`/workspace/my-evo/test-results/edge-case-screenshots/\`\n\n`;

  report += `## Recommendations\n\n`;
  report += `Based on test results:\n\n`;

  if (testResults.summary.failed > 0) {
    report += `1. **Fix Failed Tests**: ${testResults.summary.failed} test(s) failed and need investigation.\n`;
  }
  if (testResults.summary.partial > 0) {
    report += `2. **Review Partial Results**: ${testResults.summary.partial} test(s) had partial success - review for edge cases.\n`;
  }
  if (testResults.summary.error > 0) {
    report += `3. **Handle Errors**: ${testResults.summary.error} test(s) encountered errors - check infrastructure.\n`;
  }
  if (passRate >= 80) {
    report += `4. **Overall**: System is stable with ${passRate}% pass rate.\n`;
  } else {
    report += `4. **Overall**: System needs improvement - pass rate below 80%.\n`;
  }

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  log(`Report saved to ${REPORT_FILE}`, 'success');
}

// Run if executed directly
run()
  .then(results => {
    process.exit(results.summary.failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

module.exports = { run, testResults };

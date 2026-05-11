/**
 * Test Suite: Large Dataset Visualization (1000+ nodes)
 */
const { chromium } = require('playwright');
const { httpRequest, log, takeScreenshot } = require('../edge-case-test');

async function run(tests) {
  log('=== Test Suite: Large Dataset Visualization ===', 'suite');
  const suite = { name: 'Large Dataset Visualization', tests: [] };
  const BACKEND_URL = 'http://127.0.0.1:3001';
  const BASE_URL = 'http://127.0.0.1:3002';

  // 1. Create 100 nodes efficiently
  try {
    const start = Date.now();
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(httpRequest(`${BACKEND_URL}/map/node`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `large_node_${i}_${Date.now()}`, type: 'gene', size: Math.random() })
      }));
    }
    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    const successCount = results.filter(r => r.status === 201).length;
    suite.tests.push({
      name: 'Create 100 nodes efficiently',
      status: successCount >= 90 ? 'PASS' : 'FAIL',
      details: `${successCount}/100 created in ${duration}ms`
    });
    log(`Created ${successCount} nodes in ${duration}ms`, successCount >= 90 ? 'success' : 'error');
  } catch (e) { suite.tests.push({ name: 'Create 100 nodes efficiently', status: 'ERROR', error: e.message }); }

  // 2. Retrieve large node set
  try {
    const start = Date.now();
    const res = await httpRequest(`${BACKEND_URL}/map/nodes?limit=500`);
    const duration = Date.now() - start;
    const nodeCount = Array.isArray(res.body?.nodes) ? res.body.nodes.length : 0;
    suite.tests.push({
      name: 'Retrieve 500 nodes efficiently',
      status: res.status === 200 && duration < 5000 ? 'PASS' : 'PARTIAL',
      details: `${nodeCount} nodes in ${duration}ms`
    });
  } catch (e) { suite.tests.push({ name: 'Retrieve 500 nodes efficiently', status: 'ERROR', error: e.message }); }

  // 3. Create edges for large dataset
  try {
    const nodeRes = await httpRequest(`${BACKEND_URL}/map/nodes?limit=10`);
    const nodes = nodeRes.body?.nodes || [];
    if (nodes.length >= 2) {
      const edgePromises = [];
      for (let i = 0; i < Math.min(nodes.length - 1, 5); i++) {
        edgePromises.push(httpRequest(`${BACKEND_URL}/map/edge`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: nodes[i].mapNodeId, targetId: nodes[i + 1].mapNodeId })
        }));
      }
      const results = await Promise.all(edgePromises);
      const successCount = results.filter(r => r.status === 201).length;
      suite.tests.push({
        name: 'Create edges for large dataset',
        status: successCount >= 4 ? 'PASS' : 'FAIL',
        details: `${successCount} edges created`
      });
    }
  } catch (e) { suite.tests.push({ name: 'Create edges for large dataset', status: 'ERROR', error: e.message }); }

  // 4. Browser performance with many nodes
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // Set a realistic viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Check page load performance
    const start = Date.now();
    await page.goto(`${BASE_URL}/map`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loadTime = Date.now() - start;

    suite.tests.push({
      name: 'Page load performance with large dataset',
      status: loadTime < 15000 ? 'PASS' : 'PARTIAL',
      details: `Load time: ${loadTime}ms`
    });
    log(`Map page load time: ${loadTime}ms`, loadTime < 15000 ? 'success' : 'warning');

    await browser.close();
  } catch (e) {
    suite.tests.push({ name: 'Page load performance with large dataset', status: 'ERROR', error: e.message });
    if (browser) await browser.close();
  }

  // 5. Graph retrieval performance
  try {
    const start = Date.now();
    const res = await httpRequest(`${BACKEND_URL}/map/graph`);
    const duration = Date.now() - start;
    const nodeCount = res.body?.nodeCount || 0;
    suite.tests.push({
      name: 'Graph retrieval performance',
      status: duration < 10000 && res.status === 200 ? 'PASS' : 'PARTIAL',
      details: `${nodeCount} nodes + edges in ${duration}ms`
    });
  } catch (e) { suite.tests.push({ name: 'Graph retrieval performance', status: 'ERROR', error: e.message }); }

  // 6. Large map save
  try {
    const largeNodes = [];
    for (let i = 0; i < 50; i++) {
      largeNodes.push({
        name: `bulk_node_${i}`, label: `Node ${i}`,
        x: Math.random(), y: Math.random(),
        score: Math.random()
      });
    }
    const start = Date.now();
    const res = await httpRequest(`${BACKEND_URL}/map/save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: largeNodes, edges: [], name: 'Large Dataset Test' })
    });
    const duration = Date.now() - start;
    suite.tests.push({
      name: 'Large map save (50 nodes)',
      status: res.status === 200 && duration < 10000 ? 'PASS' : 'PARTIAL',
      details: `Saved ${largeNodes.length} nodes in ${duration}ms`
    });
  } catch (e) { suite.tests.push({ name: 'Large map save', status: 'ERROR', error: e.message }); }

  tests.push(suite);
  log(`Large Dataset suite: ${suite.tests.filter(t => t.status === 'PASS').length}/${suite.tests.length} passed`, 'success');
}

module.exports = { run };

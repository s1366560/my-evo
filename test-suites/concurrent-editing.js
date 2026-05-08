/**
 * Test Suite: Concurrent Map Editing
 */
const { httpRequest, log } = require('../edge-case-test');

async function run(tests) {
  log('=== Test Suite: Concurrent Map Editing ===', 'suite');
  const suite = { name: 'Concurrent Map Editing', tests: [] };
  const BACKEND_URL = 'http://127.0.0.1:3001';

  // 1. Create nodes concurrently
  try {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(httpRequest(`${BACKEND_URL}/map/node`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `concurrent_node_${i}_${Date.now()}`, type: 'gene' })
      }));
    }
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 201).length;
    suite.tests.push({
      name: 'Concurrent node creation (5 nodes)',
      status: successCount >= 4 ? 'PASS' : 'FAIL',
      details: `Created ${successCount}/5 nodes`
    });
  } catch (e) { suite.tests.push({ name: 'Concurrent node creation', status: 'ERROR', error: e.message }); }

  // 2. Concurrent edge creation
  try {
    const node1Res = await httpRequest(`${BACKEND_URL}/map/node`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `edge_src_${Date.now()}`, type: 'gene' })
    });
    const node2Res = await httpRequest(`${BACKEND_URL}/map/node`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `edge_tgt_${Date.now()}`, type: 'gene' })
    });

    if (node1Res.status === 201 && node2Res.status === 201) {
      const sourceId = node1Res.body.map_node_id;
      const targetId = node2Res.body.map_node_id;
      const edgePromises = [];
      for (let i = 0; i < 3; i++) {
        edgePromises.push(httpRequest(`${BACKEND_URL}/map/edge`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId, targetId, type: 'reference' })
        }));
      }
      const edgeResults = await Promise.all(edgePromises);
      const successCount = edgeResults.filter(r => r.status === 201 || r.status === 409).length;
      suite.tests.push({
        name: 'Concurrent edge creation handling',
        status: successCount >= 2 ? 'PASS' : 'PARTIAL',
        details: `${successCount}/3 edges handled`
      });
    } else {
      suite.tests.push({ name: 'Concurrent edge creation handling', status: 'PARTIAL', details: 'Could not create test nodes' });
    }
  } catch (e) { suite.tests.push({ name: 'Concurrent edge creation', status: 'ERROR', error: e.message }); }

  // 3. Concurrent map save
  try {
    const mapData = {
      nodes: [
        { name: 'concurrent_test_1', label: 'Test 1', x: 0.1, y: 0.1 },
        { name: 'concurrent_test_2', label: 'Test 2', x: 0.2, y: 0.2 }
      ],
      edges: []
    };
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(httpRequest(`${BACKEND_URL}/map/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mapData, name: `concurrent_map_${i}` })
      }));
    }
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 200).length;
    suite.tests.push({
      name: 'Concurrent map save operations',
      status: successCount >= 2 ? 'PASS' : 'FAIL',
      details: `${successCount}/3 saves successful`
    });
  } catch (e) { suite.tests.push({ name: 'Concurrent map save', status: 'ERROR', error: e.message }); }

  // 4. Race condition on same node update
  try {
    const nodeRes = await httpRequest(`${BACKEND_URL}/map/node`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `race_test_${Date.now()}`, type: 'gene' })
    });
    if (nodeRes.status === 201) {
      const nodeId = nodeRes.body.map_node_id;
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(httpRequest(`${BACKEND_URL}/map/node/${nodeId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `updated_by_${i}` })
        }));
      }
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.status === 200).length;
      suite.tests.push({
        name: 'Race condition on node update',
        status: successCount >= 2 ? 'PASS' : 'FAIL',
        details: `${successCount}/3 updates succeeded`
      });
    } else {
      suite.tests.push({ name: 'Race condition on node update', status: 'PARTIAL', details: 'Could not create test node' });
    }
  } catch (e) { suite.tests.push({ name: 'Race condition on node update', status: 'ERROR', error: e.message }); }

  tests.push(suite);
  log(`Concurrent Editing suite: ${suite.tests.filter(t => t.status === 'PASS').length}/${suite.tests.length} passed`, 'success');
}

module.exports = { run };

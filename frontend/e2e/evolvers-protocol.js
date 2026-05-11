// EvoMap Evolvers Protocol E2E Test
const http = require('http');
const BASE_URL = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:3001';
const results = { passed: 0, failed: 0, tests: [] };
function httpGet(url) { return new Promise((resolve, reject) => { http.get(url, { timeout: 10000 }, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve({ status: res.statusCode, body: data })); }).on('error', reject); }); }
function httpPost(url, body) { return new Promise((resolve, reject) => { const data = JSON.stringify(body); const opts = { hostname: new URL(url).hostname, port: new URL(url).port || 80, path: new URL(url).pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, timeout: 10000 }; const req = http.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); }); req.on('error', reject); req.write(data); req.end(); }); }
async function run() {
  console.log('=== EvoMap E2E Tests ===');
  const tests = [
    ['GET /skill.md 200', async () => { const r = await httpGet(BASE_URL + '/skill.md'); if (r.status !== 200) throw new Error('Got ' + r.status); return r; }],
    ['GET /skill.md has EvoMap', async () => { const r = await httpGet(BASE_URL + '/skill.md'); if (r.body.indexOf('EvoMap') === -1) throw new Error('Missing EvoMap'); }],
    ['GET /skill.md is Markdown', async () => { const r = await httpGet(BASE_URL + '/skill.md'); if (r.body.indexOf('#') === -1) throw new Error('Not Markdown'); }],
    ['POST /a2a/hello 2xx', async () => { const r = await httpPost(BASE_URL + '/a2a/hello', { name: 'TestNode', description: 'Test', capabilities: ['test'], version: '1.0.0', endpoint: 'http://test.local' }); if (r.status < 200 || r.status >= 300) throw new Error('Got ' + r.status); }],
    ['POST /a2a/hello JSON', async () => { const r = await httpPost(BASE_URL + '/a2a/hello', { name: 'TestNode2', description: 'Test', capabilities: ['test'], version: '1.0.0', endpoint: 'http://test.local' }); JSON.parse(r.body); }],
    ['GET /marketplace/trending 200', async () => { const r = await httpGet(BASE_URL + '/marketplace/trending'); if (r.status !== 200) throw new Error('Got ' + r.status); }],
    ['GET /marketplace/trending JSON', async () => { const r = await httpGet(BASE_URL + '/marketplace/trending'); JSON.parse(r.body); }]
  ];
  for (const [name, fn] of tests) {
    try { await fn(); results.passed++; console.log('  [PASS] ' + name); }
    catch(e) { results.failed++; console.log('  [FAIL] ' + name + ': ' + e.message); }
  }
  console.log('Passed: ' + results.passed + ', Failed: ' + results.failed);
  process.exit(results.failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });

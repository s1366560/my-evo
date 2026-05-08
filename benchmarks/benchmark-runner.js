#!/usr/bin/env node
/**
 * Performance Benchmark Suite for My Evo
 * Measures: page load times, API latencies, map rendering, memory usage
 */
const http = require('http');

const FRONTEND_URL = 'http://127.0.0.1:3002';
const BACKEND_URL = 'http://127.0.0.1:3001';
const ITERATIONS = 10;

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, latencyMs: Date.now() - start }));
    });
    req.on('error', e => resolve({ status: 0, error: e.message, latencyMs: Date.now() - start }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, error: 'timeout', latencyMs: Date.now() - start }); });
  });
}

async function measureEndpoint(url, iterations = ITERATIONS) {
  const times = [];
  let lastResult = null;
  for (let i = 0; i < iterations; i++) {
    const r = await httpGet(url);
    if (r.status >= 200 && r.status < 400) {
      times.push(r.latencyMs);
      lastResult = r;
    }
    if (i < iterations - 1) await new Promise(r => setTimeout(r, 50));
  }
  if (times.length === 0) return null;
  times.sort((a, b) => a - b);
  return {
    times,
    avg: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1),
    min: times[0],
    max: times[times.length - 1],
    p50: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)] || times[times.length - 1],
    p99: times[Math.floor(times.length * 0.99)] || times[times.length - 1],
    count: times.length,
    size: lastResult ? lastResult.body.length : 0,
    lastStatus: lastResult ? lastResult.status : 0,
  };
}

async function runPageLoadBenchmarks() {
  console.log('\n=== PAGE LOAD BENCHMARKS ===');
  const pages = ['/', '/map', '/marketplace', '/browse', '/login', '/register', '/bounty', '/publish', '/pricing', '/workspace'];
  const results = {};
  for (const page of pages) {
    process.stdout.write(`  ${page.padEnd(15)} `);
    const r = await measureEndpoint(FRONTEND_URL + page, ITERATIONS);
    if (r) {
      results[page] = r;
      console.log(`avg=${r.avg}ms p95=${r.p95}ms size=${(r.size/1024).toFixed(1)}KB`);
    } else {
      console.log('FAILED');
    }
  }
  return results;
}

async function runAPIBenchmarks() {
  console.log('\n=== API LATENCY BENCHMARKS ===');
  const endpoints = [
    { name: 'GET /assets?limit=5', url: BACKEND_URL + '/assets?limit=5' },
    { name: 'GET /assets?limit=50', url: BACKEND_URL + '/assets?limit=50' },
    { name: 'GET /assets?limit=100', url: BACKEND_URL + '/assets?limit=100' },
    { name: 'GET /marketplace/stats', url: BACKEND_URL + '/marketplace/stats' },
    { name: 'GET /bounty/list', url: BACKEND_URL + '/bounty/list' },
    { name: 'GET /map/nodes', url: BACKEND_URL + '/map/nodes' },
    { name: 'GET /map/edges', url: BACKEND_URL + '/map/edges' },
    { name: 'GET /map/graph', url: BACKEND_URL + '/map/graph' },
    { name: 'GET /a2a/nodes', url: BACKEND_URL + '/a2a/nodes' },
    { name: 'GET /a2a/asset/:id', url: BACKEND_URL + '/a2a/asset/evo_1024' },
    { name: 'GET /health', url: BACKEND_URL + '/health' },
  ];
  const results = {};
  for (const { name, url } of endpoints) {
    process.stdout.write(`  ${name.padEnd(30)} `);
    const r = await measureEndpoint(url, ITERATIONS);
    if (r) {
      results[name] = r;
      console.log(`avg=${r.avg}ms p95=${r.p95}ms ${r.lastStatus === 200 ? 'OK' : 'STATUS=' + r.lastStatus}`);
    } else {
      console.log('FAILED');
    }
  }
  return results;
}

async function runMapRenderingBenchmark() {
  console.log('\n=== MAP RENDERING SIMULATION ===');
  const nodeCounts = [9, 25, 50, 100, 200];
  const results = {};
  for (const count of nodeCounts) {
    const start = Date.now();
    // Simulate force-directed layout computation for N nodes
    const nodes = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        id: String(i),
        label: `Node ${i}`,
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: 0, vy: 0,
        type: ['gene', 'capsule', 'recipe'][i % 3],
        score: 50 + Math.random() * 50,
      });
    }
    const edges = [];
    for (let i = 1; i < count; i++) {
      if (Math.random() > 0.4) {
        edges.push({ source: String(i), target: String(Math.floor(Math.random() * i)), strength: Math.random() });
      }
    }
    // Simulate physics tick (force-directed layout)
    const simStart = Date.now();
    for (let tick = 0; tick < 50; tick++) {
      nodes.forEach(node => {
        let fx = 0, fy = 0;
        nodes.forEach(other => {
          if (other.id === node.id) return;
          const dx = node.x - other.x, dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          fx += (50 / (dist * dist)) * (dx / dist);
          fy += (50 / (dist * dist)) * (dy / dist);
        });
        edges.forEach(edge => {
          let other = null;
          if (edge.source === node.id) other = nodes.find(n => n.id === edge.target);
          if (edge.target === node.id) other = nodes.find(n => n.id === edge.source);
          if (other) {
            const dx = node.x - other.x, dy = node.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            fx -= edge.strength * (dx - dist) * 0.01;
            fy -= edge.strength * (dy - dist) * 0.01;
          }
        });
        node.vx = (node.vx + fx * 0.1) * 0.9;
        node.vy = (node.vy + fy * 0.1) * 0.9;
        node.x += node.vx;
        node.y += node.vy;
      });
    }
    const simTime = Date.now() - simStart;
    const totalTime = Date.now() - start;
    const memMB = (JSON.stringify(nodes).length + JSON.stringify(edges).length) / (1024 * 1024);
    results[count] = { simTimeMs: simTime, totalTimeMs: totalTime, nodes: count, edges: edges.length, dataSizeMB: +memMB.toFixed(4) };
    console.log(`  ${String(count).padStart(3)} nodes: sim=${simTime}ms total=${totalTime}ms edges=${edges.length} data=${memMB.toFixed(4)}MB`);
  }
  return results;
}

async function runMemoryProfile() {
  console.log('\n=== MEMORY PROFILE ===');
  const fs = require('fs');
  let memData = {};
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const lines = meminfo.split('\n');
    lines.forEach(line => {
      const parts = line.match(/^(\w+):\s+(\d+)/);
      if (parts) memData[parts[1]] = parseInt(parts[2]);
    });
    memData.MemUsed_MB = Math.round((memData.MemTotal - memData.MemAvailable) / 1024);
    memData.MemAvailable_MB = Math.round(memData.MemAvailable / 1024);
    memData.MemTotal_MB = Math.round(memData.MemTotal / 1024);
  } catch (e) { /* fallback */ }

  // Backend process memory
  const backendPid = (await new Promise(r => {
    require('child_process').exec("pgrep -f 'tsx.*src/index' | head -1", (e, out) => r(out.trim()));
  })) || '';

  const frontendPid = (await new Promise(r => {
    require('child_process').exec("pgrep -f 'next start' | head -1", (e, out) => r(out.trim()));
  })) || '';

  console.log(`  System: ${memData.MemTotal_MB || '?'}MB total, ${memData.MemUsed_MB || '?'}MB used, ${memData.MemAvailable_MB || '?'}MB available`);
  if (backendPid) {
    const stat = fs.readFileSync(`/proc/${backendPid}/status`, 'utf8');
    const vmRSS = stat.match(/VmRSS:\s+(\d+)/)?.[1] || '?';
    console.log(`  Backend (PID ${backendPid}): ${Math.round(parseInt(vmRSS)/1024)}MB RSS`);
  }
  if (frontendPid) {
    const stat = fs.readFileSync(`/proc/${frontendPid}/status`, 'utf8');
    const vmRSS = stat.match(/VmRSS:\s+(\d+)/)?.[1] || '?';
    console.log(`  Frontend (PID ${frontendPid}): ${Math.round(parseInt(vmRSS)/1024)}MB RSS`);
  }

  // Estimate heap usage via V8 stats
  const backendHeap = await new Promise(resolve => {
    require('http').get(BACKEND_URL + '/health', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { const j = JSON.parse(d); resolve(j.memory); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
  if (backendHeap) {
    console.log(`  Backend heap: ${backendHeap.used}MB / ${backendHeap.total}MB (${backendHeap.percentage}%)`);
  }

  return { system: memData, backendPid, frontendPid, backendHeap };
}

async function runThroughputTest() {
  console.log('\n=== THROUGHPUT TEST (100 concurrent requests) ===');
  const promises = [];
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    promises.push(httpGet(FRONTEND_URL + '/').then(r => ({ i, status: r.status, ms: r.latencyMs })));
  }
  const results = await Promise.all(promises);
  const total = Date.now() - start;
  const success = results.filter(r => r.status === 200).length;
  const times = results.map(r => r.ms).sort((a, b) => a - b);
  console.log(`  100 concurrent requests: ${success}/100 OK in ${total}ms`);
  console.log(`  Throughput: ${(100 / (total / 1000)).toFixed(1)} req/s`);
  console.log(`  Response times: avg=${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)}ms p95=${times[94]}ms p99=${times[98]}ms`);
  return { total, success, throughput: +(100 / (total / 1000)).toFixed(1) };
}

async function main() {
  const results = {
    timestamp: new Date().toISOString(),
    environment: 'production',
  };

  results.pageLoads = await runPageLoadBenchmarks();
  results.apiLatency = await runAPIBenchmarks();
  results.mapRendering = await runMapRenderingBenchmark();
  results.memory = await runMemoryProfile();
  results.throughput = await runThroughputTest();

  // Summary
  console.log('\n=== SUMMARY ===');
  const apiAvgs = Object.values(results.apiLatency).filter(Boolean).map(r => r.avg);
  const pageAvgs = Object.values(results.pageLoads).filter(Boolean).map(r => r.avg);
  const apiP95s = Object.values(results.apiLatency).filter(Boolean).map(r => r.p95);
  const pageP95s = Object.values(results.pageLoads).filter(Boolean).map(r => r.p95);

  console.log(`  Page loads: avg=${(pageAvgs.reduce((a,b)=>a+b,0)/pageAvgs.length).toFixed(1)}ms p95=${(pageP95s.reduce((a,b)=>a+b,0)/pageP95s.length).toFixed(1)}ms`);
  console.log(`  API latency: avg=${(apiAvgs.reduce((a,b)=>a+b,0)/apiAvgs.length).toFixed(1)}ms p95=${(apiP95s.reduce((a,b)=>a+b,0)/apiP95s.length).toFixed(1)}ms`);
  console.log(`  Throughput: ${results.throughput.throughput} req/s`);
  console.log(`  Map simulation (100 nodes): ${results.mapRendering['100'].simTimeMs}ms`);

  return results;
}

main().then(r => {
  const fs = require('fs');
  const out = JSON.stringify(r, null, 2);
  fs.writeFileSync('/workspace/my-evo/test-results/performance-benchmarks.json', out);
  console.log('\nResults saved to test-results/performance-benchmarks.json');
}).catch(e => { console.error(e); process.exit(1); });

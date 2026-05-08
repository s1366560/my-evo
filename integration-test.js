const http = require('http');

const results = [];

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest(name, fn) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    const result = await fn();
    if (result.passed) {
      console.log('PASS');
      results.push({ name, status: 'PASS', ...result });
    } else {
      console.log('FAIL');
      results.push({ name, status: 'FAIL', ...result });
    }
  } catch (err) {
    console.log('ERROR:', err.message);
    results.push({ name, status: 'ERROR', error: err.message });
  }
}

(async () => {
  console.log('\n=== My Evo Integration Tests ===\n');
  
  // 1. Backend Health
  await runTest('Backend Health Check', async () => {
    const res = await httpRequest({ hostname: 'localhost', port: 3001, path: '/health', method: 'GET' });
    return { passed: res.status === 200 && res.body.status === 'healthy', response: res.body };
  });

  // 2. Root endpoint
  await runTest('Backend Root API Info', async () => {
    const res = await httpRequest({ hostname: 'localhost', port: 3001, path: '/', method: 'GET' });
    return { passed: res.status === 200 && res.body.name === 'My Evo API', response: res.body };
  });

  // 3. User Registration - Valid Data
  await runTest('User Registration - Valid Data', async () => {
    const email = `test_${Date.now()}@example.com`;
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'testuser', email, password: 'TestPass123!' });
    return { passed: res.status === 201 && res.body.token, token: res.body.token, response: res.body };
  });

  // 4. User Registration - Duplicate Email
  await runTest('User Registration - Duplicate Email', async () => {
    const email = `dup_${Date.now()}@example.com`;
    await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'user1', email, password: 'TestPass123!' });
    
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'user2', email, password: 'TestPass123!' });
    return { passed: res.status === 400, response: res.body };
  });

  // 5. User Registration - Invalid Email
  await runTest('User Registration - Invalid Email', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'test', email: 'invalid-email', password: 'TestPass123!' });
    return { passed: res.status === 400, response: res.body };
  });

  // 6. User Registration - Short Password
  await runTest('User Registration - Short Password', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'test', email: 'test@example.com', password: '123' });
    return { passed: res.status === 400, response: res.body };
  });

  // 7. User Login - Valid Credentials
  await runTest('User Login - Valid Credentials', async () => {
    const email = `login_${Date.now()}@example.com`;
    await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'loginuser', email, password: 'TestPass123!' });
    
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email, password: 'TestPass123!' });
    return { passed: res.status === 200 && res.body.token, token: res.body.token, response: res.body };
  });

  // 8. User Login - Invalid Password
  await runTest('User Login - Invalid Password', async () => {
    const email = `wrongpass_${Date.now()}@example.com`;
    await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'wronguser', email, password: 'CorrectPass123!' });
    
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email, password: 'WrongPassword!' });
    return { passed: res.status === 401, response: res.body };
  });

  // 9. Protected Route - Without Token
  await runTest('Protected Route - Without Token', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/me', method: 'GET'
    });
    return { passed: res.status === 401, response: res.body };
  });

  // 10. Protected Route - With Token
  await runTest('Protected Route - With Valid Token', async () => {
    const email = `protected_${Date.now()}@example.com`;
    const regRes = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'protecteduser', email, password: 'TestPass123!' });
    const token = regRes.body.token;
    
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/me', method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { passed: res.status === 200, response: res.body };
  });

  // 11. A2A Hello - Node Registration
  await runTest('A2A Hello - Node Registration', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/a2a/hello', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: 'test-node', nodeType: 'worker' });
    return { passed: res.status === 200, response: res.body };
  });

  // 12. A2A Heartbeat
  await runTest('A2A Heartbeat', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/a2a/heartbeat', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { nodeId: 'test-node-id', status: 'alive', load: 0.5 });
    return { passed: res.status === 200, response: res.body };
  });

  // 13. A2A Publish Asset
  await runTest('A2A Publish - Gene Type', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/a2a/publish', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { type: 'gene', name: 'Test Gene', description: 'A test gene', content: 'test content', tags: ['test'] });
    return { passed: res.status === 201, response: res.body };
  });

  // 14. A2A Publish - Capsule Type
  await runTest('A2A Publish - Capsule Type', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/a2a/publish', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { type: 'capsule', name: 'Test Capsule', description: 'A test capsule', content: 'test content', tags: ['test'] });
    return { passed: res.status === 201, response: res.body };
  });

  // 15. A2A Fetch Assets
  await runTest('A2A Fetch Assets', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/a2a/fetch', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});
    return { passed: res.status === 200, response: res.body };
  });

  // 16. Create Bounty
  await runTest('Create Bounty', async () => {
    const email = `bounty_${Date.now()}@example.com`;
    const regRes = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'bountycreator', email, password: 'TestPass123!' });
    const token = regRes.body.token;
    
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/bounty/create', method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    }, { title: 'Test Bounty', description: 'A test bounty', reward: 100 });
    return { passed: res.status === 201, response: res.body };
  });

  // 17. Fetch Bounties
  await runTest('Fetch Bounties', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/bounty/list', method: 'GET'
    });
    return { passed: res.status === 200, response: res.body };
  });

  // 18. Get Evolution Map
  await runTest('Get Evolution Map', async () => {
    const res = await httpRequest({
      hostname: 'localhost', port: 3001, path: '/map/graph', method: 'GET'
    });
    return { passed: res.status === 200, response: res.body };
  });

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status !== 'PASS').length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  
  // Output JSON for parsing
  console.log('\n=== JSON Results ===');
  console.log(JSON.stringify({ total: results.length, passed, failed, results }, null, 2));
})();

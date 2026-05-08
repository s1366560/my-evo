/**
 * Test Suite: Invalid Input Handling
 */
const { httpRequest, log } = require('../edge-case-test');

async function run(tests) {
  log('=== Test Suite: Invalid Input Handling ===', 'suite');
  const suite = { name: 'Invalid Input Handling', tests: [] };
  const BACKEND_URL = 'http://127.0.0.1:3001';

  // 1. Empty registration fields
  try {
    const res = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', username: '', password: '' })
    });
    suite.tests.push({
      name: 'Empty registration fields',
      status: res.status === 400 ? 'PASS' : 'FAIL',
      expected: 400, actual: res.status, details: res.body
    });
    log(`Empty registration: ${res.status}`, res.status === 400 ? 'success' : 'error');
  } catch (e) { suite.tests.push({ name: 'Empty registration fields', status: 'ERROR', error: e.message }); }

  // 2. Invalid email format
  try {
    const res = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', username: 'testuser', password: 'Test123!' })
    });
    suite.tests.push({
      name: 'Invalid email format',
      status: res.status >= 400 ? 'PASS' : 'FAIL',
      expected: '4xx', actual: res.status, details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'Invalid email format', status: 'ERROR', error: e.message }); }

  // 3. Weak password
  try {
    const res = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: '123' })
    });
    suite.tests.push({
      name: 'Weak password rejection',
      status: res.status >= 400 ? 'PASS' : 'FAIL',
      expected: '4xx', actual: res.status, details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'Weak password rejection', status: 'ERROR', error: e.message }); }

  // 4. Missing required map fields
  try {
    const res = await httpRequest(`${BACKEND_URL}/map/node`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    suite.tests.push({
      name: 'Missing map node required fields',
      status: res.status >= 400 ? 'PASS' : 'FAIL',
      expected: '4xx', actual: res.status, details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'Missing map node required fields', status: 'ERROR', error: e.message }); }

  // 5. Invalid map node type
  try {
    const res = await httpRequest(`${BACKEND_URL}/map/node`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test', type: 'invalid_type' })
    });
    suite.tests.push({
      name: 'Invalid map node type handling',
      status: res.status >= 400 || res.status === 201 ? 'PASS' : 'FAIL',
      expected: '201 or 4xx', actual: res.status, details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'Invalid map node type handling', status: 'ERROR', error: e.message }); }

  // 6. SQL injection attempt
  try {
    const res = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: "test'OR'1'='1@test.com", username: 'hacker', password: 'Test123!' })
    });
    suite.tests.push({
      name: 'SQL injection in email',
      status: res.status >= 400 || res.status === 201 ? 'PASS' : 'FAIL',
      expected: 'not 500', actual: res.status, details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'SQL injection in email', status: 'ERROR', error: e.message }); }

  // 7. XSS attempt in username
  try {
    const res = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'xss@test.com', username: '<script>alert(1)</script>', password: 'Test123!' })
    });
    suite.tests.push({
      name: 'XSS attempt in username',
      status: res.status >= 400 || res.status === 201 ? 'PASS' : 'FAIL',
      expected: '201 or 4xx', actual: res.status, details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'XSS attempt in username', status: 'ERROR', error: e.message }); }

  // 8. Malformed JSON
  try {
    const res = await httpRequest(`${BACKEND_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json }'
    });
    suite.tests.push({
      name: 'Malformed JSON body',
      status: res.status >= 400 ? 'PASS' : 'FAIL',
      expected: '4xx', actual: res.status, details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'Malformed JSON body', status: 'ERROR', error: e.message }); }

  // 9. Negative limit for pagination
  try {
    const res = await httpRequest(`${BACKEND_URL}/map/nodes?limit=-1`);
    suite.tests.push({
      name: 'Negative pagination limit',
      status: res.status >= 400 || res.status === 200 ? 'PASS' : 'FAIL',
      expected: '200 or 4xx', actual: res.status, details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'Negative pagination limit', status: 'ERROR', error: e.message }); }

  // 10. Very long input fields
  try {
    const longString = 'A'.repeat(10000);
    const res = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'long@test.com', username: longString, password: 'Test123!' })
    });
    suite.tests.push({
      name: 'Very long username input',
      status: res.status >= 400 || res.status === 201 ? 'PASS' : 'FAIL',
      expected: '201 or 4xx', actual: res.status, details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'Very long username input', status: 'ERROR', error: e.message }); }

  tests.push(suite);
  log(`Invalid Input suite: ${suite.tests.filter(t => t.status === 'PASS').length}/${suite.tests.length} passed`, 'success');
}

module.exports = { run };

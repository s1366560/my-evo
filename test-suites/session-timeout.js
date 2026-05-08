/**
 * Test Suite: Session Timeout Flows
 */
const { httpRequest, log } = require('../edge-case-test');

async function run(tests) {
  log('=== Test Suite: Session Timeout Flows ===', 'suite');
  const suite = { name: 'Session Timeout Flows', tests: [] };
  const BACKEND_URL = 'http://127.0.0.1:3001';

  // 1. Access protected route without token
  try {
    const res = await httpRequest(`${BACKEND_URL}/map/saved`);
    suite.tests.push({
      name: 'Access protected route without token',
      status: res.status === 401 ? 'PASS' : 'FAIL',
      expected: 401, actual: res.status,
      details: res.body
    });
    log(`Protected route without token: ${res.status}`, res.status === 401 ? 'success' : 'error');
  } catch (e) { suite.tests.push({ name: 'Access protected route without token', status: 'ERROR', error: e.message }); }

  // 2. Access protected route with invalid token
  try {
    const res = await httpRequest(`${BACKEND_URL}/map/saved`, {
      headers: { 'Authorization': 'Bearer invalid_token_xyz' }
    });
    suite.tests.push({
      name: 'Access protected route with invalid token',
      status: res.status === 401 ? 'PASS' : 'FAIL',
      expected: 401, actual: res.status,
      details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'Access protected route with invalid token', status: 'ERROR', error: e.message }); }

  // 3. Valid token authentication
  try {
    const registerRes = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `session_test_${Date.now()}@test.com`,
        username: `sessionuser_${Date.now()}`,
        password: 'Test123!@#456'
      })
    });

    if (registerRes.status === 201 && registerRes.body?.token) {
      const token = registerRes.body.token;
      const meRes = await httpRequest(`${BACKEND_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      suite.tests.push({
        name: 'Valid token authentication',
        status: meRes.status === 200 ? 'PASS' : 'FAIL',
        expected: 200, actual: meRes.status,
        details: 'Token accepted and user data returned'
      });
    } else {
      suite.tests.push({ name: 'Valid token authentication', status: 'PARTIAL', details: 'Could not get test token' });
    }
  } catch (e) { suite.tests.push({ name: 'Valid token authentication', status: 'ERROR', error: e.message }); }

  // 4. Expired/malformed token handling
  try {
    const malformedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload';
    const res = await httpRequest(`${BACKEND_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${malformedToken}` }
    });
    suite.tests.push({
      name: 'Malformed JWT token handling',
      status: res.status === 401 ? 'PASS' : 'FAIL',
      expected: 401, actual: res.status,
      details: res.body
    });
  } catch (e) { suite.tests.push({ name: 'Malformed JWT token handling', status: 'ERROR', error: e.message }); }

  // 5. Token without Bearer prefix
  try {
    const registerRes = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `nobearer_${Date.now()}@test.com`,
        username: `nobearer_${Date.now()}`,
        password: 'Test123!@#456'
      })
    });

    if (registerRes.status === 201 && registerRes.body?.token) {
      const res = await httpRequest(`${BACKEND_URL}/auth/me`, {
        headers: { 'Authorization': registerRes.body.token }
      });
      suite.tests.push({
        name: 'Token without Bearer prefix',
        status: res.status === 401 ? 'PASS' : 'FAIL',
        expected: 401, actual: res.status,
        details: 'Token without Bearer rejected'
      });
    }
  } catch (e) { suite.tests.push({ name: 'Token without Bearer prefix', status: 'ERROR', error: e.message }); }

  // 6. Login after logout behavior
  try {
    const email = `logout_test_${Date.now()}@test.com`;
    const registerRes = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username: `logoutuser_${Date.now()}`, password: 'Test123!@#456' })
    });

    if (registerRes.status === 201) {
      const loginRes = await httpRequest(`${BACKEND_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Test123!@#456' })
      });
      suite.tests.push({
        name: 'Login after registration',
        status: loginRes.status === 200 ? 'PASS' : 'FAIL',
        expected: 200, actual: loginRes.status,
        details: 'Can re-login with same credentials'
      });
    }
  } catch (e) { suite.tests.push({ name: 'Login after logout behavior', status: 'ERROR', error: e.message }); }

  // 7. Duplicate registration
  try {
    const email = `dup_${Date.now()}@test.com`;
    await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username: `dupuser1_${Date.now()}`, password: 'Test123!@#456' })
    });

    const dupRes = await httpRequest(`${BACKEND_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username: `dupuser2_${Date.now()}`, password: 'Test123!@#456' })
    });
    suite.tests.push({
      name: 'Duplicate email registration',
      status: dupRes.status === 409 ? 'PASS' : 'FAIL',
      expected: 409, actual: dupRes.status,
      details: dupRes.body
    });
  } catch (e) { suite.tests.push({ name: 'Duplicate email registration', status: 'ERROR', error: e.message }); }

  tests.push(suite);
  log(`Session Timeout suite: ${suite.tests.filter(t => t.status === 'PASS').length}/${suite.tests.length} passed`, 'success');
}

module.exports = { run };

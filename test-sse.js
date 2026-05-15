#!/usr/bin/env node
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/a2a/stream/test',
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream',
  }
};

console.log('Testing SSE endpoint: http://localhost:3001/api/a2a/stream/test\n');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  console.log('\n--- SSE Stream Output ---\n');
  
  let count = 0;
  res.on('data', (chunk) => {
    const text = chunk.toString();
    console.log(`[${++count}] ${text}`);
    if (count >= 5) {
      console.log('\n--- Closing connection after 5 events ---');
      req.destroy();
    }
  });
  
  res.on('end', () => {
    console.log('\n--- Stream ended ---');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.setTimeout(15000, () => {
  console.log('\n--- Timeout ---');
  req.destroy();
  process.exit(0);
});

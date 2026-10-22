/**
 * tests/test_server_security.js
 * Automated Security & Path Traversal Verification for server.js
 * Tests:
 * 1. Server binds strictly to 127.0.0.1 (local only)
 * 2. Access-Control-Allow-Origin: * is removed (no unneeded external CORS)
 * 3. Path traversal attacks (e.g. /..%2f..%2fwindows, /../../etc/passwd) return 403 Forbidden
 * 4. Normal files (e.g. /index.html) return 200 OK
 */
const http = require('http');
const assert = require('assert');
const path = require('path');
const { handleRequest, HOST, ROOT_DIR } = require('../server.js');

const TEST_PORT = 8999;
let passedCount = 0;
let totalCount = 0;

function request(pathStr) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: TEST_PORT,
        path: pathStr,
        method: 'GET'
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function testAssertion(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ FAIL: ${name} ->`, err.message);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🛡️  STARTING SERVER SECURITY & TRAVERSAL AUDIT');
  console.log('====================================================');

  const server = http.createServer(handleRequest);

  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  try {
    // 1. Verify host configuration
    testAssertion('Server host is configured as 127.0.0.1', () => {
      assert.strictEqual(HOST, '127.0.0.1');
      const addr = server.address();
      assert.strictEqual(addr.address, '127.0.0.1');
      assert.strictEqual(addr.port, TEST_PORT);
    });

    // 2. Normal file request
    const normalRes = await request('/index.html');
    testAssertion('Normal file /index.html returns 200 OK', () => {
      assert.strictEqual(normalRes.statusCode, 200);
      assert(normalRes.headers['content-type'].includes('text/html'));
    });

    // 3. Verify Access-Control-Allow-Origin is removed
    testAssertion('Access-Control-Allow-Origin header is NOT present', () => {
      assert.strictEqual(normalRes.headers['access-control-allow-origin'], undefined);
    });

    // 4. Path traversal: /..%2f..%2fwindows
    const trav1 = await request('/..%2f..%2fwindows');
    testAssertion('Path traversal /..%2f..%2fwindows is blocked with 403 Forbidden', () => {
      assert.strictEqual(trav1.statusCode, 403);
      assert(trav1.body.includes('403 Forbidden'));
    });

    // 5. Path traversal: /../../etc/passwd
    const trav2 = await request('/../../etc/passwd');
    testAssertion('Path traversal /../../etc/passwd is blocked with 403 Forbidden', () => {
      assert.strictEqual(trav2.statusCode, 403);
      assert(trav2.body.includes('403 Forbidden'));
    });

    // 6. Path traversal: /..\..\windows\system32
    const trav3 = await request('/..\\..\\windows\\system32');
    testAssertion('Backslash traversal /..\\..\\windows is blocked with 403 Forbidden', () => {
      assert.strictEqual(trav3.statusCode, 403);
      assert(trav3.body.includes('403 Forbidden'));
    });

    // 7. Double encoded traversal: /%2e%2e%2f%2e%2e%2f
    const trav4 = await request('/%2e%2e%2f%2e%2e%2f');
    testAssertion('Double-encoded traversal /%2e%2e%2f is blocked with 403 Forbidden', () => {
      assert.strictEqual(trav4.statusCode, 403);
      assert(trav4.body.includes('403 Forbidden'));
    });

    // 8. Null byte poisoning attempt
    const nullByteRes = await request('/index.html%00.txt');
    testAssertion('Null byte injection is rejected with 400 Bad Request', () => {
      assert.strictEqual(nullByteRes.statusCode, 400);
    });

    // 9. Non-existent file within root returns 404
    const notFoundRes = await request('/non_existent_file_xyz123.txt');
    testAssertion('Non-existent file within project returns 404 Not Found', () => {
      assert.strictEqual(notFoundRes.statusCode, 404);
    });

    console.log('====================================================');
    console.log(`AUDIT RESULTS: ${passedCount}/${totalCount} tests passed.`);
    console.log('====================================================');

    if (passedCount !== totalCount) {
      process.exit(1);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

const http = require('http');
const TEST_PASSWORD = process.env.RESIN_TEST_PASSWORD || process.env.RESIN_SEED_PASSWORD || process.env.ADMIN_PASSWORD;

if (!TEST_PASSWORD) {
  console.error('Set RESIN_TEST_PASSWORD or RESIN_SEED_PASSWORD before running this script.');
  process.exit(1);
}

function postJson(url, data, sessionCookie) {
  const urlObj = new URL(url);
  const body = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Cookie': sessionCookie || ''
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseBody ? JSON.parse(responseBody) : null
        });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJson(url, sessionCookie) {
  const urlObj = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Cookie': sessionCookie || ''
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseBody ? JSON.parse(responseBody) : null
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testRoutes() {
  console.log('Logging in as admin...');
  const loginRes = await postJson('http://localhost:3000/api/auth/login', {
    email: 'admin@resin.app',
    password: TEST_PASSWORD
  });
  
  if (loginRes.statusCode !== 200) {
    console.error('Login failed!', loginRes.statusCode, loginRes.data);
    process.exit(1);
  }
  
  const setCookie = loginRes.headers['set-cookie'];
  const cookie = setCookie ? setCookie[0].split(';')[0] : '';
  console.log('Login successful! Session cookie:', cookie);
  
  // 1. Get dashboard info
  console.log('\n--- 1. Testing GET /api/admin/dashboard ---');
  const dashRes = await getJson('http://localhost:3000/api/admin/dashboard', cookie);
  console.log('Status:', dashRes.statusCode);
  console.log('Data:', dashRes.data);
  
  // 2. Get support tickets
  console.log('\n--- 2. Testing GET /api/admin/tickets ---');
  const ticketsRes = await getJson('http://localhost:3000/api/admin/tickets', cookie);
  console.log('Status:', ticketsRes.statusCode);
  console.log('Number of tickets:', ticketsRes.data ? ticketsRes.data.length : 0);
  if (ticketsRes.data && ticketsRes.data.length > 0) {
    console.log('First ticket:', ticketsRes.data[0]);
  }
  
  // 3. Post reply
  if (ticketsRes.data && ticketsRes.data.length > 0) {
    const tId = ticketsRes.data[0].id;
    console.log(`\n--- 3. Testing POST /api/admin/tickets/${tId}/reply ---`);
    const replyRes = await postJson(`http://localhost:3000/api/admin/tickets/${encodeURIComponent(tId)}/reply`, {
      content: 'Hello, this is a real support specialist reply!',
      markResolved: true
    }, cookie);
    console.log('Status:', replyRes.statusCode);
    console.log('Data:', replyRes.data);
  }
  
  // 4. Post announcement
  console.log('\n--- 4. Testing POST /api/admin/announcements ---');
  const annRes = await postJson('http://localhost:3000/api/admin/announcements', {
    title: 'Server Maintenance Scheduled',
    body: 'The server will be undergoing minor updates tomorrow at 02:00 UTC.',
    type: 'alert',
    isPinned: true
  }, cookie);
  console.log('Status:', annRes.statusCode);
  console.log('Data:', annRes.data);
  
  // 5. Cache flush
  console.log('\n--- 5. Testing POST /api/admin/cache/flush ---');
  const cacheRes = await postJson('http://localhost:3000/api/admin/cache/flush', {
    segments: ['previews', 'queries']
  }, cookie);
  console.log('Status:', cacheRes.statusCode);
  console.log('Logs returned:', cacheRes.data ? cacheRes.data.logs : null);
  
  console.log('\nAll tests complete!');
}

testRoutes().catch(err => {
  console.error('Test execution failed:', err);
});

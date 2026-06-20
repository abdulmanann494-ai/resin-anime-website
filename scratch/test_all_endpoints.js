const http = require('http');
const TEST_PASSWORD = process.env.RESIN_TEST_PASSWORD || process.env.RESIN_SEED_PASSWORD || process.env.ADMIN_PASSWORD;

if (!TEST_PASSWORD) {
  console.error('Set RESIN_TEST_PASSWORD or RESIN_SEED_PASSWORD before running this script.');
  process.exit(1);
}

function request(method, path, data, cookie) {
  const body = data ? JSON.stringify(data) : '';
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Cookie': cookie || ''
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseBody
        });
      });
    });
    req.on('error', err => resolve({ statusCode: 500, headers: {}, data: err.message }));
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('Logging in...');
  const loginRes = await request('POST', '/api/auth/login', {
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

  const getRoutes = [
    '/api/admin/dashboard',
    '/api/admin/users',
    '/api/admin/wallpapers',
    '/api/admin/audit-logs',
    '/api/admin/rankings/config',
    '/api/admin/rankings',
    '/api/admin/dmca',
    '/api/admin/community/flags',
    '/api/admin/reports',
    '/api/admin/documents',
    '/api/admin/collections',
    '/api/admin/settings',
    '/api/admin/media',
    '/api/admin/categories',
    '/api/admin/tickets'
  ];

  console.log('\n--- Testing all GET administrative endpoints ---');
  for (const route of getRoutes) {
    const res = await request('GET', route, null, cookie);
    console.log(`GET ${route} -> Status: ${res.statusCode} | Length: ${res.data.length}`);
    if (res.statusCode !== 200) {
      console.error(`ERROR on GET ${route}:`, res.data);
    }
  }
}

run().catch(console.error);

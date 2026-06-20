const http = require('http');
const TEST_PASSWORD = process.env.RESIN_TEST_PASSWORD || process.env.RESIN_SEED_PASSWORD || process.env.ADMIN_PASSWORD;

if (!TEST_PASSWORD) {
  console.error('Set RESIN_TEST_PASSWORD or RESIN_SEED_PASSWORD before running this script.');
  process.exit(1);
}

function postJson(url, data) {
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
        'Content-Length': Buffer.byteLength(body)
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

async function run() {
  const loginRes = await postJson('http://localhost:3000/api/auth/login', {
    email: 'admin@resin.app',
    password: TEST_PASSWORD
  });
  const setCookie = loginRes.headers['set-cookie'];
  const cookie = setCookie ? setCookie[0].split(';')[0] : '';
  
  const usersRes = await getJson('http://localhost:3000/api/admin/users', cookie);
  console.log('Status code:', usersRes.statusCode);
  console.log('Data:', usersRes.data);
}

run().catch(console.error);

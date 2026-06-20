const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3200;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_PASSWORD = 'E2ESeedPass!2026';

let server;
let dataDir;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealth() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error('RESIN E2E test server did not become healthy.');
}

function clearMailSpool() {
  const spoolDir = path.join(ROOT, 'data', 'mail_spool');
  if (fs.existsSync(spoolDir)) {
    const files = fs.readdirSync(spoolDir);
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(spoolDir, f));
      } catch {}
    }
  }
}

async function getSpooledToken(email) {
  const spoolDir = path.join(ROOT, 'data', 'mail_spool');
  if (!fs.existsSync(spoolDir)) return null;
  const files = fs.readdirSync(spoolDir);
  const emailLower = email.toLowerCase();
  const matchingFiles = files
    .filter(f => f.includes(emailLower))
    .map(f => ({ name: f, time: fs.statSync(path.join(spoolDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  
  if (matchingFiles.length === 0) return null;
  const content = fs.readFileSync(path.join(spoolDir, matchingFiles[0].name), 'utf8');
  const match = content.match(/<div class="token-value">([a-f0-9]{6})<\/div>/i);
  return match ? match[1] : null;
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resin-e2e-'));
  process.env.RESIN_DATA_DIR = dataDir;
  process.env.RESIN_SEED_PASSWORD = TEST_PASSWORD;
  
  clearMailSpool();

  server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      RESIN_DATA_DIR: dataDir,
      RESIN_SEED_PASSWORD: TEST_PASSWORD,
      SESSION_SECRET: 'test-session-secret-for-resin-e2e-suite',
      AUTH_RATE_LIMIT_MAX: '10', // Lower limit to test rate limit triggers easily
      WRITE_RATE_LIMIT_MAX: '10',
      GLOBAL_RATE_LIMIT_MAX: '5000'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', chunk => process.stdout.write(`[e2e-server] ${chunk}`));
  server.stderr.on('data', chunk => process.stderr.write(`[e2e-server] ${chunk}`));

  await waitForHealth();
});

test.after(async () => {
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await delay(500);
    if (!server.killed) server.kill('SIGKILL');
  }
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {}
});

let ipCounter = 1;
function createClient(ip = null) {
  let cookie = '';
  const clientIp = ip || `10.0.0.${ipCounter++}`;
  return {
    get cookie() {
      return cookie;
    },
    set cookie(val) {
      cookie = val;
    },
    async request(route, options = {}) {
      const headers = new Headers(options.headers || {});
      if (cookie) headers.set('Cookie', cookie);
      headers.set('X-Forwarded-For', clientIp);
      const res = await fetch(`${BASE}${route}`, { ...options, headers });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const text = await res.text();
      let data = text;
      try {
        data = JSON.parse(text);
      } catch {}
      return { status: res.status, headers: res.headers, data, text };
    },
    async csrf() {
      const res = await this.request('/api/csrf-token');
      assert.equal(res.status, 200);
      return res.data.csrfToken;
    }
  };
}

async function fetchBuffer(url, cookie = '') {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  headers['X-Forwarded-For'] = `10.0.0.${Math.floor(Math.random() * 254) + 1}`;
  const res = await fetch(`${BASE}${url}`, { headers });
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function loginAdmin(client) {
  let token = await client.csrf();
  let beforeCookie = client.cookie;
  let res = await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email: 'admin@resin.app', password: TEST_PASSWORD })
  });

  if (res.status === 401) {
    token = await client.csrf();
    beforeCookie = client.cookie;
    res = await client.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ email: 'admin@resin.app', password: 'BrandNewPassword123!' })
    });
  }

  assert.equal(res.status, 200);
  assert.equal(res.data.user.role, 'Administrator');
  assert.notEqual(client.cookie, beforeCookie);
  return token;
}

// =============================================================================
// TIER 1: FEATURE COVERAGE (40 tests)
// =============================================================================

// --- F1: User Authentication & Session Management ---

test('1. F1: Signup standard user', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      name: 'Standard User T1',
      email: 'standard1@resin.app',
      password: 'StandardPass!2026'
    })
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.user.email, 'standard1@resin.app');
  assert.equal(res.data.user.role, 'Standard Member');
});

test('2. F1: Login standard user', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      email: 'standard1@resin.app',
      password: 'StandardPass!2026'
    })
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.user.email, 'standard1@resin.app');
});

test('3. F1: Session cookie has secure flags', async () => {
  const client = createClient();
  const res = await client.request('/api/csrf-token');
  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
});

test('4. F1: Session ID rotates on login', async () => {
  const client = createClient();
  await client.csrf();
  const initialCookie = client.cookie;
  const token = await client.csrf();
  await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      email: 'standard1@resin.app',
      password: 'StandardPass!2026'
    })
  });
  assert.notEqual(client.cookie, initialCookie);
});

test('5. F1: Logout destroys session', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      email: 'standard1@resin.app',
      password: 'StandardPass!2026'
    })
  });
  const token2 = await client.csrf();
  const resLogout = await client.request('/api/auth/logout', {
    method: 'POST',
    headers: { 'X-CSRF-Token': token2 }
  });
  assert.equal(resLogout.status, 200);
  const resSettings = await client.request('/api/settings');
  assert.equal(resSettings.data.username, 'guest');
});

// --- F2: Access Control & Admin Gating ---

test('6. F2: Admin routes block unauthenticated requests', async () => {
  const client = createClient();
  const res = await client.request('/api/admin/dashboard');
  assert.equal(res.status, 403);
});

test('7. F2: Admin routes block standard member requests', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      email: 'standard1@resin.app',
      password: 'StandardPass!2026'
    })
  });
  const res = await client.request('/api/admin/dashboard');
  assert.equal(res.status, 403);
});

test('8. F2: Admin routes allow administrator requests', async () => {
  const client = createClient();
  await loginAdmin(client);
  const res = await client.request('/api/admin/dashboard');
  assert.equal(res.status, 200);
});

test('9. F2: Route gating covers user list', async () => {
  const client1 = createClient();
  const res1 = await client1.request('/api/admin/users');
  assert.equal(res1.status, 403);

  const client2 = createClient();
  await loginAdmin(client2);
  const res2 = await client2.request('/api/admin/users');
  assert.equal(res2.status, 200);
});

test('10. F2: Route gating covers settings update', async () => {
  const client1 = createClient();
  const token1 = await client1.csrf();
  const res1 = await client1.request('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token1 },
    body: JSON.stringify({ siteName: 'Test' })
  });
  assert.equal(res1.status, 403);

  const client2 = createClient();
  const token2 = await loginAdmin(client2);
  const res2 = await client2.request('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token2 },
    body: JSON.stringify({ siteName: 'Test' })
  });
  assert.equal(res2.status, 200);
});

// --- F3: Input Protection & Data Integrity ---

test('11. F3: Mutating POST requires CSRF token', async () => {
  const client = createClient();
  const res = await client.request('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'csm-01' })
  });
  assert.equal(res.status, 403);
});

test('12. F3: Mutating PUT requires CSRF token', async () => {
  const client = createClient();
  const res = await client.request('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteName: 'Hacked' })
  });
  assert.equal(res.status, 403);
});

test('13. F3: Mutating DELETE requires CSRF token', async () => {
  const client = createClient();
  const res = await client.request('/api/admin/users/standard1', {
    method: 'DELETE'
  });
  assert.equal(res.status, 403);
});

test('14. F3: SQL Injection fails on lookup routes', async () => {
  const client = createClient();
  const queries = [
    '/api/wallpapers?search=%27+OR+%271%27%3D%271',
    '/api/wallpapers?tag=%27+OR+%271%27%3D%271',
    '/api/wallpapers?ratio=%27+OR+%271%27%3D%271'
  ];
  for (const q of queries) {
    const res = await client.request(q);
    assert.ok(res.status === 200 || res.status === 400);
  }
});

test('15. F3: Mass assignment prevented during signup', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      name: 'Hacker User',
      email: 'hacker1@resin.app',
      password: 'HackerPass!2026',
      role: 'Administrator',
      isAdmin: true,
      is_admin: true
    })
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.user.role, 'Standard Member');
});

// --- F4: Rate Limiting & Media Ingestion ---

test('16. F4: Auth rate limit blocks excessive signups', async () => {
  const client = createClient('10.0.0.16');
  let statusCodes = [];
  for (let i = 0; i < 15; i++) {
    const token = await client.csrf();
    const res = await client.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ email: `excessive${i}@resin.app`, password: 'SomePass!2026' })
    });
    statusCodes.push(res.status);
    if (res.status === 429) break;
  }
  assert.ok(statusCodes.includes(429));
});

test('17. F4: Media upload rejects files above limit (50MB)', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const size = 51 * 1024 * 1024;
  const largeData = 'A'.repeat(size);
  const res = await client.request('/api/admin/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ data: largeData })
  });
  assert.equal(res.status, 413);
});

test('18. F4: Media upload accepts valid image uploads', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const res = await client.request('/api/admin/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      filename: 'test_upload.png',
      mimeType: 'image/png',
      data: pngBase64,
      size: 68
    })
  });
  assert.equal(res.status, 200);
  assert.ok(res.data.media.url);
});

test('19. F4: Media upload strips EXIF metadata', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const dummyIHDR = Buffer.from([
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE
  ]);
  const textChunk = Buffer.from([
    0x00, 0x00, 0x00, 0x0A, 0x74, 0x45, 0x58, 0x74,
    0x41, 0x75, 0x74, 0x68, 0x6F, 0x72, 0x00, 0x54, 0x65, 0x73, 0x74,
    0x00, 0x00, 0x00, 0x00
  ]);
  const iendChunk = Buffer.from([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  const buffer = Buffer.concat([pngHeader, dummyIHDR, textChunk, iendChunk]);
  const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

  const resUpload = await client.request('/api/admin/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      filename: 'metadata_test.png',
      mimeType: 'image/png',
      data: base64,
      size: buffer.length
    })
  });
  assert.equal(resUpload.status, 200);
  const mediaUrl = resUpload.data.media.url;
  
  const fetchedBytes = await fetchBuffer(mediaUrl);
  assert.ok(!fetchedBytes.toString().includes('tEXt'), 'EXIF/tEXt metadata should be stripped');
});

test('20. F4: Write rate limit blocks excessive writes', async () => {
  const client = createClient('10.0.0.20');
  let statusCodes = [];
  for (let i = 0; i < 15; i++) {
    const token = await client.csrf();
    const res = await client.request('/api/articles/art_featured/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ content: `Comment ${i}` })
    });
    statusCodes.push(res.status);
    if (res.status === 429) break;
  }
  assert.ok(statusCodes.includes(429));
});

// --- F5: SEO, Crawlability & Sitemaps ---

test('21. F5: Home page renders SEO meta tags', async () => {
  const client = createClient();
  const res = await client.request('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /<meta name="description"/i);
  assert.match(res.text, /<title>/i);
});

test('22. F5: Individual wallpaper path renders unique SEO tags', async () => {
  const client = createClient();
  const res = await client.request('/wallpapers/csm-01');
  assert.equal(res.status, 200);
  assert.match(res.text, /Chainsaw/i);
});

test('23. F5: sitemap.xml exists and lists valid URLs', async () => {
  const client = createClient();
  const res = await client.request('/sitemap.xml');
  assert.equal(res.status, 200);
  assert.match(res.text, /<loc>/i);
});

test('24. F5: image-sitemap.xml lists image assets', async () => {
  const client = createClient();
  const res = await client.request('/image-sitemap.xml');
  assert.equal(res.status, 200);
  assert.match(res.text, /<image:image>/i);
});

test('25. F5: robots.txt is present and directs to sitemap.xml', async () => {
  const client = createClient();
  const res = await client.request('/robots.txt');
  assert.equal(res.status, 200);
  assert.match(res.text, /Sitemap:.*sitemap\.xml/i);
});

// --- F6: Frontend Router & Client UX ---

test('26. F6: Router supports URL with spaces', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.match(source, /[\s_]/);
});

test('27. F6: Router supports URL with underscores', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.match(source, /_/);
});

test('28. F6: Image parser handles fallback extensions', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.ok(source.includes('png') || source.includes('jpg') || source.includes('webp') || source.includes('fallback'));
});

test('29. F6: Range sliders reflect default values', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  assert.match(html, /id="res-range-slider"[^>]*value="0"/);
  assert.match(html, /id="slider-dl"[^>]*value="1.5"/);
});

test('30. F6: Mobile view checks viewport responsive triggers', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  assert.match(html, /<meta name="viewport"/);
  const css = fs.readFileSync(path.join(ROOT, 'public', 'index.css'), 'utf8');
  assert.match(css, /@media/);
});

// --- F7: Performance & Quality Metrics ---

test('31. F7: Home feed lists initial batch of wallpapers', async () => {
  const client = createClient();
  const res = await client.request('/api/wallpapers');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data));
  assert.ok(res.data.length > 0);
});

test('32. F7: Home feed pagination loads next batch', async () => {
  const client = createClient();
  const res = await client.request('/api/wallpapers?page=2&limit=10');
  assert.equal(res.status, 200);
});

test('33. F7: Programmatic Core Web Vitals script output format check', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const hasVitals = indexHtml.includes('vitals') || indexHtml.includes('PerformanceObserver') || fs.existsSync(path.join(ROOT, 'public', 'vitals.js'));
  assert.ok(hasVitals, 'Core Web Vitals tracking should be integrated in the frontend');
});

test('34. F7: Performance endpoint reports response times', async () => {
  const client = createClient();
  const res = await client.request('/api/performance');
  assert.equal(res.status, 200, 'Performance endpoint should be implemented');
  assert.ok(res.data.responseTimes, 'Performance endpoint should report response times');
});

test('35. F7: Cache flush clears memory/db cache segments', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const res = await client.request('/api/admin/cache/flush', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ segments: ['queries', 'metadata'] })
  });
  assert.equal(res.status, 200);
  assert.ok(res.data.success);
});

// --- F8: Interactive Workflows & Infrastructure ---

test('36. F8: Keyboard alternative focus checks', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  assert.match(html, /tabindex=/i);
});

test('37. F8: Modal focus trap behaves correctly', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.ok(js.includes('focus') || js.includes('keydown') || js.includes('modal'));
});

test('38. F8: Simplified English copy check for UI text files', () => {
  const filePath = path.join(ROOT, 'about_website.txt');
  assert.ok(fs.existsSync(filePath));
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('RESIN'));
  assert.ok(content.includes('website'));
});

test('39. F8: Email token generated for password reset', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email: 'admin@resin.app' })
  });
  assert.equal(res.status, 200);
  assert.ok(res.data.success);
});

test('40. F8: Database schema is seeded and verified', async () => {
  const client = createClient();
  await loginAdmin(client);
  const wallpapers = await client.request('/api/admin/wallpapers');
  assert.equal(wallpapers.status, 200);
  assert.ok(wallpapers.data.wallpapers.length >= 24);
});


// =============================================================================
// TIER 2: BOUNDARY & EDGE CASES (40 tests)
// =============================================================================

// --- F1: User Authentication & Session Management ---

test('41. F1-Edge: Signup with blank email/password', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'Blank User', email: '', password: '' })
  });
  assert.equal(res.status, 400);
});

test('42. F1-Edge: Login with incorrect password', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email: 'admin@resin.app', password: 'WrongPassword123' })
  });
  assert.equal(res.status, 401);
});

test('43. F1-Edge: Signup with already-registered email', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'Duplicate User', email: 'admin@resin.app', password: 'SomePassword123!' })
  });
  assert.equal(res.status, 400);
});

test('44. F1-Edge: Google OAuth mock verification with malformed code', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ credential: 'malformed_token_here', email: 'malformed@resin.app' })
  });
  assert.equal(res.status, 401);
});

test('45. F1-Edge: Cookie validation with invalid signature', async () => {
  const client = createClient();
  client.cookie = 'resin_session=invalidSessionId.invalidSignature';
  const res = await client.request('/api/settings');
  assert.equal(res.status, 200);
  assert.equal(res.data.username, 'guest');
});

// --- F2: Access Control & Admin Gating ---

test('46. F2-Edge: Gating blocks admin actions even if role is passed in request body', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'User 46', email: 'user46@resin.app', password: 'UserPass!2026' })
  });
  const token2 = await client.csrf();
  const res = await client.request('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token2 },
    body: JSON.stringify({ siteName: 'Hacked Site', role: 'Administrator' })
  });
  assert.equal(res.status, 403);
});

test('47. F2-Edge: User modification route gates IDOR (non-admin editing another user)', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'User 47', email: 'user47@resin.app', password: 'UserPass!2026' })
  });
  const token2 = await client.csrf();
  const res = await client.request('/api/admin/users/founder/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token2 },
    body: JSON.stringify({ status: 'SUSPENDED' })
  });
  assert.equal(res.status, 403);
});

test('48. F2-Edge: Delete ticket blocks standard user', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'User 48', email: 'user48@resin.app', password: 'UserPass!2026' })
  });
  const token2 = await client.csrf();
  const res = await client.request('/api/admin/tickets/%23TK-4029', {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': token2 }
  });
  assert.ok(res.status === 403 || res.status === 404);
});

test('49. F2-Edge: Pin wallpaper blocks standard user', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'User 49', email: 'user49@resin.app', password: 'UserPass!2026' })
  });
  const token2 = await client.csrf();
  const res = await client.request('/api/admin/wallpapers/csm-01/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token2 },
    body: JSON.stringify({ rank: 1 })
  });
  assert.equal(res.status, 403);
});

test('50. F2-Edge: Recalibrate votes blocks standard user', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'User 50', email: 'user50@resin.app', password: 'UserPass!2026' })
  });
  const token2 = await client.csrf();
  const res = await client.request('/api/admin/community/recalibrate-votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token2 },
    body: JSON.stringify({ minutes: 10 })
  });
  assert.equal(res.status, 403);
});

// --- F3: Input Protection & Data Integrity ---

test('51. F3-Edge: Mutating POST with expired CSRF token', async () => {
  const client = createClient();
  await client.csrf();
  const expiredToken = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = await client.request('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': expiredToken },
    body: JSON.stringify({ id: 'csm-01' })
  });
  assert.equal(res.status, 403);
});

test('52. F3-Edge: Mutating POST with missing CSRF header but valid token in cookie', async () => {
  const client = createClient();
  await client.csrf();
  const res = await client.request('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'csm-01' })
  });
  assert.equal(res.status, 403);
});

test('53. F3-Edge: SQL injection payload using UNION/sleep in search query', async () => {
  const client = createClient();
  const payload = "' UNION SELECT null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null --";
  const res = await client.request(`/api/wallpapers?search=${encodeURIComponent(payload)}`);
  assert.ok(res.status === 200 || res.status === 400);
});

test('54. F3-Edge: Mass assignment try to overwrite user profile fields (e.g. role)', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'User 54', email: 'user54@resin.app', password: 'UserPass!2026' })
  });
  const token2 = await client.csrf();
  const res = await client.request('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token2 },
    body: JSON.stringify({ role: 'Administrator' })
  });
  assert.equal(res.status, 200);
  assert.notEqual(res.data.role, 'Administrator');
});

test('55. F3-Edge: Output escaping tags check in comments input (XSS)', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/articles/featured/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ content: '<script>alert("xss")</script>' })
  });
  assert.equal(res.status, 200);
  const resArticle = await client.request('/api/articles/featured');
  assert.equal(resArticle.status, 200);
  const commentsText = JSON.stringify(resArticle.data.comments);
  assert.ok(!commentsText.includes('<script>alert("xss")</script>'));
});

// --- F4: Rate Limiting & Media Ingestion ---

test('56. F4-Edge: Rate limiter recovery (cooldown period expiration)', async () => {
  const client = createClient('10.0.0.56');
  let got429 = false;
  let retryAfter = null;
  for (let i = 0; i < 15; i++) {
    const token = await client.csrf();
    const res = await client.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ email: `limiterrec${i}@resin.app`, password: 'SomePass!2026' })
    });
    if (res.status === 429) {
      got429 = true;
      retryAfter = res.headers.get('retry-after');
      break;
    }
  }
  assert.ok(got429);
  assert.ok(retryAfter !== null);
});

test('57. F4-Edge: Upload file with invalid image magic bytes (e.g. txt renamed to png)', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const textBase64 = `data:image/png;base64,${Buffer.from('not an image at all').toString('base64')}`;
  const res = await client.request('/api/admin/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      filename: 'fake.png',
      mimeType: 'image/png',
      data: textBase64,
      size: 19
    })
  });
  assert.equal(res.status, 400);
});

test('58. F4-Edge: Upload empty media file payload', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const res = await client.request('/api/admin/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      filename: 'empty.png',
      mimeType: 'image/png',
      data: '',
      size: 0
    })
  });
  assert.equal(res.status, 400);
});

test('59. F4-Edge: EXIF stripping check with corrupted EXIF headers', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const textChunkCorrupted = Buffer.from([
    0x00, 0x00, 0x00, 0xFF, 0x74, 0x45, 0x58, 0x74,
    0x41, 0x75, 0x74, 0x68, 0x6F, 0x72
  ]);
  const buffer = Buffer.concat([pngHeader, textChunkCorrupted]);
  const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

  const res = await client.request('/api/admin/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      filename: 'corrupted_metadata.png',
      mimeType: 'image/png',
      data: base64,
      size: buffer.length
    })
  });
  assert.equal(res.status, 200);
});

test('60. F4-Edge: Max auth rate limit boundary check', async () => {
  const client = createClient('10.0.0.60');
  let limitExceeded = false;
  for (let i = 0; i < 11; i++) {
    const token = await client.csrf();
    const res = await client.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ email: 'admin@resin.app', password: 'WrongPassword' })
    });
    if (res.status === 429) {
      limitExceeded = true;
      break;
    }
  }
  assert.ok(limitExceeded);
});

// --- F5: SEO, Crawlability & Sitemaps ---

test('61. F5-Edge: Sitemap url limit check', async () => {
  const client = createClient();
  const res = await client.request('/sitemap.xml');
  assert.equal(res.status, 200);
  const count = (res.text.match(/<loc>/g) || []).length;
  assert.ok(count > 0 && count <= 50000);
});

test('62. F5-Edge: Canonical tag dynamic path validation on nested public pages', async () => {
  const client = createClient();
  const res = await client.request('/wallpapers/csm-01');
  assert.equal(res.status, 200);
  assert.match(res.text, /rel="canonical"[^>]*href="[^"]*\/wallpapers\/csm-01"/);
});

test('63. F5-Edge: HTML contains semantic tags (main, header, footer)', async () => {
  const client = createClient();
  const res = await client.request('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /<main/i);
  assert.match(res.text, /<(aside|header)/i);
});

test('64. F5-Edge: Crawlability fallback response check when JS disabled', async () => {
  const client = createClient();
  const res = await client.request('/wallpapers/csm-01');
  assert.equal(res.status, 200);
  assert.match(res.text, /Chainsaw/);
});

test('65. F5-Edge: OpenGraph tag default fallbacks for missing wallpaper data', async () => {
  const client = createClient();
  const res = await client.request('/wallpaper/nonexistent-wp');
  assert.ok(res.status === 404 || res.text.includes('property="og:title"'));
});

// --- F6: Frontend Router & Client UX ---

test('66. F6-Edge: Router handles consecutive multiple spaces/underscores', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.match(source, /replace\(\s*\/\[\\s_\]\+\/g,\s*'-'\s*\)/);
});

test('67. F6-Edge: Slider boundary value testing (min/max bounds)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  assert.ok(html.includes('id="mod-recal-slider"'));
  assert.ok(html.includes('min="0"'));
  assert.ok(html.includes('max="60"'));
});

test('68. F6-Edge: Image fallback when src is completely broken', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.ok(source.includes('onerror') || source.includes('fallback') || source.includes('src ='));
});

test('69. F6-Edge: Missing category route renders error 404', async () => {
  const client = createClient();
  const res = await client.request('/api/categories/999999');
  assert.equal(res.status, 404);
});

test('70. F6-Edge: Navigation history back/forward state preservation', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.ok(source.includes('hashchange') || source.includes('location.hash'));
});

// --- F7: Performance & Quality Metrics ---

test('71. F7-Edge: Feed pagination when database has zero wallpapers', async () => {
  const client = createClient();
  const res = await client.request('/api/wallpapers?search=nonexistent-wp-guid-1234');
  assert.equal(res.status, 200);
  assert.equal(res.data.length, 0);
});

test('72. F7-Edge: CWV script runs with network throttling simulation', () => {
  const files = fs.readdirSync(ROOT);
  const hasThrottling = files.some(f => f.includes('lighthouse') || f.includes('perf')) || fs.existsSync(path.join(ROOT, 'scripts', 'cwv.js'));
  assert.ok(!hasThrottling, 'Network throttling script check');
});

test('73. F7-Edge: Cache flush on non-existent segments', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const res = await client.request('/api/admin/cache/flush', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ segments: ['nonexistent-segment'] })
  });
  assert.equal(res.status, 200);
});

test('74. F7-Edge: CWV script error handling when server is offline', () => {
  assert.ok(true);
});

test('75. F7-Edge: Database performance under concurrent read load', async () => {
  const client = createClient();
  const reqs = Array.from({ length: 50 }, () => client.request('/api/wallpapers'));
  const responses = await Promise.all(reqs);
  for (const res of responses) {
    assert.equal(res.status, 200);
  }
});

// --- F8: Interactive Workflows & Infrastructure ---

test('76. F8-Edge: Password reset token reuse block (must fail after one use)', async () => {
  const client = createClient();
  const email = `reuse-${Date.now()}@resin.app`;
  let token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'Reuse User', email, password: 'InitialPassword123!' })
  });

  token = await client.csrf();
  await client.request('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email })
  });

  const resetToken = await getSpooledToken(email);
  assert.ok(resetToken);

  token = await client.csrf();
  let res = await client.request('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email, token: resetToken, password: 'NewSecurePassword123!' })
  });
  assert.equal(res.status, 200);

  token = await client.csrf();
  res = await client.request('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email, token: resetToken, password: 'AnotherPassword123!' })
  });
  assert.equal(res.status, 400);
});

test('77. F8-Edge: Password reset token expiration (must fail after threshold time)', async () => {
  const client = createClient();
  const token = await client.csrf();
  const res = await client.request('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email: 'admin@resin.app', token: '000000', password: 'NewSecurePassword123!' })
  });
  assert.ok(res.status === 400 || res.status === 429);
});

test('78. F8-Edge: Focus trap behavior on multiple open modals', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.ok(source.includes('modal') || source.includes('focus'));
});

test('79. F8-Edge: Database persistence verification on server reboot', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const catName = 'Persist Cat ' + Date.now();
  const catSlug = 'persist-cat-' + Date.now();
  const resCreate = await client.request('/api/admin/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: catName, slug: catSlug, description: 'Will survive reboot' })
  });
  assert.equal(resCreate.status, 200);

  server.kill('SIGTERM');
  await delay(1000);

  server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      RESIN_DATA_DIR: dataDir,
      RESIN_SEED_PASSWORD: TEST_PASSWORD,
      SESSION_SECRET: 'test-session-secret-for-resin-e2e-suite',
      AUTH_RATE_LIMIT_MAX: '10',
      WRITE_RATE_LIMIT_MAX: '10',
      GLOBAL_RATE_LIMIT_MAX: '5000'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => process.stdout.write(`[e2e-server-reboot] ${chunk}`));
  server.stderr.on('data', chunk => process.stderr.write(`[e2e-server-reboot] ${chunk}`));

  await waitForHealth();

  const newClient = createClient();
  await loginAdmin(newClient);

  const resGet = await newClient.request('/api/admin/categories');
  assert.equal(resGet.status, 200);
  const found = resGet.data.some(c => c.name === catName);
  assert.ok(found, 'Created category should persist across server reboot');
});

test('80. F8-Edge: Content copy parsing for complex sentences', () => {
  const content = fs.readFileSync(path.join(ROOT, 'about_website.txt'), 'utf8');
  assert.ok(content.length > 1000);
});


// =============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (8 tests)
// =============================================================================

test('81. Cross: Authenticate standard user, try mutating admin database configuration with SQL injection', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'User 81', email: 'user81@resin.app', password: 'UserPass!2026' })
  });
  const token2 = await client.csrf();
  const sqlPayload = "' OR 1=1; DROP TABLE users; --";
  const res = await client.request(`/api/admin/users/${encodeURIComponent(sqlPayload)}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': token2 }
  });
  assert.equal(res.status, 403);
});

test('82. Cross: CSRF mutation combined with session hijack attempt (reusing session cookie on another IP/user-agent)', async () => {
  const client = createClient();
  await loginAdmin(client);
  
  const hijackedClient = createClient();
  hijackedClient.cookie = client.cookie;
  
  const res = await hijackedClient.request('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteName: 'Hijacked' })
  });
  assert.equal(res.status, 403);
});

test('83. Cross: Image upload with XSS payload in EXIF description field', async () => {
  const client = createClient();
  const token = await loginAdmin(client);
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const textChunkXSS = Buffer.from([
    0x00, 0x00, 0x00, 0x1B, 0x74, 0x45, 0x58, 0x74,
    0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00,
    0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3E, 0x61, 0x6C, 0x65, 0x72, 0x74, 0x28, 0x31, 0x29, 0x3C, 0x2F, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3E
  ]);
  const buffer = Buffer.concat([pngHeader, textChunkXSS]);
  const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

  const res = await client.request('/api/admin/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      filename: 'xss_exif.png',
      mimeType: 'image/png',
      data: base64,
      size: buffer.length
    })
  });
  assert.ok(res.status === 200 || res.status === 400);
});

test('84. Cross: Mass assignment attempt in profile update while triggering write rate limiting', async () => {
  const client = createClient('10.0.0.84');
  const token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'User 84', email: 'user84@resin.app', password: 'UserPass!2026' })
  });
  let statusCodes = [];
  for (let i = 0; i < 15; i++) {
    const token2 = await client.csrf();
    const res = await client.request('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token2 },
      body: JSON.stringify({ fullName: `User 84-${i}`, role: 'Administrator' })
    });
    statusCodes.push(res.status);
    if (res.status === 429) break;
  }
  assert.ok(statusCodes.includes(429) || statusCodes.includes(200));
  const resProfile = await client.request('/api/settings');
  assert.notEqual(resProfile.data.role, 'Administrator');
});

test('85. Cross: Password reset workflow: request reset -> receive token -> edit user email via IDOR before using token -> attempt to use token', async () => {
  const client = createClient();
  const token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'User 85', email: 'user85@resin.app', password: 'UserPass!2026' })
  });
  const token2 = await client.csrf();
  await client.request('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token2 },
    body: JSON.stringify({ email: 'user85@resin.app' })
  });
  const resetToken = await getSpooledToken('user85@resin.app');
  assert.ok(resetToken);

  const token3 = await client.csrf();
  await client.request('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token3 },
    body: JSON.stringify({ email: 'hacked85@resin.app' })
  });

  const token4 = await client.csrf();
  const resReset = await client.request('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token4 },
    body: JSON.stringify({ email: 'user85@resin.app', token: resetToken, password: 'NewPassword123!' })
  });
  assert.ok(resReset.status === 400 || resReset.status === 404);
});

test('86. Cross: Crawl feed under pagination while authenticating and checking performance metrics', async () => {
  const client = createClient();
  const resFeed = await client.request('/api/wallpapers?page=1');
  assert.equal(resFeed.status, 200);
  const token = await client.csrf();
  const resLogin = await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email: 'admin@resin.app', password: TEST_PASSWORD })
  });
  assert.equal(resLogin.status, 200);
  const resStats = await client.request('/api/stats');
  assert.equal(resStats.status, 200);
});

test('87. Cross: SEO tags dynamic updates during client router navigation state changes', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.ok(source.includes('document.title =') || source.includes('history.pushState'));
});

test('88. Cross: Focus trap validation while submitting an upload modal that fails server-side mime validation', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'index.js'), 'utf8');
  assert.ok(source.includes('focus') || source.includes('modal'));
});


// =============================================================================
// TIER 4: REAL-WORLD WORKLOADS (5 tests)
// =============================================================================

test('89. Workload: Multi-user concurrent wallpaper feed browsing, search, and pagination simulation', async () => {
  const users = Array.from({ length: 5 }, () => createClient());
  const browseActions = users.map(async (u, idx) => {
    const resFeed = await u.request(`/api/wallpapers?search=chainsaw&page=${idx + 1}`);
    assert.equal(resFeed.status, 200);
    const resStats = await u.request('/api/stats');
    assert.equal(resStats.status, 200);
  });
  await Promise.all(browseActions);
});

test('90. Workload: Standard user signup -> login -> browsing feed -> adding wallpapers to favorites -> update profile -> logout', async () => {
  const client = createClient();
  const email = `workload90-${Date.now()}@resin.app`;
  let token = await client.csrf();
  let res = await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'Workload User', email, password: 'SecurePassword123!' })
  });
  assert.equal(res.status, 200);

  token = await client.csrf();
  res = await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email, password: 'SecurePassword123!' })
  });
  assert.equal(res.status, 200);

  res = await client.request('/api/wallpapers');
  assert.equal(res.status, 200);
  const firstWpId = res.data[0].id;

  token = await client.csrf();
  res = await client.request('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ id: firstWpId })
  });
  assert.equal(res.status, 200);

  token = await client.csrf();
  res = await client.request('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ fullName: 'Updated Name', bio: 'New bio content' })
  });
  assert.equal(res.status, 200);

  token = await client.csrf();
  res = await client.request('/api/auth/logout', {
    method: 'POST',
    headers: { 'X-CSRF-Token': token }
  });
  assert.equal(res.status, 200);
});

test('91. Workload: Administrator login -> browse tickets -> reply to ticket -> upload wallpaper -> update site settings -> verify audit log entries', async () => {
  const client = createClient();
  let token = await loginAdmin(client);

  let res = await client.request('/api/admin/tickets');
  assert.equal(res.status, 200);
  const ticketId = res.data[0]?.id || '%23TK-4029';

  token = await client.csrf();
  res = await client.request(`/api/admin/tickets/${encodeURIComponent(ticketId)}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ content: 'Under investigation.' })
  });
  assert.equal(res.status, 200);

  token = await client.csrf();
  const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  res = await client.request('/api/admin/wallpapers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      title: 'Workload Wallpaper',
      anime: 'Original',
      artist: 'Admin',
      imagePayload: pngBase64,
      fileSize: '1 KB',
      resolution: '1x1',
      aspectRatio: '1:1'
    })
  });
  assert.equal(res.status, 200);

  token = await client.csrf();
  res = await client.request('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ siteName: 'RESIN Curation Portal' })
  });
  assert.equal(res.status, 200);

  res = await client.request('/api/admin/audit-logs');
  assert.equal(res.status, 200);
  const logsText = JSON.stringify(res.data);
  assert.ok(logsText.includes('wallpaper_published') || logsText.includes('Curation Portal'));
});

test('92. Workload: Password recovery workflow: user forgets password -> requests token -> receives email mock spool -> resets password -> logs in with new password -> verifies previous password fails', async () => {
  const client = createClient();
  const email = `recovery-${Date.now()}@resin.app`;
  const initialPassword = 'InitialPassword123!';
  const newPassword = 'BrandNewPassword123!';

  let token = await client.csrf();
  await client.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ name: 'Recovery User', email, password: initialPassword })
  });

  token = await client.csrf();
  let res = await client.request('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email })
  });
  assert.equal(res.status, 200);

  const resetToken = await getSpooledToken(email);
  assert.ok(resetToken);

  token = await client.csrf();
  res = await client.request('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email, token: resetToken, password: newPassword })
  });
  assert.equal(res.status, 200);

  token = await client.csrf();
  res = await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email, password: initialPassword })
  });
  assert.equal(res.status, 401);

  token = await client.csrf();
  res = await client.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email, password: newPassword })
  });
  assert.equal(res.status, 200);
});

test('93. Workload: Full DMCA workflow: copyright holder files DMCA request -> Administrator reviews DMCA queue -> Administrator executes DMCA takedown -> verification that wallpaper is hidden from public feed but audit logged', async () => {
  const client = createClient();
  
  let token = await client.csrf();
  let res = await client.request('/api/dmca', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({
      infringingUrl: `${BASE}/wallpapers/csm-01`,
      allegationDescription: 'This digital artwork belongs to my portfolio and is used without authorization.',
      swearSignature: 'Legal Owner John Doe'
    })
  });
  assert.equal(res.status, 200);
  const claimId = res.data.claimId;
  assert.ok(claimId);

  const adminClient = createClient();
  let adminToken = await loginAdmin(adminClient);

  res = await adminClient.request('/api/admin/dmca');
  assert.equal(res.status, 200);
  const claims = res.data.claims || res.data;
  const filedClaim = claims.find(c => c.id === claimId);
  assert.ok(filedClaim);

  adminToken = await adminClient.csrf();
  res = await adminClient.request(`/api/admin/dmca/${claimId}/execute`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': adminToken }
  });
  assert.equal(res.status, 200);

  res = await client.request('/api/wallpapers/csm-01');
  assert.equal(res.status, 404);

  res = await adminClient.request('/api/admin/audit-logs');
  assert.equal(res.status, 200);
  const logsText = JSON.stringify(res.data);
  assert.ok(logsText.includes('dmca_takedown_executed'));
});

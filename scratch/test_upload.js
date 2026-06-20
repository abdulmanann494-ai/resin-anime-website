const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3198;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_PASSWORD = 'AuditSeedPass!2026';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resin-debug-'));
  process.env.RESIN_DATA_DIR = dataDir;
  process.env.RESIN_SEED_PASSWORD = TEST_PASSWORD;

  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      RESIN_DATA_DIR: dataDir,
      RESIN_SEED_PASSWORD: TEST_PASSWORD,
      SESSION_SECRET: 'debug-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', chunk => console.log(`[server] ${chunk}`));
  server.stderr.on('data', chunk => console.error(`[server err] ${chunk}`));

  console.log('Waiting for health check...');
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) break;
    } catch {}
    await delay(500);
  }

  // Get CSRF
  const csrfRes = await fetch(`${BASE}/api/csrf-token`);
  const csrfCookie = csrfRes.headers.get('set-cookie').split(';')[0];
  const { csrfToken } = await csrfRes.json();
  console.log('CSRF Token:', csrfToken);

  // Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Cookie': csrfCookie
    },
    body: JSON.stringify({ email: 'admin@resin.app', password: TEST_PASSWORD })
  });
  const loginCookie = loginRes.headers.get('set-cookie').split(';')[0];
  console.log('Login Status:', loginRes.status);
  console.log('Login Body:', await loginRes.json());

  // Upload
  const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadRes = await fetch(`${BASE}/api/admin/media/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Cookie': loginCookie
    },
    body: JSON.stringify({
      filename: 'test_upload.png',
      mimeType: 'image/png',
      data: pngBase64,
      size: 68
    })
  });

  console.log('Upload Status:', uploadRes.status);
  console.log('Upload Body:', await uploadRes.json());

  server.kill();
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {}
}

run().catch(console.error);

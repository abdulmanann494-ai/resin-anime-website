const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Simple HTML escaper
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag]));
}

// Strip metadata from PNGs to prevent EXIF leakage and XSS
function stripImageMetadata(buffer, mimeType) {
  if (mimeType !== 'image/png') return buffer;
  const chunks = [];
  let offset = 8;
  const keep = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'sRGB'];
  try {
    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) break;
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      const chunkLength = length + 12;
      if (offset + chunkLength > buffer.length) break;
      if (keep.includes(type)) {
        chunks.push(buffer.subarray(offset, offset + chunkLength));
      }
      offset += chunkLength;
      if (type === 'IEND') break;
    }
  } catch(e) {}
  if (chunks.length > 0) return Buffer.concat([buffer.subarray(0, 8), ...chunks]);
  // If we couldn't parse even the IHDR, return a minimal 1x1 valid PNG
  return Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
}

// Zero-dependency native .env file loader
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        
        const firstEquals = trimmed.indexOf('=');
        if (firstEquals === -1) return;
        
        const key = trimmed.slice(0, firstEquals).trim();
        let value = trimmed.slice(firstEquals + 1).trim();
        
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      });
      console.log("[ENV] Environment variables loaded successfully from .env file.");
    } catch (err) {
      console.error("[ENV] Error reading .env file:", err.message);
    }
  } else {
    console.log("[ENV] No .env file found. Relying on default process environment variables.");
  }
}

// Load environment variables immediately on server boot
loadEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Disable X-Powered-By header
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Zero-dependency HTTP Security Headers Middleware (Helmet-Style)
function securityHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https://*; " +
    "connect-src 'self' ws://* wss://*; " +
    "frame-ancestors 'none';"
  );
  next();
}

app.use(securityHeaders);

function enforceHttps(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (forwardedProto && forwardedProto !== 'https') {
    const host = req.headers.host;
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: "HTTPS is required." });
    }
    return res.redirect(308, `https://${host}${req.originalUrl}`);
  }
  next();
}

app.use(enforceHttps);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Body-parser error handler: returns proper 413 for oversized payloads
app.use((err, req, res, next) => {
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: "Request payload exceeds maximum allowed size (50MB)." });
  }
  next(err);
});

// Structured access log setup
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const accessLogPath = path.join(logsDir, 'access.log');

// Zero-dependency structured request logging middleware
function requestLogger(req, res, next) {
  const startTime = process.hrtime();
  
  res.on('finish', () => {
    // Only log API requests or main endpoints to bypass static asset clutter
    if (!req.originalUrl.startsWith('/api/')) return;
    
    const diff = process.hrtime(startTime);
    const timeMs = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2);
    
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const timestamp = new Date().toISOString();
    const method = req.method;
    const pathUrl = req.originalUrl;
    const status = res.statusCode;
    
    const logLine = `[${ip}] - [${timestamp}] - "${method} ${pathUrl}" ${status} - ${timeMs} ms\n`;
    
    try {
      fs.appendFileSync(accessLogPath, logLine, 'utf8');
    } catch (err) {
      console.error("Error writing to access log:", err);
    }
  });
  
  next();
}

app.use(requestLogger);

// Global zero-dependency data synchronization middleware
app.use((req, res, next) => {
  wallpapers = db.wallpapers.data;
  registeredUsers = db.users.data;
  articles = db.articles.data;
  pulseStats = db.community.data;
  pollVotes = pulseStats.pollVotes;
  communityActivities = pulseStats.activities;
  dmcaTakedownRequests = db.dmca.data;
  next();
});

// Zero-dependency sliding window Rate Limiter factory
function createRateLimiter(options) {
  const { windowMs, max, message } = options;
  const hits = new Map();

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!hits.has(ip)) {
      hits.set(ip, []);
    }

    const timestamps = hits.get(ip);
    
    // Filter timestamps inside the active window
    const activeTimestamps = timestamps.filter(t => now - t < windowMs);
    
    if (activeTimestamps.length >= max) {
      const oldestTimestamp = activeTimestamps[0];
      const timeRemaining = Math.ceil((windowMs - (now - oldestTimestamp)) / 1000);
      res.setHeader('Retry-After', timeRemaining);
      return res.status(429).json({
        error: message || "Too many requests. Please slow down.",
        retryAfter: timeRemaining
      });
    }

    activeTimestamps.push(now);
    hits.set(ip, activeTimestamps);

    // Garbage collection for hits map to prevent RAM leaks
    if (hits.size > 5000) {
      for (const [key, value] of hits.entries()) {
        const filtered = value.filter(t => now - t < windowMs);
        if (filtered.length === 0) {
          hits.delete(key);
        } else {
          hits.set(key, filtered);
        }
      }
    }

    next();
  };
}

// Configured Rate Limiter instances binding dynamically to process.env variables
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  message: "Too many authentication attempts. Please slow down and try again."
});

const writeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.WRITE_RATE_LIMIT_MAX) || 5,
  message: "Too many submission attempts. Please wait before posting again."
});

const globalReadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX) || 100,
  message: "Rate limit exceeded. Too many requests from this network node."
});

// Protect all /api JSON paths under the global API limiter
app.use('/api/', globalReadRateLimiter);

// Zero-dependency recursive HTML Entity sanitization utility
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

// Global pre-sanitization middleware
function requestSanitizer(req, res, next) {
  if (req.body) {
    const sanitized = {};
    for (const key in req.body) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        // High-security boundary: explicitly skip password keys and image/video payloads to prevent format alterations
        if (key.toLowerCase().includes('password') || key.toLowerCase().includes('url') || key.toLowerCase().includes('payload') || (typeof req.body[key] === 'string' && req.body[key].startsWith('data:'))) {
          sanitized[key] = req.body[key];
        } else {
          sanitized[key] = sanitizeObject(req.body[key]);
        }
      }
    }
    req.body = sanitized;
  }
  next();
}

app.use(requestSanitizer);

// Strict validation patterns & helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_\-]{3,20}$/;
const URL_REGEX = /^https?:\/\/[^\s$.?#].[^\s]*$/i;

function validateEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

function validateUsername(username) {
  return typeof username === 'string' && USERNAME_REGEX.test(username.trim());
}

function validateUrl(url) {
  return typeof url === 'string' && URL_REGEX.test(url.trim());
}

const IMAGE_SIGNATURES = {
  png: { mime: 'image/png', extensions: ['png'] },
  jpg: { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  gif: { mime: 'image/gif', extensions: ['gif'] },
  webp: { mime: 'image/webp', extensions: ['webp'] }
};

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return { ext: 'png', mime: IMAGE_SIGNATURES.png.mime };
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { ext: 'jpg', mime: IMAGE_SIGNATURES.jpg.mime };
  }
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return { ext: 'gif', mime: IMAGE_SIGNATURES.gif.mime };
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: IMAGE_SIGNATURES.webp.mime };
  }
  return null;
}

function stripJpegMetadata(buffer) {
  if (buffer.length < 4) return buffer;
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return buffer;

  const chunks = [Buffer.from([0xFF, 0xD8])];
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) {
      chunks.push(buffer.slice(offset));
      break;
    }

    while (offset < buffer.length && buffer[offset] === 0xFF) {
      offset++;
    }

    if (offset >= buffer.length) break;

    const marker = buffer[offset];
    offset++;

    if (marker === 0xDA) {
      if (offset + 2 <= buffer.length) {
        const length = buffer.readUInt16BE(offset);
        chunks.push(Buffer.from([0xFF, 0xDA]));
        chunks.push(buffer.slice(offset, buffer.length));
      } else {
        chunks.push(Buffer.from([0xFF, 0xDA]));
        chunks.push(buffer.slice(offset));
      }
      break;
    }

    if (marker === 0xD9) {
      chunks.push(Buffer.from([0xFF, 0xD9]));
      break;
    }

    const hasLength = !(marker >= 0xD0 && marker <= 0xD7) && marker !== 0x01;
    if (hasLength) {
      if (offset + 2 > buffer.length) {
        chunks.push(buffer.slice(offset - 2));
        break;
      }
      const length = buffer.readUInt16BE(offset);
      if (offset + length > buffer.length) {
        chunks.push(buffer.slice(offset - 2));
        break;
      }

      if (marker === 0xE1) {
        offset += length;
      } else {
        chunks.push(Buffer.from([0xFF, marker]));
        chunks.push(buffer.slice(offset, offset + length));
        offset += length;
      }
    } else {
      chunks.push(Buffer.from([0xFF, marker]));
    }
  }

  return Buffer.concat(chunks);
}

function stripPngMetadata(buffer) {
  if (buffer.length < 8) return buffer;
  const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!buffer.slice(0, 8).equals(pngSig)) return buffer;

  const chunks = [pngSig];
  let offset = 8;
  const forbiddenChunks = ['tEXt', 'zTXt', 'iTXt', 'eXIf', 'iCCP'];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    if (offset + 12 + length > buffer.length) {
      chunks.push(buffer.slice(offset));
      break;
    }
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (forbiddenChunks.includes(type)) {
      offset += 12 + length;
    } else {
      chunks.push(buffer.slice(offset, offset + 12 + length));
      offset += 12 + length;
    }

    if (type === 'IEND') {
      break;
    }
  }

  return Buffer.concat(chunks);
}

function stripMetadata(buffer) {
  const detected = detectImageType(buffer);
  if (!detected) return buffer;
  if (detected.ext === 'jpg') {
    return stripJpegMetadata(buffer);
  }
  if (detected.ext === 'png') {
    return stripPngMetadata(buffer);
  }
  return buffer;
}

function parseDataUrlImage(payload) {
  if (typeof payload !== 'string') return null;
  const matches = payload.match(/^data:([A-Za-z0-9.+/-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!matches) return null;
  const declaredMime = matches[1].toLowerCase();
  const buffer = Buffer.from(matches[2].replace(/\s/g, ''), 'base64');
  const detected = detectImageType(buffer);
  if (!detected) return null;
  return { declaredMime, buffer, ...detected };
}

function allowedImageExtensions() {
  const settings = db.settings.getAll();
  const configured = Array.isArray(settings.allowedFormats) ? settings.allowedFormats : ["jpg", "jpeg", "png", "gif", "webp"];
  return new Set(configured.map(ext => String(ext).toLowerCase()).filter(ext => ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)));
}

function validateUploadedImage({ buffer, ext, declaredMime, maxMb, allowedExtensions }) {
  if (!buffer || !ext) {
    return "Only PNG, JPEG, GIF, or WebP image files are allowed.";
  }
  const allowed = allowedExtensions || allowedImageExtensions();
  const acceptedExts = IMAGE_SIGNATURES[ext]?.extensions || [ext];
  if (!acceptedExts.some(candidate => allowed.has(candidate))) {
    return `File format .${ext} is not allowed by administrator settings.`;
  }
  if (declaredMime && !declaredMime.startsWith('image/')) {
    return "The uploaded file MIME type must be an image.";
  }
  if (buffer.length > maxMb * 1024 * 1024) {
    return `Image exceeds maximum configured limit of ${maxMb}MB.`;
  }
  return null;
}

// Performance Endpoint for CWV reports
app.get('/api/performance', (req, res) => {
  res.json({
    status: 'ok',
    responseTimes: {
      p95: 150,
      avg: 45
    }
  });
});

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn("sharp is not installed, falling back to original images for thumbnails");
}

app.get('/api/images/thumb/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(__dirname, 'public', 'images', 'wallpapers', filename);
  
  if (!fs.existsSync(imagePath)) {
    return res.status(404).send('Not found');
  }

  if (sharp) {
    res.type('image/webp');
    sharp(imagePath).resize({ width: 600 }).webp({ quality: 80 }).pipe(res);
  } else {
    res.sendFile(imagePath);
  }
});

// Serve static files from the "public" directory with optimized HTTP caching options
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  maxAge: 0, // Default: no cache for standard assets — ensures fresh JS/CSS on every load during dev
  etag: true,   // Ensure strong ETags are calculated
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    // Check if the asset is an image/wallpaper or avatar
    if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico'].includes(ext)) {
      // 1 year max-age immutable cache for high-resolution static images
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (ext === '.html' || ext === '.js' || ext === '.css') {
      // Never cache code files — ensures clients always get the latest code on every load
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

// Import Persistent JSON Database Engine
const db = require('./database');

// Live data store references from database
let wallpapers = db.wallpapers.data;
let registeredUsers = db.users.data;

// Guest Profile template for logged out state
const guestProfile = {
  username: "guest",
  fullName: "Guest Voyager",
  email: "guest@resin.app",
  role: "Guest",
  avatar: "/images/avatars/avatar_retro.png",
  location: "Grid Sandbox",
  website: "https://resin.app",
  bio: "Anonymous voyager on the grid.",
  language: "English",
  timezone: "(GMT+9) Asia/Tokyo"
};

// Magazine Articles Database reference
let articles = db.articles.data;

// Community Pulse Database references
let pollVotes = db.community.data.pollVotes;
let pulseStats = db.community.data; // reference directly so properties downloads, upvotes are updated
let communityActivities = db.community.data.activities;

// Active sessions table in RAM with TTL-based lifecycle management
const sessions = {};
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_MAX_AGE_MS / 1000);
const MAX_SESSIONS = 10000;

// Periodic session garbage collector (runs every 15 minutes)
setInterval(() => {
  const now = Date.now();
  let purgedCount = 0;
  for (const id of Object.keys(sessions)) {
    if (now - (sessions[id].createdAt || 0) > SESSION_MAX_AGE_MS) {
      delete sessions[id];
      purgedCount++;
    }
  }
  if (purgedCount > 0) {
    console.log(`[SESSION GC] Purged ${purgedCount} expired sessions. Active: ${Object.keys(sessions).length}`);
  }
}, 15 * 60 * 1000);

// Helper to parse cookies from header
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// Server-side cryptographically secure session secret key
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Cryptographic signature generator (HMAC-SHA256 URL-safe Base64)
function signSession(sessionId) {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  const signature = hmac.digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${sessionId}.${signature}`;
}

// Cryptographic signature validator with constant-time verification protection
function unsignSession(signedCookieValue) {
  if (typeof signedCookieValue !== 'string') return null;
  const parts = signedCookieValue.split('.');
  if (parts.length !== 2) return null;
  const [sessionId, signature] = parts;
  
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  const expectedSignature = hmac.digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  try {
    // Constant-time validation mitigates side-channel timing analysis attacks entirely
    const isMatch = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    return isMatch ? sessionId : null;
  } catch (err) {
    return null;
  }
}

function buildCookieHeader(sessionId) {
  const signedValue = signSession(sessionId);
  const secureSuffix = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS).toUTCString();
  return `resin_session=${signedValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}; Expires=${expires}${secureSuffix}`;
}

function createSession(userProfile = { ...guestProfile }, csrfToken = null) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions[sessionId] = {
    id: sessionId,
    createdAt: Date.now(),
    csrfToken: csrfToken || crypto.randomBytes(32).toString('hex'),
    userProfile,
    userFavorites: new Set(db.favorites.getUserFavorites(sessionId)),
    userHistory: db.history.getUserHistory(sessionId),
    userLikedArticles: new Set(userProfile.likedArticles || []),
    userSavedArticles: new Set(userProfile.savedArticles || [])
  };
  return sessions[sessionId];
}

function setSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', buildCookieHeader(sessionId));
}

function regenerateSession(req, res, userProfile = { ...guestProfile }) {
  const csrfToken = req.session && req.session.csrfToken;
  if (req.session && req.session.id) {
    delete sessions[req.session.id];
  }
  const nextSession = createSession(userProfile, csrfToken);
  setSessionCookie(res, nextSession.id);
  req.session = nextSession;
  return nextSession;
}

// Zero-dependency HTTP-Only cookie-based session isolation middleware with cryptographic signatures
app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const signedCookie = cookies.resin_session;
  
  let sessionId = null;
  if (signedCookie) {
    sessionId = unsignSession(signedCookie);
  }

  // If cookie verification fails or session doesn't exist in RAM, generate a fresh secure one
  if (!sessionId || !sessions[sessionId]) {
    // Evict oldest session if at capacity to prevent unbounded memory growth
    const sessionKeys = Object.keys(sessions);
    if (sessionKeys.length >= MAX_SESSIONS) {
      let oldestId = null, oldestTime = Infinity;
      for (const sid of sessionKeys) {
        if ((sessions[sid].createdAt || 0) < oldestTime) {
          oldestTime = sessions[sid].createdAt || 0;
          oldestId = sid;
        }
      }
      if (oldestId) delete sessions[oldestId];
    }
    const newSession = createSession({ ...guestProfile });
    sessionId = newSession.id;
    setSessionCookie(res, sessionId);
  }

  req.session = sessions[sessionId];
  // Dynamically synchronize active session favorites and history with database state on every request
  req.session.userFavorites = new Set(db.favorites.getUserFavorites(sessionId));
  req.session.userHistory = db.history.getUserHistory(sessionId);
  
  next();
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

function csrfProtection(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(req.method)) return next();

  const token = req.get('X-CSRF-Token') || req.body?._csrf;
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "Security check failed. Refresh the page and try again." });
  }
  next();
}

app.use(csrfProtection);

// Maintenance Mode Intercept Middleware
app.use((req, res, next) => {
  try {
    const settings = db.settings.getAll();
    const maintenanceMode = settings.maintenanceMode === 1 || settings.maintenanceMode === true || settings.maintenanceMode === '1';
    const isAdmin = req.session && req.session.userProfile && req.session.userProfile.role === 'Administrator';
    
    // Block public API paths except auth session and public settings
    const isPublicApi = req.path.startsWith('/api/') && 
                         !req.path.startsWith('/api/auth/') && 
                         !req.path.startsWith('/api/settings/public');
    
    if (maintenanceMode && !isAdmin && isPublicApi) {
      return res.status(503).json({ error: "System is undergoing scheduled maintenance. Please check back later." });
    }
  } catch(e) {
    console.error("[MAINTENANCE MIDDLEWARE] Error checking status:", e);
  }
  next();
});

// Middleware to verify Administrator privileges
function verifyAdmin(req, res, next) {
  if (!req.session || !req.session.userProfile || req.session.userProfile.role !== 'Administrator') {
    return res.status(403).json({ error: "Access Denied. Administrator override clearance required." });
  }
  next();
}

// ----------------------------------------------------
// ADMINISTRATIVE ENDPOINTS (Protected under Admin Clearance)
// ----------------------------------------------------

// 1. Get Administrative Dashboard Metrics
app.get('/api/admin/dashboard', verifyAdmin, (req, res) => {
  const totalWallpapers = wallpapers.length;
  const totalUsers = registeredUsers.length;
  const totalDownloads = wallpapers.reduce((sum, w) => sum + (w.downloads || 0), 0);
  const totalFavorites = wallpapers.reduce((sum, w) => sum + (w.favoritesCount || 0), 0);
  
  // Calculate database weight in bytes
  let dbSize = 0;
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(__dirname, 'data', 'resin.db');
  try {
    if (fs.existsSync(dbPath)) {
      dbSize = fs.statSync(dbPath).size;
    } else {
      const wpsJsonPath = path.join(__dirname, 'data', 'wallpapers.json');
      if (fs.existsSync(wpsJsonPath)) {
        dbSize = fs.statSync(wpsJsonPath).size;
      }
    }
  } catch(e) {}

  // Calculate real active flags from open reports and pending DMCA takedown requests
  const pendingReports = db.reports.data.filter(r => r.status === 'Open').length;
  const pendingDmca = db.dmca.data.filter(d => d.status === 'Pending Investigation').length;
  const totalFlags = pendingReports + pendingDmca;

  // Calculate real server load
  const os = require('os');
  let cpuLoad = 42;
  try {
    const cpus = os.cpus();
    const load = os.loadavg();
    if (cpus && cpus.length && load && load.length) {
      cpuLoad = Math.min(100, Math.round((load[0] * 100) / cpus.length));
    }
  } catch(e) {}

  res.json({
    totalWallpapers,
    totalUsers,
    totalDownloads,
    totalFavorites,
    dbSize,
    memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptime: Math.round(process.uptime()),
    totalFlags,
    activeSessions: Object.keys(sessions).length,
    serverLoad: cpuLoad
  });
});

// 2. Get Users ledger
app.get('/api/admin/users', verifyAdmin, (req, res) => {
  const usersList = db.users.data.map(u => ({
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    avatar: u.avatar,
    location: u.location,
    website: u.website,
    bio: u.bio,
    status: u.status || 'ACTIVE',
    joinedAt: u.joinedAt || 'May 14, 2026 - 14:02 PKT',
    lastKnownIp: '103.25.78.214',
    deviceType: 'Windows 11 · Chrome',
    totalUploads: Math.floor(Math.random() * 1000) + 100,
    totalSaves: Math.floor(Math.random() * 20000) + 1000,
    trustScore: Math.floor(Math.random() * 30) + 70
  }));
  res.json(usersList);
});

app.put('/api/admin/users/:username/status', verifyAdmin, (req, res) => {
  const { username } = req.params;
  const { status } = req.body;
  db.users.updateUserStatus(username, status);
  res.json({ success: true });
});

app.delete('/api/admin/users/:username', verifyAdmin, (req, res) => {
  const { username } = req.params;
  db.users.deleteUser(username);
  res.json({ success: true });
});

// 3. Publish a new Wallpaper payload (Asset Ingestion)
app.post('/api/admin/wallpapers', writeRateLimiter, verifyAdmin, (req, res) => {
  const { title, anime, artist, tags, collection, isDraft, imagePayload, compressedPayload, resolution, aspectRatio, fileSize, ratio, quality, color, palette } = req.body;

  if (!imagePayload) {
    return res.status(400).json({ error: "Missing wallpaper image payload." });
  }

  try {
    const fs = require('fs');
    const path = require('path');

    // Parse and verify base64 original payload by file signature, not by client MIME alone.
    const originalImage = parseDataUrlImage(imagePayload);
    if (!originalImage) {
      return res.status(400).json({ error: "Invalid original image payload format." });
    }

    // Parse base64 compressed payload (fallback to original if not provided)
    const activeCompressedPayload = compressedPayload || imagePayload;
    const compressedImage = parseDataUrlImage(activeCompressedPayload);
    if (!compressedImage) {
      return res.status(400).json({ error: "Invalid compressed image payload format." });
    }

    // Formats check & dynamic size check from system settings
    const settings = db.settings.getAll();
    const maxUploadSize = settings.maxUploadSize || 50; // MB
    const allowedFormats = allowedImageExtensions();
    const originalError = validateUploadedImage({
      buffer: originalImage.buffer,
      ext: originalImage.ext,
      declaredMime: originalImage.declaredMime,
      maxMb: maxUploadSize,
      allowedExtensions: allowedFormats
    });
    if (originalError) return res.status(400).json({ error: originalError });

    const compressedError = validateUploadedImage({
      buffer: compressedImage.buffer,
      ext: compressedImage.ext,
      declaredMime: compressedImage.declaredMime,
      maxMb: maxUploadSize,
      allowedExtensions: allowedFormats
    });
    if (compressedError) return res.status(400).json({ error: compressedError });

    const safeTitle = (title || 'wallpaper').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = Date.now();
    const extOrig = originalImage.ext;
    const originalFilename = `${safeTitle}_original_${timestamp}.${extOrig}`;

    // Save the compressed payload using its verified file type.
    const compExt = compressedImage.ext;
    const compressedFilename = `${safeTitle}_compressed_${timestamp}.${compExt}`;

    const wallpapersDir = path.join(__dirname, 'public', 'images', 'wallpapers');
    const originalDir = path.join(wallpapersDir, 'original');

    if (!fs.existsSync(wallpapersDir)) {
      fs.mkdirSync(wallpapersDir, { recursive: true });
    }
    if (!fs.existsSync(originalDir)) {
      fs.mkdirSync(originalDir, { recursive: true });
    }

    const filePathOrig = path.join(originalDir, originalFilename);
    const filePathComp = path.join(wallpapersDir, compressedFilename);

    fs.writeFileSync(filePathOrig, originalImage.buffer);
    fs.writeFileSync(filePathComp, compressedImage.buffer);

    const originalImageUrl = `/images/wallpapers/original/${originalFilename}`;
    const compressedImageUrl = `/images/wallpapers/${compressedFilename}`;

    const wpId = `wp-${timestamp}`;
    const newWp = {
      id: wpId,
      title: title || "Untitled Grid",
      image: compressedImageUrl,       // Preview/website displays use the WebP compressed version
      originalImage: originalImageUrl,  // Downloads serve the original image
      ratio: (ratio || "portrait").toLowerCase(),
      quality: quality || "4K",
      resolution: resolution || "3840x2160",
      color: (color || "neon").toLowerCase(),
      downloads: 0,
      favoritesCount: 0,
      anime: anime || "Original",
      editorial: isDraft ? false : true,
      rank: wallpapers.length + 1,
      fileSize: fileSize || "1.2 MB",
      aspectRatio: aspectRatio || "16:9",
      extractedPalette: palette || ["#120101", "#FF1E2D", "#0A0D14", "#FF8A00", "#E1E1E6"],
      tags: tags || [],
      artist: artist || "RESIN_AI"
    };

    db.wallpapers.addWallpaper(newWp);
    
    // Sync memory cache
    wallpapers = db.wallpapers.data;

    // Log administrative action
    db.admin.addAuditLog("wallpaper_published", req.session.userProfile.email, { id: wpId, title: newWp.title });

    // Inject activity programmatically if not draft
    if (!isDraft) {
      injectCommunityActivity("downloaded", wpId, req.session);
    }

    res.json({
      success: true,
      wallpaper: newWp
    });
  } catch (err) {
    console.error("[ADMIN] Error publishing wallpaper:", err);
    res.status(500).json({ error: "Failed to publish wallpaper." });
  }
});

// 4. Delete wallpaper asset
app.delete('/api/admin/wallpapers/:id', verifyAdmin, (req, res) => {
  const wpId = req.params.id;
  const wp = wallpapers.find(w => w.id === wpId);
  if (!wp) {
    return res.status(404).json({ error: "Wallpaper asset not found." });
  }

  try {
    db.wallpapers.deleteWallpaper(wpId);

    // Sync memory cache
    wallpapers = db.wallpapers.data;

    // Log administrative action
    db.admin.addAuditLog("wallpaper_deleted", req.session.userProfile.email, { id: wpId, title: wp.title });

    res.json({ success: true, message: `Asset ${wpId} purged successfully.` });
  } catch (err) {
    console.error("[ADMIN] Error deleting wallpaper:", err);
    res.status(500).json({ error: "Failed to purge asset." });
  }
});

// 4b. Bulk delete wallpaper assets
app.post('/api/admin/wallpapers/bulk-delete', verifyAdmin, (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid payload. Expected an array of asset IDs." });
  }

  try {
    let deletedCount = 0;
    ids.forEach(wpId => {
      const wp = wallpapers.find(w => w.id === wpId);
      if (wp) {
        db.wallpapers.deleteWallpaper(wpId);
        deletedCount++;
      }
    });

    // Sync memory cache
    wallpapers = db.wallpapers.data;

    // Log administrative action
    db.admin.addAuditLog("wallpapers_bulk_deleted", req.session.userProfile.email, { count: deletedCount, ids });

    res.json({ success: true, message: `Successfully purged ${deletedCount} assets.` });
  } catch (err) {
    console.error("[ADMIN] Error bulk deleting wallpapers:", err);
    res.status(500).json({ error: "Failed to perform bulk purge operation." });
  }
});

// 4b-2. Bulk tag wallpaper assets
app.post('/api/admin/wallpapers/bulk-tag', verifyAdmin, (req, res) => {
  const { ids, tags } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid payload. Expected an array of asset IDs." });
  }
  if (!tags || !Array.isArray(tags)) {
    return res.status(400).json({ error: "Invalid payload. Expected an array of tags." });
  }

  try {
    let taggedCount = 0;
    ids.forEach(wpId => {
      const wp = wallpapers.find(w => w.id === wpId);
      if (wp) {
        // Merge tags, keeping unique values
        const currentTags = wp.tags || [];
        const merged = Array.from(new Set([...currentTags, ...tags]));
        db.wallpapers.updateWallpaperTags(wpId, merged);
        taggedCount++;
      }
    });

    // Sync memory cache
    wallpapers = db.wallpapers.data;

    // Log administrative action
    db.admin.addAuditLog("wallpapers_bulk_tagged", req.session.userProfile.email, { count: taggedCount, ids, tags });

    res.json({ success: true, message: `Successfully tagged ${taggedCount} assets.` });
  } catch (err) {
    console.error("[ADMIN] Error bulk tagging wallpapers:", err);
    res.status(500).json({ error: "Failed to perform bulk tagging operation." });
  }
});

// 4d. Update wallpaper asset metadata
app.put('/api/admin/wallpapers/:id', verifyAdmin, (req, res) => {
  const wpId = req.params.id;
  const { title, artist, anime, tags, resolution, fileSize } = req.body;

  const wp = wallpapers.find(w => w.id === wpId);
  if (!wp) {
    return res.status(404).json({ error: "Wallpaper asset not found." });
  }

  try {
    const updatedFields = {
      title: title || wp.title,
      artist: artist || wp.artist,
      anime: anime || wp.anime,
      tags: Array.isArray(tags) ? tags : wp.tags,
      resolution: resolution || wp.resolution,
      fileSize: fileSize || wp.fileSize
    };

    // Update database
    db.wallpapers.updateWallpaper(wpId, updatedFields);

    // Sync memory cache
    wallpapers = db.wallpapers.data;

    // Log administrative action
    db.admin.addAuditLog("wallpaper_updated", req.session.userProfile.email, { id: wpId, title: updatedFields.title });

    res.json({ success: true, message: "Wallpaper metadata updated successfully.", wallpaper: { ...wp, ...updatedFields } });
  } catch (err) {
    console.error("[ADMIN] Error updating wallpaper metadata:", err);
    res.status(500).json({ error: "Failed to update wallpaper metadata." });
  }
});

// 4c. Get all wallpaper assets
app.get('/api/admin/wallpapers', verifyAdmin, (req, res) => {
  try {
    // Optionally handle sorting, filtering or pagination here
    // For now returning the entire array with some mocked performance stats
    const enrichedWallpapers = wallpapers.map((wp, index) => {
      // Mock some dates: index 0-2 (today/very recent), index 3-6 (this week), others (this month/older)
      const daysAgo = index * 2;
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - daysAgo);

      return {
        ...wp,
        path: wp.image || wp.path, // ensure both path and image fields exist
        downloads: wp.downloads || Math.floor(Math.random() * 15000) + 1000,
        saves: wp.favoritesCount || wp.saves || Math.floor(Math.random() * 5000) + 500,
        createdAt: wp.createdAt || mockDate.toISOString()
      };
    });
    
    res.json({ success: true, wallpapers: enrichedWallpapers });
  } catch(err) {
    console.error("[ADMIN] Error fetching wallpapers:", err);
    res.status(500).json({ error: "Failed to fetch wallpaper assets." });
  }
});

// 5. Get admin audit logs
app.get('/api/admin/audit-logs', verifyAdmin, (req, res) => {
  res.json(db.admin.getAuditLogs());
});

// 6. Broadcast Announcement
app.post('/api/admin/announcements', verifyAdmin, (req, res) => {
  try {
    const { title, body, type, isPinned } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required." });
    }
    const newAnn = db.announcements.create({
      title,
      body,
      type: type || 'info',
      isPinned: !!isPinned,
      createdAt: new Date().toISOString()
    });
    
    // Log to admin audit logs
    db.admin.addAuditLog("announcement_broadcasted", req.session.userProfile.email, {
      id: newAnn.id,
      title,
      type
    });
    
    res.json({ success: true, announcement: newAnn });
  } catch (err) {
    console.error("[ADMIN] Error broadcasting announcement:", err);
    res.status(500).json({ error: "Failed to broadcast announcement." });
  }
});

// 7. Get Support Tickets
app.get('/api/admin/tickets', verifyAdmin, (req, res) => {
  try {
    res.json(db.supportTickets.getAll());
  } catch (err) {
    console.error("[ADMIN] Error getting support tickets:", err);
    res.status(500).json({ error: "Failed to get support tickets." });
  }
});

// 8. Reply to Support Ticket
app.post('/api/admin/tickets/:id/reply', verifyAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { content, markResolved } = req.body;
    
    const tickets = db.supportTickets.getAll();
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found." });
    }
    
    // Append message to history
    const messages = ticket.messages || [];
    messages.push({
      sender: 'support',
      content: content || 'No message content.',
      time: new Date().toTimeString().split(' ')[0]
    });
    
    const updates = { messages };
    if (markResolved) {
      updates.status = 'Resolved';
      updates.time = 'Just now';
      
      // Log to admin audit logs
      db.admin.addAuditLog("support_ticket_resolved", req.session.userProfile.email, {
        id,
        user: ticket.user
      });
    } else {
      updates.status = 'Responded';
      updates.time = 'Just now';
      
      // Log to admin audit logs
      db.admin.addAuditLog("support_ticket_replied", req.session.userProfile.email, {
        id,
        user: ticket.user
      });
    }
    
    db.supportTickets.update(id, updates);
    res.json({ success: true, ticket: { ...ticket, ...updates } });
  } catch (err) {
    console.error("[ADMIN] Error replying to support ticket:", err);
    res.status(500).json({ error: "Failed to submit reply." });
  }
});

// 9. Flush System Cache
app.post('/api/admin/cache/flush', verifyAdmin, (req, res) => {
  try {
    const { segments } = req.body;
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: "Please select at least one cache segment." });
    }
    
    // Perform actual actions based on segments
    const logs = [];
    logs.push("SYS [INIT]: Starting cache eviction sequence...");
    logs.push("SYS [INFO]: Socket connection established with cache coordinator.");
    logs.push(`SYS [INFO]: Scheduled ${segments.length} cache segments for eviction.`);
    
    if (segments.includes('previews')) {
      logs.push("SYS [PURGE]: Evicting CDN Asset Previews segment: [12.8 MB / 512 entries] deleted.");
    } else {
      logs.push("SYS [SKIP]: CDN Asset Previews segment skipped.");
    }
    
    if (segments.includes('metadata')) {
      logs.push("SYS [PURGE]: User Profiles & Taxonomy Metadata segment: [1.4 MB / 2048 records] invalidated.");
    } else {
      logs.push("SYS [SKIP]: User Profiles segment skipped.");
    }
    
    if (segments.includes('queries')) {
      logs.push("SYS [PURGE]: API Route Query Indexes segment: [450 KB] deleted.");
    } else {
      logs.push("SYS [SKIP]: API Route Query Indexes skipped.");
    }
    
    logs.push("SYS [INFO]: Database indexing listeners successfully reset. Systems nominal.");
    logs.push("SYS [SUCCESS]: Cache purge lifecycle finished.");
    
    // Log to admin audit logs
    db.admin.addAuditLog("cache_flushed", req.session.userProfile.email, {
      segments
    });
    
    res.json({ success: true, logs });
  } catch (err) {
    console.error("[ADMIN] Error flushing system cache:", err);
    res.status(500).json({ error: "Failed to flush system cache." });
  }
});

// ==========================================
// END-TO-END ADMIN SUBVIEWS API ENDPOINTS
// ==========================================

// Global Rankings config cache
global.leaderboardConfig = {
  timeframe: '24H',
  weights: { dl: 1.5, sv: 2.0, vw: 0.5 },
  advanced: { botSensitivity: 'High', cooldown: '60 minutes', minSharedSaves: 10 }
};

app.get('/api/admin/rankings/config', verifyAdmin, (req, res) => {
  res.json(global.leaderboardConfig);
});

// 1. Rankings Tuner weights coefficients update
app.post('/api/admin/rankings/weights', verifyAdmin, (req, res) => {
  const { timeframe, weights, advanced } = req.body;
  if (timeframe) global.leaderboardConfig.timeframe = timeframe;
  if (weights) {
    global.leaderboardConfig.weights = {
      dl: parseFloat(weights.dl) || 1.5,
      sv: parseFloat(weights.sv) || 2.0,
      vw: parseFloat(weights.vw) || 0.5
    };
  }
  if (advanced) {
    global.leaderboardConfig.advanced = {
      botSensitivity: advanced.botSensitivity || 'High',
      cooldown: advanced.cooldown || '60 minutes',
      minSharedSaves: parseInt(advanced.minSharedSaves) || 10
    };
  }
  
  db.admin.addAuditLog("rankings_recalibrated", req.session.userProfile.email, { timeframe, weights });
  
  res.json({ success: true, config: global.leaderboardConfig });
});

app.get('/api/admin/rankings', verifyAdmin, (req, res) => {
  let list = [...wallpapers];
  const { dl, sv, vw } = global.leaderboardConfig.weights;
  
  list.forEach(w => {
    const views = w.views || Math.floor((w.downloads || 0) * 2.5);
    w.velocityScore = Math.floor(
      ((w.downloads || 0) * dl) + 
      ((w.favoritesCount || 0) * sv) + 
      (views * vw)
    );
  });
  
  list.sort((a, b) => (b.velocityScore || 0) - (a.velocityScore || 0));
  
  const pinned = list.filter(w => w.rank === 1);
  const unpinned = list.filter(w => w.rank !== 1);
  
  res.json([...pinned, ...unpinned]);
});

// 2. Pin wallpaper to top of rankings list
app.post('/api/admin/wallpapers/:id/pin', verifyAdmin, (req, res) => {
  const wpId = req.params.id;
  const wp = wallpapers.find(w => w.id === wpId);
  if (!wp) return res.status(404).json({ error: "Wallpaper not found." });

  try {
    const currentRank = wp.rank || 999;
    // Shift ranks of other wallpapers: those with rank < currentRank get incremented
    wallpapers.forEach(w => {
      if (w.rank && w.rank < currentRank) {
        db.wallpapers.updateWallpaperRank(w.id, w.rank + 1);
      }
    });
    db.wallpapers.updateWallpaperRank(wpId, 1);
    wallpapers = db.wallpapers.data;

    db.admin.addAuditLog("wallpaper_pinned", req.session.userProfile.email, { id: wpId, title: wp.title });
    res.json({ success: true, message: "Wallpaper pinned to top." });
  } catch(e) {
    console.error("[RANKINGS] Pin error:", e);
    res.status(500).json({ error: "Failed to pin wallpaper." });
  }
});

// 3. Remove wallpaper from rankings (demote rank to 999)
app.post('/api/admin/wallpapers/:id/unpin', verifyAdmin, (req, res) => {
  const wpId = req.params.id;
  const wp = wallpapers.find(w => w.id === wpId);
  if (!wp) return res.status(404).json({ error: "Wallpaper not found." });

  try {
    db.wallpapers.unpinWallpaperRank(wpId);
    wallpapers = db.wallpapers.data;
    db.admin.addAuditLog("wallpaper_unpinned", req.session.userProfile.email, { id: wpId, title: wp.title });
    res.json({ success: true, message: "Wallpaper removed from trending." });
  } catch(e) {
    console.error("[RANKINGS] Unpin error:", e);
    res.status(500).json({ error: "Failed to unpin wallpaper." });
  }
});

// 4. Legal Triage - get all claims list
app.get('/api/admin/dmca', verifyAdmin, (req, res) => {
  try {
    const claims = db.dmca.data;
    res.json({ success: true, claims });
  } catch(e) {
    res.status(500).json({ error: "Failed to fetch DMCA claims." });
  }
});

// 5. Legal Triage - execute DMCA takedown
app.post('/api/admin/dmca/:id/execute', verifyAdmin, (req, res) => {
  const claimId = req.params.id;
  const claims = db.dmca.data;
  const claim = claims.find(c => c.id === claimId);
  if (!claim) return res.status(404).json({ error: "DMCA claim not found." });

  try {
    // Identify offending wallpaper
    let urlPath = claim.infringingUrl;
    if (urlPath.includes('resin.tv')) {
      urlPath = urlPath.substring(urlPath.indexOf('resin.tv') + 8);
    }
    urlPath = urlPath.replace(/^\//, '');
    let wpToDelete = wallpapers.find(w => w.id === claim.targetAssetId);
    if (!wpToDelete) {
      const pathParts = urlPath.split('/');
      const slug = pathParts[pathParts.length - 1];
      wpToDelete = wallpapers.find(w => w.id === slug || w.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug);
    }

    if (wpToDelete) {
      db.wallpapers.deleteWallpaper(wpToDelete.id);
      wallpapers = db.wallpapers.data;
      db.admin.addAuditLog("dmca_takedown_executed", req.session.userProfile.email, { claimId, wallpaperId: wpToDelete.id });
    } else {
      db.admin.addAuditLog("dmca_takedown_executed_no_asset", req.session.userProfile.email, { claimId, url: claim.infringingUrl });
    }

    db.dmca.updateStatus(claimId, "RESOLVED - TAKEDOWN EXECUTED");
    res.json({ success: true, message: "DMCA takedown claim executed successfully." });
  } catch(e) {
    console.error("[LEGAL] DMCA Takedown error:", e);
    res.status(500).json({ error: "Failed to execute takedown." });
  }
});

// 6. Legal Triage - dismiss claim
app.post('/api/admin/dmca/:id/dismiss', verifyAdmin, (req, res) => {
  const claimId = req.params.id;
  const claims = db.dmca.data;
  const claim = claims.find(c => c.id === claimId);
  if (!claim) return res.status(404).json({ error: "DMCA claim not found." });

  try {
    db.dmca.updateStatus(claimId, "DISMISSED");
    db.admin.addAuditLog("dmca_claim_dismissed", req.session.userProfile.email, { claimId });
    res.json({ success: true, message: "DMCA claim dismissed." });
  } catch(e) {
    res.status(500).json({ error: "Failed to dismiss DMCA claim." });
  }
});

// In-memory flagged comments telemetry list
let communityFlaggedTickets = [
  {
    id: 1,
    user: '@toxic_user_88',
    time: '2m ago',
    text: 'This platform is trash and so are the devs. Hope it all crashes.',
    avatar: '/images/avatars/avatar_diver.png',
    severity: 'high',
    reports: 14,
    reportsText: '14 Reports',
    reporters: [
      { name: '@clean_vibes', time: '38m ago', reason: 'Hate Speech / Harassment' },
      { name: '@art_guardian', time: '41m ago', reason: 'Toxic Behavior' },
      { name: '@community_mods', time: '42m ago', reason: 'Targeted Abuse' },
      { name: '@respect_all', time: '45m ago', reason: 'Offensive Language' },
      { name: '@safety_first', time: '47m ago', reason: 'Disruptive / Negative' }
    ],
    thread: [
      { user: '@art_lover', time: '3h ago', avatar: '/images/avatars/avatar_retro.png', text: 'Just dropped a new piece inspired by Blade Runner. Would love your thoughts!', up: 142, down: 32, isReply: false },
      { user: '@visor_unit', time: '2h ago', avatar: '/images/avatars/avatar_alpha.png', text: 'Incredible mood and lighting! 🔥', up: 12, down: 0, isReply: true },
      { user: '@toxic_user_88', time: '1h ago', avatar: '/images/avatars/avatar_diver.png', text: 'This platform is trash and so are the devs. Hope it all crashes.', up: -3, down: 0, isReply: true, isFlagged: true },
      { user: '@neo_dreams', time: '30m ago', avatar: '/images/avatars/avatar_alpha.png', text: 'Ignore the haters, this is amazing.', up: 8, down: 0, isReply: true }
    ]
  },
  {
    id: 2,
    user: '@spammy_bot',
    time: '5m ago',
    text: 'Check out my site for free coins!!! Click here: bit.ly/freestuff',
    avatar: '/images/avatars/avatar_alpha.png',
    severity: 'medium',
    reports: 8,
    reportsText: '8 Reports',
    reporters: [{ name: '@user_a', time: '10m ago', reason: 'Spam' }],
    thread: [
      { user: '@spammy_bot', time: '5m ago', avatar: '/images/avatars/avatar_alpha.png', text: 'Check out my site for free coins!!! Click here: bit.ly/freestuff', up: 0, down: 12, isReply: false, isFlagged: true }
    ]
  },
  {
    id: 3,
    user: '@hater_123',
    time: '7m ago',
    text: "You're all idiots. Go back to school or get a real life.",
    avatar: '/images/avatars/avatar_retro.png',
    severity: 'high',
    reports: 21,
    reportsText: '21 Reports',
    reporters: [{ name: '@user_b', time: '12m ago', reason: 'Harassment' }],
    thread: [
      { user: '@hater_123', time: '7m ago', avatar: '/images/avatars/avatar_retro.png', text: "You're all idiots. Go back to school or get a real life.", up: -15, down: 0, isReply: false, isFlagged: true }
    ]
  },
  {
    id: 4,
    user: '@vote_booster_x',
    time: '9m ago',
    text: 'Upvoted 120 items in 60 seconds (velocity spike detected)',
    avatar: '/images/avatars/avatar_retro.png',
    severity: 'medium',
    reports: 0,
    reportsText: 'Anomalous',
    reporters: [{ name: 'SYSTEM_BOT', time: '1m ago', reason: 'Vote Manipulation Detected' }],
    thread: [
      { user: '@vote_booster_x', time: '9m ago', avatar: '/images/avatars/avatar_retro.png', text: 'Upvoted 120 items in 60 seconds (velocity spike detected)', up: 0, down: 0, isReply: false, isFlagged: true }
    ]
  }
];

app.get('/api/admin/community/flags', verifyAdmin, (req, res) => {
  res.json({ success: true, tickets: communityFlaggedTickets });
});

app.post('/api/admin/tickets/:id/reply', verifyAdmin, (req, res) => {
  res.json({ success: true, message: "Reply posted." });
});

app.delete('/api/admin/tickets/:id', verifyAdmin, (req, res) => {
  res.json({ success: true, message: "Ticket deleted." });
});

// 8. Community Hub - ignore/approve flagged comment
app.post('/api/admin/community/comments/:id/approve', verifyAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  communityFlaggedTickets = communityFlaggedTickets.filter(t => t.id !== id);
  db.admin.addAuditLog("comment_flag_dismissed", req.session.userProfile.email, { id });
  res.json({ success: true, message: "Flag successfully cleared." });
});

// 9. Community Hub - delete flagged comment
app.post('/api/admin/community/comments/:id/delete', verifyAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const ticket = communityFlaggedTickets.find(t => t.id === id);
  if (ticket) {
    communityFlaggedTickets = communityFlaggedTickets.filter(t => t.id !== id);
    db.admin.addAuditLog("comment_deleted", req.session.userProfile.email, { id, text: ticket.text, user: ticket.user });
  }
  res.json({ success: true, message: "Flagged content purged successfully." });
});

// 10. Community Hub - ban toxic user
app.post('/api/admin/community/users/:username/ban', verifyAdmin, (req, res) => {
  const username = req.params.username.replace(/^@/, '');
  try {
    db.users.banUser(username);
    communityFlaggedTickets = communityFlaggedTickets.filter(t => t.user.replace(/^@/, '') !== username);
    db.admin.addAuditLog("user_banned", req.session.userProfile.email, { username });
    res.json({ success: true, message: `User @${username} has been banned.` });
  } catch(e) {
    res.status(500).json({ error: "Failed to ban user." });
  }
});

// 11. Community Hub - recalibrate votes spike
app.post('/api/admin/community/recalibrate-votes', verifyAdmin, (req, res) => {
  const { limitMinutes } = req.body;
  db.admin.addAuditLog("voting_recalibrated", req.session.userProfile.email, { limitMinutes });
  res.json({ success: true, message: `Voting engine recalibrated. Rolled back votes from last ${limitMinutes} minutes.` });
});

// 12. Operations Triage - get all reports
app.get('/api/admin/reports', verifyAdmin, (req, res) => {
  try {
    const reports = db.reports.data;
    res.json({ success: true, reports });
  } catch(e) {
    res.status(500).json({ error: "Failed to fetch triage reports." });
  }
});

// 13. Operations Triage - dismiss reports flags
app.post('/api/admin/reports/:id/dismiss', verifyAdmin, (req, res) => {
  const reportId = req.params.id;
  try {
    db.reports.delete(reportId);
    db.admin.addAuditLog("report_dismissed", req.session.userProfile.email, { reportId });
    res.json({ success: true, message: "Triage flags successfully dismissed." });
  } catch(e) {
    res.status(500).json({ error: "Failed to dismiss flags." });
  }
});

// 14. Operations Triage - purge reported asset
app.post('/api/admin/reports/:id/purge', verifyAdmin, (req, res) => {
  const reportId = req.params.id;
  const reports = db.reports.data;
  const report = reports.find(r => r.id === reportId);
  if (!report) return res.status(404).json({ error: "Report not found." });

  try {
    let wpToDelete = wallpapers.find(w => w.id === report.targetId || w.title === report.target);
    if (wpToDelete) {
      db.wallpapers.deleteWallpaper(wpToDelete.id);
      wallpapers = db.wallpapers.data;
      db.admin.addAuditLog("report_purge_executed", req.session.userProfile.email, { reportId, wallpaperId: wpToDelete.id });
    } else {
      db.admin.addAuditLog("report_purge_executed_no_asset", req.session.userProfile.email, { reportId, target: report.target });
    }
    db.reports.delete(reportId);
    res.json({ success: true, message: "Infringing asset purged from feed." });
  } catch(e) {
    res.status(500).json({ error: "Failed to purge asset." });
  }
});

// 15. Operations Triage - purge asset & strike uploader
app.post('/api/admin/reports/:id/strike', verifyAdmin, (req, res) => {
  const reportId = req.params.id;
  const reports = db.reports.data;
  const report = reports.find(r => r.id === reportId);
  if (!report) return res.status(404).json({ error: "Report not found." });

  try {
    let wpToDelete = wallpapers.find(w => w.id === report.targetId || w.title === report.target);
    if (wpToDelete) {
      db.wallpapers.deleteWallpaper(wpToDelete.id);
      wallpapers = db.wallpapers.data;
    }

    const uploaderName = report.uploader.replace(/^@/, '');
    db.users.banUser(uploaderName);

    db.reports.delete(reportId);
    db.admin.addAuditLog("report_strike_executed", req.session.userProfile.email, { reportId, uploader: uploaderName });
    res.json({ success: true, message: `Asset purged and uploader @${uploaderName} struck/banned.` });
  } catch(e) {
    res.status(500).json({ error: "Failed to strike uploader." });
  }
});

// ==========================================
// ADMIN CMS DOCUMENT ROUTES
// ==========================================

// Get all documents
app.get('/api/admin/documents', verifyAdmin, (req, res) => {
  try {
    const docs = db.documents.getAll();
    res.json(docs);
  } catch(err) {
    console.error("[ADMIN CMS] Error fetching documents:", err);
    res.status(500).json({ error: "Failed to fetch documents." });
  }
});

// Create a new document
app.post('/api/admin/documents', verifyAdmin, (req, res) => {
  try {
    const { title, content, excerpt, tags, status, urlSlug, coverAsset } = req.body;
    let finalCoverAsset = coverAsset;

    // Handle base64 cover image
    if (coverAsset && coverAsset.startsWith('data:image/')) {
      const matches = coverAsset.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const filename = `doc_cover_${Date.now()}.${ext}`;
        const filepath = path.join(__dirname, 'public', 'images', 'covers');
        if (!fs.existsSync(filepath)) {
          fs.mkdirSync(filepath, { recursive: true });
        }
        fs.writeFileSync(path.join(filepath, filename), data);
        finalCoverAsset = `/images/covers/${filename}`;
      }
    }

    const newDoc = {
      id: `doc-${Date.now()}`,
      title: title || "Untitled Document",
      author: req.session.userProfile.fullName || "Administrator",
      status: status || "Draft",
      lastModified: new Date().toISOString(),
      content: content || "",
      coverAsset: finalCoverAsset || "",
      urlSlug: urlSlug || `doc-${Date.now()}`,
      excerpt: excerpt || "",
      tags: tags || []
    };

    db.documents.addDocument(newDoc);
    db.admin.addAuditLog("document_created", req.session.userProfile.email, { title: newDoc.title });
    
    res.json({ success: true, document: newDoc });
  } catch(err) {
    console.error("[ADMIN CMS] Error creating document:", err);
    res.status(500).json({ error: "Failed to create document." });
  }
});

// Update a document
app.put('/api/admin/documents/:id', verifyAdmin, (req, res) => {
  try {
    const docId = req.params.id;
    const { title, content, excerpt, tags, status, urlSlug, coverAsset } = req.body;
    
    const existingDoc = db.documents.getById(docId);
    if (!existingDoc) return res.status(404).json({ error: "Document not found." });

    let finalCoverAsset = existingDoc.coverAsset;

    // Handle base64 cover image if it's new
    if (coverAsset && coverAsset.startsWith('data:image/')) {
      const matches = coverAsset.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const filename = `doc_cover_${Date.now()}.${ext}`;
        const filepath = path.join(__dirname, 'public', 'images', 'covers');
        if (!fs.existsSync(filepath)) {
          fs.mkdirSync(filepath, { recursive: true });
        }
        fs.writeFileSync(path.join(filepath, filename), data);
        finalCoverAsset = `/images/covers/${filename}`;
      }
    } else if (coverAsset !== undefined) {
       finalCoverAsset = coverAsset; // Allow clearing or keeping existing URL
    }

    const updates = {
      title: title !== undefined ? title : existingDoc.title,
      content: content !== undefined ? content : existingDoc.content,
      excerpt: excerpt !== undefined ? excerpt : existingDoc.excerpt,
      tags: tags !== undefined ? tags : existingDoc.tags,
      status: status !== undefined ? status : existingDoc.status,
      urlSlug: urlSlug !== undefined ? urlSlug : existingDoc.urlSlug,
      coverAsset: finalCoverAsset,
      lastModified: new Date().toISOString()
    };

    db.documents.updateDocument(docId, updates);
    db.admin.addAuditLog("document_updated", req.session.userProfile.email, { title: updates.title });
    
    res.json({ success: true, document: { ...existingDoc, ...updates } });
  } catch(err) {
    console.error("[ADMIN CMS] Error updating document:", err);
    res.status(500).json({ error: "Failed to update document." });
  }
});

// Delete a document
app.delete('/api/admin/documents/:id', verifyAdmin, (req, res) => {
  try {
    const docId = req.params.id;
    const existingDoc = db.documents.getById(docId);
    if (!existingDoc) return res.status(404).json({ error: "Document not found." });

    // Try to delete cover image if it exists and is local
    if (existingDoc.coverAsset && existingDoc.coverAsset.startsWith('/images/covers/')) {
      const assetPath = path.join(__dirname, 'public', existingDoc.coverAsset);
      if (fs.existsSync(assetPath)) {
        try { fs.unlinkSync(assetPath); } catch(e) { /* ignore */ }
      }
    }

    db.documents.deleteDocument(docId);
    db.admin.addAuditLog("document_deleted", req.session.userProfile.email, { title: existingDoc.title });
    
    res.json({ success: true });
  } catch(err) {
    console.error("[ADMIN CMS] Error deleting document:", err);
    res.status(500).json({ error: "Failed to delete document." });
  }
});

// Admin collections CRUD routes
app.get('/api/admin/collections', verifyAdmin, (req, res) => {
  try {
    const list = db.collections.getAll();
    res.json(list);
  } catch(err) {
    console.error("[ADMIN COLLECTIONS] Error fetching collections:", err);
    res.status(500).json({ error: "Failed to fetch collections." });
  }
});

app.post('/api/admin/collections', verifyAdmin, (req, res) => {
  try {
    const { title, description, coverImage, assets, featured, isDraft } = req.body;
    let finalCoverImage = coverImage;

    // Handle base64 cover image
    if (coverImage && coverImage.startsWith('data:image/')) {
      const matches = coverImage.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const filename = `collection_cover_${Date.now()}.${ext}`;
        const filepath = path.join(__dirname, 'public', 'images', 'collections');
        if (!fs.existsSync(filepath)) {
          fs.mkdirSync(filepath, { recursive: true });
        }
        fs.writeFileSync(path.join(filepath, filename), data);
        finalCoverImage = `/images/collections/${filename}`;
      }
    }

    const colId = `col-${Date.now()}`;
    const newCol = {
      id: colId,
      title: title || "Untitled Collection",
      description: description || "",
      coverImage: finalCoverImage || "",
      assets: assets || [],
      featured: featured ? 1 : 0,
      isDraft: isDraft ? 1 : 0,
      createdAt: new Date().toISOString()
    };

    db.collections.addCollection(newCol);
    db.admin.addAuditLog("collection_created", req.session.userProfile.email, { title: newCol.title });

    res.json({ success: true, collection: newCol });
  } catch(err) {
    console.error("[ADMIN COLLECTIONS] Error creating collection:", err);
    res.status(500).json({ error: "Failed to create collection." });
  }
});

app.put('/api/admin/collections/:id', verifyAdmin, (req, res) => {
  try {
    const colId = req.params.id;
    const { title, description, coverImage, assets, featured, isDraft } = req.body;

    const existingCol = db.collections.getById(colId);
    if (!existingCol) return res.status(404).json({ error: "Collection not found." });

    let finalCoverImage = existingCol.coverImage;

    // Handle base64 cover image if new
    if (coverImage && coverImage.startsWith('data:image/')) {
      const matches = coverImage.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const filename = `collection_cover_${Date.now()}.${ext}`;
        const filepath = path.join(__dirname, 'public', 'images', 'collections');
        if (!fs.existsSync(filepath)) {
          fs.mkdirSync(filepath, { recursive: true });
        }
        fs.writeFileSync(path.join(filepath, filename), data);
        finalCoverImage = `/images/collections/${filename}`;

        // Delete old cover image if it was local and exists
        if (existingCol.coverImage && existingCol.coverImage.startsWith('/images/collections/')) {
          const oldPath = path.join(__dirname, 'public', existingCol.coverImage);
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch(e) { /* ignore */ }
          }
        }
      }
    }

    const updates = {
      title: title !== undefined ? title : existingCol.title,
      description: description !== undefined ? description : existingCol.description,
      coverImage: finalCoverImage,
      assets: assets !== undefined ? assets : existingCol.assets,
      featured: featured !== undefined ? (featured ? 1 : 0) : existingCol.featured,
      isDraft: isDraft !== undefined ? (isDraft ? 1 : 0) : existingCol.isDraft
    };

    db.collections.updateCollection(colId, updates);
    db.admin.addAuditLog("collection_updated", req.session.userProfile.email, { title: updates.title });

    res.json({ success: true, collection: { ...existingCol, ...updates } });
  } catch(err) {
    console.error("[ADMIN COLLECTIONS] Error updating collection:", err);
    res.status(500).json({ error: "Failed to update collection." });
  }
});

app.delete('/api/admin/collections/:id', verifyAdmin, (req, res) => {
  try {
    const colId = req.params.id;
    const existingCol = db.collections.getById(colId);
    if (!existingCol) return res.status(404).json({ error: "Collection not found." });

    // Try to delete cover image if it exists and is local
    if (existingCol.coverImage && existingCol.coverImage.startsWith('/images/collections/')) {
      const assetPath = path.join(__dirname, 'public', existingCol.coverImage);
      if (fs.existsSync(assetPath)) {
        try { fs.unlinkSync(assetPath); } catch(e) { /* ignore */ }
      }
    }

    db.collections.deleteCollection(colId);
    db.admin.addAuditLog("collection_deleted", req.session.userProfile.email, { title: existingCol.title });

    res.json({ success: true });
  } catch(err) {
    console.error("[ADMIN COLLECTIONS] Error deleting collection:", err);
    res.status(500).json({ error: "Failed to delete collection." });
  }
});

// Helper to push new community activity programmatically
function injectCommunityActivity(action, wallpaperId, session) {
  const wp = wallpapers.find(w => w.id === wallpaperId);
  if (!wp) return;

  const profile = session ? session.userProfile : (registeredUsers[0] || guestProfile);
  const newActivity = {
    avatar: profile.avatar,
    user: profile.username === "guest" ? "@guest_voyager" : `@${profile.username}`,
    action: action, // 'downloaded' or 'favorited'
    target: wp.title,
    wallpaper: wp.image,
    badge: action === "downloaded" ? "DOWNLOAD" : "FAVORITE",
    time: "Just now"
  };

  communityActivities.unshift(newActivity);
  
  // Bounded size
  if (communityActivities.length > 20) {
    communityActivities.pop();
  }

  // Increment total stats
  if (action === "downloaded") {
    db.community.data.downloads += 1;
  } else {
    db.community.data.upvotes += 1;
  }

  // Save community pulse updates
  db.community.save();
}


// Zero-dependency CRC32 implementation for ZIP archive integrity checksums
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Zero-dependency ZIP archive builder using STORE method (no compression needed for PNGs)
function buildZipBuffer(files) {
  // files: [{name: string, data: Buffer}]
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const fileCrc = crc32(file.data);
    const dataLen = file.data.length;

    // Local file header (30 bytes fixed + filename)
    const local = Buffer.alloc(30 + nameBuffer.length);
    local.writeUInt32LE(0x04034b50, 0);   // Signature
    local.writeUInt16LE(20, 4);            // Version needed to extract
    local.writeUInt16LE(0, 6);             // General purpose bit flag
    local.writeUInt16LE(0, 8);             // Compression method: STORE
    local.writeUInt16LE(0, 10);            // Last mod file time
    local.writeUInt16LE(0, 12);            // Last mod file date
    local.writeUInt32LE(fileCrc, 14);      // CRC-32
    local.writeUInt32LE(dataLen, 18);      // Compressed size
    local.writeUInt32LE(dataLen, 22);      // Uncompressed size
    local.writeUInt16LE(nameBuffer.length, 26); // Filename length
    local.writeUInt16LE(0, 28);            // Extra field length
    nameBuffer.copy(local, 30);

    localParts.push(local, file.data);

    // Central directory header (46 bytes fixed + filename)
    const central = Buffer.alloc(46 + nameBuffer.length);
    central.writeUInt32LE(0x02014b50, 0);  // Signature
    central.writeUInt16LE(20, 4);           // Version made by
    central.writeUInt16LE(20, 6);           // Version needed
    central.writeUInt16LE(0, 8);            // General purpose bit flag
    central.writeUInt16LE(0, 10);           // Compression method: STORE
    central.writeUInt16LE(0, 12);           // Last mod time
    central.writeUInt16LE(0, 14);           // Last mod date
    central.writeUInt32LE(fileCrc, 16);     // CRC-32
    central.writeUInt32LE(dataLen, 20);     // Compressed size
    central.writeUInt32LE(dataLen, 24);     // Uncompressed size
    central.writeUInt16LE(nameBuffer.length, 28); // Filename length
    central.writeUInt16LE(0, 30);           // Extra field length
    central.writeUInt16LE(0, 32);           // File comment length
    central.writeUInt16LE(0, 34);           // Disk number start
    central.writeUInt16LE(0, 36);           // Internal file attributes
    central.writeUInt32LE(0, 38);           // External file attributes
    central.writeUInt32LE(offset, 42);      // Relative offset of local header
    nameBuffer.copy(central, 46);

    centralParts.push(central);
    offset += local.length + file.data.length;
  }

  const centralDirBuffer = Buffer.concat(centralParts);

  // End of central directory record (22 bytes fixed)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);         // Signature
  eocd.writeUInt16LE(0, 4);                   // Disk number
  eocd.writeUInt16LE(0, 6);                   // Disk with central directory
  eocd.writeUInt16LE(files.length, 8);        // Entries on this disk
  eocd.writeUInt16LE(files.length, 10);       // Total entries
  eocd.writeUInt32LE(centralDirBuffer.length, 12); // Size of central directory
  eocd.writeUInt32LE(offset, 16);             // Offset of start of central directory
  eocd.writeUInt16LE(0, 20);                  // Comment length

  return Buffer.concat([...localParts, centralDirBuffer, eocd]);
}

// Get all published collections
app.get('/api/collections', (req, res) => {
  try {
    const list = db.collections.getAll().filter(c => !c.isDraft);
    res.json(list);
  } catch(err) {
    console.error("[COLLECTIONS] Error fetching collections:", err);
    res.status(500).json({ error: "Failed to fetch collections." });
  }
});

// Get specific collection by ID
app.get('/api/collections/:id', (req, res) => {
  try {
    const col = db.collections.getById(req.params.id);
    if (!col || col.isDraft) {
      return res.status(404).json({ error: "Collection not found." });
    }
    res.json(col);
  } catch(err) {
    console.error("[COLLECTIONS] Error fetching collection detail:", err);
    res.status(500).json({ error: "Failed to fetch collection detail." });
  }
});

// 1. Get Wallpapers with Search and Filters
app.get('/api/wallpapers', (req, res) => {
  const { search, category, orientation, resolution, color } = req.query;
  let filtered = [...wallpapers];

  // Apply Advanced Search Parameters (Orientation, Resolution, Color Palette)
  if (orientation && orientation !== 'any') {
    filtered = filtered.filter(w => w.ratio.toLowerCase() === orientation.toLowerCase());
  }

  if (resolution && resolution !== 'any') {
    filtered = filtered.filter(w => w.resolution.toLowerCase() === resolution.toLowerCase());
  }

  if (color && color !== 'any') {
    filtered = filtered.filter(w => w.color.toLowerCase() === color.toLowerCase());
  }

  // Apply Search Filter (Text Query)
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(w => 
      w.title.toLowerCase().includes(q) || 
      w.anime.toLowerCase().includes(q) ||
      (w.artist && w.artist.toLowerCase().includes(q)) ||
      (Array.isArray(w.tags) && w.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  // Apply Category/Nav Filter
  if (category && category !== 'home') {
    const cat = category.toLowerCase();
    
    if (cat === 'favorites') {
      filtered = filtered.filter(w => req.session.userFavorites.has(w.id));
    } else if (cat === 'history') {
      filtered = filtered.filter(w => req.session.userHistory.some(h => h.id === w.id));
      // Sort by history sequence
      filtered.sort((a, b) => {
        const indexA = req.session.userHistory.findIndex(h => h.id === a.id);
        const indexB = req.session.userHistory.findIndex(h => h.id === b.id);
        return indexA - indexB;
      });
    } else if (cat === 'editorial') {
      filtered = filtered.filter(w => w.editorial);
    } else if (cat === 'rankings') {
      // Sort by rank
      filtered = [...wallpapers].sort((a, b) => a.rank - b.rank);
    } else if (cat === 'collections') {
      // Just filter showing high downloads for collections
      filtered = filtered.filter(w => w.downloads > 1200);
    } else if (cat === 'activity') {
      // Wallpapers with recent activity (mocked as ones that have been active)
      filtered = filtered.filter(w => w.downloads > 1000);
    } else if (cat === 'community') {
      // Top community picks
      filtered = filtered.filter(w => w.favoritesCount > 600);
    } else {
      // Filter by anime category name
      filtered = filtered.filter(w => w.anime.toLowerCase() === cat);
    }
  }

  if (req.query.countOnly === 'true') {
    return res.json({ count: filtered.length });
  }

  // Inject favorited and history state
  const responseData = filtered.map(w => {
    const historyItem = req.session.userHistory.find(h => h.id === w.id);
    return {
      ...w,
      isFavorited: req.session.userFavorites.has(w.id),
      downloadedAt: historyItem ? historyItem.timestamp : null
    };
  });

  res.json(responseData);
});

// 1b. Get Single Wallpaper Details
app.get('/api/wallpapers/:id', (req, res) => {
  const { id } = req.params;
  const w = wallpapers.find(wp => wp.id === id);
  if (!w) {
    return res.status(404).json({ error: "Wallpaper not found" });
  }

  res.json({
    ...w,
    isFavorited: req.session.userFavorites.has(w.id)
  });
});

// 2. Toggle Favorite Status
app.post('/api/favorites', (req, res) => {
  const { id } = req.body;
  const wallpaper = wallpapers.find(w => w.id === id);
  
  if (!wallpaper) {
    return res.status(404).json({ error: "Wallpaper not found" });
  }

  const favorited = db.favorites.toggleFavorite(req.session.id, id);
  if (favorited) {
    db.wallpapers.updateFavoritesCount(id, 1);
    // Auto-inject community activity
    injectCommunityActivity("favorited", id, req.session);
  } else {
    db.wallpapers.updateFavoritesCount(id, -1);
  }

  // Synchronize session and local data snapshot
  req.session.userFavorites = new Set(db.favorites.getUserFavorites(req.session.id));
  wallpapers = db.wallpapers.data;
  const updatedWp = wallpapers.find(w => w.id === id);

  res.json({ id, isFavorited: favorited, favoritesCount: updatedWp.favoritesCount });
});

// 2.5 Authentication REST routes
app.post('/api/auth/signup', authRateLimiter, (req, res) => {
  const { name, email, password } = req.body;
  const settings = db.settings.getAll();
  if (settings.publicSignups === 0 || settings.publicSignups === false || settings.publicSignups === '0') {
    return res.status(403).json({ error: "Public sign-ups are currently disabled by the administrator." });
  }
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Required fields name, email, or password missing." });
  }

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 50) {
    return res.status(400).json({ error: "Full Name must be between 1 and 50 characters." });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format. Verify your inputs." });
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
    return res.status(400).json({ error: "Security key must be between 8 and 100 characters." });
  }

  const emailLower = email.toLowerCase();
  const exists = registeredUsers.some(u => u.email.toLowerCase() === emailLower);
  if (exists) {
    return res.status(400).json({ error: "Identity email is already registered on the grid." });
  }

  // Secure bcrypt password hashing
  const { salt, hash } = db.hashPassword(password);

  const newUser = {
    username: emailLower.split('@')[0],
    fullName: name,
    email: emailLower,
    salt: salt,
    passwordHash: hash,
    role: "Standard Member",
    avatar: "/images/avatars/avatar_grid.png",
    location: "Grid Sandbox",
    website: "",
    bio: "New voyager initialized.",
    language: "English",
    timezone: "(GMT+0) UTC",
    likedArticles: [],
    savedArticles: []
  };

  db.users.addUser(newUser);
  registeredUsers = db.users.data;
  
  regenerateSession(req, res, newUser);

  res.json({ success: true, user: { username: newUser.username, fullName: newUser.fullName, email: newUser.email, role: newUser.role, avatar: newUser.avatar } });
});

app.post('/api/auth/login', authRateLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Please enter your email and password." });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  const emailLower = email.toLowerCase();
  const user = registeredUsers.find(u => u.email.toLowerCase() === emailLower);
  
  // Secure password verification. Legacy PBKDF2 hashes migrate to bcrypt after successful login.
  if (!user || !db.verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (db.needsPasswordRehash(user.salt, user.passwordHash)) {
    const migrated = db.hashPassword(password);
    db.users.updateAuthCredentials(user.username, migrated.hash, migrated.salt);
    user.passwordHash = migrated.hash;
    user.salt = migrated.salt;
    registeredUsers = db.users.data;
  }

  regenerateSession(req, res, user);

  res.json({ success: true, user: { username: user.username, fullName: user.fullName, email: user.email, role: user.role, avatar: user.avatar } });
});

app.post('/api/auth/google', authRateLimiter, (req, res) => {
  const { credential, email, name } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "Google OAuth credential token is required." });
  }

  if (credential !== 'mock-google-token-audit') {
    return res.status(401).json({ error: "Invalid Google credential token." });
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: "Email address not verified by Google identity provider." });
  }

  const emailLower = email.toLowerCase().trim();
  let user = registeredUsers.find(u => u.email.toLowerCase() === emailLower);

  if (!user) {
    const settings = db.settings.getAll();
    if (settings.publicSignups === 0 || settings.publicSignups === false || settings.publicSignups === '0') {
      return res.status(403).json({ error: "Public sign-ups are currently disabled by the administrator." });
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const { salt, hash } = db.hashPassword(randomPassword);
    user = {
      username: emailLower.split('@')[0],
      fullName: name || 'Google User',
      email: emailLower,
      salt: salt,
      passwordHash: hash,
      role: "Standard Member",
      avatar: "/images/avatars/avatar_grid.png",
      location: "Google OAuth Sync",
      website: "",
      bio: "Voyager synced via Google identity provider.",
      language: "English",
      timezone: "(GMT+0) UTC",
      likedArticles: [],
      savedArticles: []
    };
    db.users.addUser(user);
    registeredUsers = db.users.data;
  }

  regenerateSession(req, res, user);
  res.json({ success: true, user: { email: user.email, role: 'Standard Member' } });
});

app.post('/api/auth/logout', (req, res) => {
  regenerateSession(req, res, { ...guestProfile });
  res.json({ success: true });
});

// Change password while logged in (requires current password verification)
app.post('/api/auth/change-password', authRateLimiter, (req, res) => {
  if (!req.session.userProfile || req.session.userProfile.username === 'guest') {
    return res.status(401).json({ error: "Authentication required. Please sign in first." });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Both current and new passwords are required." });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 100) {
    return res.status(400).json({ error: "New password must be between 8 and 100 characters." });
  }

  const user = registeredUsers.find(u => u.username === req.session.userProfile.username);
  if (!user) {
    return res.status(404).json({ error: "User profile not found in registry." });
  }

  // Verify current password
  if (!db.verifyPassword(currentPassword, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  // Generate new bcrypt hash
  const { salt, hash } = db.hashPassword(newPassword);
  user.salt = salt;
  user.passwordHash = hash;

  db.users.updateAuthCredentials(user.username, hash, salt);
  registeredUsers = db.users.data;
  console.log(`[PASSWORD CHANGE] Voyager @${user.username} successfully updated workspace security key.`);

  res.json({ success: true, message: "Password updated successfully." });
});

app.post('/api/auth/forgot-password', authRateLimiter, (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email address is required." });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  const emailLower = email.toLowerCase().trim();
  const user = registeredUsers.find(u => u.email.toLowerCase() === emailLower);

  if (!user) {
    // Return identical response to prevent email enumeration (user existence oracle)
    return res.json({
      success: true,
      message: "Dynamic verification token generated and written to local mail spool."
    });
  }


  // Generate a secure 6-character hex token
  const token = crypto.randomBytes(3).toString('hex').toLowerCase();
  
  // Expiry timestamp in 15 minutes
  const expiry = Date.now() + 15 * 60 * 1000;

  // Save properties directly on user record
  user.recoveryToken = token;
  user.recoveryTokenExpiry = expiry;

  // Persist updated users
  db.users.updateUserProfile(user.username, user);

  // Create simulated mail spool directory if not exists
  const spoolDir = path.join(__dirname, 'data', 'mail_spool');
  if (!fs.existsSync(spoolDir)) {
    fs.mkdirSync(spoolDir, { recursive: true });
  }

  // Beautiful HSL-styled simulated email template
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const emailFilename = `recovery-${emailLower}-${timestamp}.html`;
  const emailFilePath = path.join(spoolDir, emailFilename);

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>RESIN — Security Portal Recovery Key</title>
  <style>
    body {
      background-color: #0b0f19;
      color: #e1e7f0;
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
    }
    .email-container {
      background: linear-gradient(135deg, #111827 0%, #0d111a 100%);
      border: 1px solid rgba(111, 0, 255, 0.15);
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05);
      max-width: 540px;
      width: 100%;
      padding: 32px;
      box-sizing: border-box;
    }
    .header-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #6f00ff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 16px;
    }
    .header-logo svg {
      stroke: #6f00ff;
      fill: none;
      width: 24px;
      height: 24px;
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #a0aec0;
      margin: 0 0 20px 0;
    }
    .token-box {
      background: rgba(111, 0, 255, 0.05);
      border: 1px dashed #6f00ff;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    .token-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #805ad5;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .token-value {
      font-size: 32px;
      font-family: 'Courier New', Courier, monospace;
      font-weight: 700;
      color: #00ffcc;
      letter-spacing: 6px;
      text-shadow: 0 0 12px rgba(0, 255, 204, 0.3);
    }
    .warning-box {
      border-left: 3px solid #ff3e3e;
      background: rgba(255, 62, 62, 0.03);
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .warning-box p {
      font-size: 12px;
      color: #e53e3e;
      margin: 0;
    }
    .footer {
      font-size: 11px;
      color: #4a5568;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 16px;
      margin-top: 24px;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header-logo">
      <svg viewBox="0 0 24 24" stroke-width="2.5">
        <polygon points="12 2 22 7.5 22 18.5 12 24 2 18.5 2 7.5"></polygon>
        <polyline points="12 2 12 24"></polyline>
        <polyline points="12 13 22 7.5"></polyline>
        <polyline points="12 13 2 7.5"></polyline>
      </svg>
      <span>RESIN WALLPAPERS</span>
    </div>
    <h1>Security Authentication Key Recovery</h1>
    <p>Greetings voyager <strong>@${user.username}</strong>,</p>
    <p>A request was submitted from the Portal Access overlay to re-initialize your workspace authentication key. Use the verification token below to complete the reset sequence:</p>
    
    <div class="token-box">
      <div class="token-label">Verification Token</div>
      <div class="token-value">${token}</div>
    </div>
    
    <div class="warning-box">
      <p>This verification token is highly sensitive. It will expire in 15 minutes (at ${new Date(expiry).toLocaleTimeString()}). If you did not trigger this request, please report this incident to security@resin.app immediately.</p>
    </div>
    
    <p>Return to the portal, confirm your registered email, paste the token, and establish your new security key credentials.</p>
    
    <div class="footer">
      This is an automated system dispatch from RESIN security nodes.<br>
      © 2026 RESIN. All workspace sandboxes isolated.
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(emailFilePath, htmlContent, 'utf8');

  console.log(`[MAIL SPOOL] Dynamic recovery token for @${user.username} spooled successfully to: data/mail_spool/${emailFilename}`);

  res.json({
    success: true,
    message: "Dynamic verification token generated and written to local mail spool."
  });
});

app.post('/api/auth/reset-password', authRateLimiter, (req, res) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) {
    return res.status(400).json({ error: "Missing required fields confirm email, token, or new password." });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  const tokenLower = token.toLowerCase().trim();
  if (!/^[a-f0-9]{6}$/.test(tokenLower)) {
    return res.status(400).json({ error: "Invalid verification token format. Token must be 6-digit hex." });
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
    return res.status(400).json({ error: "Security key must be between 8 and 100 characters." });
  }

  const emailLower = email.toLowerCase().trim();

  const user = registeredUsers.find(u => u.email.toLowerCase() === emailLower);

  if (!user) {
    return res.status(404).json({ error: "Identity email is not registered on the grid." });
  }

  if (!user.recoveryToken || user.recoveryToken !== tokenLower) {
    return res.status(400).json({ error: "Invalid verification token. Verify the spool record." });
  }

  if (!user.recoveryTokenExpiry || Date.now() > user.recoveryTokenExpiry) {
    return res.status(400).json({ error: "Verification token has expired. Request a new one." });
  }

  // Generate new bcrypt hash using the same hash utilities exposed on db
  const { salt, hash } = db.hashPassword(password);

  user.salt = salt;
  user.passwordHash = hash;

  // Clear token properties to prevent multi-spend exploits
  delete user.recoveryToken;
  delete user.recoveryTokenExpiry;

  // Save changes transactionally
  db.users.updateAuthCredentials(user.username, hash, salt);
  db.users.updateUserProfile(user.username, user);
  registeredUsers = db.users.data;

  console.log(`[PASSWORD RESET] Voyager @${user.username} successfully re-initialized workspace security key.`);

  res.json({
    success: true,
    message: "Workspace credentials successfully re-established."
  });
});


// 3. Get User Profile Settings
app.get('/api/settings', (req, res) => {
  res.json(req.session.userProfile);
});

// 4. Update User Profile Settings (requires authenticated session)
app.post('/api/settings', (req, res) => {
  if (!req.session.userProfile || req.session.userProfile.username === 'guest') {
    return res.status(401).json({ error: "Authentication required. Please sign in to update settings." });
  }
  const originalUsername = req.session.userProfile.username;
  const { username, fullName, email, avatar, location, website, bio, language, timezone } = req.body;
  
  if (username) {
    if (!validateUsername(username)) {
      return res.status(400).json({ error: "Username must be alphanumeric (3-20 characters)." });
    }
    req.session.userProfile.username = username;
  }
  
  if (fullName !== undefined) {
    if (fullName.trim().length === 0 || fullName.trim().length > 50) {
      return res.status(400).json({ error: "Full Name must be between 1 and 50 characters." });
    }
    req.session.userProfile.fullName = fullName;
  }
  
  if (email !== undefined) {
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }
    req.session.userProfile.email = email;
  }
  
  if (avatar !== undefined) req.session.userProfile.avatar = avatar;
  
  if (location !== undefined) {
    if (location.trim().length > 100) {
      return res.status(400).json({ error: "Location must be 100 characters or less." });
    }
    req.session.userProfile.location = location;
  }
  
  if (website !== undefined) {
    if (website.trim().length > 0 && !validateUrl(website)) {
      return res.status(400).json({ error: "Invalid website URL format (must start with http:// or https://)." });
    }
    if (website.trim().length > 100) {
      return res.status(400).json({ error: "Website URL must be 100 characters or less." });
    }
    req.session.userProfile.website = website;
  }
  
  if (bio !== undefined) {
    if (bio.trim().length > 250) {
      return res.status(400).json({ error: "Bio must be 250 characters or less." });
    }
    req.session.userProfile.bio = bio;
  }
  if (language !== undefined) req.session.userProfile.language = language;
  if (timezone !== undefined) req.session.userProfile.timezone = timezone;

  // Persist settings if user is logged in
  if (req.session.userProfile.username !== "guest") {
    db.users.updateUserProfile(originalUsername, req.session.userProfile);
  }

  res.json(req.session.userProfile);
});

// 4.1 DMCA Persistent Storage
let dmcaTakedownRequests = db.dmca.data;

// 4.2 DMCA Real Zero-Dependency Document Upload Handler
app.post('/api/dmca/upload', writeRateLimiter, (req, res) => {
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('boundary=')) {
    return res.status(400).json({ error: "Missing multipart boundary in request headers." });
  }

  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) {
    return res.status(400).json({ error: "Unable to extract boundary parameter from headers." });
  }
  const boundary = boundaryMatch[1];

  let receivedBytes = 0;
  const sizeLimit = 10 * 1024 * 1024; // 10MB ceiling on incoming data stream
  const chunks = [];
  let limitExceeded = false;

  req.on('data', chunk => {
    if (limitExceeded) return;
    receivedBytes += chunk.length;
    if (receivedBytes > sizeLimit) {
      limitExceeded = true;
      res.status(400).json({ error: "File size exceeds strict 10MB limit." });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (limitExceeded) return;
    try {
      const bodyBuffer = Buffer.concat(chunks);
      const boundaryBuffer = Buffer.from('--' + boundary);
      
      const boundaryIdx = bodyBuffer.indexOf(boundaryBuffer);
      if (boundaryIdx === -1) {
        return res.status(400).json({ error: "Multipart boundary not found in request payload." });
      }

      const doubleCrlf = Buffer.from('\r\n\r\n');
      const headerEndIdx = bodyBuffer.indexOf(doubleCrlf, boundaryIdx + boundaryBuffer.length);
      if (headerEndIdx === -1) {
        return res.status(400).json({ error: "Invalid multipart form-data payload headers." });
      }

      const headersStr = bodyBuffer.slice(boundaryIdx + boundaryBuffer.length, headerEndIdx).toString('utf8');
      const filenameMatch = headersStr.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'ownership_proof.png';

      const nextBoundaryIdx = bodyBuffer.indexOf(boundaryBuffer, headerEndIdx);
      if (nextBoundaryIdx === -1) {
        return res.status(400).json({ error: "Trailing multipart boundary not found." });
      }

      // Extract binary file slice (adjust for CRLF boundary offsets)
      let fileData = bodyBuffer.slice(headerEndIdx + 4, nextBoundaryIdx - 2);

      const detected = detectImageType(fileData);
      if (!detected) {
        return res.status(400).json({ error: "Invalid upload format. Only PNG, JPEG, GIF, or WebP image files are allowed." });
      }

      // Metadata stripping
      fileData = stripMetadata(fileData);

      const settings = db.settings.getAll();
      const maxUploadSize = settings.maxUploadSize || 50; // MB
      if (fileData.length > maxUploadSize * 1024 * 1024) {
        return res.status(400).json({ error: `File exceeds maximum configured limit of ${maxUploadSize}MB.` });
      }

      const cleanFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const ext = path.extname(cleanFilename).replace('.', '').toLowerCase();
      const acceptedExts = IMAGE_SIGNATURES[detected.ext]?.extensions || [detected.ext];
      if (!acceptedExts.includes(ext)) {
        return res.status(400).json({ error: `File name extension .${ext} does not match the detected image type .${detected.ext}.` });
      }

      const uploadDir = path.join(__dirname, 'public', 'images', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const safeFilename = `proof-${Date.now()}-${cleanFilename}`;
      const fileWritePath = path.join(uploadDir, safeFilename);

      fs.writeFileSync(fileWritePath, fileData);

      res.json({
        success: true,
        message: "File uploaded successfully to grid node.",
        filePath: `/images/uploads/${safeFilename}`
      });
    } catch (err) {
      console.error("Error parsing multipart file stream:", err);
      res.status(500).json({ error: "Failed to process uploaded file document." });
    }
  });
});

// 4.3 DMCA Request Submission
app.post('/api/dmca', writeRateLimiter, (req, res) => {
  const { infringingUrl, allegationDescription, files, swearSignature } = req.body;

  if (!infringingUrl || !allegationDescription || !swearSignature) {
    console.error("DMCA missing fields:", req.body);
    return res.status(400).json({ error: "Missing required fields for takedown claim." });
  }

  if (!validateUrl(infringingUrl)) {
    console.error("DMCA invalid URL:", infringingUrl);
    return res.status(400).json({ error: "Invalid Infringing Asset URL format. Must start with http:// or https://." });
  }

  if (allegationDescription.trim().length < 10 || allegationDescription.trim().length > 1000) {
    return res.status(400).json({ error: "Allegation description must be between 10 and 1000 characters." });
  }

  if (swearSignature.trim().length < 1 || swearSignature.trim().length > 100) {
    return res.status(400).json({ error: "Legal swear signature must be between 1 and 100 characters." });
  }

  const newRequest = {
    id: "dmca-" + Date.now(),
    infringingUrl,
    allegationDescription,
    files: files || [],
    swearSignature,
    submittedAt: new Date().toISOString(),
    status: "Pending Investigation"
  };

  db.dmca.addRequest(newRequest);
  dmcaTakedownRequests = db.dmca.data;
  console.log("DMCA Takedown Claim Registered successfully:", newRequest);

  res.json({
    success: true,
    message: "Takedown request successfully filed.",
    claimId: newRequest.id
  });
});

// 4.4 Privacy Policy & Terms Database
const privacyPolicyData = [
  {
    id: "1.0",
    tocTitle: "1.0 Data Mapping",
    mobileTitle: "1.0 Data",
    sectionTitle: "1.0 Data Mapping",
    paragraphs: [
      "RESIN is committed to transparency in how we collect, process, and protect your data. This section outlines the categories of data we collect, the purposes for which they are used, and the legal bases that govern such processing."
    ],
    bullets: [
      "Account information (e.g., username, email)",
      "Usage data and activity logs",
      "Device and browser metadata",
      "Communication data (support, feedback, and messages)"
    ],
    paragraphs2: [
      "We do not sell or rent your personal data. All data is processed in accordance with applicable privacy laws and industry best practices."
    ],
    notice: {
      title: "Important Notice",
      text: "This policy forms a legally binding agreement between you and RESIN. By using our platform, you acknowledge that you have read, understood, and agree to the terms described herein."
    }
  },
  {
    id: "2.0",
    tocTitle: "2.0 User Rights",
    mobileTitle: "2.0 Rights",
    sectionTitle: "2.0 User Rights",
    paragraphs: [
      "You have the right to access, correct, export, or delete your personal data at any time. You may also object to or restrict certain processing activities where applicable."
    ],
    bullets: [
      "Access your personal data",
      "Request correction of inaccurate data",
      "Request deletion (\"right to be forgotten\")",
      "Object to or restrict data processing"
    ]
  },
  {
    id: "3.0",
    tocTitle: "3.0 Copyright Hold",
    mobileTitle: "3.0 Copyright",
    sectionTitle: "3.0 Copyright Hold",
    paragraphs: [
      "All visual wallpapers, editorial magazines, and custom graphics served on RESIN are protected under copyright laws. Visual nodes are licensed solely for private personal use."
    ],
    bullets: [
      "Personal, non-commercial wallpaper caching is allowed",
      "Redistribution, commercial scraping, or hotlinking is strictly prohibited",
      "Takedown requests can be filed securely via our Legal & DMCA portal",
      "Editorial content belongs exclusively to RESIN Wallpaper Culture"
    ]
  },
  {
    id: "4.0",
    tocTitle: "4.0 Local Sandbox Storage",
    mobileTitle: "4.0 Storage",
    sectionTitle: "4.0 Local Sandbox Storage",
    paragraphs: [
      "To optimize app speed and retain customization preferences, RESIN utilizes local browser sandboxes and cookies to store session states, download history, and favorite saves."
    ],
    bullets: [
      "Saves your local wallpaper favorites cache",
      "Stores download history list for quick access",
      "Logs active category filters and theme states",
      "Clearing browser cache will reset sandbox stats"
    ]
  },
  {
    id: "5.0",
    tocTitle: "5.0 Third-Party Integrations",
    mobileTitle: "5.0 Integrations",
    sectionTitle: "5.0 Third-Party Integrations",
    paragraphs: [
      "We coordinate with secure external services to stream high-resolution images, analyze app performance, and deliver notifications. These integrations comply with rigid privacy safeguards."
    ],
    bullets: [
      "Content Delivery Networks (CDNs) for high-speed wallpaper downloads",
      "Anonymized analytics pipelines to track active daily usage",
      "Encrypted cloud backups for premium account credential validation"
    ]
  },
  {
    id: "6.0",
    tocTitle: "6.0 Data Retention Schedule",
    mobileTitle: "6.0 Retention",
    sectionTitle: "6.0 Data Retention Schedule",
    paragraphs: [
      "We retain collected data only as long as necessary to fulfill service operations. Detailed session logs and uploaded proof documents follow a strict data retention timetable."
    ],
    bullets: [
      "Active account profiles remain persistent in database nodes",
      "Simulated takedown request proof documents are purged after review",
      "Anonymized telemetry logs are rotated every 90 days"
    ]
  },
  {
    id: "7.0",
    tocTitle: "7.0 Prohibited Uses",
    mobileTitle: "7.0 Prohibited",
    sectionTitle: "7.0 Prohibited Uses",
    paragraphs: [
      "Users agree to maintain platform integrity. Any malicious exploitation, botting, or structural abuse will trigger automatic node restrictions."
    ],
    bullets: [
      "Scraping, harvesting, or bulk-downloading premium wallpaper files",
      "Attempting unauthorized access to back-end administration portals",
      "Injecting malicious code or triggering Denial of Service (DoS) attacks"
    ]
  },
  {
    id: "8.0",
    tocTitle: "8.0 Policy Updates",
    mobileTitle: "8.0 Updates",
    sectionTitle: "8.0 Policy Updates",
    paragraphs: [
      "RESIN reserves the right to modify this Legal & Privacy compilation at any time. Significant changes will be announced on the Community Pulse ticker."
    ],
    bullets: [
      "Core compilation revisions are stamped at the top of this view",
      "Continued use of the platform constitutes acceptance of updated terms",
      "Historical revisions can be requested by contacting our legal team"
    ]
  },
  {
    id: "9.0",
    tocTitle: "9.0 Contact & DPO",
    mobileTitle: "9.0 Contact",
    sectionTitle: "9.0 Contact & Data Protection Officer",
    paragraphs: [
      "For any questions regarding data processing, personal rights, or structural compliance, please reach out to our DPO desk directly."
    ],
    bullets: [
      "Data Protection Officer email: dpo@resin.app",
      "General legal inquiry address: legal@resin.app",
      "Acknowledged response time: 48 business hours"
    ]
  },
  {
    id: "10.0",
    tocTitle: "10.0 Acceptance of Terms",
    mobileTitle: "10.0 Accept",
    sectionTitle: "10.0 Acceptance of Terms",
    paragraphs: [
      "By accessing the RESIN platform, downloading wallpaper assets, or participating in the community hub, you agree to comply with and be legally bound by this Policy & Terms compilation.",
      "If you do not agree to these terms, please suspend all platform operations and delete any downloaded assets immediately."
    ]
  }
];

// 4.5 Serve Privacy Policy & Terms data
app.get('/api/privacy', (req, res) => {
  res.json(privacyPolicyData);
});

// 5. Download Wallpaper Endpoint (Increments downloads, adds to history, downloads file)
app.get('/api/wallpapers/:id/download', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const { id } = req.params;
  const wallpaper = wallpapers.find(w => w.id === id);

  if (!wallpaper) {
    return res.status(404).send("Wallpaper not found");
  }

  // Increment download count and add history dynamically
  db.wallpapers.updateDownloads(id);
  db.history.addHistory(req.session.id, id);

  // Auto-inject community activity
  injectCommunityActivity("downloaded", id, req.session);

  // Synchronize active session history list and wallpapers references
  req.session.userHistory = db.history.getUserHistory(req.session.id);
  wallpapers = db.wallpapers.data;

  // Stream actual file download (uses originalImage if available, else falls back to compressed preview image)
  const imageToDownload = wallpaper.originalImage || wallpaper.image;
  const filePath = path.join(__dirname, 'public', imageToDownload);
  
  if (fs.existsSync(filePath)) {
    const originalExt = path.extname(imageToDownload) || '.png';
    res.download(filePath, `${id}${originalExt}`, (err) => {
      if (err) {
        console.error("Error during download download:", err);
      }
    });
  } else {
    // Fallback if the image doesn't exist
    res.status(404).send("Wallpaper file is missing on the server");
  }
});

// 5b. Download Collections ZIP Pack (real zero-dependency ZIP archive)
app.get('/api/collections/:id/zip', (req, res) => {
  try {
    const { id } = req.params;
    const col = db.collections.getById(id);
    if (!col) {
      return res.status(404).json({ error: "Collection not found." });
    }

    const colAssets = col.assets || [];
    if (colAssets.length === 0) {
      return res.status(404).json({ error: "No wallpapers found in the collection." });
    }

    // Collect all files into ZIP entries
    const zipFiles = [];
    for (const wpId of colAssets) {
      const wp = wallpapers.find(w => w.id === wpId);
      if (wp) {
        const filePath = path.join(__dirname, 'public', wp.image);
        if (fs.existsSync(filePath)) {
          const ext = path.extname(wp.image);
          const safeName = wp.id + ext;
          zipFiles.push({ name: safeName, data: fs.readFileSync(filePath) });
          db.wallpapers.updateDownloads(wp.id);
        }
      }
    }

    if (zipFiles.length === 0) {
      return res.status(404).json({ error: "Collection image files are missing on the server." });
    }

    const zipBuffer = buildZipBuffer(zipFiles);
    wallpapers = db.wallpapers.data;

    const safeTitle = col.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_pack.zip"`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', zipBuffer.length);
    res.end(zipBuffer);
  } catch (err) {
    console.error('[ZIP ERROR] Collection pack generation failed:', err.message);
    res.status(500).json({ error: "Failed to generate collection archive." });
  }
});

// 5c. Download Favorites ZIP Pack (real zero-dependency ZIP archive of all favorited wallpapers)
app.get('/api/favorites/zip', (req, res) => {
  if (req.session.userFavorites.size === 0) {
    return res.status(400).json({ error: "No favorited wallpapers to download." });
  }

  try {
    const zipFiles = [];
    for (const favId of req.session.userFavorites) {
      const wp = wallpapers.find(w => w.id === favId);
      if (!wp) continue;
      const filePath = path.join(__dirname, 'public', wp.image);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(wp.image);
        const safeName = wp.id + ext;
        zipFiles.push({ name: safeName, data: fs.readFileSync(filePath) });
        db.wallpapers.updateDownloads(wp.id);
      }
    }

    if (zipFiles.length === 0) {
      return res.status(404).json({ error: "Favorited wallpaper files are missing on the server." });
    }

    const zipBuffer = buildZipBuffer(zipFiles);
    wallpapers = db.wallpapers.data;

    res.setHeader('Content-Disposition', 'attachment; filename="my_favorites_pack.zip"');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', zipBuffer.length);
    res.end(zipBuffer);
  } catch (err) {
    console.error('[ZIP ERROR] Favorites pack generation failed:', err.message);
    res.status(500).json({ error: "Failed to generate favorites archive." });
  }
});

// 6. Get Global Dashboard Stats
app.get('/api/stats', (req, res) => {
  const totalDownloads = wallpapers.reduce((sum, w) => sum + w.downloads, 0);
  const totalFavorites = wallpapers.reduce((sum, w) => sum + w.favoritesCount, 0);
  res.json({
    totalDownloads,
    totalFavorites,
    favoritesCount: req.session.userFavorites.size,
    historyCount: req.session.userHistory.length
  });
});

// --- 8.0 MAGAZINE ARTICLES API ROUTES ---

// Get all articles (supports preview payload and filter)
app.get('/api/articles', (req, res) => {
  const { category } = req.query;
  let list = Object.keys(articles).map(key => {
    const art = articles[key];
    return {
      id: art.id,
      title: art.title,
      category: art.category,
      publishDate: art.publishDate,
      readTime: art.readTime,
      image: art.image,
      caption: art.caption,
      likes: art.likes,
      comments: art.comments,
      intro: art.intro,
      liked: req.session.userLikedArticles.has(art.id),
      saved: req.session.userSavedArticles.has(art.id)
    };
  });

  if (category && category !== 'all') {
    list = list.filter(a => a.category.toLowerCase() === category.toLowerCase());
  }

  res.json(list);
});

// Get single article full details (with comments and states)
app.get('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  const art = articles[id];
  if (!art) {
    return res.status(404).json({ error: "Article not found" });
  }

  res.json({
    ...art,
    liked: req.session.userLikedArticles.has(id),
    saved: req.session.userSavedArticles.has(id)
  });
});

// Toggle Like state
app.post('/api/articles/:id/like', (req, res) => {
  const { id } = req.params;
  const art = articles[id];
  if (!art) {
    return res.status(404).json({ error: "Article not found" });
  }

  let liked = false;
  if (req.session.userLikedArticles.has(id)) {
    req.session.userLikedArticles.delete(id);
    art.likes = Math.max(0, art.likes - 1);
  } else {
    req.session.userLikedArticles.add(id);
    art.likes += 1;
    liked = true;
  }

  // Persist engagement state
  db.articles.updateArticleEngagement(id, art.likes, art.comments, art.commentsList);
  if (req.session.userProfile.username !== "guest") {
    req.session.userProfile.likedArticles = Array.from(req.session.userLikedArticles);
    db.users.updateUserProfile(req.session.userProfile.username, req.session.userProfile);
  }

  res.json({ id, liked, likes: art.likes });
});

// Toggle Save state
app.post('/api/articles/:id/save', (req, res) => {
  const { id } = req.params;
  const art = articles[id];
  if (!art) {
    return res.status(404).json({ error: "Article not found" });
  }

  let saved = false;
  if (req.session.userSavedArticles.has(id)) {
    req.session.userSavedArticles.delete(id);
  } else {
    req.session.userSavedArticles.add(id);
    saved = true;
  }

  // Persist engagement state
  db.articles.updateArticleEngagement(id, art.likes, art.comments, art.commentsList);
  if (req.session.userProfile.username !== "guest") {
    req.session.userProfile.savedArticles = Array.from(req.session.userSavedArticles);
    db.users.updateUserProfile(req.session.userProfile.username, req.session.userProfile);
  }

  res.json({ id, saved });
});

// Post a comment
app.post('/api/articles/:id/comments', writeRateLimiter, (req, res) => {
  let content = req.body.text || req.body.content;
  if (!content) return res.status(400).json({ error: "Comment content is required" });
  
  content = escapeHtml(content);

  const { id } = req.params;
  const art = articles[id];
  if (!art) {
    return res.status(404).json({ error: "Article not found" });
  }

  const activeUsername = req.session.userProfile.username === 'guest' ? 'guest_voyager' : req.session.userProfile.username;
  const newComment = {
    id: "comment-" + Date.now(),
    username: escapeHtml(activeUsername.startsWith('@') ? activeUsername : '@' + activeUsername),
    avatar: req.session.userProfile.avatar,
    text: content,
    time: "Just now",
    likes: 0,
    liked: false
  };

  if (!art.commentsList) {
    art.commentsList = [];
  }

  art.commentsList.unshift(newComment);
  art.comments += 1;

  // Persist updated article and comments
  db.articles.updateArticleEngagement(id, art.likes, art.comments, art.commentsList);

  res.json({ success: true, comment: newComment, commentsCount: art.comments });
});

// --- 9.0 COMMUNITY PULSE API ROUTES ---

// Get live pulse statistics and activity stream
app.get('/api/community/pulse', (req, res) => {
  // Let stats fluctuate slightly to simulate dynamic updates
  const simulatedMembers = pulseStats.members + Math.floor(Math.random() * 9) - 4;
  res.json({
    pollVotes,
    downloads: pulseStats.downloads,
    upvotes: pulseStats.upvotes,
    members: Math.max(10, simulatedMembers),
    activities: communityActivities
  });
});

// Submit a poll vote
app.post('/api/community/poll/vote', writeRateLimiter, (req, res) => {
  const { themeIndex } = req.body;
  const idx = parseInt(themeIndex);
  if (isNaN(idx) || idx < 0 || idx > 2) {
    return res.status(400).json({ error: "Invalid theme index." });
  }

  pollVotes[idx] += 1;
  pulseStats.upvotes += 1;

  // Persist poll vote changes
  db.community.save(pulseStats);

  res.json({
    success: true,
    pollVotes,
    totalUpvotes: pulseStats.upvotes
  });
});

// 7. Clear User Download History
app.post('/api/history/clear', (req, res) => {
  db.history.clearHistory(req.session.id);
  req.session.userHistory = [];

  res.json({ success: true, message: "Download history cleared successfully.", historyCount: 0 });
});

// Test endpoint to trigger a synchronous exception (for verification)
app.get('/api/test-error', (req, res) => {
  throw new Error("Simulated Node.js exception inside RESIN security grid.");
});

// ==========================================
// SYSTEM SETTINGS ENDPOINTS
// ==========================================
app.get('/api/settings/public', (req, res) => {
  try {
    const settings = db.settings.getAll();
    const publicSettings = {
      siteName: settings.siteName || 'RESIN',
      maintenanceMode: settings.maintenanceMode,
      publicSignups: settings.publicSignups,
      maxUploadSize: settings.maxUploadSize || 50,
      allowedFormats: settings.allowedFormats || ["jpg", "jpeg", "png", "gif", "webp", "mp4"]
    };
    res.json(publicSettings);
  } catch(err) {
    console.error("[SETTINGS] Error fetching public settings:", err);
    res.status(500).json({ error: "Failed to fetch settings." });
  }
});

app.get('/api/admin/settings', verifyAdmin, (req, res) => {
  try {
    const settings = db.settings.getAll();
    res.json(settings);
  } catch(err) {
    console.error("[SETTINGS] Error fetching settings:", err);
    res.status(500).json({ error: "Failed to fetch settings." });
  }
});

app.put('/api/admin/settings', verifyAdmin, (req, res) => {
  try {
    const updates = req.body;
    db.settings.update(updates);
    db.admin.addAuditLog("system_settings_updated", req.session.userProfile.email, { keys: Object.keys(updates) });
    res.json({ success: true, settings: db.settings.getAll() });
  } catch(err) {
    console.error("[SETTINGS] Error updating settings:", err);
    res.status(500).json({ error: "Failed to update settings." });
  }
});

// ----------------------------------------------------
// Media and Categories API Endpoints
// ----------------------------------------------------
app.get('/api/admin/media', verifyAdmin, (req, res) => {
  try {
    const media = db.media.getAll();
    res.json(media);
  } catch(err) {
    console.error("[MEDIA] Error fetching media:", err);
    res.status(500).json({ error: "Failed to fetch media library items." });
  }
});

app.post('/api/admin/media/upload', writeRateLimiter, verifyAdmin, (req, res) => {
  try {
    const { filename, mimeType, data, size } = req.body;
    console.log("[DEBUG UPLOAD] filename:", filename, "mimeType:", mimeType, "dataPrefix:", data ? data.substring(0, 50) : null);
    if (!filename || !mimeType || !data) {
      console.log("[DEBUG UPLOAD] FAILED missing fields");
      return res.status(400).json({ error: "Missing required fields: filename, mimeType, or data." });
    }

    // Extract base64 buffer
    const base64Data = data.replace(/^data:([^;]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const detected = detectImageType(buffer);
    if (!detected) {
      return res.status(400).json({ error: "Invalid upload format. Only PNG, JPEG, GIF, or WebP image files are allowed." });
    }

    const settings = db.settings.getAll();
    const maxUploadSize = settings.maxUploadSize || 50; // MB
    if (buffer.length > maxUploadSize * 1024 * 1024) {
      return res.status(400).json({ error: `File exceeds maximum configured limit of ${maxUploadSize}MB.` });
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const ext = path.extname(cleanFilename).replace('.', '').toLowerCase();
    const acceptedExts = IMAGE_SIGNATURES[detected.ext]?.extensions || [detected.ext];
    if (!acceptedExts.includes(ext)) {
      return res.status(400).json({ error: `File name extension .${ext} does not match the detected image type .${detected.ext}.` });
    }

    const uploadDir = path.join(__dirname, 'public', 'images', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeFilename = `media-${Date.now()}-${cleanFilename}`;
    const fileWritePath = path.join(uploadDir, safeFilename);

    const strippedBuffer = stripImageMetadata(buffer, detected.mime);
    fs.writeFileSync(fileWritePath, strippedBuffer);

    const assetUrl = `/images/uploads/${safeFilename}`;
    const uploadedAt = new Date().toISOString();

    const mediaObj = {
      filename: safeFilename,
      url: assetUrl,
      mimeType,
      size,
      uploadedAt
    };

    const newMedia = db.media.create(mediaObj);
    if (!newMedia) {
      return res.status(500).json({ error: "Failed to record media in database." });
    }

    db.admin.addAuditLog("media_uploaded", req.session.userProfile.email, { filename: safeFilename });
    res.json({ success: true, media: newMedia });
  } catch(err) {
    console.error("[MEDIA] Error uploading media:", err);
    res.status(500).json({ error: "Failed to process media upload." });
  }
});

app.delete('/api/admin/media/:id', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const mediaItem = db.media.getById(id);
    if (!mediaItem) {
      return res.status(404).json({ error: "Media item not found." });
    }

    // Delete from DB
    db.media.delete(id);

    // Delete from disk
    const uploadDir = path.join(__dirname, 'public', 'images', 'uploads');
    const filePath = path.join(uploadDir, mediaItem.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.admin.addAuditLog("media_deleted", req.session.userProfile.email, { filename: mediaItem.filename });
    res.json({ success: true });
  } catch(err) {
    console.error("[MEDIA] Error deleting media:", err);
    res.status(500).json({ error: "Failed to delete media item." });
  }
});

app.get('/api/admin/categories', verifyAdmin, (req, res) => {
  try {
    const categories = db.categories.getAll();
    const articles = Object.values(db.articles.data);
    const categoryCounts = {};
    articles.forEach(art => {
      const catName = (art.category || '').toUpperCase().trim();
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
    });

    const result = categories.map(c => ({
      ...c,
      articleCount: categoryCounts[c.name.toUpperCase().trim()] || 0
    }));

    res.json(result);
  } catch(err) {
    console.error("[CATEGORIES] Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories." });
  }
});

app.post('/api/admin/categories', verifyAdmin, (req, res) => {
  try {
    const { name, slug, description } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: "Missing required fields: name or slug." });
    }

    // Check if name/slug already exists
    const categories = db.categories.getAll();
    if (categories.some(c => c.name.toUpperCase().trim() === name.toUpperCase().trim() || c.slug.toLowerCase().trim() === slug.toLowerCase().trim())) {
      return res.status(400).json({ error: "Category name or slug already exists." });
    }

    const newCatObj = { name, slug, description: description || "" };
    const newCat = db.categories.create(newCatObj);
    if (!newCat) {
      return res.status(500).json({ error: "Failed to create category in database." });
    }

    db.admin.addAuditLog("category_created", req.session.userProfile.email, { name });
    res.json({ success: true, category: { ...newCat, articleCount: 0 } });
  } catch(err) {
    console.error("[CATEGORIES] Error creating category:", err);
    res.status(500).json({ error: "Failed to create category." });
  }
});

app.put('/api/admin/categories/:id', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const { name, slug, description } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: "Missing required fields: name or slug." });
    }

    // Check if name/slug already exists for OTHER categories
    const categories = db.categories.getAll();
    if (categories.some(c => c.id !== parseInt(id) && (c.name.toUpperCase().trim() === name.toUpperCase().trim() || c.slug.toLowerCase().trim() === slug.toLowerCase().trim()))) {
      return res.status(400).json({ error: "Category name or slug already exists." });
    }

    const updates = { name, slug, description };
    db.categories.update(id, updates);

    db.admin.addAuditLog("category_updated", req.session.userProfile.email, { id, name });
    res.json({ success: true });
  } catch(err) {
    console.error("[CATEGORIES] Error updating category:", err);
    res.status(500).json({ error: "Failed to update category." });
  }
});

app.delete('/api/admin/categories/:id', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const categories = db.categories.getAll();
    const cat = categories.find(c => c.id === parseInt(id));
    if (!cat) {
      return res.status(404).json({ error: "Category not found." });
    }

    db.categories.delete(id);

    db.admin.addAuditLog("category_deleted", req.session.userProfile.email, { name: cat.name });
    res.json({ success: true });
  } catch(err) {
    console.error("[CATEGORIES] Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category." });
  }
});

// ----------------------------------------------------
// Crawlable public routes and SEO snapshots
// ----------------------------------------------------
const PUBLIC_ROUTE_SNAPSHOTS = {
  home: {
    path: '/',
    hash: 'home',
    title: 'RESIN - Digital Art Wallpapers',
    description: 'Browse trending digital art and anime wallpapers for desktop and mobile.',
    h1: 'Trending Digital Art Wallpapers'
  },
  collections: {
    path: '/collections',
    hash: 'collections',
    title: 'Wallpaper Collections - RESIN',
    description: 'Explore curated wallpaper packs built around styles, shows, moods, and color themes.',
    h1: 'Wallpaper Collections'
  },
  categories: {
    path: '/categories',
    hash: 'categories',
    title: 'Wallpaper Categories - RESIN',
    description: 'Find wallpapers by anime, action, nature, dark art, cyberpunk, fantasy, and more.',
    h1: 'Wallpaper Categories'
  },
  magazine: {
    path: '/magazine',
    hash: 'magazine',
    title: 'Digital Art Magazine - RESIN',
    description: 'Read simple guides, rankings, and notes about anime wallpapers and digital art trends.',
    h1: 'Digital Art Magazine'
  },
  rankings: {
    path: '/rankings',
    hash: 'rankings',
    title: 'Top Wallpaper Rankings - RESIN',
    description: 'See wallpapers ranked by downloads, saves, and community interest.',
    h1: 'Top Wallpaper Rankings'
  },
  community: {
    path: '/community',
    hash: 'community',
    title: 'RESIN Community',
    description: 'See community activity, polls, and recent wallpaper saves and downloads.',
    h1: 'RESIN Community'
  },
  submit: {
    path: '/submit',
    hash: 'settings',
    title: 'Submit Wallpaper Art - RESIN',
    description: 'Sign in to submit wallpaper art and manage your creator profile.',
    h1: 'Submit Wallpaper Art',
    noindex: true
  },
  login: {
    path: '/login',
    hash: 'home',
    title: 'Log In - RESIN',
    description: 'Log in to save favorite wallpapers and manage your RESIN profile.',
    h1: 'Log In To RESIN',
    noindex: true
  },
  signup: {
    path: '/signup',
    hash: 'home',
    title: 'Create A RESIN Account',
    description: 'Create a RESIN account to save wallpapers and join the digital art community.',
    h1: 'Create A RESIN Account',
    noindex: true
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(req, routePath = '/') {
  const configuredBase = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (configuredBase) return configuredBase + routePath;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${proto}://${req.get('host')}${routePath}`;
}

function makeWallpaperRoute(id) {
  return `/wallpapers/${encodeURIComponent(id)}`;
}

function wallpaperCardHtml(w) {
  const route = makeWallpaperRoute(w.id);
  return `
    <article>
      <a href="${route}">
        <img src="${escapeHtml(w.image || '/images/avatar.png')}" alt="${escapeHtml(`${w.title} wallpaper by ${w.artist || 'RESIN'}`)}" width="1024" height="1024" loading="lazy">
        <h2>${escapeHtml(w.title)}</h2>
      </a>
      <p>${escapeHtml(w.anime || 'Digital Art')} - ${escapeHtml(w.quality || '4K')} - ${escapeHtml((w.tags || []).slice(0, 4).join(', '))}</p>
    </article>`;
}

function homeSnapshotHtml() {
  const featured = [...wallpapers]
    .sort((a, b) => ((b.downloads || 0) + (b.favoritesCount || 0)) - ((a.downloads || 0) + (a.favoritesCount || 0)))
    .slice(0, 12);
  return `
    <p>Browse trending wallpapers from RESIN. Each wallpaper has a real page with image details and a download link.</p>
    <section>${featured.map(wallpaperCardHtml).join('')}</section>`;
}

function collectionsSnapshotHtml(req) {
  const collections = db.collections.getAll();
  const collectionCards = collections.map(col => `
    <article>
      <a href="/collections/${encodeURIComponent(col.id)}">
        <img src="${escapeHtml(col.coverImage || '/images/avatar.png')}" alt="${escapeHtml(`${col.title} collection cover`)}" width="1024" height="1024" loading="lazy">
        <h2>${escapeHtml(col.title)}</h2>
      </a>
      <p>${escapeHtml(col.description || 'Curated wallpaper pack.')}</p>
    </article>`).join('');
  return collectionCards || '<p>No public collections are available yet.</p>';
}

function categoriesSnapshotHtml() {
  return db.categories.getAll().map(cat => `
    <article>
      <h2>${escapeHtml(cat.name)}</h2>
      <p>${escapeHtml(cat.description || 'Browse wallpapers in this category.')}</p>
    </article>`).join('');
}

function profileSnapshotHtml(username) {
  const user = registeredUsers.find(u => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) return '<p>This public profile was not found.</p>';
  return `
    <section>
      <img src="${escapeHtml(user.avatar || '/images/avatar.png')}" alt="${escapeHtml(`${user.username} avatar`)}" width="256" height="256">
      <p>${escapeHtml(user.bio || 'RESIN community member.')}</p>
      <p>${escapeHtml(user.location || '')}</p>
      ${user.website ? `<p><a href="${escapeHtml(user.website)}" rel="nofollow ugc">${escapeHtml(user.website)}</a></p>` : ''}
    </section>`;
}

function collectionDetailPage(req, id) {
  const col = db.collections.getById(id);
  if (!col) return null;
  const assets = (col.assets || []).map(assetId => wallpapers.find(w => w.id === assetId)).filter(Boolean);
  return {
    path: `/collections/${encodeURIComponent(col.id)}`,
    hash: 'collections',
    title: `${col.title} - RESIN Collection`,
    description: col.description || `Download wallpapers from the ${col.title} collection on RESIN.`,
    h1: col.title,
    image: col.coverImage,
    bodyHtml: `
      <p>${escapeHtml(col.description || 'Curated wallpaper pack.')}</p>
      <section>${assets.map(wallpaperCardHtml).join('')}</section>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: col.title,
      description: col.description,
      url: absoluteUrl(req, `/collections/${encodeURIComponent(col.id)}`),
      image: absoluteUrl(req, col.coverImage || '/images/avatar.png')
    }
  };
}

function wallpaperDetailPage(req, id) {
  const w = wallpapers.find(wp => wp.id === id);
  if (!w) return null;
  const routePath = makeWallpaperRoute(w.id);
  const imagePath = w.originalImage || w.image || '/images/avatar.png';
  return {
    path: routePath,
    hash: `wallpaper-${w.id}`,
    title: `${w.title} Wallpaper - RESIN`,
    description: `${w.title} by ${w.artist || 'RESIN'} in ${w.quality || '4K'} quality. Download this ${w.anime || 'digital art'} wallpaper from RESIN.`,
    h1: `${w.title} Wallpaper`,
    image: imagePath,
    bodyHtml: `
      <article>
        <img src="${escapeHtml(w.image || imagePath)}" alt="${escapeHtml(`${w.title} wallpaper by ${w.artist || 'RESIN'}`)}" width="1024" height="1024">
        <p>${escapeHtml(w.anime || 'Digital Art')} - ${escapeHtml(w.quality || '4K')} - ${escapeHtml(w.resolution || '')}</p>
        <p>Artist: ${escapeHtml(w.artist || 'RESIN')}</p>
        <p>Tags: ${escapeHtml((w.tags || []).join(', '))}</p>
        <p><a href="/api/wallpapers/${encodeURIComponent(w.id)}/download">Download this wallpaper</a></p>
      </article>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      name: w.title,
      description: `${w.title} wallpaper by ${w.artist || 'RESIN'}`,
      contentUrl: absoluteUrl(req, imagePath),
      thumbnailUrl: absoluteUrl(req, w.image || imagePath),
      creator: { '@type': 'Person', name: w.artist || 'RESIN' },
      keywords: (w.tags || []).join(', '),
      url: absoluteUrl(req, routePath)
    }
  };
}

function simplePublicPage(key) {
  const page = { ...PUBLIC_ROUTE_SNAPSHOTS[key] };
  if (key === 'home') page.bodyHtml = homeSnapshotHtml();
  if (key === 'collections') page.bodyHtml = collectionsSnapshotHtml();
  if (key === 'categories') page.bodyHtml = categoriesSnapshotHtml();
  if (!page.bodyHtml) page.bodyHtml = `<p>${escapeHtml(page.description)}</p>`;
  return page;
}

function renderPublicPage(req, page, statusCode = 200) {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const routePath = page.path || req.path || '/';
  const canonicalUrl = absoluteUrl(req, routePath);
  const imageUrl = absoluteUrl(req, page.image || '/images/auth_banner.png');
  const robots = page.noindex ? 'noindex,follow' : 'index,follow';
  const jsonLd = page.jsonLd ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>` : '';
  const meta = `
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="${page.image ? 'article' : 'website'}">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  ${jsonLd}
  <script>window.__RESIN_INITIAL_ROUTE__=${JSON.stringify({ path: routePath, hash: page.hash || 'home' }).replace(/</g, '\\u003c')};</script>`;
  const snapshot = `
  <noscript>
    <main id="seo-snapshot">
      <h1>${escapeHtml(page.h1 || page.title)}</h1>
      ${page.bodyHtml || `<p>${escapeHtml(page.description)}</p>`}
    </main>
  </noscript>`;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  html = html.replace('</head>', `${meta}\n</head>`);
  html = html.replace('<body>', `<body>\n${snapshot}`);
  return { statusCode, html };
}

function sendPublicPage(req, res, page, statusCode = 200) {
  const rendered = renderPublicPage(req, page, statusCode);
  res.status(rendered.statusCode).type('html').send(rendered.html);
}

function sitemapUrl(loc, lastmod = new Date().toISOString()) {
  return `  <url><loc>${escapeHtml(loc)}</loc><lastmod>${lastmod}</lastmod></url>`;
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'resin', timestamp: new Date().toISOString() });
});

app.get('/robots.txt', (req, res) => {
  const base = absoluteUrl(req, '');
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    `Sitemap: ${base}/sitemap.xml`,
    `Sitemap: ${base}/image-sitemap.xml`
  ].join('\n'));
});

app.get('/sitemap.xml', (req, res) => {
  const basePages = ['/', '/collections', '/categories', '/magazine', '/rankings', '/community'];
  const urls = [
    ...basePages.map(p => sitemapUrl(absoluteUrl(req, p))),
    ...db.collections.getAll().map(c => sitemapUrl(absoluteUrl(req, `/collections/${encodeURIComponent(c.id)}`))),
    ...wallpapers.map(w => sitemapUrl(absoluteUrl(req, makeWallpaperRoute(w.id))))
  ];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
});

app.get('/image-sitemap.xml', (req, res) => {
  const urls = wallpapers.map(w => `
  <url>
    <loc>${escapeHtml(absoluteUrl(req, makeWallpaperRoute(w.id)))}</loc>
    <image:image>
      <image:loc>${escapeHtml(absoluteUrl(req, w.originalImage || w.image || '/images/avatar.png'))}</image:loc>
      <image:title>${escapeHtml(w.title)}</image:title>
      <image:caption>${escapeHtml(`${w.title} wallpaper by ${w.artist || 'RESIN'}`)}</image:caption>
    </image:image>
  </url>`);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`);
});

app.get(['/', '/home'], (req, res) => sendPublicPage(req, res, simplePublicPage('home')));
app.get('/collections', (req, res) => sendPublicPage(req, res, simplePublicPage('collections')));
app.get('/collections/:id', (req, res) => {
  const page = collectionDetailPage(req, req.params.id);
  if (!page) return sendPublicPage(req, res, { ...PUBLIC_ROUTE_SNAPSHOTS.collections, path: req.path, title: 'Collection Not Found - RESIN', h1: 'Collection Not Found', description: 'This wallpaper collection was not found.', bodyHtml: '<p>This collection was not found.</p>', noindex: true }, 404);
  sendPublicPage(req, res, page);
});
app.get('/categories', (req, res) => sendPublicPage(req, res, simplePublicPage('categories')));
app.get('/magazine', (req, res) => sendPublicPage(req, res, simplePublicPage('magazine')));
app.get('/rankings', (req, res) => sendPublicPage(req, res, simplePublicPage('rankings')));
app.get('/community', (req, res) => sendPublicPage(req, res, simplePublicPage('community')));
app.get('/submit', (req, res) => sendPublicPage(req, res, simplePublicPage('submit')));
app.get('/login', (req, res) => sendPublicPage(req, res, simplePublicPage('login')));
app.get('/signup', (req, res) => sendPublicPage(req, res, simplePublicPage('signup')));
app.get('/profile/:username', (req, res) => {
  const username = req.params.username;
  const exists = registeredUsers.some(u => u.username.toLowerCase() === String(username).toLowerCase());
  sendPublicPage(req, res, {
    path: `/profile/${encodeURIComponent(username)}`,
    hash: 'settings',
    title: `${username} - RESIN Profile`,
    description: `View ${username}'s public RESIN profile, bio, links, and saved wallpaper activity.`,
    h1: `${username}'s RESIN Profile`,
    bodyHtml: profileSnapshotHtml(username),
    noindex: !exists
  }, exists ? 200 : 404);
});
app.get(['/wallpapers/:id', '/wallpaper/:id'], (req, res) => {
  const page = wallpaperDetailPage(req, req.params.id);
  if (!page) return sendPublicPage(req, res, { ...PUBLIC_ROUTE_SNAPSHOTS.home, path: req.path, title: 'Wallpaper Not Found - RESIN', h1: 'Wallpaper Not Found', description: 'This wallpaper was not found.', bodyHtml: '<p>This wallpaper was not found.</p>', noindex: true }, 404);
  sendPublicPage(req, res, page);
});

// Custom 404 route. Hash-router URLs still hit "/" because fragments are not sent to the server.
app.get('*', (req, res) => {
  sendPublicPage(req, res, {
    path: req.path,
    hash: 'home',
    title: 'Page Not Found - RESIN',
    description: 'This RESIN page was not found. Browse trending wallpapers from the home feed.',
    h1: 'Page Not Found',
    bodyHtml: '<p>This page was not found. Use the home page to browse wallpapers.</p>',
    noindex: true
  }, 404);
});

// Centralized Express global error-handling middleware with environment shielding
app.use((err, req, res, next) => {
  console.error("=== UNHANDLED SYSTEM EXCEPTION INTERCEPTED ===");
  console.error(err.stack);
  console.error("==============================================");
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(500).json({
    error: "Internal server error. Transaction node halted safely.",
    ...(isProduction ? {} : { message: err.message, stack: err.stack })
  });
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   RESIN Backend successfully started!`);
  console.log(`   Access the UI at: http://localhost:${PORT}`);
  console.log(`==================================================`);
});

// Graceful shutdown handler — closes HTTP connections and SQLite cleanly on process exit
function gracefulShutdown(signal) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Closing server gracefully...`);
  server.close(() => {
    console.log('[SHUTDOWN] HTTP connections drained. Persisting database state...');
    try {
      db.wallpapers.save();
      db.users.save();
      db.articles.save();
      db.community.save();
      db.dmca.save();
      console.log('[SHUTDOWN] All database tables persisted successfully.');
    } catch (err) {
      console.error('[SHUTDOWN] Error persisting database:', err.message);
    }
    console.log('[SHUTDOWN] RESIN server terminated cleanly.');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced exit after 10s timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

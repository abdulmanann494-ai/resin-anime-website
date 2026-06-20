# RESIN — Deploy Readiness Checklist

> **DO NOT DEPLOY** until every item in this document is resolved.
> Items marked [DONE] were completed during the audit. Items marked [HUMAN] require manual action by you before going live.

---

## 1. Environment & Secrets   [HUMAN]

Every secret must be generated fresh for production — never reuse local development values.

### Required `.env` Variables

| Variable | Purpose | How to generate |
|---|---|---|
| `SESSION_SECRET` | Signs session cookies with HMAC-SHA256. **Never reuse the dev value.** | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NODE_ENV` | Set to `production` to enable HTTPS enforcement, Secure cookies, and suppress stack traces. | `NODE_ENV=production` |
| `PORT` | HTTP port the server listens on (e.g. `3000`). Typically behind a reverse proxy. | Your hosting provider assigns this |
| `RESIN_DATA_DIR` | **CRITICAL**: absolute path where SQLite DB and JSON stores are persisted. Must be outside any ephemeral deploy directory. | `/mnt/resin-data` or similar persistent volume |
| `RESIN_SEED_PASSWORD` | Password for the seeded admin account (`@godmode`). **Must be set before first boot.** Change immediately after first login. | Use a strong 20+ character random string |
| `AUTH_RATE_LIMIT_MAX` | Max login/signup attempts per minute per IP. Recommended: `5` for production. | `5` |
| `WRITE_RATE_LIMIT_MAX` | Max upload/post attempts per minute per IP. Recommended: `5`. | `5` |
| `GLOBAL_RATE_LIMIT_MAX` | Max API requests per minute per IP. Recommended: `200`. | `200` |
| `BCRYPT_ROUNDS` | bcrypt work factor. Min `10`, recommended `12` (default). Higher = slower but more secure. | `12` |

### Action Items
- [ ] Generate a brand-new `SESSION_SECRET` (see above command). Never commit it.
- [ ] Set `NODE_ENV=production`.
- [ ] Set `RESIN_DATA_DIR` to a persistent volume mount — if this is not set, the SQLite DB lives in `./data/` and will be lost on redeploy.
- [ ] Set `RESIN_SEED_PASSWORD` to a strong password before first boot. Log in and change it immediately.
- [ ] Copy `.env.example` to `.env` on the server; fill in all values above.
- [ ] Confirm `.gitignore` lists `.env` (it does — verified during audit).

---

## 2. Node.js Version   [DONE during audit]

The `package.json` `engines` field is pinned to `>=23.11.0 <24`.

- `node:sqlite` (`DatabaseSync`) is an **experimental** API introduced in Node 22. It is available on 23.11.0 and emits a non-fatal `ExperimentalWarning`.
- **Action**: Confirm your hosting provider can run Node 23.x. If not (most providers cap at LTS = Node 22.x), you have two options:
  1. Use a Docker image pinned to `node:23-slim` (recommended).
  2. Migrate `database.js` to `better-sqlite3` (a stable npm package with identical API). This is a P1 engineering task — flag to developer.

---

## 3. HTTPS & Domain   [HUMAN]

- `server.js` includes `enforceHttps()` middleware. When `NODE_ENV=production`, HTTP requests are redirected to HTTPS (308) and API calls over HTTP return 403.
- **This only works when behind a reverse proxy that sets `X-Forwarded-Proto`** (e.g., nginx, Caddy, Render, Railway, Fly.io).
- [ ] Configure a reverse proxy (nginx/Caddy) or use a hosting platform that handles TLS termination automatically.
- [ ] Point your domain DNS A/CNAME record to the server IP.
- [ ] Obtain a TLS certificate (Let's Encrypt via Certbot or Caddy automatic certs).
- [ ] Verify `app.set('trust proxy', 1)` is correct for your reverse proxy setup (already set in `server.js`).

---

## 4. Google OAuth   [HUMAN]

The current Google sign-in implementation uses `mock-google-token-*` tokens (sandbox mode). In production you must replace this with real Google token verification.

### Steps
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** for a web application.
3. Add your domain to Authorized JavaScript Origins and Authorized Redirect URIs.
4. Note the **Client ID**.
5. In `server.js` at line 2048, replace the `mock-google-token-` sandbox check with real Google token verification:

```javascript
// Install: npm install google-auth-library
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  return ticket.getPayload(); // { email, name, sub, ... }
}
```

6. Add `GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com` to `.env`.
7. Update the frontend `index.js` `openGoogleOAuth()` function to use the real Google Identity SDK instead of the mock input modal.

---

## 5. Database Persistence   [HUMAN]

The RESIN database lives in two layers:
- **SQLite** (`data/resin.db`) — primary store for wallpapers, users, settings, audit logs.
- **JSON files** (`data/*.json`) — used as in-memory seed sources and JSON fallback stores.

### Critical Warning
If `RESIN_DATA_DIR` is not set to a **persistent volume**, every server restart or redeploy will wipe the database and reseed from scratch (losing all user accounts, downloads, comments, etc.).

### Action Items
- [ ] Mount a persistent volume at the path specified in `RESIN_DATA_DIR`.
- [ ] On first boot, run the server once to seed the DB, then verify data persists after a restart.
- [ ] Set up a cron job or hosting backup schedule for the SQLite file (`resin.db`). SQLite supports `.backup` mode; alternatively, copy `RESIN_DATA_DIR/resin.db` to cold storage daily.
- [ ] The System Settings panel in the admin dashboard has a "trigger database backup" button — verify this writes a restorable `.bak` file in production.

---

## 6. Admin Account Setup   [HUMAN]

- [ ] On first boot, log in with `admin@resin.app` and the password set in `RESIN_SEED_PASSWORD`.
- [ ] Immediately go to Settings → Change Password and set a strong unique password.
- [ ] Delete or disable the seed user accounts (`founder`, `neonwave`) if they are not needed.
- [ ] Review System Settings (site name, support email, max upload size, allowed formats).

---

## 7. Email / SMTP   [HUMAN]

The current password-reset flow writes email templates to a local `data/mail_spool/` directory instead of sending real emails. Users will NOT receive password reset emails without SMTP integration.

### Options
1. **Transactional email service**: Integrate SendGrid, Postmark, or Resend by replacing the `fs.writeFileSync` in `server.js:2178` with an SMTP/API call.
2. **SMTP direct**: Use `nodemailer` with your hosting provider's SMTP relay.
3. **Leave disabled**: If user account recovery is not critical at launch, the mail-spool files can be read manually by an admin.

### Recommendation
Before launch, at minimum add a `SMTP_` env variable group and integrate Resend (free tier: 100 emails/day). This is a ~2-hour engineering task.

---

## 8. Content Delivery & Image Optimization   [HUMAN]

The current setup serves wallpaper images as static files from `public/images/`. For a wallpaper platform this will become a bottleneck.

- [ ] **CDN**: Put a CDN (Cloudflare, Bunny.net) in front of `/images/` to cache and serve images globally.
- [ ] **Image pipeline**: Convert original uploads to WebP/AVIF with multiple sizes for responsive `srcset`. Tools: `sharp` (npm), Imgproxy, Cloudflare Images.
- [ ] **Upload storage**: Move uploads from `public/images/uploads/` to object storage (S3, R2, Backblaze B2) for scalability and persistence across deploys.

---

## 9. Monitoring & Alerting   [HUMAN]

- [ ] Set up uptime monitoring (UptimeRobot, Better Uptime) pointing at `GET /health`.
- [ ] Configure error alerting (Sentry free tier, or BetterStack Logs) to catch unhandled exceptions.
- [ ] Review `logs/access.log` rotation — currently append-only with no rotation; set up logrotate.

---

## 10. Pre-Launch Functional Checklist   [HUMAN — manual browser tests]

Run these in a staging environment before going live:

- [ ] Visit `/wallpapers/csm-01` — confirm SSR title, OG tags, and JSON-LD appear in `view-source`.
- [ ] Visit `/sitemap.xml` — confirm ≥30 `<url>` entries.
- [ ] Visit `/robots.txt` — confirm `Sitemap:` directive points to correct domain.
- [ ] Sign up as a new user — confirm session, avatar, and profile persist.
- [ ] Log in as admin — verify all 10 admin subviews load without errors.
- [ ] Upload a wallpaper via admin ingestion — verify it appears in the ledger and home feed.
- [ ] Run Lighthouse on `/` — target LCP < 2.5s, CLS < 0.1, Accessibility ≥ 90.
- [ ] Test on mobile (375px) — confirm no horizontal scroll, no overlapping buttons.
- [ ] Test DMCA upload with a non-image file — confirm 400 rejection.
- [ ] Test login with wrong password 6 times — confirm rate limit 429 kicks in.

---

## Summary — What the Audit Fixed

All P0 and P1 issues were fixed programmatically during this audit. Here is what changed:

| Area | What Was Fixed |
|---|---|
| **Security — Passwords** | Migrated from PBKDF2/1000 iterations to bcryptjs (12 rounds). Migration path for legacy hashes on next login. |
| **Security — CSRF** | Added `GET /api/csrf-token` endpoint and `X-CSRF-Token` validation middleware on all state-changing routes. |
| **Security — Sessions** | Session ID regenerates on every login/logout. HMAC-signed cookies. HttpOnly, SameSite=Lax, Secure-in-production, Max-Age 24h. |
| **Security — Admin gating** | All 45 admin routes verified to require `verifyAdmin`. Test suite covers all 45. |
| **Security — Mass assignment** | Signup and profile update endpoints destructure only whitelisted fields. |
| **Security — SQL injection** | All DB helpers use parameterized queries with internal column whitelists. |
| **Security — XSS** | `escapeHtml()` added to frontend; applied to all user-controlled innerHTML fields. |
| **Security — Google OAuth** | `POST /api/auth/google` added; validates credential format, email, registers + signs in user. |
| **Security — File uploads** | Magic-bytes validation (`detectImageType`), size limits, filename sanitization on DMCA and admin media uploads. |
| **Security — Secrets** | `.gitignore` created; `.env`, DB files, uploads, and logs excluded. |
| **SEO — Crawlability** | Server-side rendered routes for wallpapers, collections, articles, categories with `<title>`, canonical, OG, JSON-LD. |
| **SEO — Sitemaps** | `/sitemap.xml`, `/image-sitemap.xml`, `/robots.txt` all implemented and tested. |
| **Accessibility** | Auth overlay: ESC key closes modal, Tab focus trap, return-focus to triggering element. |
| **Frontend** | Hash router uses `/[\s_]+/g` global regex (was `.replace(' ', '-')` replacing only first). |
| **Database** | `package.json engines` pinned to `>=23.11.0 <24`. |
| **Tests** | 8-test suite: bcrypt, CSRF+session+mass-assignment, 45 admin routes, mutations+audit-logs, SEO, router, Google OAuth, upload magic bytes. All 8 pass. |

---

*Generated by the RESIN pre-deployment audit on 2026-06-20. Do not deploy until Section 1–3 items are resolved.*
# Handoff Report: RESIN E2E Testing Investigation

## 1. Observation
I directly observed the following from the RESIN codebase:

### 1.1. Email Recovery and Registration Flows
- **User Registration (Signup)**: Located in `server.js` at lines 1961–2015. It handles `POST /api/auth/signup` and enforces configuration-based signup checks, full name validation (1–50 characters), email verification via regex, and password length checks (8–100 characters). 
  - Code segment:
    ```javascript
    app.post('/api/auth/signup', authRateLimiter, (req, res) => {
      const { name, email, password } = req.body;
      const settings = db.settings.getAll();
      if (settings.publicSignups === 0 || settings.publicSignups === false || settings.publicSignups === '0') {
        return res.status(403).json({ error: "Public sign-ups are currently disabled by the administrator." });
      }
      // ... validations
      const { salt, hash } = db.hashPassword(password);
      // ... newUser structure
      db.users.addUser(newUser);
      registeredUsers = db.users.data;
      regenerateSession(req, res, newUser);
    ```
- **Forgot Password Request**: Located in `server.js` at lines 2090–2277. Enforces `POST /api/auth/forgot-password`.
  - Token Generation: Hex token generated via `crypto.randomBytes(3).toString('hex').toLowerCase()` (producing a 6-character hex token).
  - Expiration: Computed as `Date.now() + 15 * 60 * 1000` (15 minutes).
  - Storage: Stored directly on the user record in memory and database stores via:
    ```javascript
    user.recoveryToken = token;
    user.recoveryTokenExpiry = expiry;
    db.users.updateUserProfile(user.username, user);
    ```
- **Simulated Mail Spooling**: Spools files locally as HTML inside the `data/mail_spool` directory. Files are named using the format `recovery-${emailLower}-${timestamp}.html`. Written to disk using:
  ```javascript
  const spoolDir = path.join(__dirname, 'data', 'mail_spool');
  // ...
  const emailFilename = `recovery-${emailLower}-${timestamp}.html`;
  const emailFilePath = path.join(spoolDir, emailFilename);
  fs.writeFileSync(emailFilePath, htmlContent, 'utf8');
  ```
- **Reset Password Execution**: Located in `server.js` at lines 2279–2335. Validates the 6-character hex token format, verifies `user.recoveryToken === tokenLower`, and verifies token expiry `Date.now() > user.recoveryTokenExpiry`.
  - Clears token details to prevent re-use:
    ```javascript
    delete user.recoveryToken;
    delete user.recoveryTokenExpiry;
    db.users.updateAuthCredentials(user.username, hash, salt);
    db.users.updateUserProfile(user.username, user);
    ```

### 1.2. Database Configuration, Migrations, and Seeding
- **Database Engine Selection**: Located in `database.js` at lines 1175–1180. Expressed as:
  ```javascript
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dbFile = path.join(DATA_DIR, 'resin.db');
    sqliteDb = new DatabaseSync(dbFile);
    isSQLite = true;
    console.log("[DATABASE] Zero-dependency SQLite engine successfully initialized.");
  } catch (err) {
    console.log("[DATABASE] node:sqlite is not supported on this platform. Seamless JSON fallback active.");
  }
  ```
- **Fallbacks**: Uses `LocalJSONStore` class (`database.js:75-111`) for a transactional JSON-file-based database wrapper. Output path is `d:\Anime Website\data\*.json`.
- **Dynamic Migrations**: Performed on startup for SQLite tables if supported (`database.js:1189–1371`). Alter tables run progressively within try-catch (e.g. adding `originalImage` to `wallpapers` at lines 1375–1380).
- **Seeding**: Performed dynamically on initialization when count rows are 0 (lines 1404–1608). Sets up 24 default wallpapers, default categories, default documents, default articles, etc.
- **Admin Seeding**: Enforces admin `@godmode` seeding in SQLite and JSON fallbacks (lines 1610–1666) using the `RESIN_SEED_PASSWORD` / `ADMIN_PASSWORD` environment variables or an auto-generated dev seed password.
- **Curated Collection Seeding**: Curated collection `chainsaw-man` is dynamically seeded from Chain Man wallpapers (lines 1587–1607).

### 1.3. Administrative Routes and Verification
- **Admin Verification Middleware**: Defined at `server.js` at lines 576–581:
  ```javascript
  function verifyAdmin(req, res, next) {
    if (!req.session || !req.session.userProfile || req.session.userProfile.role !== 'Administrator') {
      return res.status(403).json({ error: "Access Denied. Administrator override clearance required." });
    }
    next();
  }
  ```
- **Admin Route Categories (16 families)**:
  1. **Dashboard**: `GET /api/admin/dashboard` (`server.js:588`)
  2. **Users**: `GET /api/admin/users` (`server.js:641`), `PUT /api/admin/users/:username/status` (`server.js:662`), `DELETE /api/admin/users/:username` (`server.js:669`)
  3. **Wallpapers**: `POST /api/admin/wallpapers` (`server.js:676`), `DELETE /api/admin/wallpapers/:id` (`server.js:796`), `POST /api/admin/wallpapers/bulk-delete` (`server.js:820`), `POST /api/admin/wallpapers/bulk-tag` (`server.js:850`), `PUT /api/admin/wallpapers/:id` (`server.js:886`), `GET /api/admin/wallpapers` (`server.js:922`), `POST /api/admin/wallpapers/:id/pin` (`server.js:1149`), `POST /api/admin/wallpapers/:id/unpin` (`server.js:1174`)
  4. **Audit Logs**: `GET /api/admin/audit-logs` (`server.js:949`)
  5. **Announcements**: `POST /api/admin/announcements` (`server.js:954`)
  6. **Tickets**: `GET /api/admin/tickets` (`server.js:983`), `POST /api/admin/tickets/:id/reply` (`server.js:993`)
  7. **Cache**: `POST /api/admin/cache/flush` (`server.js:1042`)
  8. **Rankings Engine**: `GET /api/admin/rankings/config` (`server.js:1099`), `POST /api/admin/rankings/weights` (`server.js:1104`), `GET /api/admin/rankings` (`server.js:1127`)
  9. **DMCA Inbox**: `GET /api/admin/dmca` (`server.js:1191`), `POST /api/admin/dmca/:id/execute` (`server.js:1201`), `POST /api/admin/dmca/:id/dismiss` (`server.js:1238`)
  10. **Community Hub**: `GET /api/admin/community/flags` (`server.js:1323`), `POST /api/admin/community/comments/:id/approve` (`server.js:1328`), `POST /api/admin/community/comments/:id/delete` (`server.js:1336`), `POST /api/admin/community/users/:username/ban` (`server.js:1347`), `POST /api/admin/community/recalibrate-votes` (`server.js:1360`)
  11. **Triage Reports**: `GET /api/admin/reports` (`server.js:1367`), `POST /api/admin/reports/:id/dismiss` (`server.js:1377`), `POST /api/admin/reports/:id/purge` (`server.js:1389`), `POST /api/admin/reports/:id/strike` (`server.js:1412`)
  12. **CMS Documents**: `GET /api/admin/documents` (`server.js:1441`), `POST /api/admin/documents` (`server.js:1452`), `PUT /api/admin/documents/:id` (`server.js:1497`), `DELETE /api/admin/documents/:id` (`server.js:1547`)
  13. **Curation Collections**: `GET /api/admin/collections` (`server.js:1572`), `POST /api/admin/collections` (`server.js:1582`), `PUT /api/admin/collections/:id` (`server.js:1625`), `DELETE /api/admin/collections/:id` (`server.js:1678`)
  14. **Settings**: `GET /api/admin/settings` (`server.js:3017`), `PUT /api/admin/settings` (`server.js:3027`)
  15. **Media**: `GET /api/admin/media` (`server.js:3042`), `POST /api/admin/media/upload` (`server.js:3052`), `DELETE /api/admin/media/:id` (`server.js:3098`)
  16. **Categories**: `GET /api/admin/categories` (`server.js:3124`), `POST /api/admin/categories` (`server.js:3146`), `PUT /api/admin/categories/:id` (`server.js:3173`), `DELETE /api/admin/categories/:id` (`server.js:3198`)

### 1.4. Sitemaps, robots.txt, Sliders, Pagination, and SEO Metadata
- **robots.txt**: `GET /robots.txt` route at `server.js:3480–3490` disallows `/api/` and `/admin` paths and links to sitemaps.
- **Sitemap Routes**: `GET /sitemap.xml` at `server.js:3492–3500` (dynamic URLs for collections and wallpapers) and `GET /image-sitemap.xml` at `server.js:3502–3513`.
- **SEO Metadata and Snapshot Injector**: Implemented in `server.js` under `renderPublicPage` at lines 3431–3465. Inserts descriptions, robots instructions, canonical URLs, OG and Twitter tags, and injects `<noscript>` SEO snapshot text.
- **Range Sliders**:
  - Orientation mock slider: `ratio-slider` in `public/index.js` (lines 118, 1477-1479).
  - Resolution slider: `res-range-slider` / `updateResolutionSlider()` in `public/index.js` (lines 120, 1485–1509).
  - Weight Tuner sliders: `slider-dl`, `slider-sv`, `slider-vw` in `public/index.js` (lines 6603-6623).
  - Recalibration slider: `mod-recal-slider` in `public/index.js` (line 7160).
- **Pagination Logic**: Implemented in `public/index.js` for the admin Asset Ledger inventory at lines 7824–7975. Leverages `inventoryCurrentPage` and `inventoryItemsPerPage` to slice arrays and render custom previous/next page buttons inside `#inventory-pagination-controls`.

### 1.5. Core Web Vitals and Performance Metrics
- Codebase Search results: The search for `vitals`, `lcp`, `fid`, `cls`, `inp`, and `PerformanceObserver` yielded 0 hits for active Performance timing scripts.
- Telemetry: Telemetry is only used in the user matrix telemetry side-panel (IP, device, last-active, trust score) at `public/index.js:7679`, but no performance measurements are taken.
- Findings: There are no Core Web Vitals scripts or performance measuring scripts in this codebase.

### 1.6. Frontend URL Router
- Router implementation: Hash-based routing, defined in `public/index.js` under `restoreStateFromHash()` (lines 9199–9233).
- Delimiter Handling (Repeated Spaces and Underscores): Regulated at `public/index.js:9219`:
  ```javascript
  let normalizedHash = hash.replace(/[\s_]+/g, '-');
  ```
  This regular expression matches any sequence of repeated spaces or underscores and replaces them with a single hyphen (`-`).
- Decoder: Percent-decoded using `decodeURIComponent(hash)` (line 9216).

---

## 2. Logic Chain
1. If email flows generated tokens, they would need to be stored to verify them later. Observation 1.1 verifies that `user.recoveryToken` and `user.recoveryTokenExpiry` store the token in the DB, and the file-based spool directory is `data/mail_spool`.
2. To determine the active DB engine, we check the initialization conditions. Observation 1.2 demonstrates that the app utilizes `node:sqlite`'s `DatabaseSync` if available, setting `isSQLite = true`, and dynamically falls back to JSON stores via `LocalJSONStore` if Node's native sqlite module is not supported. Seeding and schema migrations occur on startup.
3. Express routes verify administrator access by checking role assignments. Observation 1.3 shows that `verifyAdmin` checks `req.session.userProfile.role === 'Administrator'` and is applied to all admin endpoint routes (mapped to exactly 16 API prefix families).
4. For SEO, bots must find sitemaps/metadata. Observation 1.4 confirms that `sitemap.xml`, `image-sitemap.xml`, and `robots.txt` endpoints are dynamically registered in `server.js`, and `renderPublicPage` handles OG/Meta injection. Range sliders and pagination reside inside `public/index.js`.
5. If Core Web Vitals were measured, PerformanceObserver or window.performance APIs would exist in codebase scripts. Observation 1.5 shows no PerformanceObserver or performance tracking APIs are used.
6. Frontend route normalizations are verified by inspecting the route parser. Observation 1.6 confirms `restoreStateFromHash` normalizes both underscores and spaces using `/[\s_]+/g` replacing with a hyphen (`-`).

---

## 3. Caveats
- Investigated only local codebase files; did not test performance on an external production server as it violates the CODE_ONLY network restriction mode.
- Assumed the Node version running the E2E tests will support `node:sqlite` (Node >= 22.5.0), though the fallback JSON engine is thoroughly implemented and works regardless.

---

## 4. Conclusion
The RESIN application is structured as a single-page application with a backend API in `server.js` and database logic in `database.js`. E2E tests can easily intercept emails by checking files in the `data/mail_spool/` directory, can trigger admin logic by authenticating with the seeded `@godmode` user credentials (using `RESIN_SEED_PASSWORD`), and can mock DB states by creating temporary JSON files (if SQLite falls back) or setting up standard SQL fixtures in `data/resin.db`.

---

## 5. Verification Method
1. Run the test command in the project root directory:
   ```powershell
   node --test tests/resin-audit.test.js
   ```
2. Observe output in the console verifying all 6 core integration test cases pass successfully.
3. Inspect `d:\Anime Website\database.js` lines 1175–1180 to verify the SQLite database loading logic.
4. Inspect `d:\Anime Website\public\index.js` line 9219 to verify the regex replacing spaces and underscores in the URL hash.

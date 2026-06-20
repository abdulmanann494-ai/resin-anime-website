# Handoff Report — explorer_m1_3

## 1. Observation

### Database Setup
1. **Password Hashing (SEC-001)**: `database.js` imports `bcryptjs` on line 4 (`const bcrypt = require('bcryptjs');`) and performs bcrypt hashing on line 48 (`return { salt: null, hash: bcrypt.hashSync(password, BCRYPT_ROUNDS) };`). On login in `server.js:2035`, it detects if user credentials require rehashing (`if (db.needsPasswordRehash(user.salt, user.passwordHash))`) and upgrades them to bcrypt transparently.
2. **SQL Parameterization (SEC-008)**: Direct database update queries in `database.js` are fully parameterized using static column statements. Property keys are filtered against explicit whitelists. For example, in `updateDocument` (`database.js:2190-2191`):
   ```javascript
   const allowed = ['title', 'author', 'status', 'lastModified', 'content', 'coverAsset', 'urlSlug', 'excerpt', 'tags'];
   const safeUpdates = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
   ```
3. **Node/SQLite Pinning (DB-001)**: `package.json` contains:
   ```json
   "engines": {
     "node": ">=23.11.0 <24"
   }
   ```
4. **Active SQLite Walpaper Count (DB-003)**: Running `node scratch/check_wallpapers.js` outputs:
   ```
   TOTAL WALLPAPERS IN SQLITE: 24
   ```

### Email and Forgot/Reset Flow
1. **Password Reset Tokens (EMAIL-001)**: Password resets in `server.js:2108-2111` generate a 6-character hex token with a 15-minute expiration timestamp:
   ```javascript
   const token = crypto.randomBytes(3).toString('hex').toLowerCase();
   const expiry = Date.now() + 15 * 60 * 1000;
   ```
   Upon reset completion in `server.js:2321-2322`, the token properties are cleared to prevent reuse:
   ```javascript
   delete user.recoveryToken;
   delete user.recoveryTokenExpiry;
   ```
   No signup email verification flow exists; the user profile is immediately initialized upon signup.

### Test Setup and CSRF
1. **CSRF Protection (SEC-010)**: `server.js:541-552` implements CSRF protection for all `/api/` write methods:
   ```javascript
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
   ```
2. **Automated test script (TEST-001)**: `package.json` contains `"test": "node --test tests/*.test.js"`.
3. **Test Execution Result**: Running `npm test` successfully executes the suite in `tests/resin-audit.test.js`, yielding:
   ```
   ✔ clean seed creates expected data with bcrypt password storage (10112.6022ms)
   ✔ CSRF, session rotation, and mass assignment protections work (2337.3514ms)
   ✔ all admin endpoints reject a normal user (1816.3171ms)
   ✔ admin mutations perform DB actions and write audit logs (1291.3658ms)
   ✔ crawlable public routes expose SEO metadata and sitemaps (189.1267ms)
   ✔ frontend router handles repeated spaces and underscores (27.0181ms)
   ℹ tests 6
   ℹ suites 0
   ℹ pass 6
   ℹ fail 0
   ```

### Scratch Scripts
1. **Scratch API Scripts failure**: The HTTP API testing scripts `test_admin_routes.js`, `test_all_endpoints.js`, `query_users.js`, and `simulate_publish.js` do not retrieve or send CSRF tokens when logging in or making state-changing requests. For instance, in `scratch/test_admin_routes.js` line 69:
   ```javascript
   const loginRes = await postJson('http://localhost:3000/api/auth/login', {
     email: 'admin@resin.app',
     password: TEST_PASSWORD
   });
   ```
   Since no `X-CSRF-Token` header is present in `postJson`, the backend blocks the login with 403 Forbidden.

---

## 2. Logic Chain

1. **Bcrypt and SQL Parameterization**: The codebase has successfully replaced PBKDF2 with bcrypt (with auto-migration on login) and whitelisted/parameterized all update statements in `database.js`. This resolves `SEC-001` and `SEC-008` (contrary to the old report findings in `AUDIT_REPORT.md`).
2. **Engines Pinning**: The `engines` pin added to `package.json` enforces the Node environment constraint, resolving `DB-001`.
3. **CSRF Protection & Scratch Scripts**: Mounting the `csrfProtection` middleware in `server.js` secures the API but causes all legacy scratch test scripts (`test_admin_routes.js`, `test_all_endpoints.js`, `query_users.js`, `simulate_publish.js`) to break. This is because these scripts perform login POST actions without retrieving a CSRF token first.
4. **Password Reset Security**: The forgot/reset password flow is secure (tokens are single-use, 15-minute expiry, spooled to `data/mail_spool/`), but user signups do not require email verification.
5. **Robust Test Suite**: The automated test suite `tests/resin-audit.test.js` successfully covers CSRF, mass assignment, role-gating, audit logging, SEO headers, and sitemaps.

---

## 3. Caveats

- We assumed that the local Node executable supports the experimental `node:sqlite` feature (which it does, version `v23.11.0`).
- The `SESSION_SECRET` key is hardcoded in the local `.env` file. While it is ignored by `.gitignore` (which is present and working, contrary to `AUDIT_REPORT.md`), keeping secrets in `.env` inside the workspace root remains a minor risk.
- We did not implement code fixes, as our task is strictly read-only.

---

## 4. Conclusion

The audit status of RESIN is **significantly improved** compared to the baseline `AUDIT_REPORT.md`:
- **Database**: 100% parameterized with whitelists, Node compatibility pinned, passwords utilize bcrypt with automatic legacy PBKDF2 migration.
- **Email**: Single-use password reset tokens with 15-minute expiry are fully implemented. Email verification on signup is still missing.
- **Test Setup**: `npm test` runs a highly thorough native Node.js test suite (`tests/resin-audit.test.js`) which runs and passes 100%.

### Fix Strategies for Scratch Scripts
To make the existing scratch scripts functional, they must be updated to retrieve a CSRF token:
1. Make a GET request to `/api/csrf-token` to retrieve `{ csrfToken }`.
2. Extract the `Set-Cookie` header to establish the session.
3. For all subsequent POST/PUT/DELETE API requests (including `/api/auth/login`), attach the `X-CSRF-Token` header containing the retrieved token, and pass the session cookie.

---

## 5. Verification Method

To independently verify this report:
1. Run `npm test` to confirm all security, database, and SEO tests pass.
2. Run `node scratch/check_wallpapers.js` to verify raw SQLite query output.
3. Run `node scratch/test_admin_routes.js` to observe the 403 Forbidden failure caused by the lack of CSRF token headers.

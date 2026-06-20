## 2026-06-20T01:23:24Z
You are a Worker Agent. Your task is to implement the E2E Test Suite for RESIN in `tests/e2e.test.js`.

Requirements:
1. The test suite must use Node's native `node:test` and `node:assert/strict` modules.
2. It must spawn the RESIN server (`server.js` using `child_process.spawn`) under an isolated port (e.g. 3200) and an isolated `RESIN_DATA_DIR` (using a temporary folder via `fs.mkdtempSync`), similar to how it is done in `tests/resin-audit.test.js`.
3. It must clean up by killing the server in a `test.after()` hook.
4. It must implement exactly 93 distinct test cases grouped by Tiers as defined below (do not skip any tests, do not use dummy implementations):
   - Tier 1: Feature Coverage (40 tests, 5 per feature F1 to F8)
   - Tier 2: Boundary & Edge Cases (40 tests, 5 per feature F1 to F8)
   - Tier 3: Cross-Feature Combinations (8 tests)
   - Tier 4: Real-world Workloads (5 tests)
5. Verify your test file syntax and execute the tests against the current server to see what passes and what fails. Note that some tests might fail if features are not yet implemented/fixed in the codebase — this is normal and expected for a test suite before implementation.
6. Return a handoff report `handoff.md` detailing:
   - What tests were implemented (the exact list).
   - How they are structured.
   - The test run execution output.
   - Which tests passed, which failed, and the reasons for failure (expected vs actual).

Here is the exact catalog of the 93 tests to implement:

### Tier 1: Feature Coverage (5 per feature = 40 tests)
- **F1: User Authentication & Session Management**
  - 1. Signup standard user.
  - 2. Login standard user.
  - 3. Session cookie has secure flags (e.g., httpOnly).
  - 4. Session ID rotates on login (cookie value changes).
  - 5. Logout destroys session.
- **F2: Access Control & Admin Gating**
  - 6. Admin route /api/admin/dashboard blocks unauthenticated requests.
  - 7. Admin route /api/admin/dashboard blocks standard member requests.
  - 8. Admin route /api/admin/dashboard allows administrator requests.
  - 9. Admin route /api/admin/users blocks standard member requests.
  - 10. Admin route /api/admin/settings blocks standard member requests.
- **F3: Input Protection & Data Integrity**
  - 11. Mutating POST requires CSRF token.
  - 12. Mutating PUT requires CSRF token.
  - 13. Mutating DELETE requires CSRF token.
  - 14. SQL Injection payload in lookup routes is safely parameterized (doesn't execute SQL).
  - 15. Mass assignment check: signup role parameter is ignored or set to Standard Member.
- **F4: Rate Limiting & Media Ingestion**
  - 16. Auth rate limit blocks excessive signups.
  - 17. Media upload rejects files above limit (50MB).
  - 18. Media upload accepts valid image uploads.
  - 19. Media upload strips EXIF metadata (metadata is blank/removed).
  - 20. Write rate limit blocks excessive writes.
- **F5: SEO, Crawlability & Sitemaps**
  - 21. Home page renders SEO meta tags.
  - 22. Individual wallpaper path renders unique SEO tags.
  - 23. sitemap.xml exists and lists valid URLs.
  - 24. image-sitemap.xml lists image assets.
  - 25. robots.txt is present and directs to sitemap.xml.
- **F6: Frontend Router & Client UX**
  - 26. Router supports URL with spaces.
  - 27. Router supports URL with underscores.
  - 28. Image parser handles fallback extensions.
  - 29. Range sliders reflect default values in index.js.
  - 30. Mobile view checks viewport responsive triggers.
- **F7: Performance & Quality Metrics**
  - 31. Home feed lists initial batch of wallpapers.
  - 32. Home feed pagination loads next batch.
  - 33. Programmatic Core Web Vitals script output format check.
  - 34. Performance endpoint reports response times.
  - 35. Cache flush clears memory/db cache segments.
- **F8: Interactive Workflows & Infrastructure**
  - 36. Keyboard alternative focus checks.
  - 37. Modal focus trap behaves correctly.
  - 38. Simplified English copy check for UI text files.
  - 39. Email token generated for password reset.
  - 40. Database schema is seeded and verified.

### Tier 2: Boundary & Edge Cases (5 per feature = 40 tests)
- **F1: User Authentication & Session Management**
  - 41. Signup with blank email/password.
  - 42. Login with incorrect password.
  - 43. Signup with already-registered email.
  - 44. Google OAuth mock verification with malformed code.
  - 45. Cookie validation with invalid signature.
- **F2: Access Control & Admin Gating**
  - 46. Gating blocks admin actions even if role is passed in request body.
  - 47. User modification route gates IDOR (non-admin editing another user).
  - 48. Delete ticket blocks standard user.
  - 49. Pin wallpaper blocks standard user.
  - 50. Recalibrate votes blocks standard user.
- **F3: Input Protection & Data Integrity**
  - 51. Mutating POST with expired CSRF token.
  - 52. Mutating POST with missing CSRF header but valid token in cookie.
  - 53. SQL injection payload using UNION/sleep in search query.
  - 54. Mass assignment try to overwrite user profile fields (e.g. role).
  - 55. Output escaping tags check in comments input (XSS).
- **F4: Rate Limiting & Media Ingestion**
  - 56. Rate limiter recovery (cooldown period expiration).
  - 57. Upload file with invalid image magic bytes (e.g. txt renamed to png).
  - 58. Upload empty media file payload.
  - 59. EXIF stripping check with corrupted EXIF headers.
  - 60. Max auth rate limit boundary check.
- **F5: SEO, Crawlability & Sitemaps**
  - 61. Sitemap url limit check.
  - 62. Canonical tag dynamic path validation on nested public pages.
  - 63. HTML contains semantic tags (main, header, footer).
  - 64. Crawlability fallback response check when JS disabled.
  - 65. OpenGraph tag default fallbacks for missing wallpaper data.
- **F6: Frontend Router & Client UX**
  - 66. Router handles consecutive multiple spaces/underscores.
  - 67. Slider boundary value testing (min/max bounds).
  - 68. Image fallback when src is completely broken.
  - 69. Missing category route renders error 404.
  - 70. Navigation history back/forward state preservation.
- **F7: Performance & Quality Metrics**
  - 71. Feed pagination when database has zero wallpapers.
  - 72. CWV script runs with network throttling simulation.
  - 73. Cache flush on non-existent segments.
  - 74. CWV script error handling when server is offline.
  - 75. Database performance under concurrent read load.
- **F8: Interactive Workflows & Infrastructure**
  - 76. Password reset token reuse block (must fail after one use).
  - 77. Password reset token expiration (must fail after threshold time).
  - 78. Focus trap behavior on multiple open modals.
  - 79. Database persistence verification on server reboot.
  - 80. Content copy parsing for complex sentences.

### Tier 3: Cross-Feature Combinations (8 tests)
- 81. Authenticate standard user, try mutating admin database configuration with SQL injection.
- 82. CSRF mutation combined with session hijack attempt (reusing session cookie on another IP/user-agent).
- 83. Image upload with XSS payload in EXIF description field.
- 84. Mass assignment attempt in profile update while triggering write rate limiting.
- 85. Password reset workflow: request reset -> receive token -> edit user email via IDOR before using token -> attempt to use token.
- 86. Crawl feed under pagination while authenticating and checking performance metrics.
- 87. SEO tags dynamic updates during client router navigation state changes.
- 88. Focus trap validation while submitting an upload modal that fails server-side mime validation.

### Tier 4: Real-world Workloads (5 tests)
- 89. Multi-user concurrent wallpaper feed browsing, search, and pagination simulation.
- 90. Standard user signup -> login -> browsing feed -> adding wallpapers to favorites -> update profile -> logout.
- 91. Administrator login -> browse tickets -> reply to ticket -> upload wallpaper -> update site settings -> verify audit log entries.
- 92. Password recovery workflow: user forgets password -> requests token -> receives email mock spool -> resets password -> logs in with new password -> verifies previous password fails.
- 93. Full DMCA workflow: copyright holder files DMCA request -> Administrator reviews DMCA queue -> Administrator executes DMCA takedown -> verification that wallpaper is hidden from public feed but audit logged.

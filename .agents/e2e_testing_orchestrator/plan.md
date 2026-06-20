# E2E Test Suite Plan for RESIN

This document outlines the plan for designing, implementing, and running a comprehensive, opaque-box E2E test suite for RESIN.

## 1. Feature Definitions (F1 to F8)

Based on the requirements in `ORIGINAL_REQUEST.md`, we define the following 8 core features of RESIN to be covered by the E2E test suite:

- **F1: User Authentication & Session Management**
  - Sign up, login, session validation, logout.
  - Session ID rotation on login.
  - Secure session cookies (`httpOnly`, `secure` (production mode check), `sameSite=lax|strict`).
  - Google OAuth mock integration.
- **F2: Access Control & Admin Gating**
  - Strict gating of all 16 admin routes (returns 401/403 for unauthorized requests).
  - Validation of roles (e.g., Administrator vs Standard Member).
- **F3: Input Protection & Data Integrity**
  - Parameterized SQL queries to prevent SQL injection.
  - Mass assignment prevention (unauthorized role promotion or admin privilege changes).
  - CSRF validation on mutating POST/PUT/DELETE requests.
  - Output escaping/sanitization to prevent XSS.
- **F4: Rate Limiting & Media Ingestion**
  - Auth rate limiting (login/signup), write rate limiting, global rate limiting.
  - Secure media upload validation (mimeType checks, size limits, EXIF metadata stripping).
- **F5: SEO, Crawlability & Sitemaps**
  - Crawlable URLs/static fallbacks/SSR-like meta tags for public pages & wallpapers without JS rendering dependency.
  - Unique titles, descriptions, canonical links, and OG/Twitter tags on public routes.
  - Sitemaps (`sitemap.xml`, `image-sitemap.xml`) and `robots.txt` compliance.
- **F6: Frontend Router & Client UX**
  - SPA client-side hash router handling (spaces, underscores, symbols).
  - Image extension fallbacks (if format parsing fails).
  - Functional range sliders updating in UI.
  - Responsive layout visibility triggers.
- **F7: Performance & Quality Metrics**
  - Home feed pagination/lazy-loading logic.
  - Programmatic Core Web Vitals measurement (LCP, CLS, INP) output verification.
- **F8: Interactive Workflows & Infrastructure**
  - Keyboard accessibility & modal focus trapping.
  - Copy editing validation (simplified English copy throughout).
  - Mock email transport layer verification (expiration/one-time use of password reset/verification tokens).
  - Database persistence across restarts (schema integrity, seed passwords, weights persistence).

---

## 2. Test Suite Architecture & Tiers

We will use Node's native test runner (`node:test`) and assertion library (`node:assert`) as specified in the project. This allows seamless integration into `npm test`.

### Mock Layers
- **Email Transport**: Mock the mail service to intercept reset/verification tokens, validating expiration and reuse.
- **Environment**: Use configurable environment variables (like `PORT`, `RESIN_DATA_DIR`, and `SESSION_SECRET`) to test isolation.

### Minimum Targets:
- **Tier 1 (Feature Coverage)**: >= 40 tests (>=5 per feature)
- **Tier 2 (Boundary & Edge Cases)**: >= 40 tests (>=5 per feature)
- **Tier 3 (Cross-Feature Combinations)**: >= 8 tests
- **Tier 4 (Real-world Workloads)**: >= 5 tests
- **Total Minimum**: 93 tests

---

## 3. Test Cases Catalog

### Tier 1: Feature Coverage (5 per feature = 40 tests)
- **F1: User Authentication & Session Management**
  - 1. Signup standard user.
  - 2. Login standard user.
  - 3. Session cookie has secure flags.
  - 4. Session ID rotates on login.
  - 5. Logout destroys session.
- **F2: Access Control & Admin Gating**
  - 6. Admin routes block unauthenticated requests.
  - 7. Admin routes block standard member requests.
  - 8. Admin routes allow administrator requests.
  - 9. Route gating covers user list.
  - 10. Route gating covers settings update.
- **F3: Input Protection & Data Integrity**
  - 11. Mutating POST requires CSRF token.
  - 12. Mutating PUT requires CSRF token.
  - 13. Mutating DELETE requires CSRF token.
  - 14. SQL Injection fails on lookup routes.
  - 15. Mass assignment prevented during signup.
- **F4: Rate Limiting & Media Ingestion**
  - 16. Auth rate limit blocks excessive signups.
  - 17. Media upload rejects files above limit (50MB).
  - 18. Media upload accepts valid image uploads.
  - 19. Media upload strips EXIF metadata.
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
  - 29. Range sliders reflect default values.
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

### Tier 3: Cross-Feature Combinations (>= 8 tests)
- 81. Authenticate standard user, try mutating admin database configuration with SQL injection.
- 82. CSRF mutation combined with session hijack attempt (reusing session cookie on another IP/user-agent).
- 83. Image upload with XSS payload in EXIF description field.
- 84. Mass assignment attempt in profile update while triggering write rate limiting.
- 85. Password reset workflow: request reset -> receive token -> edit user email via IDOR before using token -> attempt to use token.
- 86. Crawl feed under pagination while authenticating and checking performance metrics.
- 87. SEO tags dynamic updates during client router navigation state changes.
- 88. Focus trap validation while submitting an upload modal that fails server-side mime validation.

### Tier 4: Real-world Workloads (>= 5 tests)
- 89. Multi-user concurrent wallpaper feed browsing, search, and pagination simulation.
- 90. Standard user signup -> login -> browsing feed -> adding wallpapers to favorites -> update profile -> logout.
- 91. Administrator login -> browse tickets -> reply to ticket -> upload wallpaper -> update site settings -> verify audit log entries.
- 92. Password recovery workflow: user forgets password -> requests token -> receives email mock spool -> resets password -> logs in with new password -> verifies previous password fails.
- 93. Full DMCA workflow: copyright holder files DMCA request -> Administrator reviews DMCA queue -> Administrator executes DMCA takedown -> verification that wallpaper is hidden from public feed but audit logged.

---

## 4. Execution Plan
1. **Phase 1**: Set up E2E Test Suite infrastructure (e.g. `tests/e2e-suite.test.js`) and mock layers.
2. **Phase 2**: Implement Tier 1 (40 tests).
3. **Phase 3**: Implement Tier 2 (40 tests).
4. **Phase 4**: Implement Tier 3 (8 tests) and Tier 4 (5 tests).
5. **Phase 5**: Verify test runner executions, output metrics, and publish files.

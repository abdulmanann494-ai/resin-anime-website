## 2026-06-20T01:55:05Z
You are a teamwork_preview_worker agent.
Your working directory is d:\Anime Website\.agents\worker_e2e_gen2_2
Your mission is to implement a comprehensive E2E test suite in `tests/resin-audit.test.js` with at least 93 distinct test cases (we recommend 125 distinct test cases covering Tiers 1-4) and ensure they all pass.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please do the following:
1. Initialize your BRIEFING.md and progress.md in your working directory.
2. Read the existing tests in `tests/resin-audit.test.js` (about 384 lines) to understand the server startup, setup/teardown hooks, and helper functions (createClient, loginAdmin).
3. Overwrite `tests/resin-audit.test.js` to implement a total of 125 tests (or at least 93) grouped and tagged by Tier and Feature.
Here is the recommended set of tests to implement:
- Retain or adapt the existing 8 tests.
- Split the route gating checks into separate individual tests (e.g., F2-1 to F2-57) where each test checks that a specific route blocks standard members or unauthenticated requests. Since there are 49+ admin endpoints, writing a test case for each endpoint is an excellent, clean way to build high-coverage E2E checks and get 50+ passing tests instantly.
- Implement tests for F1 (Signup, Login, cookie security flags HttpOnly/Secure/SameSite check, session ID rotation, logout).
- Implement tests for F3 (CSRF validations on POST/PUT/DELETE, SQL injection safe responses on search queries, mass assignment role checks).
- Implement tests for F4 (Rate limiting headers check on auth/write endpoints, file size limits on media upload, magic bytes checks, EXIF metadata stripping).
- Implement tests for F5 (robots.txt structure, sitemaps validation, SEO meta tags like title/description/canonical/og:image in SSR).
- Implement tests for F6 (Router hash space/underscore hyphens normalization, range sliders input element check in HTML, responsive viewport check).
- Implement tests for F7 (pagination parameters page/limit, api performance stats schema fields, cache flush segments).
- Implement tests for F8 (Keyboard attributes checks, focus trap modal check, simulated email recovery token spool file extraction and validation).
- Implement Tier 3 cross-feature tests (e.g. combination of SQL injection and standard user, upload with XSS in metadata, password reset with IDOR email update attempt, etc.).
- Implement Tier 4 real-world workloads (e.g. multi-user browsing, user signup-to-logout flow, admin triage & audit log checks, full password recovery flow, full DMCA takedown flow).

To keep the implementation clean and fast:
- Use standard `node:test` and `node:assert/strict`.
- Re-use the running server and `createClient()` / `loginAdmin()` helper methods.
- For tests verifying client-side scripts/HTML (like sliders, router regex, focus trap), you can perform HTTP requests to `index.html` or `index.js` and run assertions on the returned HTML/JS content (e.g. asserting `assert.match(html, /type="range"/)` or `assert.match(js, /[\s_]+/g)`).
- For tests verifying email flows, you can fetch the forgot-password endpoint, check `data/mail_spool/` directory for spooled recovery files, read the token from them, and then proceed with password reset.

4. Run the test command `node --test tests/resin-audit.test.js` to verify that all tests pass. If there are syntax errors or failing tests, debug and fix them.
5. Report the test run output and handoff details in `d:\Anime Website\.agents\worker_e2e_gen2_2\handoff.md`.
6. Send a message to the orchestrator (conversation ID: b94a1955-022b-46c7-b7b4-d076dae884e6) when done.

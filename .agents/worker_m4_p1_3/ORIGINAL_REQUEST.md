## 2026-06-19T21:01:19Z

Your identity: Worker 4 (archetype: teamwork_preview_worker)
Your working directory: d:\Anime Website\.agents\worker_m4_p1_3
Your task: Implement all Milestone 4 (P1) fixes for RESIN.

Specifically, make code edits to the codebase (server.js, public/index.js, public/index.html, and scratch/ scripts) to resolve:

1. SEC-003: Google Sign-in backend integration & frontend verification.
   - In server.js, implement a POST /api/auth/google endpoint that receives { credential, email, name }.
     * If credential is not present, return 400.
     * If credential is not 'mock-google-token-audit', return 401.
     * If email is not a valid email (e.g. doesn't contain '@'), return 400.
     * If valid, create a new user with standard member permissions and a secure bcrypt password hash (if it doesn't already exist). Then call regenerateSession(req, res, user) to log them in and rotate the session ID, returning { success: true, user: { email, role: 'Standard Member' } }.
   - In public/index.js, update handleGoogleAuthSubmit(name, email) and custom form submit to retrieve the CSRF token, perform a POST /api/auth/google request with the payload, and update the UI/session state on success.

2. SEC-012: Upload validation and metadata stripping.
   - Restructure POST /api/dmca/upload and POST /api/admin/media/upload in server.js to validate the uploaded image bytes against magic signature bytes using the existing detectImageType helper. Return 400 with "Invalid upload format" if validation fails.
   - Enforce a strict file size ceiling (e.g., 10MB) directly on the incoming data stream in the DMCA route.
   - Implement an EXIF and metadata stripping function:
     * For JPEG: Strip the APP1 segment (0xFFE1).
     * For PNG: Filter out chunks with names 'tEXt', 'zTXt', 'iTXt', 'eXIf', and 'iCCP'.
     * Run this metadata stripping function on all uploaded media and DMCA files before writing them to the filesystem.

3. SEO-005 (HTML/Server heading cleanup):
   - Remove the extra <h1> wrapper inside the <noscript> tag generated in server.js's sendPublicPage / renderPublicPage.
   - Ensure public templates do not render redundant <h1> elements.

4. SEO-007 / PERF-001: Image aspect ratio and layout shifts.
   - In public/index.js (under createWallpaperCard or card renders), explicitly set the 'width' and 'height' properties on the generated <img> tag based on aspect ratio to prevent CLS. Ensure loading="lazy" is also set.

5. Fix legacy scratch scripts in scratch/ folder:
   - Update test_admin_routes.js, test_all_endpoints.js, query_users.js, and simulate_publish.js so that they perform a GET /api/csrf-token first, parse the session cookie, and include the X-CSRF-Token header on all state-changing write requests.

6. Run the test suite using `npm test` and ensure all tests pass.
7. Write your progress.md and handoff.md in your working directory.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Provide a clear report and send a message back to the orchestrator (Conversation ID: 56529239-8bf3-4cf8-bb69-e96d384b6f6d) when done.

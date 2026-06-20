## 2026-06-20T01:27:06Z
Your identity: Worker 2 (archetype: teamwork_preview_worker)
Your working directory: d:\Anime Website\.agents\worker_m4_p1
Your task: Implement all Milestone 4 (P1) fixes for RESIN.

Specifically, you must make code edits to the codebase (server.js, public/index.js, public/index.html, and scratch/ scripts) to resolve:

1. SEC-003: Google Sign-in backend integration & frontend verification.
   - In server.js, implement a POST /api/auth/google-login endpoint that receives { idToken, name, email }. The route must validate these parameters, check if a user with the email exists, and if not, create a new user with standard member permissions and a secure bcrypt password hash. It must then call regenerateSession(req, res, user) to log them in and rotate the session ID, returning success.
   - In public/index.js, update handleGoogleAuthSubmit(name, email) and custom form submit to retrieve the CSRF token, perform a POST /api/auth/google-login request with the payload, and update the UI/session state on success (like closing overlays, showing user profile, reloading, etc.).

2. SEC-012: Upload validation and metadata stripping.
   - Restructure POST /api/dmca/upload and POST /api/admin/media/upload in server.js to validate the uploaded image bytes against magic signature bytes using the existing detectImageType helper.
   - Enforce a strict file size ceiling (e.g., 10MB) directly on the incoming data stream in the DMCA route (check buffer size).
   - Implement an EXIF and metadata stripping function:
     * For JPEG: Strip the APP1 segment (0xFFE1).
     * For PNG: Filter out chunks with names 'tEXt', 'zTXt', 'iTXt', 'eXIf', and 'iCCP'.
     * Run this metadata stripping function on all uploaded media and DMCA files before writing them to the filesystem.

3. SEO-005 (Part 1 - HTML/Server heading cleanup):
   - Remove the extra <h1> wrapper inside the <noscript> tag generated in server.js's sendPublicPage / renderPublicPage.
   - Ensure public templates do not render redundant <h1> elements.

4. SEO-007 / PERF-001: Image aspect ratio and layout shifts.
   - In public/index.js (under createWallpaperCard or card renders), explicitly set the 'width' and 'height' properties on the generated <img> tag based on aspect ratio (e.g., width=400 height=600 for portrait, width=600 height=400 for landscape) to prevent Cumulative Layout Shift (CLS). Ensure loading="lazy" is also set.

5. Fix legacy scratch scripts in scratch/ folder:
   - Update test_admin_routes.js, test_all_endpoints.js, query_users.js, and simulate_publish.js so that they perform a GET /api/csrf-token first, parse the session cookie, and include the X-CSRF-Token header on all state-changing write requests to prevent 403 Forbidden errors.

6. Run the test suite using `npm test` and ensure all tests continue to pass.
7. Write your progress.md and handoff.md in your working directory.

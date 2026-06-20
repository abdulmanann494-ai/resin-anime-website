# Original User Request

## 2026-06-19T20:13:17Z

Full pre-deployment audit and fix of RESIN, a public community platform for digital art and wallpapers. Address all issues tagged P0, P1, and P2 across security, SEO, build, performance, accessibility, content, and tests.

Working directory: `d:\Anime Website`
Integrity mode: development

## Requirements

### R1. Complete Codebase Mapping & Severity-Tagged Audit
Perform a complete audit of the codebase (`d:\Anime Website`). Tag all findings with:
- **P0**: Blocker (auth flaws, injection, missing CSRF on admin actions, secrets in repo, won't boot, uncrawable).
- **P1**: Critical (real security/SEO/UX damage).
- **P2**: Important (degrades quality).
- **P3**: Polish (nice-to-have).

Document the findings in `AUDIT_REPORT.md` following a strict format (severity, status [PASS/FAIL/MISSING], file+line, description, fix applied, evidence).

### R2. Resolve All P0, P1, and P2 Issues
Implement security, SEO, performance, accessibility, database compatibility, content, email flows, and test issues. P0s must be resolved first, then P1s, then P2s. P3s should be logged for future work.
- **Security**: Password hashing, secure sessions/cookies, role check gating on all 16 admin routes, IDOR/ownership controls, mass assignment prevention, parameterized SQL queries, output escaping for XSS, CSRF protection on POSTs, rate limiting, secure upload validation, security headers (Helmet), env vars for secrets, error leakage prevention.
- **SEO**: Crawlable URLs / static fallbacks / SSR-like meta tags for public pages & wallpapers, unique title/description, OG/Twitter tags, canonical links, semantic HTML, image SEO (alt, WebP format, sizes, lazy loading), sitemaps (`sitemap.xml`, `image-sitemap.xml`), and `robots.txt`.
- **Performance**: Paginate or lazy-load feed, measure/report Core Web Vitals (LCP, CLS, INP).
- **Frontend**: Router fixes, image extension parser fallback, responsive visibility, visible sliders.
- **Database/Deployment**: Node version compatibility, full schema matching, seed verification, ranking weights DB persistence, DB file persistence across deploys.
- **Accessibility**: Keyboard alternatives, focus trapping, WCAG AA contrast.
- **Content**: Simplified English copy throughout.
- **Email flows**: Reset/verify tokens.

### R3. Automated Testing and CI Validation
Fix the route validation script and ensure all 16 routes pass. Add automated tests for admin routes, critical behavior (router, image fallback, mobile visibility, auth gating, IDOR, CSRF). Ensure `npm test` runs the whole suite and exits 0 only when all tests pass.

## Acceptance Criteria

### Security & Access Control
- [ ] No plaintext/MD5/SHA1 passwords in DB (use bcrypt).
- [ ] All 16 admin routes strictly gated by admin check, returning 401/403 for unauthorized requests.
- [ ] CSRF validation enforced for all mutating POST/PUT/DELETE requests.
- [ ] Session ID rotates on login, and cookies are secure (`httpOnly`, `secure`, `sameSite=lax|strict`).
- [ ] SQL injection, mass assignment, and IDOR are prevented and verified via automated tests.

### SEO & Crawlability
- [ ] Crawlers can access unique, indexable URLs for public pages and individual wallpapers without JS rendering dependencies.
- [ ] Correct title, meta description, OG tags, and canonical links present on all public routes.
- [ ] `sitemap.xml`, `image-sitemap.xml`, and `robots.txt` exist and expose valid URLs.

### Performance & Quality
- [ ] Home feed is paginated or lazy-loaded.
- [ ] Range sliders are fully functional and update values on the screen.
- [ ] Core Web Vitals (LCP, CLS, INP) performance of the home feed is measured programmatically (e.g., using a script with Puppeteer or Lighthouse) to measure and output specific metric values.
- [ ] Simplified English copy updated across all UI strings.

### Email Flows
- [ ] Automated tests mock the email transport layer to verify password reset/verification tokens expire and cannot be reused.

### Test Coverage & Deploy Readiness
- [ ] `npm test` runs the full test suite and exits 0.
- [ ] `AUDIT_REPORT.md` is complete with all P0/P1/P2 items passing.
- [ ] `DEPLOY_READINESS.md` is populated with instructions for manual steps.

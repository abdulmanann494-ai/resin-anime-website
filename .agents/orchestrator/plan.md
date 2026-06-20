# RESIN Pre-Deployment Audit and Fix: Master Plan

## 1. Objectives & Scope
The objective is to perform a full pre-deployment audit and fix of RESIN (a digital art/wallpaper platform). All P0, P1, and P2 findings must pass, and the application must be verified as production-ready and secure.

## 2. Parallel Dual-Track Topology
We will use the Project Pattern with a dual-track architecture:
1. **E2E Testing Track**: Spawn a sub-orchestrator to design, implement, and verify a comprehensive, opaque-box E2E test suite covering features F1-F8. It will create `TEST_INFRA.md` and publish `TEST_READY.md`.
2. **Implementation Track**: Spawn subagents sequentially to address milestones:
   - **Milestone 1: Mapping & Base Audit** (Verification of existing codebase and files).
   - **Milestone 2: Security & Setup (P0)** (Password hashing, Session ID rotation/security, CSRF, Admin route gating, SQL injection, Mass assignment).
   - **Milestone 3: Functional & UX (P1)** (Google OAuth fallback verification, Output escaping/XSS, Rate limiting, Upload validation, Security headers, production error stack hiding, hash router, image fallback, emails, sitemaps/robots).
   - **Milestone 4: Performance & Quality (P2)** (Pagination, range sliders, CWV, Mobile CSS, keyboard shortcuts/focus trap, copy edits).
   - **Milestone 5: E2E Acceptance & Adversarial Hardening (Tier 5)** (Run full E2E suite, generate adversarial cases via Challengers, run Forensic Auditor).

---

## 3. Milestones Details

### Milestone 1: Base Audit Verification
*   **Objective**: Confirm the correctness of the initial mapping and setup.
*   **Role**: Explorer.
*   **Outputs**: Initial audit verification report.

### Milestone 2: E2E Test Suite Development (Parallel Track)
*   **Objective**: Generate E2E test suite covering Tiers 1-4.
*   **Role**: Sub-orchestrator (`self`) -> Workers, Challengers.
*   **Outputs**: `TEST_INFRA.md`, `TEST_READY.md` (min 93 test cases: 40 Tier 1, 40 Tier 2, 8 Tier 3, 5 Tier 4).

### Milestone 3: Resolve P0 Blockers
*   **Objective**: Fix the critical blockers:
    1. Bcrypt password hashing instead of 1000-iteration PBKDF2.
    2. Enforce CSRF protection on mutating POST/PUT/DELETE routes.
    3. Gate all 16 admin routes strictly with role verification.
    4. Remove `.env` secrets from repository and write proper `.gitignore`.
    5. Fully parameterize SQL (dynamic column name whitelisting).
*   **Role**: Worker (impl), Reviewers, Challenger.

### Milestone 4: Resolve P1 Issues
*   **Objective**: Fix high-priority bugs/vulnerabilities:
    1. Google OAuth backend mock/validation.
    2. Session cookie security (Secure, HttpOnly, SameSite, Max-Age) and session rotation on login/destroy.
    3. Input escaping / XSS protection.
    4. Safe rate limiters that don't block tests.
    5. Upload safety (magic bytes, EXIF metadata stripping).
    6. Helmet security headers configuration.
    7. Production environment setup (hide stack traces, HTTPS redirect).
    8. Router fixes (multiple spaces/hyphens).
    9. Sitemaps/robots.txt implementation.
    10. Dynamic SEO meta tags (title, description, canonical, OG/Twitter).
*   **Role**: Worker, Reviewers, Challenger.

### Milestone 5: Resolve P2 Issues
*   **Objective**: Fix medium-priority and quality issues:
    1. Feed pagination/lazy-loading.
    2. Dynamic range sliders.
    3. Core Web Vitals measurement script (using Puppeteer).
    4. Mobile/responsive CSS fixes.
    5. Accessibility focus trap (Esc, return-focus for modal).
    6. Simplified English copy check.
*   **Role**: Worker, Reviewers, Challenger.

### Milestone 6: Final Verification & Adversarial Auditing
*   **Objective**: Verify codebase against E2E test suite, perform Tier 5 adversarial testing, run Forensic Auditor.
*   **Role**: Challengers (adversarial test generation), Reviewers, Forensic Auditor.

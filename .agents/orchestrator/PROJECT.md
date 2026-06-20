# Project: RESIN Pre-Deployment Audit & Fix

## Architecture
RESIN is a single-process Node.js web application built with Express and SQLite (via Node's built-in `node:sqlite`).
- **Database Layer (`database.js`)**: Handles SQLite schema creation, data seeding, and provides synchronous/asynchronous data access methods.
- **Web Server Layer (`server.js`)**: Express server defining public views, admin subviews, user auth routes, and REST APIs.
- **Frontend SPA Client (`public/index.js`, `public/index.html`, `public/css/`)**: A Single Page Application using a client-side hash router (`#feed`, `#settings`, etc.) and dynamically rendering content using jQuery-like Vanilla JS.

---

## Code Layout
- `server.js` - Express application and routes.
- `database.js` - SQLite database initialization and APIs.
- `public/` - Public assets, HTML, CSS, client-side JavaScript.
  - `index.html` - Primary SPA template.
  - `index.js` - Client-side router and UI rendering.
- `tests/` - Test suites.
  - `resin-audit.test.js` - Main test file.
- `scratch/` - Utilities and scratch scripts for manual checks.
- `.env` - Environment configurations.
- `.gitignore` - Ignored paths.

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Base Audit | Review codebase and map all P0/P1/P2/P3 issues (IDs: 147ce2ee, d569ea2d, ef200544) | None | DONE |
| M2 | E2E Testing Track | Design and build comprehensive E2E test suite (Tiers 1-4) (ID: b94a1955) | None | IN_PROGRESS |
| M3 | Security & Setup (P0) | Resolve critical blockers (bcrypt, admin gating, SQL injection, CSRF protection, `.env` removal) (ID: 420f19bb) | M1 | DONE |
| M4 | Functional & UX (P1) | Resolve high-priority issues (Google OAuth, secure sessions, XSS, rate limiting, upload validation, Helmet headers, router fix, sitemaps, SEO tags) (ID: 53b07b7e) | M3 | IN_PROGRESS |
| M5 | Performance & Quality (P2) | Resolve quality issues (pagination, range sliders, CWV measurement, A11y focus trap, copy edit) | M4 | PLANNED |
| M6 | Acceptance & Hardening | E2E test validation, Tier 5 adversarial testing, Forensic Auditor pass | M2, M5 | PLANNED |

---

## Interface Contracts
### Client ↔ Server Auth
- `POST /api/auth/signup`: Create a standard member user.
- `POST /api/auth/login`: Authenticate and start a secure session (rotates session ID, sets secure cookie flags).
- `POST /api/auth/logout`: Terminate session, clear cookie.

### CSRF Protection
- `GET /api/csrf-token`: Returns `{ csrfToken: string }`.
- Mutating routes (`POST`, `PUT`, `DELETE`) require `X-CSRF-Token` header matching active session token.

### Admin Gating
- `verifyAdmin` middleware checks if `req.session.user` has `role === 'Administrator'`. Rejects non-admin with `401` or `403`.

# E2E Test Infra: RESIN Wallpaper Culture Platform

## Test Philosophy
- Opaque-box, requirement-driven. No direct dependency on implementation internals.
- Native Node.js Test Runner (`node:test`) and assertion library (`node:assert/strict`).
- Fully isolated execution: Spawns the Express server under a temporary directory `RESIN_DATA_DIR` and custom `PORT` (e.g., 3200) to verify database initialization, migrations, seeding, and session security in isolation.
- Structured mock layers:
  - **Email spooled files**: Read and parse recovery files spooled in `${RESIN_DATA_DIR}/mail_spool/` to extract and verify one-time tokens.
  - **Google OAuth**: Access mocked routing endpoints.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 (Coverage) | Tier 2 (Boundary) |
|---|---------|----------------------|:-----------------:|:-----------------:|
| F1| User Authentication & Sessions | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 |
| F2| Access Control & Admin Gating | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 |
| F3| Input Protection & Integrity | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 |
| F4| Rate Limiting & Media Ingest | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 |
| F5| SEO, Crawlability & Sitemaps | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 |
| F6| Single Page App & Router UX  | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 |
| F7| Performance & Quality Metrics| ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 |
| F8| Interactive Workflows & DB   | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 |

## Test Architecture
- **Runner**: Node.js built-in runner (`node --test tests/e2e.test.js`).
- **Isolation**: Each test suite runs within `test.before` and `test.after` brackets, creating temporary data directory and setting specific port/env.
- **Client Mocking**: Uses `fetch` and custom HTTP header injection (tracking cookies, X-CSRF-Token headers) to act as an opaque-box browser agent.
- **Directory Layout**:
  - `tests/e2e.test.js`: Contains all E2E test cases, grouped by test blocks and tagged with Tiers.

## Real-World Application Scenarios (Tier 4)
1. **Multi-user browse/search concurrency**: Simulates multiple clients requesting feed endpoints concurrently.
2. **End-to-End User Flow**: Signup -> login -> browse feed -> add favorite -> edit profile -> logout.
3. **Admin Operation Log Flow**: Admin login -> browse tickets -> reply to ticket -> upload wallpaper -> update config -> verify audit log entries.
4. **Password Reset Recovery E2E**: Forgot password -> extract spooled token -> verify old password fails -> reset password -> login with new password -> verify reuse fails.
5. **DMCA Takedown & Audit Trail**: User files DMCA -> Admin reviews queue -> Admin executes takedown -> verify wallpaper is hidden but audit logged.

## Coverage Thresholds
- Tier 1: >= 40 tests (5 per feature F1-F8)
- Tier 2: >= 40 tests (5 per feature F1-F8)
- Tier 3: >= 8 cross-feature integration tests
- Tier 4: >= 5 realistic workload application scenarios
- Total Target: 93 tests

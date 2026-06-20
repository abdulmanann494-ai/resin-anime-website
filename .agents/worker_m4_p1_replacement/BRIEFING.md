# BRIEFING — 2026-06-20T01:50:50Z

## Mission
Implement all Milestone 4 (P1) fixes for RESIN, including Google Sign-in integration, upload validation & metadata stripping, HTML/Server heading cleanup, image aspect ratio/layout shift corrections, and scratch script updates.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: d:\Anime Website\.agents\worker_m4_p1_replacement
- Original parent: 56529239-8bf3-4cf8-bb69-e96d384b6f6d
- Milestone: Milestone 4 (P1) fixes for RESIN

## 🔒 Key Constraints
- CODE_ONLY network mode: No external website/service queries. No run_command targeting external HTTP URLs.
- Follow minimal change principle: only modify what is necessary, no unrelated refactorings.
- DO NOT CHEAT: genuine implementations only, no dummy/facade code or hardcoding of test results.

## Current Parent
- Conversation ID: 56529239-8bf3-4cf8-bb69-e96d384b6f6d
- Updated: not yet

## Task Summary
- **What to build**: 
  1. SEC-003: Google Sign-in backend integration & frontend verification.
  2. SEC-012: Upload validation and metadata stripping (JPEG/PNG).
  3. SEO-005: HTML/Server heading cleanup (noscript and template check).
  4. SEO-007 / PERF-001: Image aspect ratio & layout shift correction (loading="lazy", width/height attributes).
  5. Fix legacy scratch scripts to retrieve and include CSRF token.
  6. Run `npm test` and verify.
- **Success criteria**: All tests pass successfully and all security/SEO enhancements are genuinely implemented.
- **Interface contracts**: server.js, public/index.js, public/index.html, and scratch/ scripts.
- **Code layout**: Project root, public/, and scratch/ folders.

## Key Decisions Made
- [TBD]

## Artifact Index
- [TBD]

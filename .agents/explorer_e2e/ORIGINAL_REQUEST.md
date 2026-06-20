## 2026-06-20T20:16:37Z
You are an Explorer. Your task is to investigate the RESIN codebase (d:\Anime Website) to understand how to design and write E2E tests for it.
Specifically:
1. Locate where email flows (signup, password reset, token generation, mail spooling) are implemented in server.js/database.js and how they store or expire tokens.
2. Verify how the database is configured (SQLite or JSON files, migrations, seeding, database.js).
3. Find all 16 admin routes and how admin verification is performed (e.g. session checking, roles).
4. Locate any sitemaps, robots.txt, range sliders, pagination logic, and SEO meta tags implementations.
5. Search for any existing Core Web Vitals scripts or how performance metrics are measured.
6. Check how the frontend router handles URLs (in public/index.js or public/index.html) and how it handles repeated spaces/underscores.
7. Write a detailed handoff report `handoff.md` in your working directory (d:\Anime Website\.agents\explorer_e2e) summarizing your findings with file paths and line numbers.

Verify everything. Do not implement anything.
Your working directory is d:\Anime Website\.agents\explorer_e2e.
Provide your findings in a clear handoff.md.

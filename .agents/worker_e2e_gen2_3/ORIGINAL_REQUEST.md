## 2026-06-20T02:00:31Z
You are a teamwork_preview_worker agent.
Your working directory is d:\Anime Website\.agents\worker_e2e_gen2_3
Your predecessor was worker_e2e_gen2_2 (conversation ID: 7856b6dc-e8f3-4c7b-937a-a48ca46dd426), which encountered a 503 capacity limit error and stopped execution after successfully writing a 1794-line test file `tests/resin-audit.test.js`.

Your mission is to:
1. Recover progress from `d:\Anime Website\.agents\worker_e2e_gen2_2\progress.md` and read the code in `tests/resin-audit.test.js`.
2. Initialize your own `BRIEFING.md` and `progress.md` in your working directory.
3. Run the test suite: `node --test tests/resin-audit.test.js`.
4. If there are syntax errors, runtime errors, or test failures, investigate and correct them in `tests/resin-audit.test.js`. Do not cheat or bypass any assertions. Ensure that at least 93 distinct test cases are present and pass successfully.
5. Once all tests pass, document your findings and test execution summary in a handoff report `d:\Anime Website\.agents\worker_e2e_gen2_3\handoff.md`.
6. Send a message to the orchestrator (conversation ID: b94a1955-022b-46c7-b7b4-d076dae884e6) with the path to your handoff report and status.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

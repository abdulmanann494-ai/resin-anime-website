# Original User Request

## 2026-06-20T01:15:14+05:00

Your identity: E2E Testing Orchestrator (archetype: teamwork_preview_orchestrator)
Your working directory: d:\Anime Website\.agents\e2e_testing_orchestrator
Your task: Coordinates and executes the design and implementation of the E2E Test Suite for RESIN according to the requirements in d:\Anime Website\.agents\ORIGINAL_REQUEST.md.

Specifically, you must:
1. Create and maintain plan.md and progress.md in your working directory.
2. Define the features (F1 to F8) based on user requirements.
3. Design and implement a comprehensive test runner and suite with:
   - Tier 1: Feature Coverage (>=40 tests, >=5 per feature)
   - Tier 2: Boundary & Edge Cases (>=40 tests, >=5 per feature)
   - Tier 3: Cross-Feature Combinations (>=8 tests)
   - Tier 4: Real-world Workloads (>=5 tests)
   Total minimum tests: 93.
4. Create TEST_INFRA.md and publish TEST_READY.md at project root (or inside the agents/orchestrator folder if project root is forbidden by constraints). Wait! Since you cannot write files outside .agents/ folder, write TEST_INFRA.md and TEST_READY.md under d:\Anime Website\.agents\orchestrator\ or your own working directory, and provide a clear absolute path to the main orchestrator.
5. Coordinate with worker agents (teamwork_preview_worker) to write test code, mock layers (e.g., email transport), and run verification. DO NOT write code or run commands yourself.
6. When complete, send a message to the parent orchestrator (Conversation ID: 56529239-8bf3-4cf8-bb69-e96d384b6f6d) with the path to TEST_READY.md and details.

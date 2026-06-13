#!/usr/bin/env node

const runbook = `Atlas Dev Loop Runbook
======================

Step 1:
npm run atlas:handoff

Step 2:
npm run atlas:prompt

Step 3:
Copy the prompt into Codex and run one task only.

Step 4:
Review Codex output manually.

Step 5:
npm run atlas:check
npm run atlas:status

Step 6:
If the result is accepted:
npm run atlas:complete

Step 7:
npm run atlas:handoff

Safety reminders:
- Do not run atlas:complete until the task result is reviewed.
- Do not let Codex continue to the next task automatically.
- Diagnostics should not modify files.
- Implementation tasks should modify the smallest safe file set.
- Visual/map changes require human inspection.
- Romeo page and ATLAS_EVENTS remain protected unless explicitly targeted.

Optional commit reminder:
- Commit only after review and successful checks.
- Do not auto-commit from this helper.`;

console.log(runbook);

# Atlas Dev Loop

## Purpose

The Atlas Dev Loop turns the current manual development rhythm into a repeatable, reviewable process for Celebration Atlas work.

The loop exists to protect the app's current behavior while allowing steady progress through small, well-scoped tasks. It is designed for changes where a human selects one next task, Codex performs only that task, verification is run, results are reported, and the process stops for review.

## Core Principles

- **One task per run.** Each run handles exactly one task from `docs/ATLAS_TASK_QUEUE.md`.
- **Never continue to the next task automatically.** Even if a task succeeds, the run stops after reporting results.
- **Preserve current app behavior unless the task explicitly changes it.** Existing map, marker, constellation, routing, event, and page behavior should remain unchanged by default.
- **Diagnostics do not modify code.** Diagnostic tasks inspect, reason, and report only.
- **Implementation tasks modify the smallest safe set of files.** Prefer targeted edits over broad refactors.
- **UI, map, projection, and media changes require extra caution.** These areas shape the Atlas experience and can easily create unintended visual or behavioral changes.
- **The Romeo page is protected unless the task specifically targets it.** Do not alter Romeo page files, content, data, media, or behavior incidentally.
- **`ATLAS_EVENTS` is protected unless the task specifically targets event data.** Do not alter event records, identifiers, coordinates, timing, or metadata unless the selected task explicitly calls for data work.
- **Always run `npm run lint` and `npm run build`.** A task is not complete until both checks have been attempted and reported.
- **Always report files changed and behavior preserved.** The report must make it easy for a human to review scope and risk.

## Required Reading Before Each Run

Read these files before taking action:

1. `MASTER_ATLAS_CONTEXT.md`
2. `docs/ATLAS_DEV_LOOP.md`
3. `docs/ATLAS_TASK_QUEUE.md`

Also read any architecture document relevant to the selected task:

- `docs/EVENT_EXPERIENCE_ARCHITECTURE.md` for event-page architecture, responsive layout, data model, media-slot, or AI-agent population changes.
- `docs/ATLAS_DISCOVERY_ARCHITECTURE.md` for homepage, U.S. map, state map, Michigan map, event discovery, search, filter, region, state-level, national-scale, or large-scale event browsing changes.
- `docs/STATE_ATLAS_ARCHITECTURE.md` for country/state atlas, state map, regional discovery, constellation marker, or multi-state scaling changes.
- `docs/MAP_PRESENTATION_ARCHITECTURE.md` for map projection, illustrated map, real map, event grounds map, constellation marker, geocoding, or map calibration changes.
- `docs/ATLAS_CONSTELLATIONS_ARCHITECTURE.md` for constellation marker, star marker, trail, cluster glow, themed discovery path, or AI-suggested relationship changes.

## Task Lifecycle

1. **Read context.** Read the required context and architecture files before making any decision.
2. **Select one task.** Use `npm run atlas:next` as the standard way to view the first task in `docs/ATLAS_TASK_QUEUE.md` marked `Status: next`; use `npm run atlas:prompt` when you want a ready-to-copy Codex prompt for that same selected task. Then select only that task.
3. **Confirm task type.** Determine whether the task is `diagnostic` or `implementation`.
4. **Respect scope.** Work only within the task's stated scope and protected-area rules.
5. **Perform the task.** Diagnose without changing code, or implement with the smallest safe file set.
6. **Verify.** Run `npm run lint` and `npm run build`.
7. **Report.** Summarize files changed, checks run, behavior preserved, and any risks or blockers.
8. **Stop.** Do not pick up another task in the same run.

## Diagnostic-First Rule

When a task is marked `diagnostic`, the goal is to understand the safest path before changing behavior.

Diagnostic tasks may:

- Read files.
- Run non-mutating commands.
- Inspect existing code paths.
- Identify risk areas.
- Recommend a future implementation approach.
- Report blockers or questions for human review.

Diagnostic tasks must not:

- Modify source code.
- Modify data files.
- Modify styles.
- Modify media.
- Change package scripts.
- Commit experimental behavior.

## Implementation-After-Diagnostic Rule

Implementation tasks should only proceed when their blockers are cleared. If the queue says an implementation task is blocked until a diagnostic is complete, do not start it early.

Implementation tasks must:

- Stay inside the selected task's scope.
- Modify only the smallest safe set of files.
- Preserve behavior outside the task's explicit target.
- Avoid opportunistic cleanup, refactors, or unrelated improvements.
- Keep user-visible changes limited to the requested behavior.

If the implementation appears larger or riskier than expected, stop and report that the task needs human review.

## Lint and Build Requirement

Every run must attempt both checks:

```bash
npm run lint
npm run build
```

Report whether each check passed, failed due to an agent error, or could not complete because of an environment limitation.

If a check fails, do not hide it. Include the failing command and enough detail for a human to understand the failure.

## Report Requirement

Each run must report:

- The task name.
- The task type.
- The task scope.
- Files created or changed.
- Verification commands and results.
- Whether app/runtime behavior changed.
- Whether UI files changed.
- Whether data files changed.
- Whether media files changed.
- Any protected areas touched.
- Any blockers, risks, or recommended next human decision.

For implementation tasks, also report the behavior changed and the behavior intentionally preserved.

For diagnostic tasks, also report the recommended safest implementation path, if one is known.

## Rollback Requirement

Changes must remain easy to review and roll back.

- Keep commits focused on one task.
- Avoid mixing docs, UI, data, and behavior changes unless the task explicitly requires it.
- Do not perform broad formatting sweeps.
- Do not rename or move files unless required.
- If verification fails because of the change, either fix the change within scope or revert it.
- If the task becomes unsafe, stop and report instead of pushing through.

## When to Stop

Stop immediately after one of these conditions:

- The selected task is complete and reported.
- The selected task is blocked.
- The selected task is too broad for one safe run.
- The task requires a protected area not listed in scope.
- A diagnostic reveals that implementation requires human design or architecture review.
- Lint or build fails in a way that cannot be safely fixed within the task scope.

Do not continue to any future task automatically.

## Human Review Checkpoints

Human review is required when:

- A task affects homepage map behavior, marker behavior, projection math, constellation rendering, or media presentation.
- A task touches the Romeo page.
- A task touches `ATLAS_EVENTS` or event data shape.
- A task requires changing routes, package scripts, build configuration, or deployment automation.
- A diagnostic recommends more than one viable implementation path.
- A change alters visible UI, animation, map layering, data meaning, or discovery behavior.
- A task needs screenshots, visual judgment, or content approval.

## Forbidden Behaviors

Do not:

- Continue from one queue item to another without a new human instruction.
- Modify app UI unless the selected task explicitly requires it.
- Modify homepage map behavior unless the selected task explicitly requires it.
- Modify marker behavior unless the selected task explicitly requires it.
- Modify constellation behavior unless the selected task explicitly requires it.
- Modify event data unless the selected task explicitly targets event data.
- Modify the Romeo page unless the selected task explicitly targets it.
- Modify routing unless the selected task explicitly targets routing.
- Modify media files unless the selected task explicitly targets media.
- Modify CSS unless the selected task explicitly targets styling.
- Modify package scripts unless the selected task explicitly targets scripts.
- Add GitHub Actions, automation code, or scheduled jobs unless explicitly instructed.
- Use diagnostics as an excuse to make small code edits.
- Perform unrelated refactors, cleanup, dependency updates, or formatting sweeps.

## Branch and Commit Expectations

- Work on the current branch unless a human gives different instructions.
- Keep each commit focused on one task.
- Commit only after verification has been run or attempted.
- The commit message should describe the single completed task.
- Do not commit unrelated local changes.
- If no files changed, do not create a commit.
- If changes were committed, report the commit and verification status.

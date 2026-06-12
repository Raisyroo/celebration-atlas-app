# Atlas Task Queue

This queue coordinates one safe Atlas Dev Loop task at a time. Each run should take only the first task marked `Status: next`, complete or report it, and then stop.

## Current Queue

### 1. Diagnose constellation line rendering

- **Type:** diagnostic
- **Status:** complete
- **Scope:** homepage map / AtlasMap only
- **Notes:** Determine safest SVG/CSS/canvas layer strategy before rendering lines.

### 2. Implement faint selected-constellation line layer

- **Type:** implementation
- **Status:** complete
- **Scope:** homepage map / AtlasMap only
- **Notes:** Only draw lines for selected constellation. No always-on constellation lines.

### 3. Add constellation interaction polish

- **Type:** implementation
- **Status:** complete
- **Scope:** homepage discovery section
- **Notes:** Improve selected row state and clear action if needed.

### 4. Diagnose seasonal timing metadata

- **Type:** diagnostic
- **Status:** complete
- **Scope:** event profile/data only
- **Notes:** Do not add Seasonal Discoveries UI until timing data is structured.

### 5. Add structured timing metadata model

- **Type:** implementation
- **Status:** complete
- **Scope:** data only
- **Notes:** No UI until enough timing data exists.

### 6. Define Celebration Search command model

- **Type:** implementation
- **Status:** complete
- **Scope:** data/model architecture only
- **Protected files/areas:** app UI, routing, event data, map behavior, constellation behavior, media files, CSS, package scripts, automation
- **Notes:** Converted the national atlas command architecture into a safe TypeScript command model before building Celebration Search UI.
- **Verification:** `npm run atlas:check`

### 7. Prototype Celebration Search mock parser

- **Type:** implementation
- **Status:** complete
- **Scope:** Celebration Search parser/data layer only after command model review
- **Protected files/areas:** app UI, routing, event data, map behavior, constellation behavior, media files, CSS, package scripts, automation
- **Notes:** Convert approved mock command examples into a non-UI parser prototype that emits safe `AtlasSearchCommand` objects.
- **Verification:** `npm run atlas:check`

### 8. Prototype national atlas shell

- **Type:** implementation
- **Status:** future
- **Scope:** national atlas shell only after architecture review
- **Protected files/areas:** existing Michigan map behavior, marker behavior, constellation behavior, event data, Romeo page, media files, package scripts, automation
- **Notes:** Build the first national atlas shell only after the command model is reviewed and accepted.
- **Verification:** `npm run atlas:check`

### 9. Prototype Celebration Search UI shell

- **Type:** implementation
- **Status:** future
- **Scope:** Celebration Search UI shell only after parser fixtures are reviewed
- **Protected files/areas:** homepage map behavior, marker behavior, constellation behavior, event data, Romeo page, routing, media files, package scripts, automation
- **Notes:** Create a non-executing or minimally wired Celebration Search interface shell only after parser fixture output has been reviewed and accepted.
- **Verification:** `npm run atlas:check`

## Completed Tasks

- Define Celebration Search command model — completed in current queue item 6 as a data/model architecture step.

## Paused / Needs Human Review

No tasks are currently paused for human review.

## Task Template

Use this template when adding a task:

### N. Task name

- **Type:** diagnostic | implementation
- **Status:** next | blocked until diagnostic complete | future | paused | complete
- **Scope:** specific files, feature area, or data area
- **Protected files/areas:** areas that must not be touched during the task
- **Notes:** short description of the goal, constraints, and review needs
- **Verification:** required checks beyond `npm run lint` and `npm run build`, if any

## Rules for Adding Tasks

- Add small tasks that can be completed or diagnosed in one run.
- Keep only one task marked `Status: next` unless a human explicitly changes the process.
- Prefer diagnostic tasks before risky implementation tasks.
- Mark implementation tasks as blocked when they depend on diagnostic findings.
- Include a narrow scope for every task.
- Call out protected files and areas when risk is known.
- Do not add broad refactors, visual redesigns, routing changes, package-script changes, or automation work without human approval.
- Keep Romeo page, `ATLAS_EVENTS`, map projection, media, and constellation behavior changes explicit and reviewed.
- Move completed tasks to `Completed Tasks` only after verification and reporting.

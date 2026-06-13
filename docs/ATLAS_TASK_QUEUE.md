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

### 8. Add non-rendered National/State shell component skeletons

- **Type:** implementation
- **Status:** complete
- **Scope:** component skeletons only; no route imports and no rendered UI
- **Protected files/areas:** app/page.tsx, homepage runtime behavior, existing Michigan map behavior, marker behavior, clustering, constellation behavior, event data, Romeo page, media files, CSS, package scripts, automation
- **Notes:** Add non-rendered `AtlasGatewayShell`, `NationalAtlasShell`, and `StateAtlasShell` skeleton boundaries without changing the visible homepage. This is the next safe code step after the documentation-only migration plan.
- **Verification:** `npm run atlas:check`

### 9. Wrap current HomeAtlasExperience as MichiganAtlasExperience

- **Type:** implementation
- **Status:** future
- **Scope:** Michigan state atlas boundary only after shell skeletons are reviewed
- **Protected files/areas:** app/page.tsx unless explicitly approved, AtlasMap projection, marker behavior, clustering, constellation behavior, selected event card behavior, cluster panel behavior, event data, Romeo page, media files, CSS, package scripts, automation
- **Notes:** Create a `MichiganAtlasExperience` wrapper or alias around the current `HomeAtlasExperience` without changing behavior first.
- **Verification:** `npm run atlas:check`

### 10. Prototype hidden NationalAtlasShell

- **Type:** implementation
- **Status:** future
- **Scope:** hidden/dev-only national atlas shell only after Michigan boundary review
- **Protected files/areas:** visible homepage runtime behavior, app/page.tsx unless explicitly approved, existing Michigan map behavior, marker behavior, constellation behavior, event data, Romeo page, media files, CSS, package scripts, automation
- **Notes:** Exercise national command, partial-coverage, and state-transition structure without making the national shell public.
- **Verification:** `npm run atlas:check`

### 11. Prototype national atlas placeholder

- **Type:** implementation
- **Status:** future
- **Scope:** visible placeholder only after hidden shell review and explicit approval
- **Protected files/areas:** default homepage entry, existing Michigan map behavior, marker behavior, constellation behavior, event data, Romeo page, media files, package scripts, automation
- **Notes:** Do not mark the visible national homepage or default national gateway as next yet. Any placeholder must clearly communicate partial coverage and preserve Michigan as the canonical state atlas prototype.
- **Verification:** `npm run atlas:check`

### 12. Prototype Celebration Search UI shell

- **Type:** implementation
- **Status:** future
- **Scope:** Celebration Search UI shell only after parser fixtures and shell boundaries are reviewed
- **Protected files/areas:** homepage map behavior, marker behavior, constellation behavior, event data, Romeo page, routing, media files, package scripts, automation
- **Notes:** Create a non-executing or minimally wired Celebration Search interface shell only after parser fixture output and shell boundaries have been reviewed and accepted.
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

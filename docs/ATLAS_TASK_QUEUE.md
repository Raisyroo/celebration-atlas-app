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
- **Status:** complete
- **Scope:** Michigan state atlas boundary only after shell skeletons are reviewed
- **Protected files/areas:** app/page.tsx unless explicitly approved, AtlasMap projection, marker behavior, clustering, constellation behavior, selected event card behavior, cluster panel behavior, event data, Romeo page, media files, CSS, package scripts, automation
- **Notes:** Created a `MichiganAtlasExperience` wrapper around the current `HomeAtlasExperience` without changing behavior first.
- **Verification:** `npm run atlas:check`

### 10. Diagnose hidden national atlas route strategy

- **Type:** diagnostic
- **Status:** superseded by current Event Hub factory milestone
- **Scope:** routing / national atlas shell / feature-flag strategy only
- **Protected files/areas:** app UI, homepage runtime behavior, app/page.tsx, HomeAtlasExperience behavior, AtlasMap behavior, NationalAtlasShell runtime wiring, StateAtlasShell runtime wiring, MichiganAtlasExperience runtime wiring, CelebrationSearchPanel runtime wiring, routing, event data, media files, CSS, package scripts, automation scripts
- **Notes:** Determine the safest way to expose the NationalAtlasShell for development review without changing the visible homepage. Compare hidden route, dev-only route, feature flag, and non-rendered import strategies.
- **Verification:** `npm run atlas:doctor`, `npm run atlas:handoff`, `npm run atlas:next`, `npm run atlas:prompt`, `npm run atlas:check`

### 11. Implement hidden/dev-only NationalAtlasShell route

- **Type:** implementation
- **Status:** complete
- **Scope:** hidden/dev-only national atlas shell route only after route strategy is diagnosed and approved
- **Protected files/areas:** visible homepage runtime behavior, app/page.tsx unless explicitly approved, existing Michigan map behavior, marker behavior, constellation behavior, event data, Romeo page, media files, CSS, package scripts, automation
- **Notes:** Created unlinked `/dev/national-atlas` route rendering `NationalAtlasShell` only, with Development Preview and partial-coverage language. Do not add CelebrationSearchPanel, MichiganAtlasExperience, national map functionality, or state transitions until explicitly approved.
- **Verification:** `npm run atlas:doctor`, `npm run atlas:check`, `npm run atlas:status`, `npm run lint`, `npm run build`

### 12. Prototype national atlas placeholder content

- **Type:** implementation
- **Status:** future
- **Scope:** placeholder content only after hidden/dev-only route review and explicit approval
- **Protected files/areas:** default homepage entry, existing Michigan map behavior, marker behavior, constellation behavior, event data, Romeo page, media files, package scripts, automation
- **Notes:** Do not mark the visible national homepage or default national gateway as next yet. Any placeholder must clearly communicate partial coverage and preserve Michigan as the canonical state atlas prototype.
- **Verification:** `npm run atlas:check`

### 13. Connect CelebrationSearchPanel to NationalAtlasShell in dev-only route

- **Type:** implementation
- **Status:** complete
- **Scope:** dev-only national route search wiring only after hidden/dev-only route and placeholder content review
- **Protected files/areas:** visible homepage runtime behavior, app/page.tsx unless explicitly approved, existing Michigan map behavior, marker behavior, constellation behavior, event data, Romeo page, media files, CSS, package scripts, automation
- **Notes:** Wire the reusable CelebrationSearchPanel into the NationalAtlasShell only inside the approved dev-only review surface. Do not affect the visible homepage or production-facing route behavior.
- **Verification:** `npm run atlas:check`

### 14. Define state transition from national shell to Michigan shell

- **Type:** diagnostic
- **Status:** future
- **Scope:** national-to-state transition architecture only
- **Protected files/areas:** visible homepage runtime behavior, app/page.tsx unless explicitly approved, existing Michigan map behavior, marker behavior, constellation behavior, event data, Romeo page, media files, CSS, package scripts, automation
- **Notes:** Define the safest development-only transition from the national shell into the Michigan shell before implementing navigation, routing, or runtime wiring.
- **Verification:** `npm run atlas:check`

### 15. Prototype Celebration Search UI shell

- **Type:** implementation
- **Status:** future
- **Scope:** Celebration Search UI shell only after parser fixtures and shell boundaries are reviewed
- **Protected files/areas:** homepage map behavior, marker behavior, constellation behavior, event data, Romeo page, routing, media files, package scripts, automation
- **Notes:** Create a non-executing or minimally wired Celebration Search interface shell only after parser fixture output and shell boundaries have been reviewed and accepted.
- **Verification:** `npm run atlas:check`

### 16. Diagnose AI-first map command layout

- **Type:** diagnostic
- **Status:** future
- **Scope:** architecture / layout strategy only
- **Protected files/areas:** app UI, homepage runtime behavior, app/page.tsx, /dev/national-atlas behavior, HomeAtlasExperience behavior, AtlasMap behavior, marker projection, marker coordinates, clustering logic, marker tap targets, event data, Romeo page, media files, CSS, package scripts, automation scripts
- **Notes:** Determine the safest full-screen map and bottom-centered Ask Celebration Atlas layout direction before implementation.
- **Verification:** `npm run atlas:doctor`, `npm run atlas:check`, `npm run atlas:status`

### 17. Diagnose removal/collapse of permanent guide and region chips

- **Type:** diagnostic
- **Status:** future
- **Scope:** discovery UI architecture only
- **Protected files/areas:** app UI, homepage runtime behavior, HomeAtlasExperience behavior, AtlasMap behavior, marker behavior, event data, Romeo page, media files, CSS, package scripts, automation scripts
- **Notes:** Identify where guide, category, and region chips should become collapsible, generated suggestions, or fallback-only controls.
- **Verification:** `npm run atlas:check`

### 18. Design AI-first map command layout

- **Type:** diagnostic
- **Status:** future
- **Scope:** product/architecture design notes only
- **Protected files/areas:** app UI, homepage runtime behavior, app/page.tsx, /dev/national-atlas behavior, HomeAtlasExperience behavior, AtlasMap behavior, marker behavior, event data, Romeo page, media files, CSS, package scripts, automation scripts
- **Notes:** Define desktop and mobile layout requirements for the full-screen map and bottom-centered command window after diagnostic review.
- **Verification:** `npm run atlas:check`

### 19. Prototype bottom-centered Ask Celebration Atlas command window

- **Type:** implementation
- **Status:** future
- **Scope:** UI prototype only after AI-first layout design approval
- **Protected files/areas:** homepage runtime behavior unless explicitly approved, app/page.tsx unless explicitly approved, AtlasMap projection, marker coordinates, clustering logic, marker tap targets, event data, Romeo page, media files, package scripts, automation scripts
- **Notes:** Prototype the command window without implementing real AI/API behavior and without removing fallback controls until explicitly approved.
- **Verification:** `npm run atlas:doctor`, `npm run atlas:check`, `npm run atlas:status`, `npm run lint`, `npm run build`

### 20. Diagnose rich event intelligence card model

- **Type:** diagnostic
- **Status:** future
- **Scope:** event card data/model architecture only
- **Protected files/areas:** app UI, homepage runtime behavior, AtlasMap behavior, selected event card behavior, event data, Romeo page, media files, CSS, package scripts, automation scripts
- **Notes:** Define source-backed fields, confidence rules, and safe omissions for richer AI-built event cards.
- **Verification:** `npm run atlas:check`

### 21. Prototype richer event card shell

- **Type:** implementation
- **Status:** future
- **Scope:** event card shell only after rich card model diagnostic approval
- **Protected files/areas:** homepage runtime behavior unless explicitly approved, AtlasMap projection, marker behavior, event data, Romeo page, media files, package scripts, automation scripts
- **Notes:** Prototype a richer card shell from existing safe structured data only; do not redesign cards or add live/current claims without explicit approval.
- **Verification:** `npm run atlas:doctor`, `npm run atlas:check`, `npm run atlas:status`, `npm run lint`, `npm run build`

### 22. Build Coast Guard Festival through the Event Factory

- **Type:** implementation
- **Status:** next
- **Scope:** Coast Guard Festival source intake, evidence bundle, synthesis, visual workflow, private package, and mobile preview
- **Protected files/areas:** existing published Event Hub packages, homepage map geometry, illustrated-map calibration, universal Scout AI runtime, production publication before human review, sponsor listings
- **Notes:** Read `docs/PROJECT_STATE.md` and `docs/COAST_GUARD_FESTIVAL_BRIEF.md`. Use fresh official-source research and the supplied repository hero. Build an elegant, source-complete private Event Hub package with the Hero Image Factory. Do not publish it until Ray reviews the exact mobile preview.
- **Verification:** `npm run build`, Atlas Control readiness, migration parity, private package mobile review, no horizontal overflow, no browser errors, existing public Event Hub smoke check

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

# Atlas Codex Run Template

Use this template to run exactly one Atlas Dev Loop task. Run `npm run atlas:prompt` to print a ready-to-copy prompt for the next queue item marked `Status: next`.

```text
Read MASTER_ATLAS_CONTEXT.md first.
Read the relevant architecture docs for the selected task:
- docs/EVENT_EXPERIENCE_ARCHITECTURE.md when touching event-page architecture, responsive layout, data model, media slots, or AI-agent population.
- docs/ATLAS_DISCOVERY_ARCHITECTURE.md when touching homepage, U.S. map, state map, Michigan map, event discovery, search, filters, regions, state-level browsing, national-scale browsing, or large-scale event browsing.
- docs/STATE_ATLAS_ARCHITECTURE.md when touching country/state atlas, state map, regional discovery, constellation markers, or multi-state scaling.
- docs/MAP_PRESENTATION_ARCHITECTURE.md when touching map projection, illustrated maps, real maps, event grounds maps, constellation markers, geocoding, or map calibration.
- docs/ATLAS_CONSTELLATIONS_ARCHITECTURE.md when touching constellation markers, star markers, trails, cluster glow, themed discovery paths, or AI-suggested relationships.
Read docs/ATLAS_DEV_LOOP.md.
Read docs/ATLAS_TASK_QUEUE.md.
Use npm run atlas:next to view the next queued task.

Take only the next task marked Status: next.
Do not proceed to any future task.
Stop after one task.

Task name: [TASK NAME]
Task type: [diagnostic | implementation]
Scope: [NARROW TASK SCOPE]
Protected files/areas: [FILES OR AREAS THAT MUST NOT BE TOUCHED]
Verification requirements: [ANY EXTRA CHECKS BEYOND LINT/BUILD]

Rules:
- If the task is diagnostic, do not modify code.
- Diagnostics may inspect files, run read-only commands, identify risks, and recommend a safe implementation path.
- If the task is implementation, modify only the smallest safe file set.
- Preserve current app behavior unless the task explicitly changes it.
- UI/map/projection/media changes require extra caution.
- The Romeo page is protected unless the task specifically targets it.
- ATLAS_EVENTS is protected unless the task specifically targets event data.
- Do not wire anything into scripts.
- Do not add GitHub Actions.
- Do not add automation code unless the selected task explicitly requires it.
- Do not run `npm run atlas:complete` automatically unless the human explicitly instructs Codex to advance the queue after review.

Run:
- npm run lint
- npm run build

Report results using this format:

Summary:
- Task completed:
- Task type:
- Scope:
- Files changed:
- Behavior changed:
- Behavior preserved:
- UI files changed:
- Data files changed:
- Media files changed:
- Protected areas touched:

Verification:
- npm run lint: [pass | fail | warning, with details]
- npm run build: [pass | fail | warning, with details]

Notes / Risks / Next Human Decision:
- [Any blockers, risks, diagnostic findings, or recommended next step]
```

## Placeholders

- **Task name:** the exact queue task title.
- **Task type:** `diagnostic` or `implementation`.
- **Scope:** the files, feature area, or data area allowed for the run.
- **Protected files/areas:** files and areas that must not be touched.
- **Verification requirements:** checks required in addition to `npm run lint` and `npm run build`.
- **Report format:** the summary, verification, and notes format shown above.

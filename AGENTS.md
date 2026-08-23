<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Celebration Atlas Working Agreement

## Start Here

Before changing the application, read:

1. `MASTER_ATLAS_CONTEXT.md` for the durable product vision.
2. `docs/PROJECT_STATE.md` for the current operational truth and next milestone.
3. The feature-specific architecture document named by those files or the task brief.

Current operational state overrides older historical notes. Do not restore a superseded flyer-first or hardcoded-event workflow because an older document still mentions it.

## Product Boundaries

- Celebration Atlas is a mobile-first public web application. Event URLs are public web pages.
- Full Event Hub pages are the primary event experience. Flyer cards and collectibles remain optional downstream media.
- Scout is the event intelligence identity. The universal Scout response service is not connected yet; current Scout prompts must remain source-bound and deterministic.
- Do not invent dates, times, attendance, performers, vendors, rules, locations, sponsors, or official relationships.
- Do not display event sponsors unless they are Celebration Atlas sponsors or a reviewed legal/product requirement says otherwise.
- Keep an official-source link in the Event Hub footer. Plan links may point to useful official pages.
- Historical schedules may be shown only with an explicit year label and caveat. Never project old times onto the current edition.
- The illustrated Michigan map is intentionally approximate. Preserve verified real coordinates in data, but do not force the artwork to behave like a literal geographic map.

## Event Factory Rules

- New events move through retained evidence, deterministic reconciliation, editorial synthesis, private package preview, human approval, and audited publication.
- Inspection, synthesis, and package preparation never equal publication.
- During the Michigan pilot, only an explicit human package approval may materialize and publish a new event.
- New hero art must satisfy `docs/EVENT_IMAGE_SPECIFICATION.md` and use an approved Supabase-hosted visual workflow. A finished externally supplied asset may enter through Atlas Control; local image existence alone never clears review.
- Preserve source URLs, claims, disagreements, schedule provenance, visual references, and review actions.
- Existing published packages are compatibility fixtures. Do not break them while tightening requirements for new packages.

## Engineering And Verification

- Audit existing code and database behavior before adding a new abstraction.
- Work with existing dirty-tree changes. Never revert files you did not create or changes the user has not asked to remove.
- Keep secrets in `.env.local` or managed platform settings. Never commit credentials.
- `npm run build` is the required full check. It includes flyer, Event Hub, source inspection, synthesis, and Atlas Control validations.
- Do not run `npm run test:visual-smoke` or `scripts/visual-smoke.mjs` unless the user explicitly requests it. Use available browser tools for targeted review; if those are unavailable, leave visual review to the user.
- For user-facing changes, verify the real route at mobile width and check for horizontal overflow, rendering errors, and missing media.
- For Supabase schema work, add a numbered migration and verify local/remote migration parity.
- Update `docs/PROJECT_STATE.md` when a milestone changes architecture, publication state, or the next-task handoff.

## Michigan County Event Operations

- When asked to create events for a registered Michigan county, use `npm run atlas:create-county-events -- <county>` and the existing Michigan Completion architecture. Do not hand-build a parallel county workflow or manually run per-event manifests.
- Use `--plan-only` when the authorization is limited to classification and local manifest/report generation. The normal command defaults to dry-run; private workflow records require the user's explicit authorization plus `--authorize-private-writes --actor <identity>`.
- County operation is deterministic-only with zero model budget. It may not canonicalize, search for or create images, approve packages, publish Event Pages, or change public discovery.
- Preserve every inventory disposition, retained exception, immutable hash, replay identity, and human verification/publication gate. Never auto-resolve an exception to make a county continue.
- Read `docs/COUNTY_COMPLETION_OPERATOR.md` before changing or operating the county command.

## Ray-Approved Event List Operations

- For a list Ray explicitly approves for inclusion, use the Approved-List Fast Track contract in `docs/FAST_TRACK_APPROVED_EVENTS.md`; do not route it through county-completion batching or repeat discovery qualification.
- Treat list approval as authorization for event-isolated private preparation only. It is never hero approval, package approval, canonicalization approval, or publication approval.
- Retain the factual checks that protect identity, current dates, recurrence, location, coordinates, sources, schedules, and manifest grounding. Populate the existing verification record from the same evidence pass instead of creating a redundant research or review queue when those facts are complete.
- Give every event one `gpt-5.6-sol` Ultra full-manifest authorship pass. Protected identity, date, location, schedule, source, art, and lifecycle values must remain unchanged.
- At the hero-image stage, use `$create-celebration-atlas-hero` with GPT-5.6 Luna at Max reasoning. Pass its iconic-moment preflight, make exactly one image-generation call per event, and never create an automatic edit, variant, or retry. A failed result stops only that event until Ray explicitly authorizes another paid attempt.
- Process failures per event and continue the rest of the approved list. Stop every successful event at its existing private Event Factory package preview before publication.

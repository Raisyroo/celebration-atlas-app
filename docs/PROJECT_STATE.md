# Celebration Atlas Project State

Last updated: July 16, 2026

This file is the current operational handoff for new Codex tasks. Read `MASTER_ATLAS_CONTEXT.md` first for the durable vision, then use this file when older notes conflict with the running application.

## Repository And Deployment

- Repository: `C:\Users\Ray\Documents\GitHub\celebration-atlas-app`
- Production: `https://celebration-atlas-app.vercel.app`
- Atlas Control Desk: `https://celebration-atlas-app.vercel.app/atlas-control`
- Local development: `http://localhost:3000`
- Stack: Next.js 16 web app, Supabase Postgres/Auth/Storage, Vercel deployment and AI Gateway.
- Primary experience: mobile-first public web app. Desktop and tablet must remain structurally sound, but mobile review leads product decisions.

## Product Decisions Now In Force

1. Public Event Hub pages replace flyer popups as the primary event detail experience.
2. Flyer cards and collectible artifacts remain optional add-ons generated from the same approved event intelligence.
3. Scout represents the verified intelligence layer inside Event Hub pages.
4. Event sponsors are omitted unless they are Celebration Atlas sponsors or a reviewed requirement says otherwise.
5. Official event sources appear in the footer, not as a competing hero call to action.
6. Historical schedules can add value when a current schedule is unavailable, but they must retain their original year and a visible caveat.
7. Map marker placement on the illustrated Michigan artwork is approximate presentation. Verified real coordinates remain canonical data.

## Event Hub Architecture

The public route is `/events/[id]`. It resolves published database packages first and checked-in transition manifests second. `components/EventHub.tsx` renders the shared responsive experience from validated manifests.

The reusable content model supports event identity, schedule, highlights or traditions, planning links, source-backed Scout Spotlights, citations, and a compact Ask Scout surface. Tabs are selected from the event's real content rather than forced into one fixed event template.

Current public Event Hub coverage:

| Event | Public slug | Source |
| --- | --- | --- |
| Michigan Brown Trout Festival | `alpena-brown-trout` | Published package |
| Detroit Jazz Festival | `detroit-jazz` | Checked-in transition manifest |
| Romeo Peach Festival | `romeo-peach-festival` | Published package |
| National Cherry Festival | `national-cherry-festival` | Published package |
| Black River Tattoo Convention | `black-river-tattoo-convention` | Published package |
| St. Clair County 4-H & Youth Fair | `st-clair-county-4-h-youth-fair` | Published package |
| Grand Haven Coast Guard Festival | `coast-guard-festival` | Published package |

The six factory-published packages are at 100 percent readiness. Existing package and manifest fallbacks must remain valid while the generalized pipeline expands.

Private review queue:

No packages are currently waiting for private review.

## Event Factory

The operating loop is:

```text
Discover -> Verify -> Collect -> Reconcile -> Compose -> Illustrate -> Preview -> Approve -> Publish -> Monitor
```

An event package freezes the candidate, canonical profile, map record, Event Hub manifest, Scout context, evidence, art workflow, and review state. New event-specific source code should not be required.

Key boundaries:

- Official-source inspection creates research candidates only.
- Evidence bundles retain source snapshots and field-level provenance.
- Deterministic synthesis reconciles facts and preserves disagreements.
- Model-assisted editorial work may refine allowlisted prose but cannot change immutable dates, times, locations, sources, or publication state.
- Private package previews render the exact package under review.
- Human package approval is the only Michigan-pilot action that may publish a new event and add it to the public map.
- Published package events overlay the checked-in catalog so the map can grow without expanding a hardcoded array for every event.

Canonical implementation notes live in:

- `docs/event-factory.md`
- `docs/event-intake-workbench.md`
- `docs/event-source-synthesis.md`
- `docs/event-page-publishing.md`
- `docs/source-intelligence-schema.md`

## Hero Image Factory

Migration `014_event_visual_workflows.sql` and the Control Desk Hero Image Factory implement the fast visual workflow:

1. Record an event-and-location image search query.
2. Review roughly 15 to 30 useful thumbnails.
3. Retain representative public source-page URLs.
4. Record three to five recurring visual-signature motifs.
5. Write one defining hero moment.
6. Generate a deterministic, text-free, vertical 2:3 Celebration Atlas prompt.
7. Upload the selected image to the public `celebration-atlas-media` Supabase bucket.
8. Verify visual facts, independent composition, absence of invented marks, mobile crop, and public asset delivery.
9. Require explicit human approval before synthesis or package publication can use the art.

New package preparation prefers the approved cloud asset and retains the full visual brief and QA audit. Existing published legacy packages continue to render without retroactive migration.

## Scout Status

Scout's visual identity is implemented. Event Hub Ask Scout is now a single-purpose question composer: suggestion chips, suggested questions, predefined prompt tags, and event-specific keyword response routing are not rendered. Existing source-backed suggestion records remain in published manifests as compatibility data for the reviewed Event Factory lifecycle.

The composer exposes a versioned context contract for event ID, content package/version, source kind, and active Event Hub section. Published page versions, Event Factory package previews, source-synthesis previews, and checked-in transition manifests each supply the strongest content reference they currently own.

The universal conversational Scout service is not connected. Submitting the UI-only composer retains the visitor's question, preserves focus, and explicitly says that no response service received it. The fixed composer uses safe-area and visual-viewport keyboard insets, a 16px input to prevent iOS focus zoom, a minimum 44px send target, and one shared translucent dock treatment across phone, tablet, and desktop.

Do not build one-off deep-question logic into individual event pages. The future Scout response layer should retrieve approved event claims, schedules, rules, PDFs, provenance, and freshness metadata at request time, then answer with citations and uncertainty controls. Event-specific source intelligence should become shared retrieval data, not custom chatbot code.

## Supabase And Atlas Control

- Remote migrations `005` through `014` are applied.
- Atlas Control is protected and uses server-side service-role routes for editorial mutations.
- Public pages never receive the service-role key.
- The Control Desk supports source inspection, bundle collection, synthesis, verification, package review, publication, and visual workflow approval.
- Production authentication remains required. An existing signed-in browser session reaches `/atlas-control`; unauthenticated requests redirect to `/atlas-login`.
- Migration `014` creates the public media bucket and service-only visual workflow tables and RPCs.
- The first migration-014 visual workflow is approved for the Coast Guard Festival private package. Its supplied 1024x1536 hero is stored in `celebration-atlas-media`; package approval remains separate.

Never place Supabase or Vercel credentials in documentation, source code, prompts, or commits.

## Michigan Homepage State

The Michigan Atlas homepage completed its rail, deterministic discovery, and shared responsive-shell checkpoint on July 15, 2026.

- The homepage now receives an explicit serializable Michigan state configuration and state-local event catalog; `AtlasMap` no longer owns a silent global Michigan fallback.
- Published database overlays are scoped to canonical `MI`/`Michigan` events before published packages are loaded, so another state cannot leak into or replace a Michigan fallback event by name.
- The bottom rail now contains only exact-dated live or upcoming public events, evaluated in the Michigan time zone and sorted live-first then chronologically.
- Published package dates retain their reviewed event timezone. Rail eligibility evaluates each event in its own valid timezone and falls back safely to the state timezone when needed.
- Completed, undated, TBA, estimated, and recurrence-only events remain eligible for general map/search discovery when otherwise public, but do not appear in the time-sensitive rail.
- Ask Celebration Atlas remains visible when no rail event qualifies.
- Short non-desktop landscape viewports retain menu, favorite, filter, Ask Atlas, and dated event access beside a bounded full-art map.
- Desktop preserves the portrait artwork content box beside a non-overlapping introduction/discovery panel instead of cropping the state art into a wide phone-like frame.
- Versioned artwork identity, dimensions, and SHA-256 values are retained in the state configuration and checked by `validate:state-atlas-data` during every full build.
- Homepage search now runs through one deterministic resolver with explicit state rules, catalog, profiles, and configuration. Exact identities remain unique, broad results are stably ranked, and only structured identity, place, category, region, reviewed date, season, or curated state rules participate.
- The legacy any-token matcher and the rule that incorrectly linked cherry, lilac, and tulip searches to Romeo Peach Festival were removed. Exact navigation, map labels, result callouts, and the geospatial development route now share the same resolver semantics.
- Search label locations preserve the supplied state instead of appending `MI`, and the full build includes deterministic regression coverage for ambiguity, category leakage, reviewed dates, state curation, and catalog-order independence.
- One classifier now owns portrait, compact-landscape, and desktop behavior. `1024×390` remains compact rather than entering a broken desktop hybrid, while desktop requires at least `1024×600` in landscape.
- Essential menu, filter, Ask Atlas, and dated-rail controls no longer wait for artwork loading or map measurement after rotation. The selected artwork variant and viewport mode are exposed as root data contracts and covered by visual smoke tests.
- Homepage filters are functional and limited to reviewed facts: exact category, explicitly curated state region IDs, exact city, reviewed month, and the same live/upcoming eligibility used by the rail. Artistic atmosphere labels never become geographic regions.
- Query-only broad search uses accessible, clickable title tags on the illustrated map. The discovery panel/list belongs to filter-only and query-plus-filter workflows, so ordinary search never replaces the map with a filter results screen. Exact identity still navigates directly, active-empty discovery hides contradictory markers, and filter changes never mutate rail membership.
- Mobile filter and menu sheets now have real actions, Escape/focus containment, focus restoration, and background inerting. Query result title tags are keyboard targets; decorative labels and overflow indicators are not duplicate targets.
- Atlas Control styles are scoped beneath `.control-shell`. A build validator and route-order visual smoke test protect public Event Hub controls from admin/login CSS that remains loaded after client navigation.
- The illustrated map remains approximate. A unified coded-star and presentation-position resolver is not implemented yet.

The durable audit and multi-state recommendations are in `docs/MICHIGAN_HOMEPAGE_AUDIT.md`.

## Known Transition State

- Several older architecture and task documents describe flyer-first behavior. The Event Hub decisions in this file supersede those passages.
- `docs/ATLAS_TASK_QUEUE.md` contains historical completed/future map work. No item should become `next` until Ray chooses the follow-up milestone.
- A deliberately excluded `Codex Event Write Test` database row still appears in factory diagnostics and must never become public.
- The universal Scout AI runtime, periodic update agents, nationwide discovery campaigns, and map redesign are future milestones.
- Source update monitoring must eventually detect material schedule/date changes, create a new synthesis/package version, and require the configured review policy before public replacement.

## Latest Completed Event Factory Milestone

The Grand Haven Coast Guard Festival package completed the Event Factory and is public at:

`https://celebration-atlas-app.vercel.app/events/coast-guard-festival`

The package retains 11 source snapshots, 40 current official schedule rows, the distinct organizer/program/City date windows, an approved visual-signature workflow, Census-geocoded waterfront venue provenance, four visitor-planning links, and a source-backed maritime traditions module. The optional AI Gateway prose request was unavailable in the local environment, so the exact accepted child uses the existing evidence-bound editorial API with operator-reviewed copy and immutable facts locked.

Published package v4 incorporates Ray's editorial feedback: the 1924 picnic and 1937 formal-festival origin appears in one dedicated tradition card, while the Traditions introduction covers present-day attendance and national dignitary scale and the Why Go Spotlight explains Grand Haven's 1998 `Coast Guard City, USA` designation. The package, immutable Event Hub v1, canonical event, approved hero, and homepage map entry were published together on July 15, 2026.

## Current Next Milestone

The state-scoped catalog/configuration, deterministic search, live/upcoming rail, shared viewport model, and functional discovery/filter surfaces are complete checkpoints.

The next focused checkpoint is a shared `StateMapPresentationProfile` and one versioned position resolver for stars, labels, atmosphere, constellation lines, and audits. It must account for artwork fit/crop, keep Upper and Lower Peninsula calibration regions separate, render one accessible coded-star control per reachable event on every supported viewport, and preserve verified coordinates as source truth while treating illustrated offsets as presentation data. Pre-aggregate discovery facet counts before catalogs grow to national scale.

## Required Verification

For a full application checkpoint:

```text
npm run build
```

For Event Factory work, also confirm:

- Atlas Control reports `Control Plane Ready`.
- Relevant source, synthesis, package, and visual validations pass.
- Supabase migration history is aligned when schema changed.
- The private Event Hub preview works at a phone viewport without horizontal overflow.
- Browser console contains no application errors.
- Existing published Event Hub pages and the homepage still resolve.
- Mobile smoke coverage preserves query-only map title tags and verifies Event Hub tab geometry both directly and after Atlas Login -> homepage -> Event Hub client navigation.
- Scout Composer smoke coverage verifies direct and client Event Hub navigation, context updates, keyboard focus order, translucent treatment, no prompt-chip controls, and no overflow at 390x844, 390x430, 844x390, 768x1024, and 1440x900.

## Handoff Convention

Use a fresh Codex task for each distinct milestone, opened in this same local project. The working tree, committed documentation, and automated cross-surface contracts carry the durable state; each task keeps its own transcript. Keep one task open through diagnosis, implementation, verification, and publication of its milestone, and start every new task from current `origin/main`.

At milestone completion:

1. Update this file if operational truth changed.
2. Update the single next item in `docs/ATLAS_TASK_QUEUE.md`.
3. Run the required verification.
4. Create a focused checkpoint commit.
5. Start the next task with `npm run atlas:prompt` or the task-specific brief.

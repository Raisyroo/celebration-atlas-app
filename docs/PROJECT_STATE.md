# Celebration Atlas Project State

Last updated: July 15, 2026

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

Scout's visual identity and source-backed prompt suggestions are implemented. A universal conversational Scout service is not yet connected.

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

The Michigan Atlas homepage completed a rail and responsive-layout baseline on July 15, 2026.

- The bottom rail now contains only exact-dated live or upcoming public events, evaluated in the Michigan time zone and sorted live-first then chronologically.
- Completed, undated, TBA, estimated, and recurrence-only events remain eligible for general map/search discovery when otherwise public, but do not appear in the time-sensitive rail.
- Ask Celebration Atlas remains visible when no rail event qualifies.
- Short non-desktop landscape viewports retain menu, favorite, filter, Ask Atlas, and dated event access beside a bounded full-art map.
- Desktop preserves the portrait artwork content box beside a non-overlapping introduction/discovery panel instead of cropping the state art into a wide phone-like frame.
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

The Michigan homepage audit and safe responsive baseline are complete. The recommended next map milestone is a diagnostic definition of the shared `StateMapPresentationProfile` and one position resolver for stars, labels, atmosphere, constellation lines, and audits. That work should preserve verified coordinates as source truth and treat illustrated offsets as versioned presentation data.

No follow-up implementation task is selected. Promote one future queue item to `next` only when Ray chooses the next milestone.

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

## Handoff Convention

Use a fresh Codex task for each distinct milestone, opened in this same local project. The working tree and committed documentation carry the durable state; each task keeps its own transcript.

At milestone completion:

1. Update this file if operational truth changed.
2. Update the single next item in `docs/ATLAS_TASK_QUEUE.md`.
3. Run the required verification.
4. Create a focused checkpoint commit.
5. Start the next task with `npm run atlas:prompt` or the task-specific brief.

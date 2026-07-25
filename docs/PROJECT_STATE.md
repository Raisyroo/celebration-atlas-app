# Celebration Atlas Project State

Last updated: July 23, 2026

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
| Armada Fair | `armada-fair` | Published package |

The seven factory-published packages are at 100 percent readiness. Existing package and manifest fallbacks must remain valid while the generalized pipeline expands.

The private review queue is empty.

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

The Armada Fair timing trial is complete. Its reviewed bundle retains eight explicit official snapshots, eleven claims, and eight 2026 schedule rows; its five-item verification case is verified at 100 percent. Ray's supplied text-free 2:3 hero is approved and publicly stored. Accepted deterministic synthesis `c94f5934-efea-4b2b-8012-fb4cab10f47f` uses engine v19, is valid at 95 percent quality, has no factual conflicts or missing fields, and retains the sourced OpenStreetMap fairgrounds record. Its visitor-facing Event Hub uses Why Go, Schedule, Highlights, and Plan; the revised Why Go and Schedule copy sells the experience without exposing factory provenance language. The corrected hero revision `ebd0c53a-538a-43cb-8492-041110e0f470` removes the inaccurate water tower and is retained by published package v6 `f8aa5fd0-30a7-4197-b6ee-9ce12b84a299`, immutable Event Hub version `7ce8c474-3577-4ee4-8edf-7ed1f5a68f98`, and media record `4751504b-6cd7-489a-91df-8165ece9806c` for canonical event `46d7e6ff-bec5-4801-80da-2d21aa131092`. The public page is live at `https://celebration-atlas-app.vercel.app/events/armada-fair`.

This trial also hardened the reusable path before more fairs enter the queue:

- Candidate intake now preserves the reviewed event key, event type, recurrence, official URL, and canonical `Michigan` state value.
- Factory joins compare only present candidate, event, and event-key identifiers, preventing unrelated null-owned records from sharing visual, verification, synthesis, or package readiness.
- Supporting source captures can explicitly contribute identity, description, or location claims.
- Schedule extraction can combine retained edition-date claims with a separate official heading/date-pair page while preserving both claim ids in row provenance.
- Fair schedules now use first-class `livestock`, `exhibits`, `grandstand`, and `midway` categories through synthesis, validation, filtering, and Event Hub rendering.
- Fair schedule categories now create source-bound Grandstand, Livestock, Midway, and Exhibits Scout shortcuts when matching current items exist.
- Operational homepage notices such as exhibitor drop-off instructions remain retained as evidence but are excluded from general Event Hub copy; synthesis falls back to a restrained overview derived from source-backed schedule categories.
- Every new Event Hub must materialize four primary sections: Why Go, Schedule, one evidence-backed experience section such as Highlights, and Plan. Missing third-section evidence is a completeness failure rather than permission to ship a three-tab page.
- Visitor headlines, summaries, and module introductions must invite attendance. Factory phrases such as `official program` and `source-backed event times` belong in retained provenance and review surfaces, not public-facing promotional copy.
- A protected fixed API action exposes the existing audited source-synthesis map-record operation.

Armada publication is complete. The next Event Factory trial should begin from the generalized v19 rules and measure how much editorial intervention remains, rather than adding Armada-specific code.

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

Event-category exemplars may guide layout or rendering quality, but they are not event-content references. The selected generation must follow the saved event-and-location research, recurring motifs, and defining hero moment; if the actual generation diverges, reset QA, replace the asset, and rerun the checks before requesting approval.

New package preparation prefers the approved cloud asset and retains the full visual brief and QA audit. Existing published legacy packages continue to render without retroactive migration.

Migration `017_event_factory_revisions.sql` adds the correction path for a released same-edition event. Visual workflows retained by frozen packages and published packages remain immutable. A corrected hero starts a linked, QA-reset visual revision; once that revision is approved, package preparation freezes a new linked package version for the usual private preview and human publication decision. This is the reusable path for fixing released art without overwriting the earlier cloud object, package, or Event Hub version.

## Scout Status

Scout's visual identity is implemented. Event Hub Ask Scout is now a single-purpose question composer: suggestion chips, suggested questions, predefined prompt tags, and event-specific keyword response routing are not rendered. Existing source-backed suggestion records remain in published manifests as compatibility data for the reviewed Event Factory lifecycle.

The composer exposes a versioned context contract for event ID, content package/version, source kind, and active Event Hub section. Published page versions, Event Factory package previews, source-synthesis previews, and checked-in transition manifests each supply the strongest content reference they currently own.

The universal conversational Scout service is not connected. Each valid submit appends the question and the same client-only generic response to an ordered, same-event conversation so the future answer flow can be reviewed; it performs no retrieval, source lookup, or event-specific reasoning, and the copy explicitly states that the universal service is not connected. Submitting makes the retained history visible, clears the text-entry area, explicitly dismisses the mobile keyboard, and moves keyboard focus to the send control. A top-right X control hides the response history, dismisses the keyboard, and restores focus to the send control without deleting any turns. Refocusing the question input during the same event reopens that retained history, and asking another question appends to it. The history is component-local and every Event Hub call site is keyed by event ID, so leaving or switching events clears it and a later return starts clean. The outer Scout surface remains one shared dock: the history wrapper and conversation turns use only spacing and dividers, while the logo, borderless transparent text-entry area, and submit control remain on one row with no nested text box. The fixed composer uses safe-area and visual-viewport keyboard insets, a 16px input to prevent iOS focus zoom, minimum 44px send and close targets, bounded scrollable history, and visibility-conditioned responsive clearance for its expanded and keyboard-focused states.

Do not build one-off deep-question logic into individual event pages. The future Scout response layer should retrieve approved event claims, schedules, rules, PDFs, provenance, and freshness metadata at request time, then answer with citations and uncertainty controls. Event-specific source intelligence should become shared retrieval data, not custom chatbot code.

## Supabase And Atlas Control

- Remote migrations `005` through `017` are applied.
- Atlas Control is protected and uses server-side service-role routes for editorial mutations.
- Public pages never receive the service-role key.
- The Control Desk supports source inspection, bundle collection, synthesis, verification, package review, publication, and visual workflow approval.
- Production authentication remains required. An existing signed-in browser session reaches `/atlas-control`; unauthenticated requests redirect to `/atlas-login`.
- Migration `014` creates the public media bucket and service-only visual workflow tables and RPCs.
- The first migration-014 visual workflow is approved for the Coast Guard Festival private package. Its supplied 1024x1536 hero is stored in `celebration-atlas-media`; package approval remains separate.

Never place Supabase or Vercel credentials in documentation, source code, prompts, or commits.

## Michigan Homepage State

The Michigan Atlas homepage completed its search-first public discovery checkpoint on July 16, 2026, building on the rail, deterministic discovery, and shared responsive-shell work completed July 15.

- The homepage now receives an explicit serializable Michigan state configuration and state-local event catalog; `AtlasMap` no longer owns a silent global Michigan fallback.
- Published database overlays are scoped to canonical `MI`/`Michigan` events before published packages are loaded, so another state cannot leak into or replace a Michigan fallback event by name.
- The bottom rail now contains only exact-dated live or upcoming public events, evaluated in the Michigan time zone and sorted live-first then chronologically.
- Published package dates retain their reviewed event timezone. Rail eligibility evaluates each event in its own valid timezone and falls back safely to the state timezone when needed.
- Completed, undated, TBA, estimated, and recurrence-only events remain eligible for general map/search discovery when otherwise public, but do not appear in the time-sensitive rail.
- Ask Celebration Atlas remains visible when no rail event qualifies.
- Short non-desktop landscape viewports retain menu, favorite, Ask Atlas, and dated event access beside a bounded full-art map.
- Desktop preserves the portrait artwork content box beside a non-overlapping introduction/discovery panel instead of cropping the state art into a wide phone-like frame.
- Versioned artwork identity, dimensions, and SHA-256 values are retained in the state configuration and checked by `validate:state-atlas-data` during every full build.
- Homepage search now runs through one deterministic resolver with explicit state rules, catalog, profiles, configuration, and a review-time clock. Exact identities remain unique, broad results are stably ranked, and only structured identity, place, category, region, reviewed date, season, live/upcoming status, or curated state rules participate.
- The legacy any-token matcher and the rule that incorrectly linked cherry, lilac, and tulip searches to Romeo Peach Festival were removed. Exact navigation, map labels, result callouts, and the geospatial development route now share the same resolver semantics.
- Search label locations preserve the supplied state instead of appending `MI`, and the full build includes deterministic regression coverage for ambiguity, category leakage, reviewed dates, state curation, and catalog-order independence.
- One classifier now owns portrait, compact-landscape, and desktop behavior. `1024×390` remains compact rather than entering a broken desktop hybrid, while desktop requires at least `1024×600` in landscape.
- Essential menu, Ask Atlas, and dated-rail controls no longer wait for artwork loading or map measurement after rotation. The selected artwork variant and viewport mode are exposed as root data contracts and covered by responsive browser contracts.
- The public Michigan homepage is now search-first. The visible filter button, mobile filter sheet, and desktop filter controls are removed, while the underlying exact category, curated region, exact city, reviewed month/date, live/upcoming, facet, and discovery APIs remain available to search, Scout, Near Me, agents, and future indexes. Artistic atmosphere labels never become geographic regions.
- Query-only broad search uses accessible, clickable title tags on the illustrated map. Exact identity still navigates directly, combined structured criteria intersect, and a query-only empty result now opens a clear visible no-results panel while hiding contradictory markers.
- Submitted homepage discovery queries now live in the public `q` URL parameter and are deterministically reconstructed from the reviewed Michigan catalog. Browser-history entries retain only presentation state: page scroll, live/upcoming rail position, open result cluster, selected result, and exact-navigation suppression. Internal Event Hub transitions remain App Router client navigations, Back restores the homepage context without duplicated result storage, Forward returns to the same Event Hub, and exact-search returns do not immediately redirect again.
- The large mobile landing identity is now a one-way, session-scoped welcome. The first meaningful interaction or a durable search URL dismisses it, the cream Michigan identity remains for the rest of that browser-tab session, and a source-keyed artwork readiness contract prevents cached-image load ordering from hiding or reviving either state.
- Event Hubs expose an explicit Atlas-home destination instead of a control that claims to be Back. Native browser Back remains the sole discovery-restoration action; authenticated package and synthesis previews return explicitly to Atlas Control.
- Unmanifested events remain discoverable through one generic inline card and no longer advertise experimental detail templates. Missing or failed thumbnails use the asset-independent event glyph, while approved hosted flyer decks remain supported. Broken local flyer references were removed without removing their events, and full builds now verify every retained local flyer path.
- The mobile menu retains Escape/focus containment, focus restoration, and background inerting. Query result title tags are keyboard targets; decorative labels and overflow indicators are not duplicate targets.
- The public mobile hamburger is intentionally anonymous-only: About Celebration Atlas, Privacy, and Terms. Celebration Atlas has no public account session or favorites collection yet, so the menu exposes no Sign In, Create Account, Favorites, Account, Sign Out, Atlas Login, discovery reset, or administrative action. Existing homepage and Event Hub heart toggles remain browser-local preferences outside the hamburger; `docs/PUBLIC_ACCOUNT_FAVORITES_FOLLOW_UP.md` defines the separate account and synchronized-favorites milestone.
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

Armada Fair completed the Event Factory and is public at:

`https://celebration-atlas-app.vercel.app/events/armada-fair`

The package retains eight official snapshots, eight current schedule rows, a sourced OpenStreetMap fairgrounds record, a fully verified 2026 diligence case, and Ray's approved Supabase-hosted hero. Deterministic synthesis v19 excludes operational exhibitor copy, derives fair duration and experience claims from retained evidence, and enforces the four-section Why Go, Schedule, Highlights, and Plan structure.

The package, canonical event, immutable Event Hub v1, approved media record, and homepage entry were published together on July 23, 2026. Production mobile review at `390x844` confirmed the hero, all four sections, zero horizontal overflow, and a clean browser console.

## Current Next Milestone

The state-scoped catalog/configuration, deterministic search, live/upcoming rail, shared viewport model, and search-first public discovery surface are complete checkpoints. Filter and facet data contracts remain retained beneath the public UI.

The next focused checkpoint is a shared `StateMapPresentationProfile` and one versioned position resolver for stars, labels, atmosphere, constellation lines, and audits. It must account for artwork fit/crop, keep Upper and Lower Peninsula calibration regions separate, render one accessible coded-star control per reachable event on every supported viewport, and preserve verified coordinates as source truth while treating illustrated offsets as presentation data. Pre-aggregate discovery facet counts before catalogs grow to national scale.

The anonymous public hamburger cleanup is also complete. Public accounts and synchronized favorites remain a separate, unselected milestone defined in `docs/PUBLIC_ACCOUNT_FAVORITES_FOLLOW_UP.md`; do not expose account menu controls until that complete public system exists.

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

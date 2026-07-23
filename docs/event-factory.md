# Celebration Atlas Event Factory

## Objective

The Event Factory converts statewide discovery into complete, evidence-backed Celebration Atlas event packages. AI performs research and production work. An editor approves the finished package before it becomes public.

The operating loop is:

```text
Discover -> Verify -> Enrich -> Place -> Compose -> Illustrate -> Approve -> Publish -> Monitor
```

The unit of work is an event package, not an individual web page. A package freezes the exact canonical profile, public map record, Event Hub manifest, Scout context, art brief, selected artwork, and evidence links that an editor reviews. Optional collectible cards are downstream outputs of the same approved intelligence.

## Readiness Gates

Every package must report these gates independently:

| Gate | Ready means |
| --- | --- |
| Exists | An official or organizer-controlled source confirms the event identity. |
| Annual | Retained evidence confirms a repeating annual event, ideally with explicit annual language or occurrences in multiple years. |
| Dates | Current-year dates are confirmed, or a reviewed not-yet-announced state is stored. |
| Location | City or venue is confirmed and map coordinates have a retained source and verification state. |
| Sources | The official source is supported by at least one useful corroborating source. |
| Map | A canonical public map record can be rendered from approved database data. |
| Page | A valid accepted source-synthesis manifest, reviewed page version, or checked-in transition manifest can render a private Event Hub preview. |
| Art | Celebration Atlas artwork is approved, or an editor has deliberately selected an allowed fallback. |

An event description containing words such as `annual` or `recurring` is a claim, not proof. The underlying source and excerpt must remain available for review.

When a current schedule is pending, the editorial planner searches retained official schedule pages for the latest complete earlier program. Exact historical times may appear only inside a year-labeled `referenceSchedule` with a persistent caveat; they are never projected onto the current edition. A simpler `recurringEvents` guide remains available when the source documents recurring experiences but no complete earlier program can be reconstructed.

Official About, history, personalities, pageant, parade, and gallery pages are part of bounded source collection. When they support multiple enduring traditions, synthesis creates a dedicated `Traditions` tab and retains the source ids behind every story. The deterministic planner also creates source-bound Scout commands for traditions and available schedule categories before any model writes prose.

Supporting pages may contribute event identity, description, or location only when the capture request explicitly enables that claim scope. When one official page publishes the edition date range and another publishes day/time rows without a year, schedule extraction may use the retained bundle date claims as its date basis; every generated row records the exact start/end claim ids alongside its source-snapshot locator. Heading/date-pair pages and static day lists are reusable schedule adapters rather than event-specific code.

Fair manifests use first-class `livestock`, `exhibits`, `grandstand`, and `midway` schedule categories in addition to the existing general categories. Those values are validated, synthesized, filtered, and rendered by the shared Event Hub. Matching current categories also create source-bound Scout shortcuts rather than requiring fair-specific response code.

An extracted `identity.description` is not automatically suitable as a general overview. Operational notices such as exhibitor instructions, drop-off schedules, forms, and task-specific calls to action remain in retained evidence but are excluded from public Event Hub prose. When no suitable general description remains, deterministic synthesis creates restrained overview copy from the current source-backed schedule categories.

## Automation Boundary

AI may discover events, inspect sources, archive evidence, reconcile facts, classify the event, geocode the location, generate a manifest, prepare Scout context, create an art brief, generate artwork, and assemble a private preview.

During the Michigan pilot, only a human approval may release a package publicly. Approval is a single package-level decision after all blockers are visible and the mobile preview has been reviewed. Canonical materialization, map publication, Event Hub publication, and art registration remain separate audited effects underneath that decision so any failed effect can be retried safely.

Package preparation never creates or updates a public canonical event. Migration 011 stores packages and their action history behind service-role-only access. The `Approve and publish` control is the first action allowed to materialize the candidate into `events` and publish the reviewed Event Hub version.

Package assembly prefers a valid, accepted `event_source_syntheses.manifest_proposal`. Its reconciled profile may carry a source-backed `mapRecord` so a new event can reach private review before its canonical event row is public. Checked-in Event Page Manifests and map records remain transition fallbacks for existing pilot events; new factory events do not require event-specific source code.

Every assembled package has an authenticated preview at `/atlas-control/event-preview/[packageId]`. This route renders the exact frozen manifest under review and is marked non-indexable. The public `/events/[slug]` route continues to resolve only published Event Hub versions.

The homepage resolves database events only from packages whose final status is `published`, validates the retained page manifest again, and merges those records over the checked-in Michigan pilot catalog. This lets newly approved packages appear without expanding the hardcoded map array while preserving local fallbacks during the transition.

## Discovery Coverage

Statewide discovery must be measured as coverage rather than an unbounded search result count. Campaigns should track:

- Counties and major municipalities checked.
- State, regional, county, chamber, venue, fair, festival, arts, and tourism sources checked.
- Source freshness and last successful inspection.
- Candidates found, duplicates resolved, exclusions, and unresolved research.
- Known coverage gaps by geography, season, and event form.

The same campaign model can be reused for every state by changing the jurisdiction and source registry, not the Event Factory logic.

## Art Workflow

Art is a replaceable output of verified intelligence. New Event Factory packages use the Hero Image Factory stored by migration 014 rather than treating a local image path as approval.

The fast visual lane records:

- An event-and-location image search query.
- Approximately 15 to 30 reviewed thumbnails.
- Representative public source-page URLs.
- Three to five recurring visual-signature motifs.
- One defining hero moment.
- A deterministic text-free Celebration Atlas generation brief in vertical 2:3 format.
- A public Supabase Storage asset, alt text, content hash, and storage path.
- QA for source accuracy, independent composition, invented text or marks, mobile crop, and public delivery.

The workflow begins in `draft`, can become `ready_for_review`, and requires explicit human approval. Generated art cannot imply official branding, sponsors, performers, landmarks, insignia, or event features that are not supported by the approved package. An editor may approve a generated option, replace it with manually created art, or request another variation without reopening factual verification.

Art from another event may be a rendering-quality or layout exemplar, but it must never outweigh the target event's own thumbnail research or act as evidence for its content. The uploaded asset must implement the stored event-specific generation brief. When a generated option drifts from that brief, the editor resets its QA checks, replaces the cloud asset, and verifies the new mobile crop before the workflow can return to `ready_for_review`.

Package synthesis and preparation prefer the approved cloud asset and retain the complete visual brief and review record. New visual-signature packages cannot publish without that approved workflow. Existing published pilot packages remain compatible and are not retroactively blocked.

## Current Pilot

Brown Trout Festival is the first dense vertical slice. Romeo Peach Festival is the first source-driven factory page with no checked-in Event Page Manifest. Its published package retains official snapshots, independent corroboration, a verified 2026 case, accepted model-assisted manifests, source-backed village-center coordinates, and Celebration Atlas art. Romeo's third page version established the reusable reference-rich festival pattern: confirmed 2026 facts, a visibly labeled 2025 reference weekend, and source-backed traditions occupy separate truth layers. Deterministic synthesis version 4 now detects that pattern plus general festival royalty, parade, harvest, arts, and Scout structures, while human package approval remains required.

National Cherry Festival is the first clean-room test of the evidence-bound editorial pipeline. Its published package retained eight official source snapshots, ten canonical claims, and 204 official 2026 schedule rows. Deterministic synthesis version 6 created four tabs, four tradition stories, and four Scout commands; the Vercel AI Gateway editorial pass refined 27 allowlisted prose targets, added two audience groups and one Scout Spotlight, and preserved every immutable fact. Sponsor text, raw calendar markup, stale internal year labels, false subpage identity conflicts, research narration, schedule-only Spotlights, and stale rewrite citations are excluded by automated checks.

Black River Tattoo Convention established the completed-event pattern, and the St. Clair County 4-H & Youth Fair established the rules-and-deep-reference pattern. Both are published packages. Their supporting documents remain reusable Scout retrieval material rather than one-off chatbot code.

Armada Fair is the first completed speed-with-quality factory timing trial. Its initial bounded crawl was archived when it followed an unrelated event page on the same official domain; the replacement uses an explicit eight-page source list. The retained evidence produces eight current schedule rows, a sourced OpenStreetMap fairgrounds record, and a fully verified 2026 diligence case. Ray's supplied text-free 2:3 hero is approved without treating its combined scene as documentary evidence of the fairgrounds layout. Deterministic synthesis v19 excludes an exhibitor drop-off notice that the homepage extractor had selected as `identity.description`, uses source-backed fair facts to create visitor-facing Why Go and Highlights modules, and requires the four-section Why Go, Schedule, experience, and Plan structure. Fair duration, carnival frequency, lineup references, agricultural experiences, and highlight counts are all derived from retained event evidence rather than Armada-specific defaults. Factory-facing phrases such as `official program` and `source-backed event times` are prohibited from public module introductions. Accepted synthesis `c94f5934-efea-4b2b-8012-fb4cab10f47f` has no conflicts or missing fields. Package `cca41beb-ddc5-4cb0-a168-b38c27affb69` published canonical event `46d7e6ff-bec5-4801-80da-2d21aa131092` and immutable Event Hub version `faadd134-33c6-4d5b-8265-d419207ead29`; the page is live at `https://celebration-atlas-app.vercel.app/events/armada-fair`.

The Michigan Event Factory dashboard audits every existing Supabase discovery and canonical event record against all eight gates. This makes missing recurrence proof, dates, coordinates, sources, map integration, page composition, and art visible before the system is allowed to scale its mistakes.

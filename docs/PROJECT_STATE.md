# Celebration Atlas Project State

Last updated: August 2, 2026

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
| Shelby Township Art Fair | `shelby-township-art-fair-shelby-township-mi` | Published package |

The eight factory-published packages are at 100 percent readiness. Existing package and manifest fallbacks must remain valid while the generalized pipeline expands.

The bounded Macomb completion pilot retains event-scoped completion exceptions
for records that still need facts. Shelby Township Art Fair completed the first
Ray-approved full-manifest authorship proof and was explicitly published; that
approval does not authorize any other Macomb candidate.

## Event Factory

The reduced art-optional publication path is implemented. A fully verified, identity-cleared package may become review-ready with `art=false`; its public Event Hub renders a deliberate image-free hero. The existing Atlas Control visual workbench now has a finished external-image path governed by `docs/EVENT_IMAGE_SPECIFICATION.md` (1024 x 1536, 2:3, JPG/PNG/WebP, 8 MB). Upload, approval, attachment, replacement, and removal retain the existing visual, package, media, Event Page, URL, and audit architecture. No image generation is part of this path.

Forward-only migration `027_art_optional_event_hubs.sql` was deployed to the linked Supabase project on July 29, 2026, with local and remote migration parity verified through `027`. It adds no table. It keeps all functions service-role-only, makes an image-free package review-ready only after the seven non-art checks plus verified diligence and identity clearance pass, permits null media only for an actually empty hero during atomic activation, and creates immutable manual-art and art-removal revisions. It cannot approve a workflow or package, materialize a candidate, or publish a page by itself.

Forward-only migration `030_enforce_new_event_content_readiness.sql` is also deployed, with local and remote history aligned through `030`. It adds no table or public write path. Its service-role-only trigger blocks new root Event Factory packages from entering private review or publication states unless they contain exactly four substantive, source-backed topics. Existing published compatibility fixtures and linked correction revisions remain valid.

Forward-only migrations `031_reprocess_retained_source_schedule.sql` and
`032_fix_retained_schedule_conflict_target.sql` are deployed with local and
remote history aligned through `032`. They add no table or publication path.
The service-role-only RPC can attach newly derived deterministic schedule rows
to an exact retained snapshot SHA-256 while its private bundle is reopened,
deduplicates every row, and appends an audit action. Shelby proved the path by
recovering eight current entertainment rows from an already retained official
Wix page without replacing evidence or touching public domain tables.

The operating loop is:

```text
Discover -> Verify -> Collect -> Reconcile -> Compose -> Illustrate -> Preview -> Approve -> Publish -> Monitor
```

An event package freezes the candidate, canonical profile, map record, Event Hub manifest, Scout context, evidence, art workflow, and review state. New event-specific source code should not be required.

Key boundaries:

- Official-source inspection creates research candidates only.
- Evidence bundles retain source snapshots and field-level provenance.
- Deterministic synthesis reconciles facts and preserves disagreements.
- Model-assisted editorial work may author the complete visitor-facing manifest when every claim remains grounded in retained evidence. Identity, dates, schedule rows, source identities, approved art, canonicalization, and publication state remain protected.
- Private package previews render the exact package under review.
- Human package approval is the only Michigan-pilot action that may publish a new event and add it to the public map.
- Published package events overlay the checked-in catalog so the map can grow without expanding a hardcoded array for every event.
- Deployed forward-only migration `021_atomic_event_factory_publication.sql` moves the Event Factory public boundary into one service-role-only transaction after canonical materialization, Event Hub approval, and hero registration. The transaction locks and verifies the package, canonical event, exact frozen manifest, approved version, and approved hero record; then it archives the prior version, activates the replacement, marks the package published, and appends both audit histories atomically. Failed media or activation leaves a new version private and preserves the old public version during revisions. Exact replay is a no-op. Shelby Township Art Fair exercised this boundary successfully with package v8 and an approved Supabase hero.

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
- Forward-only migration `020_preserve_deterministic_editorial_parent.sql` keeps a deterministic synthesis `generated` while its model-assisted editorial child is generated, reviewed, or rejected. A rejected child may be retried without defeating deterministic replay; only acceptance supersedes the parent, and accepted uniqueness remains enforced per evidence bundle. The migration appends a compensating `restored` action for any legacy parent that was superseded only by a non-accepted editorial child.

Armada publication is complete. The next Event Factory trial should use the current generalized v21 rules and measure how much editorial intervention remains, rather than adding event-specific code.

The reusable county-seed parser and deterministic matching crosswalk are implemented as read-only Event Factory infrastructure. Macomb County Seed Inventory v1 reads only the finalized workbook's `03_IMPORT_READY` sheet, enforces the 40-column contract and 83 approved unique Clean IDs, preserves complete row provenance, fingerprints both the workbook and approved sheet, normalizes seed fields without treating spreadsheet qualification as publication approval, and compares every seed with the deployed Michigan canonical-event and candidate records. Its primary dry-run classifications are 2 existing canonical likely matches, 46 provisional new candidates, and 35 insufficient-information seeds. Armada Fair and Romeo Peach Festival are the two likely canonical matches. All 83 seeds still require current-edition verification and verified coordinates or address resolution.

The county-seed dry-run command itself creates no discovery run or candidate and performs no Supabase writes. Its human-readable, machine-readable, and schema-parity outputs live under `artifacts/county-seeds/macomb/`, and the focused commands are `npm run dry-run:county-seeds -- <workbook.xlsx> --county-code macomb --output artifacts/county-seeds/macomb` and `npm run validate:county-seeds -- <workbook.xlsx>`. The later, separately authorized Bay-Rama canary is the only county-seed candidate staged so far; event research, publication, imagery, and clustering have not begun.

Read-only deployed-schema inspection confirms that `discovery_runs`, `event_candidates`, `event_candidate_sources`, `events`, `atlas_operation_runs`, and `atlas_operation_actions` expose the columns expected by the current operational contract. The repository still lacks the historical foundational migration `004_atlas_control_plane.sql`, and PostgREST OpenAPI does not expose every check constraint or unique index. Phase C0 independently retrieved the narrow deployed contract and generated a checked TypeScript excerpt; Phases C2B/C2C then independently verified the required live objects before deploying the two guarded county-intake migrations. The dry-run tooling itself applies no migration. Mount Clemens remains the intended first municipality-scale clustering pilot after its event records are completed; no clustering implementation is part of this milestone.

Phase C0 independently reconstructed and committed the narrow deployed county-intake contract, exact function definitions, constraints, indexes, privileges, and generated TypeScript excerpt without recreating the missing historical migration 004. Phase C1 now adds guarded local staging-readiness infrastructure while preserving the zero-write boundary. The deterministic adapter retains the full workbook, row, URL, decision, cleanup, parser, adapter, and payload-hash provenance in the proposed candidate raw payload. GET-only preflight covers canonical, URL, name/location, alias/location, slug, idempotency, county identity, source ownership, organizer/venue, promoted-candidate, and fuzzy warning conditions.

The approved Batch 0 result is a no-write crosswalk only: `MAC-001` remains linked to Armada Fair and `MAC-050` remains linked to Romeo Peach Festival; neither creates or updates a database row. The historical immutable Batch 1 manifest contains exact, non-executed payloads for `MAC-003`, `MAC-004`, `MAC-008`, `MAC-011`, `MAC-041`, `MAC-042`, and `MAC-049`; its SHA-256 is `d0203c6b9141f068a3a4c25ad6449ed641877117d7010fefabc535fb25bae9f2`. A GET-only scan found no candidate-slug, candidate/source, operation-identity, exact county-identity, or seven-record preflight collision. That complete manifest remains unauthorized and must not be executed; deployment of the guard migrations does not grant batch approval.

The seven-record Batch 1 manifest remains retained as historical preparation, but it is no longer the selected first-event pilot. The revised immutable pilot manifest contains only `MAC-042` Bay-Rama Fishfly Festival, `MAC-049` Richmond Good Old Days Festival, and `MAC-026` Memphis Festival Days in `county-seed-first-event-pilot-staging-manifest-v2.json`; its SHA-256 remains `d2d1c245c1c8ac4abea3a1fef1e21a9ab8da2adf7a05d0db6c8bfbaba3079fd8`. Memphis retains its Phase B `Insufficient information` warning and missing address/organizer-source warnings rather than being silently promoted to a complete seed. Current-edition verification, geocoding or address resolution, evidence, Event Hub preparation, and Art remain future work. No image is included or selected; each Art gate reads `Waiting for Ray-provided image.`, and publication is blocked pending Ray's approved image.

Migrations `018_guard_county_seed_candidate_staging.sql` and `019_allow_revised_county_seed_pilot_manifest.sql` are deployed to Supabase project `hmytrcorqkqvoaedvgbf`. Migration 019 changes only the guarded RPC disposition check: it accepts the two exact values `provisional_batch_1_manifest_only` and `revised_three_event_pilot_manifest_only`; nulls, prefixes, suffixes, and every other value remain rejected. SECURITY DEFINER, empty search path, service-role-only execution, advisory locking, hash and identity checks, duplicate protections, promotion-state checks, and guarded delegation remain intact. Migration deployment changed no application-data counts.

The separate Bay-Rama canary authorization binds only `MAC-042` to manifest SHA-256 `d2d1c245c1c8ac4abea3a1fef1e21a9ab8da2adf7a05d0db6c8bfbaba3079fd8` and payload SHA-256 `8672985d675e18749bec93030b4b2f13eda7df7a4f73d398e453d5a2fc3f6594`. The guarded execution created candidate `6da5b04d-013f-45d0-acc1-9bbc782de02f` plus exactly one discovery run, official source association, operation run, and applied operation action. Counts moved from 10/23/40/7/7 to 11/24/41/8/8 for discovery runs/candidates/sources/operation runs/actions; canonical events remained 19 and matched candidates remained 18. An exact replay returned the same candidate and operation without duplication; a different-hash replay was rejected and rolled back. `MAC-049` and `MAC-026` remain unstaged. No canonical event, package, Event Hub, publication, visual workflow, image, or placeholder art was created. The append-only audit and verification artifacts are retained beside the authorization under `artifacts/county-seeds/macomb/`. No further pilot record is authorized. See `docs/COUNTY_SEED_STAGING_READINESS.md`.

## Michigan Completion Operating Layer v1

The Michigan Completion Operating Layer is implemented in the current working tree as an eleven-stage, deterministic-first coordinator around the existing county intake, identity, source-evidence, synthesis, Event Factory, visual-readiness, and publication-readiness capabilities. Publication is intentionally absent from its stage registry and command interface.

Persistent completion state reuses `atlas_operation_runs`, append-only `atlas_operation_actions`, and `atlas_review_items`. Migration `023_michigan_completion_operating_layer.sql` adds fixed service-role-only completion RPCs, exact replay and conflicting-replay guards, atomic model-budget reservation and usage recording, and the single genuinely missing `atlas_review_item_actions` exception-transition ledger. It does not add a parallel run, event, stage, model, identity, synthesis, package, or publication table family.

The command `npm run atlas:complete-michigan-batch` defaults to dry-run, requires `--authorize-private-writes` for existing private workflow mutations, supports bounded concurrency, deterministic-only execution, explicit run and per-event model budgets, exact resume, and a structured report. It exposes no publication option. Model assistance is reserved only after deterministic processing and records its route, reason, preconditions, configured model, attempt cap, usage, budgets, fallback, and terminal outcome.

Content and art readiness are independent. Complete source-bound Event Hub content can remain `art_pending` without a hero URL, but missing art alone is no longer a publication-blocking exception. The completion layer never searches for, generates, copies, edits, uploads, selects, substitutes, or approves imagery. Public validation accepts either a complete hero source/alt pair or a deliberately empty pair.

Atlas Control gains only a protected compact completion-run projection and linked completion-exception context. The full architecture and operating contract are in `docs/MICHIGAN_COMPLETION_ARCHITECTURE.md`; the bounded county rollout and first-proof procedure are in `docs/MICHIGAN_COMPLETION_EXECUTION_PLAN.md`.

Migrations 023 and 024 passed the required release gate and are deployed. Migration 024 is the forward-only correction for the PostgreSQL-specific run-list limit expression found during read-only verification; migration 023 was not edited in place. Local and remote migration history is aligned through 024. The service-role run list returns an empty array, the completion exception-action table is empty, and anonymous access to both is denied. Before/after verification retained 19 canonical events, 18 matched candidates, eight published package rows, seven published page pointers and versions, and nine approved media records with identical public-state hashes. No production completion run has been started, and this implementation has not staged, canonicalized, packaged, or published any production event. The existing Bay-Rama candidate is unchanged; Richmond and Memphis remain unstaged; no image action has occurred.

## Michigan County Completion Operator

The local working tree now contains the minimum county-level coordinator requested by the Macomb workflow audit. `npm run atlas:create-county-events -- <county>` verifies a registered retained county inventory, classifies every row, reuses existing canonical/candidate/run/evidence/package records, creates bounded hash-protected Michigan Completion manifests for only eligible records, safely discovers resumable runs, and produces one aggregate county report. It defaults to deterministic zero-model dry runs with concurrency one. `--plan-only` performs classification plus local manifest/report generation without starting or resuming a run. Private records require explicit `--authorize-private-writes --actor <identity>`.

Macomb's registry binds the retained 83-record `03_IMPORT_READY` inventory and its exact artifact, workbook, sheet, row-count, header, and row fingerprints. Every record receives one report disposition. Armada Fair and Romeo Peach Festival reuse canonical records; Art on the Bay and other compatible retained records reuse candidates/runs; protected or held Bay-Rama, Richmond, and Memphis are excluded; ambiguous and insufficient records remain blocked; only the rest enter bounded manifests.

The operator remains a thin layer over the existing county staging, Michigan Completion, source-bundle, synthesis, verification, Event Factory, visual-readiness, review, and publication-safeguard contracts. Deterministic identity clearance cannot use fuzzy similarity as proof and cannot create a canonical event or match. Source composition uses the existing bounded capture service. Official-family evidence may clear a private verification case automatically only when it proves identity, current dates, location, and annual recurrence; otherwise the event stops with the exact facts still needing human verification.

Forward-only migration `026_generalize_county_completion_staging.sql` contains the generalized guarded staging predicate and service-role-only deterministic identity-clearance action. It was deployed atomically on July 29, 2026, and local/remote migration history is aligned through 026. Service-role calls reach the function's fail-closed input validation; anonymous calls are denied with `42501`.

Forward-only migration `028_fix_county_completion_identity_target_type.sql`
corrects the identity-clearance replay lookup to compare the deployed UUID
action target directly with the UUID candidate parameter. The original
production-shaped five-event run exposed the migration-026 `uuid = text`
comparison before identity clearance. Migration 028 patches only the existing
function definition inside one transaction, retains its service-role assertion
and execution grants, and adds no table or alternate workflow. It was deployed
on July 29, 2026, and local/remote migration history is aligned through 028.

Forward-only migration `029_official_first_event_verification.sql` is deployed
with local/remote parity through 029. It keeps the existing verification,
evidence, and package RPCs, adds service-role assertions to all three replaced
definitions, recognizes retained pages in the official host family, permits
strong annual language to corroborate an official current occurrence, requires
current dates before verification, and removes the blanket second-source
requirement. It adds no table and cannot create a canonical event, public page,
media record, discovery record, or publication pointer.

The first Macomb `--plan-only` projection classified all 83 retained records without starting or resuming a completion run: 43 eligible for guarded staging, 34 insufficient, three protected or held, two existing canonical records, and one disputed identity record (`MAC-041` Art on the Bay). It generated nine local dry-run manifests and `artifacts/michigan-completion/macomb/county-operation-report-v1.json`, whose canonical SHA-256 is `abdf37f05007e56eb9e2920e6e6978e8ba4c46264f9b4d667acc5b5547b26b75`.

Before/after plan-only counts and stable hashes are identical for canonical events, candidates, candidate sources, source bundles, syntheses, verification cases, packages, pages, page versions, media, visual workflows, completion runs/actions, and review items. No model, image, canonicalization, publication, or private-processing action occurred. The full contract is in `docs/COUNTY_COMPLETION_OPERATOR.md`.

The first bounded private county cohort uses run
`37942091-94d7-4599-ae36-ffbf4bf4096a` for `MAC-054` Holland Ponds Migratory
Bird Day, `MAC-057` Shelby Township Art Fair, `MAC-059` Assumption GreekFest,
`MAC-063` Shorewood Kiwanis Harper Charity Cruise, and `MAC-065` St. Clair
Shores Memorial Day Parade. Its five migration-026 database exceptions were
transitioned through the supported append-only `superseded` disposition with
migration-028 provenance and no human identity decision, then the same run was
resumed exactly once. All five candidates are now deterministically cleared as
distinct private unmatched candidates. The run retains five official candidate
sources, five source bundles, 21 source snapshots, 59 claims, two
needs-review verification cases, and four verification-evidence rows.

The run is safely `waiting_for_exceptions` with seven open review items:
Holland Ponds and Assumption GreekFest each require human verification and
retain a deterministic synthesis conflict; Shelby Township Art Fair,
Shorewood Kiwanis Harper Charity Cruise, and the St. Clair Shores Memorial Day
Parade retain conflicting date claims. No synthesis, package, visual workflow,
canonical match, canonical event, Event Page, page version, media record,
model action, image action, or publication action was created. The next
operator action is evidence review of these seven retained exceptions, not
another county run or another resume.

Completion evidence selection now distinguishes the immutable retained archive
from the facts active for a target edition. Policy
`completion-evidence-selection/1` requires exact normalized event identity for
supporting snapshots, excludes explicitly non-target-year editions and
unrelated page metadata, prefers a single value from the official host family,
and still blocks on conflicting current-year official dates. It feeds both
verification planning and deterministic synthesis without deleting or changing
any retained snapshot, claim, or schedule candidate. Evidence-readiness stage
version 4, deterministic-synthesis wrapper stage version 22, and
content-readiness stage version 2 prevent older successful checkpoints from
silently replaying pre-policy or three-topic behavior.

The focused county-operator validator covers current-year official-family
selection, historical/news exclusion, and preservation of genuine
official-family date conflicts. The full production build passes. The existing
five-event run and all seven exception records remain unchanged; this
implementation did not resume a run, transition a review item, call a model,
create an image, canonicalize, package, or publish.

County continuation is event-scoped within each immutable batch. On resume,
completed and review-ready events replay no work, events with their own open
blocking exceptions remain quarantined, and unrelated incomplete events may
continue. A blocker from an older deterministic stage version may receive one
versioned recheck, but the event remains blocked until the retained exception
is dispositioned through the supported review action. A run-level blocking
exception still stops every event. The
exception-review stage now enforces the same event-scoped policy before
publication readiness, so an event cannot become review-ready while its own
blocking exception remains open. A batch may remain
`waiting_for_exceptions` while clean packages from that batch proceed through
individual human approval.

The retained five-event Macomb private run
`37942091-94d7-4599-ae36-ffbf4bf4096a` received one event-scoped deterministic
resume on July 29, 2026. The run remained `waiting_for_exceptions`, used zero
model tokens, and invoked no publication or image action. The recheck produced
four deterministic syntheses, three new diligence cases, and thirteen retained
verification-evidence rows:

- At that checkpoint, Shelby Township Art Fair had reached valid,
  conflict-free private content
  (`936e3e3c-8e30-46c5-8a31-a35e30dc68af`) but had not yet cleared its
  diligence case. Migration 029 and the acceptance proof described below now
  supersede that historical blocker.
- Shorewood Kiwanis Harper Charity Cruise reached valid, conflict-free private
  content (`82a46b17-86e5-45fc-8208-2983a84d7908`) and stopped before package
  creation because diligence case `cc4bb03d-b09d-4a0c-90a0-b6f58e1a8314`
  still needs human verification.
- St. Clair Shores Memorial Day Parade selected the official May 24, 2026
  edition without an active date conflict, but content remains blocked on a
  missing location and timezone.
- Assumption GreekFest no longer has an active synthesis conflict, but current
  dates, location, and timezone remain missing.
- Holland Ponds Migratory Bird Day remains quarantined for weak current-edition
  evidence.

Four obsolete archive-wide conflict exceptions were resolved through
`atlas_transition_michigan_completion_exception` only after current-version
checkpoints proved the blockers gone. Nine legitimate verification, evidence,
content, and package-readiness exceptions remain open. Four retained bundles
advanced to `draft_ready`; no candidate, candidate source, source snapshot,
source claim, canonical event, package, Event Page, page version, media record,
or visual workflow was created or changed by the resume.

The official-first Shelby acceptance proof is complete. Existing candidate
`0ebe2d9f-f85c-4075-a93e-02b6cddb61f0`, verification case
`2d41f85d-4c19-4aba-9dba-58f8cbdd6aec`, bundle
`340b2b94-d90e-48b6-88cf-a83d2d0fc37e`, and deterministic synthesis
`936e3e3c-8e30-46c5-8a31-a35e30dc68af` were reused. The municipal calendar
proved the event identity, August 8-9 dates, and River Bends Park; retained
high-confidence `43rd annual` language proved recurrence. The case is verified
at score 1.0 with one official and two supporting sources. The exact official
5700 22 Mile Road address was matched to OpenStreetMap way `767548630` at
`42.6545304, -83.0548010` and appended through the existing synthesis map RPC.

The first Shelby package version exposed a real gate defect: it was marked
review-ready even though its own synthesis report listed
`modules.experience` as missing and the preview contained only Why Go,
Schedule, and Plan. That package was rejected through the supported review
action. Content-readiness v2 now rejects identity echoes, placeholder copy,
empty schedules, duplicated experience copy, uncited practical details, and
three-topic shells.

The retained official municipal page added one private snapshot and two
verified August 8-9 schedule rows. Accepted deterministic synthesis
`966df32a-a3d8-43d6-a5df-e18fe4a4faff` uses engine v21 and retains the
existing verified OpenStreetMap record. Rebuilt private package
`2cad824e-2a7b-43db-a58b-d4bcb133efc9` is version 2,
`ready_for_review`, content-ready, and deliberately art-pending. Its deployed
read-only preview now contains Why Go, Schedule, Highlights, and Plan;
Highlights covers food and musical entertainment, more than 120 artist and
marketplace vendors, and the kids' craft and activity area. Schedule shows
10 AM-5 PM on both days. Mobile review at `390x844` confirmed all four tabs,
zero horizontal overflow, and no browser-console errors.

Canonical events, candidate matches, public pages, page versions, media,
visual workflows, and public discovery retained identical before/after counts
and hashes. Model, image, canonicalization, approval, and publication actions
remained zero. The obsolete Shelby verification and package-readiness
exceptions remain historically superseded, and the five-event run remains
partial because the other events still have their own exceptions.

Human review then found that package v2 met the structural four-topic gate but
recycled the same entertainment/vendor/kids list across the hero, Why Go, and
Highlights. Package v2 was rejected through the supported Event Factory review
action; its accepted facts and verified map record were not changed.
Content-readiness v3 now adds a deterministic semantic editorial gate for
core-copy repetition, known factory phrases, and multiple generic Highlight
summaries. Editorial prompt v6 assigns distinct jobs to the hero, Why Go
headline, and Why Go summary, permits grounded audience-group replacement, and
runs the full content gate before a model-assisted child may be considered
valid. Michigan Completion routes the economical pass when either numeric
quality or semantic editorial quality needs it.

One bounded Shelby editorial canary created deterministic-v22 parent
`70db347a-c5bd-47c7-bbdd-dc790a825800` and retained the previously reviewed
OpenStreetMap record. Its single `openai/gpt-5.4-mini` request timed out at the
55-second provider boundary. It was not retried, returned no usage record, and
created no editorial child or replacement package. Canonical events,
candidate matches, public Event Pages and versions, media, visual workflows,
and discovery remained unchanged. The structured after-state is retained at
`artifacts/michigan-completion/macomb/shelby-editorial-canary-v1.json`.

That failed economical attempt is now historical. On August 1, one authorized
`gpt-5.6-sol-ultra` editorial pass used twelve retained sources and a ten-row
current program. Eight bounded prose fields, two audience groups, and one
Monster Mural Scout Spotlight passed every immutable-fact, citation, numeric,
sponsor, research-narration, repetition, and manifest check with zero rejected
fields. The exact accepted output was replayed without another model call only
to regenerate immutable link metadata after the reusable generator stopped
calling an archived exhibitor page a current-year directory and began labeling
closed application pages neutrally.

Accepted synthesis `aba8107e-efcf-480a-83c1-90e214294663` now backs private
package v7 `2cad824e-2a7b-43db-a58b-d4bcb133efc9`. The package is
`ready_for_review`, content-ready, art-ready, and still unpublished. Ray's
finished 1024 x 1536 hero is retained in approved visual workflow
`d96410cc-110b-470e-9357-f5f3cddf74f2`; sixteen official event and exhibitor
thumbnails supplied the existing visual-workflow review record. The private
preview contains Why Go, Schedule, Highlights, and Plan; its Schedule names all
six musical acts, both stages, the balloon artist, and both days' hours. Plan
links to the closed applications page without implying registration is open.
Review at
`https://celebration-atlas-app.vercel.app/event-preview/2cad824e-2a7b-43db-a58b-d4bcb133efc9`.
Mobile `390x844` and desktop `1440x900` inspection found zero horizontal
overflow and zero browser-console errors. Counts and stable hashes for
canonical events, public Event Pages, public page versions, and media remained
identical. No canonicalization or publication occurred. The structured audit
is `artifacts/michigan-completion/macomb/shelby-ultra-canary-v2.json`.

The county operator remains deterministic and zero-cost by default. A new
explicit `--editorial` option creates a different immutable contract with one
economical attempt and a 15,000-token ceiling per event; `--plan-only` can
preview that routing without a provider call. This reuses the existing
model-assisted synthesis and publication safeguards rather than creating a
parallel content workflow.

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

- Remote migrations `005` through `032` are applied.
- Atlas Control is protected and uses server-side service-role routes for editorial mutations.
- Public pages never receive the service-role key.
- The Control Desk supports source inspection, bundle collection, synthesis, verification, package review, publication, and visual workflow approval.
- Production authentication remains required. An existing signed-in browser session reaches `/atlas-control`; unauthenticated requests redirect to `/atlas-login`.
- Migration `014` creates the public media bucket and service-only visual workflow tables and RPCs.
- The first migration-014 visual workflow is approved for the Coast Guard Festival private package. Its supplied 1024x1536 hero is stored in `celebration-atlas-media`; package approval remains separate.
- Migration `020` replaces the early editorial-child supersession transition, keeps deterministic replay unique, permits a new editorial attempt after rejection, and supersedes the deterministic parent only when its editorial child is accepted. Deployment restored one legacy deterministic parent from `superseded` to `generated` with an append-only compensating action; it changed no accepted synthesis.

Never place Supabase or Vercel credentials in documentation, source code, prompts, or commits.

## Michigan Homepage State

The Michigan Atlas homepage completed its search-first public discovery checkpoint on July 16, 2026, building on the rail, deterministic discovery, and shared responsive-shell work completed July 15.

- Homepage publication discovery now uses the service-role-only `atlas_get_published_event_discovery` RPC from migration `022`. One state-scoped database round trip returns only the canonical identity, place, coordinates, reviewed dates/timezone, lifecycle/publication identities, official URL, and lightweight thumbnail fields needed by map markers, search, the dated rail, Experience Deck entry cards, and Event Hub links. The RPC requires an active verified located canonical event plus the exact published Event Factory package and published valid Event Hub version bound to the same frozen manifest. Checked-in transition events still reconcile through the existing state catalog. Full manifests and media decks are absent from the initial payload; approved flyer/source resolution is requested only after an event is selected.
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
- Submitted homepage discovery queries now live in the public `q` URL parameter and are deterministically reconstructed from the reviewed Michigan catalog. Browser-history entries retain only presentation state: page scroll, live/upcoming rail position, map transform, open result cluster, Experience Deck visibility and active index, selected result, and exact-navigation suppression. Internal Event Hub transitions remain App Router client navigations, Back restores the homepage context without duplicated result storage, Forward returns to the same Event Hub, and exact-search returns do not immediately redirect again.
- The reusable Atlas Experience Deck is implemented and visually approved. Crowded illustrated-map search-result regions now open the shared Rolodex stack directly over the unchanged map, using actual ranked event IDs and existing safe-media helpers. Recessed cards promote without navigation; the active card navigates to the existing `/events/[id]` route.
- Browser Back restores the submitted query, open search cluster, selected deck index, map transform, page scroll, and live/upcoming rail position through namespaced history fields that preserve Next.js state. Downward swipe and the close control dismiss the deck and reveal the unchanged map.
- The limited integration was validated at `390×844` with ten actual catalog events. Recessed-card promotion, rapid multi-card flicking, missing-image fallback, long active titles, published Event Hub navigation, nonzero-index Back restoration, and isolation of deck gestures from underlying map movement and zoom were verified.
- A development-only multi-event regression fixture remains available only when the app is running in development and both `atlasDebug=1` and `atlasDeckFixture=multi` are present. The production guard protecting this fixture must not be weakened.
- General geographic clustering has not been implemented and remains a separate future project. The Experience Deck should be treated as finished infrastructure unless a specific reproducible defect is found.
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
- The Event Hub synthesis validator now preserves the approved lifecycle distinction: current editions use `Why Go / Schedule / Highlights / Plan`, while completed editions use `Experience / Schedule / Highlights / Next Time`. The full production build passed when that focused validator repair was committed. Phase C2C changes no application build path and therefore did not rerun the full build.
- `docs/ATLAS_TASK_QUEUE.md` contains historical completed/future map work. No item should become `next` until Ray chooses the follow-up milestone.
- A deliberately excluded `Codex Event Write Test` database row still appears in factory diagnostics and must never become public.
- The universal Scout AI runtime, periodic update agents, nationwide discovery campaigns, and map redesign are future milestones.
- Source update monitoring must eventually detect material schedule/date changes, create a new synthesis/package version, and require the configured review policy before public replacement.

## Latest Completed Event Factory Milestone

Shelby Township Art Fair completed the first full-manifest, high-intelligence
authorship proof and is public at:

`https://celebration-atlas-app.vercel.app/events/shelby-township-art-fair-shelby-township-mi`

Retained evidence and deterministic synthesis remain upstream. Ultra-authored
synthesis v20 owns the complete four-topic visitor manifest while validation
locks identity, dates, ten schedule rows, twelve source identities, approved
hero art, links, and publication state. Ray approved the final Scout wording,
package v8, and publication. The accepted synthesis, package, canonical event,
immutable Event Hub v1, approved media record, and homepage discovery record
retain the normal review and audit lineage.

Production review confirmed the public hero and corrected Monster Mural Scout
spotlight on desktop. Mobile DOM review at `390x844` confirmed all four topics,
the approved hero identity, and zero horizontal overflow. No additional model
call was used for Ray's final copy correction.

The Ray-approved list Fast Track contract is now implemented for the next
growth phase. `npm run atlas:prepare-fast-track -- --input <list.json>` creates
an immutable normalized list plus isolated operator, Ultra full-manifest, Luna
Max hero-skill, and private-package handoffs for every event. List approval
authorizes private preparation but never publication. Clean events do not wait
for failed list-mates, one official source may clear the existing verification
record when it proves every required fact, and no separate supporting-source or
verification queue is introduced. Identity, current dates, recurrence,
location, coordinates, factual conflicts, content grounding, visual approval,
and explicit package approval remain protected.

The repository-local `$create-celebration-atlas-hero` skill is installed at
`.agents/skills/create-celebration-atlas-hero/`. Every Fast Track event that
reaches the hero stage must use GPT-5.6 Luna at Max reasoning, generate one
primary image, and create a focused alternative only after rejection or low
confidence. A local image is not approval; the existing specification and
Supabase visual workflow remain authoritative.

## Current Next Milestone

Run the first Ray-approved list through the new Fast Track contract. Prepare
each event independently through retained evidence, Ultra full-manifest
authorship, Luna Max hero creation, the approved visual workflow, and its exact
private package preview. Stop before publication and present each successful
package for an explicit human decision.

Shorewood Kiwanis Harper Charity Cruise remains the clean official-first
continuation if it appears on that list. Do not clear Holland Ponds, Assumption
GreekFest, or the Memorial Day Parade until their event-specific missing facts
are supplied by retained sources. Do not wait for those events before reviewing
a clean package.

Outside Fast Track, continue county growth in bounded five-event cohorts. Successful events may
advance to individual private package review while failed events enter the
separate verification queue. A cohort's aggregate `waiting_for_exceptions`
status is not a reason to hold a clean event, but no event bypasses its own
diligence or explicit human package approval.

Bay-Rama, Richmond, and Memphis remain excluded. Any later dry run or private
run requires its own explicit authorization. No county operation may
canonicalize, perform image work, approve, or publish.

The state-map presentation resolver, anonymous public-account follow-up, and broader product checkpoints remain separately queued and are not part of the completion-layer release.

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

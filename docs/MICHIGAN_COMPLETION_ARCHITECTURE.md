# Michigan Completion Operating Layer v1

Status: implemented and deployed operating-layer contract through migration `026_generalize_county_completion_staging.sql`. Migration 026 was deployed atomically on July 29, 2026, and local/remote migration history is aligned through 026. No migration authorizes a completion run, event staging, canonicalization, package publication, or image action.

## Purpose and boundary

The Michigan Completion Operating Layer is a narrow, deterministic orchestrator around the existing Celebration Atlas control plane and Event Factory. It does not own event facts or create a new event pipeline.

Its responsibilities are limited to:

- validating one immutable, versioned county or batch manifest;
- recording a resumable run in the existing operation ledger;
- calling existing candidate, evidence, synthesis, Event Factory, visual-readiness, and publication-readiness capabilities in a fixed order;
- recording event- and stage-level progress in the existing operation action ledger;
- routing unresolved exceptions into the existing Atlas Control review queue;
- reserving and recording bounded model use only after deterministic processing is insufficient;
- producing a private run report and stopping before publication.

The operating rule is:

```text
deterministic repetition -> bounded model assistance -> human exception review -> human publication decision
```

Publication is deliberately outside the stage registry. The orchestrator must never call `atlas_materialize_event_factory_package`, `atlas_activate_event_factory_publication`, `atlas_publish_event_page_version`, or the `approve_and_publish` Atlas Control action.

## County-level operator extension

`scripts/create-county-events.ts` is the one-command county coordinator over this operating layer. It does not replace the manifest, candidate, matching, source-bundle, synthesis, verification, Event Factory, exception, run, or publication contracts.

For a registered county it:

1. verifies one retained approved inventory and all of its source hashes;
2. loads a read-only county projection from existing domain and completion records;
3. assigns every inventory row one explicit disposition;
4. excludes canonical/completed, protected, held, ambiguous, insufficient, and actively blocked records;
5. reuses eligible private candidates and safely resumable compatible runs;
6. creates stable bounded manifests only for remaining guarded work;
7. invokes the existing orchestrator in dry-run mode by default or private mode only after explicit authorization;
8. emits one hash-protected aggregate report covering every source record.

The private extension generalizes the existing guarded staging predicate rather than creating a new intake RPC. Deterministic identity clearance is permitted only for an immutable reviewed county payload, explicit private-write authorization, no canonical/candidate exact collision, no source-ownership conflict, no prior promotion or match, and no fuzzy warning. The action marks only the private candidate's reviewed distinct identity state; it does not create a canonical event or match.

Evidence composition uses the existing bounded source-bundle capture service. A retained official host family may deterministically clear a private verification case only when it proves the exact event identity, current-edition dates, location, and annual recurrence. Missing or conflicting facts still create a concise human-review exception. A package cannot use an unverified completion-created verification case, and verification never authorizes canonicalization or publication. See `docs/COUNTY_COMPLETION_OPERATOR.md`.

## Reuse audit

The classifications below are exhaustive for the v1 completion workflow.

| Required capability | Classification | Canonical implementation or object | v1 decision |
| --- | --- | --- | --- |
| County workbook parsing and normalized seed provenance | reuse unchanged | `lib/county-seeds/workbook.ts`, `lib/county-seeds/types.ts` | Preserve the 40-column source row, workbook and sheet fingerprints, Clean ID, cleanup provenance, and normalized fields. |
| Canonical JSON and SHA-256 hashing | reuse unchanged | `lib/county-seeds/staging.ts` | Reuse sorted-key serialization and immutable payload/manifest hashes. Do not introduce a second hashing convention. |
| Completion input schema and whole-manifest validation | extend | county-seed manifest contracts plus `lib/michigan-completion/manifest.ts` | Add only the completion-specific state, county/batch, version, authorization, budget, and event expectations. |
| Persistent run identity and coarse lifecycle | extend | `atlas_operation_runs` and completion-specific fixed RPCs | Use one `operation_type` for Michigan completion and the existing `(operation_type, idempotency_key)` identity. The general start helper is not reused because it can replace a conflicting request. Keep the shared coarse statuses; store the fine completion status in `summary.completionStatus`. |
| Event progress, versioned stage checkpoints, retry history, and audit | adapt | `atlas_operation_actions` | Completion RPCs append immutable action rows carrying event identity, stage/version, attempt, input hash, result references, warnings, and failures. Do not add completion-run, run-event, or stage-checkpoint tables. |
| Exact replay and conflicting replay protection | extend | operation uniqueness plus migration-018 county guards | Exact run/stage/model input hashes return prior results. The same immutable identity with a different input hash is rejected. Completion-specific indexes and guards belong in migration 023. |
| Resume, safe retry, partial completion, and bounded concurrency | genuinely missing | `lib/michigan-completion/orchestrator.ts`, completion RPCs | Existing operations are idempotent building blocks, but no persistent multi-event checkpoint runner currently composes them. |
| Dry-run execution and structured run reports | genuinely missing | `scripts/complete-michigan-batch.ts`, `lib/michigan-completion/runtime.ts` | Dry-run is the default. It may record a private run envelope/report, but it may not mutate candidate, evidence, package, canonical, page, media, or publication state. |
| Discovery-run and candidate provenance | reuse unchanged | `discovery_runs`, `event_candidates`, `event_candidate_sources` | Candidate intake continues to create or reuse these records through the guarded canonical path. A discovery run is not a substitute for a completion run. |
| Guarded county candidate staging | reuse unchanged | `atlas_stage_county_seed_candidate`, migrations 018-019, `lib/county-seeds/stagingApply.ts` | Preserve advisory locking, exact scope checks, source evidence, candidate/source uniqueness, and collision rejection. Never send county records through the unguarded base intake RPC. |
| Canonical identity comparison | extend | `lib/county-seeds/matching.ts`, `lib/county-seeds/stagingPreflight.ts`, `lib/county-seeds/staging.ts`, `events`, `event_candidates` | Reuse exact URL, normalized name/place, alias/place, slug, county identity, source ownership, and promoted-state checks. Fuzzy similarity remains a warning and never causes an automatic merge. |
| Canonical events | reuse unchanged | `events` | Canonical materialization remains an Event Factory publication effect after human approval. The completion orchestrator only reads existing canonical identity. |
| Official-source inspection and bounded collection | reuse unchanged | `lib/event-intake/officialSourceInspection*.ts`, `sourceCollection.ts`, `sourceBundles.ts`, migration 006 objects | Retain network safety, source snapshots, raw private archive, claims, links, schedule candidates, and source provenance. No alternate crawler or evidence store is permitted. |
| Source/evidence readiness | extend | `event_source_bundles`, snapshots, claims, links, schedule candidates, bundle actions | Add deterministic readiness evaluation and exception routing; do not copy evidence into completion records. |
| Event verification | reuse with official-first policy | `lib/event-factory/verification.ts`, `event_verification_cases`, evidence, actions, migration 029 | Preserve existence, recurrence, dates, location, official-source, and exception gates. Supporting evidence is useful but not mandatory when the retained official source proves the required facts. |
| Deterministic synthesis | reuse unchanged | `lib/event-intake/synthesisEngine.ts`, `synthesis.ts`, migrations 007, 013, and 020 | Keep input-hash replay, conflict preservation, historical/current separation, sponsor exclusion, map provenance, and immutable proposals. |
| Evidence-bound editorial synthesis | adapt | `lib/event-intake/editorialAssistance.ts`, `editorialModel.ts`, `synthesis.ts`, migration 020 lifecycle | Invoke only through a reserved completion model action. Record why deterministic output was insufficient, the configured route, limits, usage, and fallback. Rejection leaves deterministic content available. |
| Model routing, per-event/run budgets, and usage ledger | genuinely missing | completion action records and `lib/michigan-completion/runtime.ts` | Add deterministic-first routes, budget reservation, usage completion, exact-replay charge suppression, and explicit budget exceptions. Do not connect a billing API for v1. |
| Content quality/readiness | extend | manifest validator, synthesis validation report, Event Factory gate evaluation | Compute content readiness independently from art readiness without weakening factual, provenance, sponsor, or public manifest rules. |
| Event Factory package assembly | adapt | `lib/event-factory/packages.ts`, `event_factory_packages`, package actions | Permit a private `assembling` package with `page=true` and `art=false` when all content gates pass. Keep final package review and publication requirements unchanged. |
| Private Event Hub package preview | adapt | `/atlas-control/event-preview/[packageId]`, `getEventFactoryPackagePreview`, `components/EventHub.tsx` | Add a private-only art-pending presentation that validates all non-art content and clearly says art is pending. It must not create or substitute an image and must not weaken public Event Hub validation. |
| Visual workflow and approved hero art | reuse unchanged | `lib/event-factory/visuals.ts`, migrations 014 and 017 objects, private media workflow | Completion only inspects readiness and provenance. It does not search for, generate, upload, transform, approve, or replace imagery. |
| Image provenance vocabulary | extend | completion/package metadata adjacent to the existing visual workflow | Record one of `ray_provided`, `organizer_provided`, `licensed`, `generated`, `legacy`, or `unknown`. `unknown` and unapproved provenance always block publication. |
| Exception queue | extend | `atlas_review_items`, `/api/atlas-control/review-items`, Atlas Control open-review surface | Store completion exceptions in the existing queue with run/stage/evidence/package references in its evidence payload. Do not add a parallel exception table or dashboard. |
| Exception transition audit | genuinely missing | migration 023 `atlas_review_item_actions` | Add the smallest append-only lifecycle ledger needed for acknowledge, resolve, waive-with-reason, and supersede transitions. |
| Atlas Control run and exception visibility | extend | `/api/atlas-control/operations`, `/api/atlas-control/review-items`, `app/atlas-control/ControlDesk.tsx` | Add compact run counts, current status, event progress, model usage, and linked exceptions. Reuse the current protected surface. |
| Publication readiness evaluation | reuse unchanged | Event Factory eight gates, migration 021 activation preconditions, Event Page validation | Evaluate whether an event may be handed to human review. Readiness is not approval and never invokes publication. |
| Atomic publication | reuse unchanged but prohibited to the orchestrator | `atlas_activate_event_factory_publication`, migration 021, `approveAndPublishEventFactoryPackage` | Remains available only through the existing explicit human package approval path. |
| Batched public discovery | reuse unchanged | `atlas_get_published_event_discovery`, migration 022 | Completion does not modify homepage discovery. Only an already published package can enter this result. |
| Statewide coverage/readiness/cost reporting | extend | discovery/candidate/canonical data, Event Factory readiness, completion reports | Derive county coverage, readiness tiers, content/art separation, exception rates, deterministic completion, and recorded model use. |
| Focused PostgreSQL-compatible validation | genuinely missing | `scripts/validate-michigan-completion.ts` and synthetic fixtures | Prove clean, ambiguous, conflicting-date, art-pending, budget, resume, replay, conflict, and security cases without production data. |
| Hardcoded event creation, checked-in manifests, and flyer-first pages for new events | legacy and prohibited for new use | `data/events.ts`, transition manifests, flyer workflows | Preserve existing compatibility fixtures, but do not use them to bypass evidence, synthesis, Event Factory, or approval for new Michigan events. |
| Direct county intake through `atlas_intake_event_candidate` | legacy and prohibited for county completion | base migration-004 RPC | County completion must use the migration-018 guarded wrapper. |
| Automatic model use for every event, unbounded retry, and silent model escalation | legacy and prohibited | none | Every model call needs an explicit route, reason, reservation, budget, attempt cap, and recorded outcome. |
| Local image existence, placeholders, automated image search, or image generation as art clearance | legacy and prohibited | local public assets are compatibility fixtures only | Only an approved visual workflow can clear the art gate for a new package. |
| Direct Event Page publication for a factory-owned manifest | legacy and prohibited | general migration-005 publish RPC remains for non-factory pages | Migration 021 guards factory-owned activation; completion must not bypass it. |

## Canonical files and extension points

| Area | Canonical files | Completion-layer use |
| --- | --- | --- |
| County input | `lib/county-seeds/workbook.ts`, `matching.ts`, `staging.ts`, `stagingPreflight.ts`, `stagingApply.ts` | Parse, normalize, hash, preflight, and perform guarded no-op or candidate staging. |
| Control-plane service boundary | `lib/atlas-control/service.ts`, `auth.ts`, `readiness.ts` | Create server-only service-role clients and preserve administrator authorization. |
| Source intelligence | `lib/event-intake/sourceBundles.ts`, `sourceCollection.ts`, `officialSourceInspection.ts`, `dynamicSchedule.ts` | Read or invoke existing bounded source/evidence operations. |
| Synthesis | `lib/event-intake/synthesisEngine.ts`, `synthesis.ts`, `editorialPlanning.ts`, `editorialAssistance.ts`, `editorialModel.ts` | Run deterministic synthesis first and optional bounded editorial assistance second. |
| Verification and packages | `lib/event-factory/verification.ts`, `readiness.ts`, `packages.ts`, `types.ts` | Evaluate existing gates and prepare only private packages. |
| Visual readiness | `lib/event-factory/visuals.ts`, `visualPrompt.ts` | Read approved workflow state and provenance; never create visual work from completion. |
| Event Hub contract | `data/eventPageManifestValidation.ts`, `data/eventPageManifestTypes.ts`, `components/EventHub.tsx` | Preserve strict public validation; provide only a private art-pending preview seam. |
| Publication | `lib/event-pages/publishing.ts`, `supabase/migrations/021_atomic_event_factory_publication.sql` | Read readiness and preserve the human-only atomic boundary. |
| Atlas Control | `app/atlas-control/ControlDesk.tsx`, `app/api/atlas-control/operations/route.ts`, `review-items/route.ts`, `event-factory/route.ts` | Add minimal completion status and exception inspection to the current desk. |
| Public discovery | `lib/events/publishedAtlasEvents.ts`, `data/publishedAtlasDiscovery.ts`, migration 022 | No completion-layer write or behavior change. |

The v1 completion code belongs only in:

- `lib/michigan-completion/types.ts`
- `lib/michigan-completion/stageRegistry.ts`
- `lib/michigan-completion/manifest.ts`
- `lib/michigan-completion/orchestrator.ts`
- `lib/michigan-completion/supabaseStore.ts`
- `lib/michigan-completion/runtime.ts`
- `lib/michigan-completion/editorialExecutor.ts`
- `scripts/complete-michigan-batch.ts`
- `scripts/validate-michigan-completion.ts`

Those files compose existing services. They must not contain a second candidate schema, synthesis engine, Event Hub manifest model, visual factory, canonical event writer, or publication implementation.

The county extension is limited to:

- `lib/michigan-completion/countyInventory.ts`
- `lib/michigan-completion/countyOperator.ts`
- `lib/michigan-completion/countyOperatorSupabase.ts`
- `lib/michigan-completion/identityClearance.ts`
- `lib/michigan-completion/privateComposition.ts`
- `scripts/create-county-events.ts`
- `scripts/validate-county-completion-operator.ts`
- `supabase/migrations/026_generalize_county_completion_staging.sql`

These files may coordinate or narrowly extend the contracts above; they may not duplicate them.

## Current canonical state transitions

The completion layer observes and invokes these existing lifecycles; it does not rename or replace them.

| Canonical object | Current transition contract | Completion boundary |
| --- | --- | --- |
| `atlas_operation_runs` | `planned -> running -> succeeded|partial|failed|cancelled`; the existing start helper can resume `failed|cancelled -> running` | Completion keeps these coarse states and records its fine state separately. |
| `atlas_operation_actions` | `proposed -> applied|skipped|blocked|failed` in existing mutation flows | Completion does not mutate an action through that lifecycle; it appends immutable status/checkpoint actions so every attempt remains visible. |
| `event_candidates` | intake creates/updates `needs_review`; reviewed Event Factory materialization later sets `matched_event_id`, `verification_status=promoted`, `duplicate_status=unique_candidate`, and `needs_review=false` | Completion may stage/reuse a candidate, but canonical promotion is prohibited. |
| `event_source_bundles` | `collecting -> ready_for_synthesis -> draft_ready`; `ready_for_synthesis|draft_ready -> collecting` on reopen; any non-archived state may archive | Completion can advance evidence only through the existing bundle RPCs. |
| `event_source_syntheses` | `generated -> in_review -> accepted|rejected`; acceptance supersedes another accepted proposal; an accepted editorial child supersedes its deterministic parent; rejected editorial work leaves the deterministic parent generated | Deterministic generation may run automatically; review acceptance remains its existing human gate. |
| `event_verification_cases` | `collecting -> needs_review -> verified`; open cases may reject; `needs_review|verified|rejected|stale -> collecting` on reopen | Completion adds retained evidence and may take the existing `verify` transition only when deterministic official-first requirements pass. Otherwise it queues the exact missing facts for human review. |
| `event_visual_workflows` | `researching -> draft -> ready_for_review -> approved|rejected`; eligible approved/rejected work may reopen to draft; retained released art uses a new immutable revision | Completion reads this lifecycle only and never initiates visual work. |
| `event_factory_packages` | `assembling -> ready_for_review -> approved|rejected`; `rejected|failed -> assembling`; `approved -> publishing -> published|failed`; released corrections create linked immutable package revisions | Art-pending completion remains `assembling`; the orchestrator never approves, materializes, publishes, or archives a package. |
| `event_page_versions` | `draft -> in_review -> approved|rejected`; `approved -> published`; a replaced published version becomes `archived` | Completion does not cross into draft review/publication for an art-pending package and never moves the public pointer. |

## Genuinely missing operating capabilities

The audit found only these missing pieces:

1. a deterministic multi-event coordinator and eleven-stage registry;
2. persistent checkpoint/resume projections over the existing operation ledger;
3. exact completion replay/conflict guards and completion-action immutability;
4. exception acknowledge/resolve/waive/supersede audit on the existing review queue;
5. atomic model-budget reservation, usage recording, and charge replay protection;
6. a private art-pending package/preview seam that leaves public validation strict;
7. one default-dry CLI, structured report, focused validator, and compact Atlas Control projection;
8. statewide completion/readiness/cost metrics derived from the existing canonical records.

Everything else is an existing capability to reuse or narrowly adapt.

## Database contract

### Existing objects remain authoritative

| Object | Existing role in completion |
| --- | --- |
| `atlas_operation_runs` | One coarse run envelope, immutable operation/idempotency identity, request contract, aggregate summary, error, and timestamps. |
| `atlas_operation_actions` | Completion run transitions, per-event stage attempts/results, model reservations/usage, targets, warnings, and failures. Completion-owned rows become append-only. |
| `atlas_review_items` | Persistent completion exception queue. Native operation-run, operation-action, candidate, and event foreign keys remain authoritative; source/synthesis/verification/package details live in its evidence document. |
| `discovery_runs` | Provenance for candidates created by the canonical intake RPC; not the completion orchestrator ledger. |
| `event_candidates`, `event_candidate_sources` | Source-bound candidate identity and source association. |
| `events`, `event_sources`, `event_media` | Canonical identity and approved public outputs, readable by completion but writable only through existing reviewed paths. |
| `event_source_bundles`, `event_source_snapshots`, `event_source_claims`, `event_source_links`, `event_schedule_candidates`, `event_source_bundle_actions` | Persistent retained evidence and its audit. |
| `event_source_syntheses`, `event_source_synthesis_actions` | Deterministic and model-assisted immutable proposals plus review audit. |
| `event_verification_cases`, `event_verification_evidence`, `event_verification_actions` | Event Factory due diligence and human verification. |
| `event_factory_packages`, `event_factory_package_actions` | Frozen private package data, readiness checks, review, and publication history. |
| `event_visual_workflows`, `event_visual_workflow_actions` | Visual research, asset, QA, provenance, revision, and approval. |
| `event_pages`, `event_page_versions`, `event_page_version_transitions` | Immutable Event Hub versions and the public pointer. |

### Narrow migration 023 delta

Migration `023_michigan_completion_operating_layer.sql` may add only what the audited objects cannot safely express:

1. `atlas_review_item_actions`, an append-only exception lifecycle ledger.
2. Completion-specific expression indexes and guards over `atlas_operation_runs`, `atlas_operation_actions`, and `atlas_review_items` for exact replay, one terminal checkpoint per stable key, one model reservation per exact charge key, and one active equivalent exception.
3. Fixed, service-role-only completion RPCs:
   - `atlas_start_michigan_completion_run`
   - `atlas_resume_michigan_completion_run`
   - `atlas_record_michigan_completion_checkpoint`
   - `atlas_record_michigan_completion_exception`
   - `atlas_transition_michigan_completion_exception`
   - `atlas_reserve_michigan_completion_model_action`
   - `atlas_finish_michigan_completion_model_action`
   - `atlas_finalize_michigan_completion_run`
   - `atlas_get_michigan_completion_run`
   - `atlas_list_michigan_completion_runs`
4. Completion-only immutability guards that reject update/delete of completion actions and exception actions.

Migration 023 must not create `atlas_completion_runs`, `atlas_completion_run_events`, `atlas_completion_stage_checkpoints`, `atlas_completion_exceptions`, or `atlas_completion_model_actions`. Their information fits safely in the existing operation/action/review objects when written through fixed RPCs.

Every new mutation RPC must:

- be `SECURITY DEFINER` only when required;
- use an empty `search_path`;
- call `atlas_assert_service_role`;
- avoid unrestricted dynamic SQL;
- be revoked from `public`, `anon`, and `authenticated`;
- preserve existing rows and histories;
- append an operation or review action for every material transition.

Because the historical migration 004 is absent from the repository, migration 023 must preflight the deployed `atlas_review_items` contract and fail closed if its columns or constraints are incompatible. It must not guess and drop an unknown foundational status constraint.

Migration 023 is forward-only and was applied only after the focused completion validator, Atlas Control validation, public-schema security validation, lint, and full build passed.

Migration 024 replaces only the private run-list RPC after read-only hosted verification showed that PostgreSQL's `LEAST`/`GREATEST` expression syntax cannot be schema-qualified as ordinary `pg_catalog` functions. It preserves the service-role assertion, empty search path, bounded limit, return shape, revokes, and grant; it changes no run, event, package, media, page, or publication data.

Migration 029 narrows private diligence to the facts that matter at county scale. It keeps the existing verification and package RPCs, monotonically upgrades retained evidence when a related page is in the official host family, permits high-confidence annual language to corroborate an official current occurrence, requires current dates before verification, and removes the blanket second-source requirement. All three replaced functions remain atomic, service-role-only, and unable to create a canonical event or public page.

### Run data placement

| Required datum | Canonical location |
| --- | --- |
| Run ID | `atlas_operation_runs.id` |
| State ID, county/batch identity, input-manifest version, input hash, orchestrator version, dry-run flag, deterministic-only flag, concurrency limit, model budgets | immutable top-level fields in `atlas_operation_runs.request` |
| Created, started, updated, completed timestamps | existing run timestamp columns |
| Fine completion status | `atlas_operation_runs.summary.completionStatus` |
| Coarse status | existing `atlas_operation_runs.status` |
| Stage counts, event counts/progress, retries, exception count, publication-eligibility count, estimated/recorded model usage | aggregate top-level fields in `atlas_operation_runs.summary` |
| Event identity and current readiness | immutable request event plus `summary.eventProgress[eventKey]`, with links projected from its latest checkpoints |
| Stage ID/version/input hash/attempt/status/result | immutable `atlas_operation_actions` row with `action_type = 'michigan_completion_checkpoint'` and stable `requested_payload.checkpointKey` |
| Run state transition | immutable `michigan_completion_run_started`, `_resumed`, and `_finalized` actions |
| Model processor/route/reason/preconditions/configuration/budgets/usage/fallback | immutable `michigan_completion_model_reserved|budget_blocked|rejected|finished` actions with stable `requested_payload.chargeKey` |
| Exception code/classification/status/references/reason | native `atlas_review_items.operation_run_id`, `operation_action_id`, `candidate_id`, and `event_id`; completion evidence payload; append-only `atlas_review_item_actions` |
| Full machine-readable report | deterministic projection returned by the private read RPC and written to the requested local output path |

### Coarse and fine run states

The completion layer uses the required fine states without widening the shared operation status constraint:

| Completion status | `atlas_operation_runs.status` |
| --- | --- |
| `queued` | `planned` |
| `validating` | `running` |
| `running` | `running` |
| `waiting_for_exceptions` | `partial` |
| `ready_for_review` | `partial` |
| `completed` | `succeeded` |
| `failed` | `failed` |
| `cancelled` | `cancelled` |

Allowed fine transitions are:

```text
queued -> validating -> running
running -> waiting_for_exceptions -> running
running -> ready_for_review -> completed
waiting_for_exceptions -> ready_for_review
queued|validating|running|waiting_for_exceptions|ready_for_review -> failed|cancelled
```

`completed` means the deterministic workflow has stopped at its publication boundary and its report is complete. It does not mean any event was published.

Stage attempt statuses are `queued`, `running`, `succeeded`, `skipped`, `blocked`, and `failed`. Terminal successful checkpoints are never rewritten. A retry appends a new bounded attempt.

### Idempotency, replay, resume, and partial completion

- Run identity is `(operation_type, idempotency_key)`. The immutable request includes the canonical manifest hash.
- Exact run replay returns the existing run and report without new domain work or model charge.
- The same run identity with a different manifest hash is a conflict and must fail before any stage executes.
- Stage identity is `(run ID, manifest record identity, stage ID, stage version, stage input hash)` and is serialized as the checkpoint key.
- A succeeded or deliberately skipped exact stage is reused.
- A blocked or failed stage may append another attempt only when its registry retry policy allows it and the configured attempt cap is not exceeded.
- Resume reads the latest successful checkpoint for every event and starts only the next eligible stage.
- One event's exception does not roll back already valid records or stop unrelated records unless the run-level manifest or security contract is invalid.
- Bounded concurrency applies across event records; work for one event remains serial by stage.
- Completion actions and exception actions are append-only. Aggregate run status/summary may advance, but historical attempts and decisions are never deleted or rewritten.

## Versioned workflow registry

The registry contains exactly the eleven Michigan v1 stages below. A registry change requires a new stage version; completed checkpoints retain the version that produced them.

### 1. `manifest_validation@1`

- Existing capability: county-seed parsing, stable JSON, manifest hashing, completion manifest schema.
- Processor: deterministic.
- Prerequisites: valid CLI arguments and a readable manifest.
- Idempotency: state/county/batch identity plus manifest version and canonical SHA-256.
- Completion: every record has a unique immutable identity, valid expected action, valid source/provenance references, explicit dry-run/private/publication authorization fields, and a recomputed matching hash.
- Retry: only after correcting the manifest under a new hash; an exact valid replay is reused.
- Exceptions: `invalid_manifest_record`, `identity_security_mismatch`.
- Blocking: blocks the entire run.
- Required for every event: no; it is one run-level checkpoint covering all records.

### 2. `candidate_staging@1`

- Existing capability: `atlas_stage_county_seed_candidate`, county preflight, existing candidate/canonical lookup.
- Processor: deterministic.
- Prerequisites: successful manifest validation and a record eligible for candidate handling.
- Idempotency: existing county Clean ID, payload hash, guarded idempotency key, slug, and source identity contract.
- Completion: exact existing candidate/canonical no-op is verified, or an explicitly authorized private execution returns the canonical candidate/operation IDs. Dry-run records the proposed/no-op result without domain writes.
- Retry: fresh preflight first; network uncertainty stops for reconciliation; database conflicts are not blindly retried.
- Exceptions: `invalid_manifest_record`, `uncertain_identity_match`, `duplicate_candidate`, `identity_security_mismatch`, `unexpected_system_failure`.
- Blocking: blocks this event's later stages; other events continue.
- Required for every event: yes, although an existing identity completes it as `skipped`/verified no-op.

### 3. `identity_matching@1`

- Existing capability: deterministic canonical/candidate/source matching and promoted-state checks.
- Processor: deterministic. Fuzzy similarity is informational only.
- Prerequisites: candidate staging result or an existing canonical/candidate reference.
- Idempotency: normalized identity inputs and deployed identity snapshot hash.
- Completion: one unambiguous existing identity is retained or the candidate is confirmed as a distinct, still-private candidate. The stage never creates or merges a canonical event.
- Retry: after new evidence or a human identity decision changes the input hash.
- Exceptions: `uncertain_identity_match`, `duplicate_candidate`, `identity_security_mismatch`.
- Blocking: blocks this event on ambiguity; unrelated records continue.
- Required for every event: yes.

### 4. `evidence_readiness@4`

- Existing capability: source bundles, immutable snapshots, claims, links, schedule candidates, verification evidence, and official-source inspection safety.
- Processor: deterministic readiness evaluation. Collection uses only the existing bounded source service when separately authorized.
- Prerequisites: resolved private event/candidate identity and at least one retained official-source reference.
- Idempotency: bundle/snapshot/claim hashes and the readiness-input hash.
- Completion: retained official-family evidence proves identity, current dates, location, and annual recurrence, or the event stops with a plain-language list of the facts that still need human verification. Conflicts and archive/current distinctions remain explicit.
- Retry: automatically retryable only for a registry-approved transient collection failure; otherwise reopen evidence or route to review.
- Exceptions: `conflicting_event_dates`, `missing_official_source`, `weak_source_evidence`, `unsupported_source_format`, `missing_or_ambiguous_location`, `archive_current_program_ambiguity`.
- Blocking: blocks synthesis for this event; other events continue.
- Required for every event: yes.

### 5. `deterministic_synthesis@1`

- Existing capability: `synthesisEngine.ts`, deterministic synthesis RPC and action ledger.
- Processor: deterministic.
- Prerequisites: a source bundle ready for synthesis.
- Idempotency: bundle evidence plus deterministic engine version and input hash.
- Completion: a deterministic proposal exists with visible conflicts/missing fields, validation report, quality score, and proposed Event Hub content.
- Retry: exact replay reuses the proposal; changed evidence or engine version produces a new immutable proposal.
- Exceptions: `deterministic_synthesis_failure`, `conflicting_event_dates`, `missing_or_ambiguous_location`, `archive_current_program_ambiguity`, `unexpected_system_failure`.
- Blocking: engine failure or unsafe facts block content; weak but factually safe prose does not.
- Required for every event: yes.

### 6. `editorial_assistance@1`

- Existing capability: evidence-bound model-assisted child synthesis and immutable-fact safeguards.
- Processor: optional model-assisted.
- Prerequisites: a successful deterministic proposal, an allowlisted editorial need, an explicit route, and successful event/run budget reservation.
- Idempotency: parent synthesis, route/processor version, configured model, prompt version, and editorial input hash.
- Completion: a valid bounded child proposal is recorded, or the deterministic parent is retained with a deliberate skip/fallback.
- Retry: bounded by configured attempts; no retry after budget exhaustion; exact replay never reserves or charges again; stronger-model escalation requires a declared route and new reservation.
- Exceptions: `editorial_quality_failure`, `model_budget_exceeded`, `unexpected_system_failure`.
- Blocking: normally non-blocking because deterministic content remains available; a human-defined content-quality requirement may keep the event from review.
- Required for every event: no.

### 7. `content_readiness@1`

- Existing capability: synthesis validation report, Event Hub manifest rules, Event Factory non-art gates.
- Processor: deterministic.
- Prerequisites: deterministic or accepted editorial content and resolved publication-sensitive factual exceptions.
- Idempotency: chosen synthesis ID, validator version, and content projection hash.
- Completion: identity, evidence, dates/lifecycle, location/map provenance, official link, required Event Hub sections, citations, sponsor exclusion, and public-copy checks pass independently of art.
- Retry: after content/evidence/validator-version changes.
- Exceptions: `conflicting_event_dates`, `missing_official_source`, `missing_or_ambiguous_location`, `editorial_quality_failure`, `event_factory_readiness_failure`.
- Blocking: blocks package preparation if content is unsafe; does not wait for art.
- Required for every event: yes.

### 8. `package_preparation@1`

- Existing capability: Event Factory package upsert, package action history, private package preview.
- Processor: deterministic.
- Prerequisites: verified case, accepted/selected content, map provenance, and `content_ready`.
- Idempotency: candidate/year plus package content hash and package revision rules.
- Completion: an immutable private package projection exists. With no approved art it records `page=true` and `art=false`; migration 027 may mark it `ready_for_review` only after all seven non-art gates, verified diligence, and identity clearance pass.
- Retry: exact package hash reuses the package; editable private content may create the next allowed package version; approved/published packages remain immutable.
- Exceptions: `event_factory_readiness_failure`, `identity_security_mismatch`, `unexpected_system_failure`.
- Blocking: package failure blocks later readiness for this event; missing art alone does not invalidate completed content.
- Required for every event: yes after content readiness.

### 9. `visual_readiness@2`

- Existing capability: approved visual-workflow lookup, immutable visual revisions, media/provenance QA.
- Processor: deterministic read-only evaluation.
- Prerequisites: private package/content identity.
- Idempotency: selected workflow/asset content hash and QA/review state.
- Completion: either approved, provenance-complete art is linked, or the event is explicitly marked `art_pending` without creating an image action or publication-blocking exception. Completion never initiates image work.
- Retry: only after an external human visual workflow action changes the workflow/asset hash.
- Exceptions: `image_provenance_failure` only when an existing asset has unsafe or unknown provenance.
- Blocking: art absence is non-blocking; unsafe provenance blocks publication readiness.
- Required for every event: the evaluation is required; an image operation is never required or performed by completion.

### 10. `exception_review@2`

- Existing capability: Atlas Control `atlas_review_items`; migration 023 adds transition audit.
- Processor: deterministic queue reconciliation plus human decisions. A model may assist only when the exception is explicitly model-review eligible and budgeted.
- Prerequisites: all currently reachable prior stages have completed.
- Idempotency: run/event/stage/code/reference/input hash; one equivalent active exception.
- Completion: no open publication-blocking exception remains, or every remaining exception is intentionally acknowledged/waived with an actor and reason. Fatal errors cannot be waived into readiness.
- Retry: resumes after an exception action or referenced evidence/package change.
- Exceptions: every registered exception code, including `unexpected_system_failure`.
- Blocking: blocks only affected events unless the exception is run-level or a fatal identity/security/system error.
- Required for every event: no; it is skipped when no exception exists.

### 11. `publication_readiness@2`

- Existing capability: seven mandatory non-art Event Factory gates, an independent art state, strict Event Page validation, and migration-027 atomic activation preconditions.
- Processor: deterministic read-only evaluation.
- Prerequisites: private package, completed exception review, and visual-readiness result.
- Idempotency: package/readiness/exception/visual hashes and publication-readiness rule version.
- Completion: records `publication_eligible=true` when the non-art package is review-ready and all blockers are closed, whether approved art exists or the package is deliberately image-free.
- Retry: after package, exception, art, or readiness-rule changes.
- Exceptions: `image_provenance_failure`, `event_factory_readiness_failure`, `publication_readiness_failure`, `identity_security_mismatch`.
- Blocking: never blocks the preservation of earlier work; it blocks handoff to human publication review.
- Required for every event that reaches the end of the run: yes.

The stage ends after recording readiness. There is no stage 12 and no publication call.

## Exception contract

Completion exceptions use `atlas_review_items` with `review_type = 'michigan_completion_exception'`. Its native `operation_run_id`, `operation_action_id`, `candidate_id`, and `event_id` foreign keys are filled when known. Its evidence document uses this completion projection:

```text
contractVersion
exceptionCode
stageId
severity
retryable
modelReviewEligible
publicationBlocking
sourceBundleId
synthesisId
verificationCaseId
packageId
sourceIds
details
```

The exception's stable input hash and manifest-record identity may be retained inside `details`; native foreign keys must not be duplicated as competing authorities.

Required states are:

```text
open -> acknowledged -> resolved
open|acknowledged -> waived (actor and non-empty reason required)
open|acknowledged -> superseded (replacement exception required)
```

A resolved, waived, or superseded record is never reopened in place; changed evidence creates or reuses the appropriate new exception identity and the action history explains the relationship.

Classifications are independent flags, not one lossy severity enum:

- `informational`
- `automatically_retryable`
- `model_review_eligible`
- `human_review_required`
- `publication_blocking`
- `fatal_system_error`

| Exception code | Default handling |
| --- | --- |
| `invalid_manifest_record` | Human review; run-blocking and publication-blocking. |
| `uncertain_identity_match` | Human review; never auto-merge; publication-blocking. |
| `duplicate_candidate` | Human review; preserve both references; publication-blocking. |
| `conflicting_event_dates` | Model-review eligible only for bounded comparison; human decision and publication block remain when unresolved. |
| `missing_official_source` | Human review and publication block. |
| `weak_source_evidence` | Model-review eligible for bounded assessment; human review when still weak. |
| `unsupported_source_format` | Automatically retryable only through an approved existing adapter; otherwise human review. |
| `missing_or_ambiguous_location` | Human review; publication-blocking. |
| `archive_current_program_ambiguity` | Model-review eligible; unresolved ambiguity requires human review and blocks publication. |
| `deterministic_synthesis_failure` | Automatically retryable only when classified transient; otherwise human/system review. |
| `editorial_quality_failure` | Retain deterministic content; human review; non-blocking unless the configured content gate requires the edit. |
| `model_budget_exceeded` | No further model call; deterministic processing continues; route to review if editorial assistance was required. |
| `missing_approved_image` | Mark `art_pending`; preserve content/private preview; publication-blocking; no automatic image action. |
| `image_provenance_failure` | Human/legal review and publication block. |
| `event_factory_readiness_failure` | Human review and publication block. |
| `publication_readiness_failure` | Human review and publication block; no publication attempt. |
| `identity_security_mismatch` | Fatal for the affected scope; never automatically retried or waived into publication readiness. |
| `unexpected_system_failure` | Fatal or explicitly transient after diagnosis; no blind retry. |

## Model routing and cost controls

Model work is an exception path, not a normal stage requirement.

The route registry contains only near-term Michigan routes:

| Route | Use | Default outcome on failure |
| --- | --- | --- |
| `deterministic_only` | Every event starts here; no provider call. | Preserve deterministic result or create the deterministic-stage exception. |
| `editorial-economical-v1` | Factual structure is safe but allowlisted prose needs material improvement. Reuses the evidence-bound editorial service and configured economical model. | Preserve deterministic content and record `editorial_quality_failure`. |
| `editorial-reasoning-v1` | Bounded editorial handling where the reviewed policy explicitly allows the configured stronger route. It never changes identity or publication facts by itself. | Create or retain the human-review exception. No silent escalation. |

Before a provider call, the store appends a `michigan_completion_model_reserved` action containing:

- processor and route ID/version;
- reason the model is required;
- deterministic preconditions attempted and their result references;
- provider/model family or configured model and reasoning level when supported;
- maximum attempts and current attempt;
- exact model input hash;
- estimated input/output usage;
- per-event and per-run budget limit, used amount, and proposed reservation;
- fallback behavior and whether failure blocks content/readiness.

The matching `michigan_completion_model_finished` action records the reservation identity, response identity when available, actual or best available estimated input/output usage, recorded cost when configured, and one of `succeeded`, `failed`, or `rejected`. Budget-blocked and deterministic-only rejections are terminal reservation actions and never call a provider.

Protections:

- no reservation means no call;
- an exact successful replay returns the prior action and adds no charge;
- event and run budgets are checked atomically before reservation;
- exhausted budgets create `model_budget_exceeded`;
- retries are bounded and require a new attempt action;
- stronger reasoning uses a different declared route and cannot happen silently;
- deterministic content remains available after provider, safeguard, budget, or editorial rejection;
- v1 records configured estimates/actual gateway usage but does not call a billing API.

## Content-ready and art-pending semantics

Content and art are two independent completion dimensions.

| Completion readiness | Meaning |
| --- | --- |
| `publication_blocked` | A non-art factual, identity, evidence, content, security, or package blocker is open. Earlier successful work remains intact. |
| `content_ready` | Identity, evidence, verification, synthesis, Event Hub content, citations, map provenance, and non-art package gates pass. Art has not yet been evaluated for final readiness. |
| `art_pending` | Content remains ready and no approved provenance-complete hero exists. This is an independent presentation state, not a failed event. |
| `review_ready` | Every non-art requirement passes and no publication blocker is open. Approved art is optional. This is eligibility for human review, not approval or publication. |

The existing package model remains authoritative:

- all seven non-art gates ready, verified diligence, and identity clearance may make an art-false package `ready_for_review`;
- the completion layer retains `art_pending` as an independent output while recording publication review eligibility;
- private and public Event Hubs present a deliberate text-based hero and do not set a fake hero URL;
- public manifest validation requires both hero source and alt text together, or both empty;
- no Event Page version is published or made public;
- content is not discarded or regenerated when art later becomes available;
- only an approved visual workflow and reviewed package revision can attach art;
- image provenance must be `ray_provided`, `organizer_provided`, `licensed`, `generated`, `legacy`, or `unknown`; `unknown` is never publication-ready.

This task does not implement the Event Image Lab and the orchestrator contains no image search, generation, upload, copy, edit, transform, replacement, or placeholder behavior.

## Michigan assumptions that remain configurable

Michigan is the reference configuration, not a hardcoded fork. The following belong in the manifest/runtime configuration or stage registry:

- state ID, display name, accepted state values, and time zone (`America/Detroit`);
- county code/name and county/batch identity;
- input schema version, workbook/sheet identity, parser version, adapter version, and orchestrator version;
- approved manifest dispositions and record-level expected actions;
- current-edition review clock and target year;
- bounded event concurrency and stage retry limits;
- deterministic-only mode and route allowlist;
- per-event and per-run model budgets and usage-estimation policy;
- source count/readiness thresholds and supported existing source adapters;
- stage IDs, versions, prerequisites, and blocking rules;
- Event Factory readiness-rule version and content-quality threshold;
- allowed image provenance categories;
- local structured-report destination;
- authorized Atlas administrator identity supplied at execution time.

The following are invariants, not configurable Michigan options:

- exact replay cannot duplicate work or model charge;
- conflicting replay is rejected;
- fuzzy similarity cannot merge identity;
- unresolved factual ambiguity requires human review;
- approved/public histories are immutable;
- completion cannot generate or substitute imagery;
- completion cannot materialize a new canonical event;
- completion cannot approve or publish a package or Event Hub page.

## Prohibited duplicates and replacements

Do not add:

- a Michigan-only event table or identity graph;
- a second candidate intake RPC;
- a second source archive, evidence/claim store, or schedule store;
- a second deterministic or model synthesis system;
- a second Event Factory/package model;
- a second Event Hub manifest or public route;
- a second visual workflow or image lab;
- a completion-specific run/event/stage/model table family;
- a parallel exception dashboard or exception table;
- a publication worker, publication stage, or automatic approval path;
- one autonomous agent per event.

Existing checked-in events, manifests, local media, and published packages remain compatibility fixtures. Tightening the new completion path must not invalidate them retroactively.

## Security and validation boundary

The completion entry point runs in a trusted local/server context with service-role credentials kept outside source control. Public, anonymous, and authenticated roles must not execute completion RPCs or read private runs/exceptions.

The focused validator must prove:

1. deterministic clean completion with no model action and no publication;
2. identity ambiguity creates a human-review exception while other records continue;
3. conflicting dates retain evidence and block readiness;
4. content completes while art remains pending and no image appears;
5. event/run budgets block further model calls without blocking deterministic records;
6. resume starts after the last successful checkpoint;
7. exact replay duplicates neither domain/audit work nor usage;
8. conflicting replay is rejected under the same immutable identity;
9. public, `anon`, and `authenticated` roles cannot invoke privileged completion functions.

No production event is a test fixture. No completion run may be started merely to verify that migrations 023-024 deployed. Post-deployment verification is read-only.

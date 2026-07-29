# Michigan Completion Execution Plan v1

Status: post-implementation operating plan. This document does not authorize migration deployment, a production completion run, candidate staging, canonical materialization, image work, package approval, or publication. Event-specific Macomb proofs are retained history; the county operator remains a separate authorization boundary.

The operating layer must follow `docs/MICHIGAN_COMPLETION_ARCHITECTURE.md`. Michigan is the only implementation target for this plan; there is no fifty-state roadmap here.

The implementation release gate completed on July 28, 2026. Migrations 023-024 are deployed and read-only verification confirmed parity, private-role isolation, zero completion runs, and unchanged public event/package/page/media state. The commands below remain the required regression gate before the separately reviewed first private proof.

## Release gate before any private proof

Migrations `023_michigan_completion_operating_layer.sql` and the forward-only hosted-Postgres correction `024_fix_michigan_completion_run_list_limit.sql` may be deployed only after all of the following pass from the same source state:

```powershell
npm run validate:michigan-completion
npm run validate:event-source-synthesis
npm run validate:event-source-synthesis-lifecycle
npm run validate:event-factory-publication-lifecycle
npm run validate:published-atlas-discovery
npm run validate:atlas-control
npm run validate:public-schema-security
npm run validate:state-atlas-data
npm run lint
npm run build
```

`npm run build` remains the required full application check even when it repeats focused validators. Do not run visual smoke and do not launch Playwright.

After an authorized migration deployment:

1. confirm local/remote migration parity through 024;
2. read the new RPC definitions, privileges, completion-specific indexes/guards, and `atlas_review_item_actions` in a read-only transaction;
3. confirm `public`, `anon`, and `authenticated` cannot execute completion RPCs or read private completion/exception data;
4. confirm the existing published-event count and exact published package/page pointers are unchanged;
5. stop without starting a completion run.

Migration deployment and a completion-run authorization are separate decisions.

## County operator

The supported county entry point is:

```powershell
npm run atlas:create-county-events -- macomb
```

It verifies the registered retained inventory, classifies every row, creates bounded immutable Michigan Completion manifests, discovers compatible runs, starts or resumes default-safe dry runs through the existing orchestrator, and writes one aggregate county report. Model budgets default to zero and concurrency defaults to one. An explicit `--editorial` option creates a different immutable contract with one economical, evidence-bound attempt per event and a 15,000-token per-event ceiling; plan-only and dry-run modes still make no provider call.

Planning without a completion run uses:

```powershell
npm run atlas:create-county-events -- macomb --plan-only
```

Private workflow effects require a separately reviewed instruction and an explicit actor:

```powershell
npm run atlas:create-county-events -- macomb --authorize-private-writes --actor <allowlisted-admin-email>
```

Migration 026 passed review and validation, was deployed atomically, and has verified local/remote parity. Dry-run and private manifests have separate immutable identities. The operator never exposes canonicalization, image, approval, or publication options. Detailed classification, replay, resume, report, and safety rules are in `docs/COUNTY_COMPLETION_OPERATOR.md`.

## Michigan operating sequence

### 1. Prove the workflow with a private Macomb County batch

The first proof is exactly one separately reviewed record: the already-staged `MAC-042` Bay-Rama Fishfly Festival candidate.

The proof manifest must be created separately at:

```text
artifacts/michigan-completion/macomb/macomb-private-proof-v1.json
```

It must bind:

- state ID `MI`;
- county code `macomb`;
- `MAC-042`;
- the existing candidate ID `6da5b04d-013f-45d0-acc1-9bbc782de02f`;
- the retained county-seed manifest and payload hashes already associated with that candidate;
- expected candidate action `verified_existing_no_op`;
- deterministic-only processing;
- per-event model budget `0`;
- per-run model budget `0`;
- concurrency `1`;
- private evidence/content/package work only;
- `candidate_staging_authorized = false`;
- `canonical_materialization_authorized = false`;
- `image_action_authorized = false`;
- `publication_authorized = false`.

Do not reuse the historical seven-record Batch 1 authorization as completion authorization. Do not add `MAC-049` Richmond Good Old Days Festival or `MAC-026` Memphis Festival Days. They remain unstaged.

First recompute and independently review the proof manifest hash. Then run the default-safe proof:

```powershell
npm run atlas:complete-michigan-batch -- --manifest artifacts/michigan-completion/macomb/macomb-private-proof-v1.json --county macomb --dry-run --deterministic-only --model-budget 0 --per-event-model-budget 0 --concurrency 1
```

The dry-run report must show:

- manifest validation succeeded;
- candidate staging resolved to the existing candidate as a no-op;
- no candidate, candidate source, discovery run, canonical event, source bundle, synthesis, package, media, page version, or publication write was attempted;
- no model reservation or usage action exists;
- publication eligibility is false;
- the next private actions and all expected exception codes are explicit.

Only after Ray reviews that exact report and separately authorizes the same immutable manifest hash may the private execution mode be used. The v1 interface must require an explicit private-execution switch and actor identity; omission must remain a dry-run. The authorized command shape is:

```powershell
npm run atlas:complete-michigan-batch -- --manifest artifacts/michigan-completion/macomb/macomb-private-proof-v1.json --county macomb --authorize-private-writes --actor <allowlisted-admin-email> --deterministic-only --model-budget 0 --per-event-model-budget 0 --concurrency 1
```

The private run may create only the completion ledger/audit records and the existing private evidence, deterministic synthesis, verification, content, and assembling-package records explicitly allowed by the reviewed manifest. Candidate staging must remain a verified no-op.

Expected proof outcome:

- deterministic stages complete without a model call;
- Bay-Rama remains a private candidate and is not materialized into `events`;
- evidence and conflicting facts, if any, remain attached to their existing canonical source objects;
- valid content reaches `content_ready`;
- the private Event Factory package/preview remains available with explicit art-pending treatment;
- no image is searched, generated, copied, uploaded, transformed, selected, or substituted;
- `missing_approved_image` remains an open publication-blocking exception;
- completion readiness is `art_pending`;
- publication eligibility is false;
- the run stops in `waiting_for_exceptions` or `ready_for_review`, as supported by its open blockers;
- no publication function is called.

Read-only verification after the proof must compare before/after counts and identities for:

- `events`;
- promoted/matched candidates;
- published Event Factory packages;
- published Event Hub versions and pointers;
- approved media;
- completion run/actions;
- open completion exceptions and exception actions;
- model reservations/usage.

The expected deltas are zero canonical events, zero promoted candidates, zero published packages/pages, zero approved media, and zero model usage. Only authorized private workflow and completion audit records may increase.

Bay-Rama must not be canonicalized or published. The completion-layer implementation task itself does not run this proof.

### 2. Resolve exceptions

Use the existing Atlas Control Desk queue and completion run detail, not a separate dashboard.

For each exception:

1. inspect the linked run, event/candidate, stage/version, evidence/synthesis/package identity, input hash, and classification flags;
2. acknowledge it before performing human investigation;
3. correct the canonical source object rather than copying a correction into the completion ledger;
4. resolve only after a deterministic rerun proves the blocker is gone;
5. waive only a non-fatal exception with an actor and concrete reason;
6. supersede only when a linked replacement exception exists;
7. resume the same run so successful checkpoints are reused; only incomplete
   events without an open event-level blocking exception continue, while
   unresolved neighboring events remain quarantined. A blocker tied to an
   older deterministic stage version may receive one bounded recheck, but it
   remains publication-blocking until the retained review item receives a
   supported disposition.

Never waive an identity/security mismatch, unsupported canonical merge, missing official source, unresolved current-date conflict, unknown image provenance, or missing approved art into publication readiness.

Resume only by retained run ID; the immutable manifest and authorization mode come from the run:

```powershell
npm run atlas:complete-michigan-batch -- --run-id <completion-run-uuid> --resume --actor <allowlisted-admin-email>
```

Model-review-eligible exceptions may use a declared route only after deterministic attempts are retained and a budget reservation succeeds. Model advice does not resolve publication-sensitive ambiguity by itself.

### 3. Approve a limited showcase collection

After the one-record proof is understood, Ray may choose a small set of private packages as the Michigan showcase collection.

Collection approval means editorial selection for further human review. It does not mean Event Factory package approval, canonical materialization, Event Hub publication, sponsor placement, or an official organizer relationship.

Each showcase selection must have:

- resolved identity;
- retained official and corroborating evidence;
- current-edition truth separated from archives;
- verified location/map provenance;
- content-ready Event Hub sections and official-source link;
- an explicit art state;
- no unresolved fatal exception;
- an owner and next review date.

An art-pending package may be selected for future showcase work while remaining publication-blocked. The completion orchestrator must not start the visual workflow.

### 4. Process additional counties in bounded batches

Expand only after the Macomb exception patterns are incorporated into a new manifest or stage version.

For every county:

1. freeze and fingerprint the approved county input;
2. run a deterministic local validation;
3. perform the default dry-run;
4. review identity matches, insufficient records, shared sources, and proposed private effects;
5. authorize an exact manifest hash and bounded private scope;
6. execute with explicit concurrency and model budgets;
7. allow independent records to complete when another record blocks;
8. reconcile exceptions and resume from checkpoints;
9. export the structured report;
10. stop before publication approval.

Recommended initial limits are one county per run, no more than five event records per private batch, concurrency one or two, deterministic-only first pass, and a zero model budget until the county's deterministic exception profile is reviewed. These values are configuration, not permanent national defaults.

Do not treat a workbook's qualification or a county's completion percentage as permission to stage, canonicalize, approve, or publish an event.

### 5. Maintain statewide coverage metrics

Maintain one state-level rollup from immutable run reports and canonical source objects. Never count generated prose, image work, or publication as discovery coverage.

Required coverage measures:

| Metric | Definition |
| --- | --- |
| County inventory coverage | Counties with a reviewed versioned input divided by Michigan counties in the configured pilot scope. |
| County disposition rate | Manifest records ending in unambiguous existing identity, reviewed new candidate, insufficient information, excluded, or open identity exception divided by all reviewed records. |
| Source-class coverage | Configured county, municipal, chamber, fair, arts, festival, venue, tourism, and official-organizer source classes checked, with last-successful date. |
| Identity resolution rate | Records with an exact canonical/candidate disposition divided by valid manifest records. |
| Current-edition evidence rate | Events with current dates or an explicit reviewed not-yet-announced state divided by identity-resolved events. |
| Location readiness rate | Events with retained verified location/coordinate provenance divided by identity-resolved events. |
| Content completion rate | Events at `content_ready`, `art_pending`, or `review_ready` divided by eligible private events. |
| Art readiness rate | Events with approved, provenance-complete art divided by content-complete events. |
| Review readiness rate | `review_ready` events divided by eligible private events. |
| Publication stop compliance | Runs with zero publication calls and writes divided by all completion runs; target 100 percent. |
| Freshness | Age of latest successful source/evidence review by event and county. |

Report exclusions and insufficient-information records. A lower honest coverage rate is preferable to silently dropping difficult records.

### 6. Distinguish basic, showcase, and revenue-capable event readiness

These are operational reporting tiers, not separate event types or publication systems.

#### Basic

Basic readiness requires:

- resolved event/candidate identity;
- at least one retained official source;
- current dates or an explicit reviewed not-yet-announced state;
- a confirmed city/venue and retained map provenance;
- concise source-backed Event Hub content with an official-source link;
- no unresolved identity, date, location, or security blocker.

Art is not required for basic content completion. A basic event may be `art_pending` and private only.

#### Showcase

Showcase readiness requires all Basic gates plus:

- accepted, valid Event Hub content with the required experience, schedule, highlights, and plan structure for its lifecycle;
- useful source-backed planning and Scout context;
- an approved, provenance-complete hero with verified mobile crop;
- a complete private package preview;
- no open publication-blocking exception.

This maps to completion `review_ready`, not publication.

#### Revenue-capable

Revenue-capable readiness requires all Showcase gates plus a separate human commercial/legal review covering:

- rights and provenance for every commercial placement asset;
- current planning/ticket links and a named freshness owner;
- an approved Celebration Atlas commercial placement plan;
- analytics/fulfillment readiness when applicable;
- explicit confirmation that no event sponsor or official relationship is implied.

This tier is a reporting flag only. It does not create a sponsor, organizer, or partner relationship, and it does not authorize sponsor display or publication.

### 7. Track art separately from content completion

Every event report must expose:

- `content_readiness`;
- `art_readiness`;
- `image_provenance`;
- `private_preview_available`;
- `publication_eligible`;
- the active visual exception, if any.

Allowed provenance values are:

```text
ray_provided
organizer_provided
licensed
generated
legacy
unknown
```

`unknown`, missing QA, missing approval, a local file alone, or a broken public asset keeps art pending. Missing art never decreases the content completion numerator, deletes a package, or triggers image work.

### 8. Stop every batch before publication approval

The terminal completion action is the publication-readiness evaluation and report.

Every run report must state:

```text
publication_stage_present: false
publication_actions_attempted: 0
publication_writes: 0
```

`publication_eligible=true` means only that an event may be handed to the existing human Event Factory review. The completion script must exit before:

- package approval;
- canonical materialization;
- Event Page draft submission/approval for publication;
- hero media registration for publication;
- migration-021 activation;
- homepage discovery changes.

Any later publication is an event-specific human action in the existing Atlas Control flow. There is no batch publish command and no completion-run approval that authorizes all contained events.

### 9. Measure deterministic completion rate and model cost

Required efficiency and cost metrics:

| Metric | Definition |
| --- | --- |
| Deterministic completion rate | Events reaching content completion with zero successful model calls divided by events reaching content completion. |
| Deterministic stage success rate | Successful deterministic stage attempts divided by eligible deterministic stage attempts, excluding exact replay skips. |
| Model-assistance rate | Events with at least one model reservation divided by valid event records. |
| Model success/rejection/failure rates | Terminal model usage states by route and processor version. |
| Estimated and actual input/output usage | Totals by event, run, route, and configured model; label estimates as estimates. |
| Recorded model cost | Configured or gateway-reported cost by event/run; do not imply billing-ledger accuracy. |
| Budget-block rate | Events receiving `model_budget_exceeded` divided by model-eligible events. |
| Cost per content-complete event | Recorded run model cost divided by content-complete events. |
| Exact-replay duplicate charge count | Count of exact replays that create a new charge; required value zero. |
| Escalation count | Explicit stronger-route reservations; silent escalation count must be zero. |

Track deterministic content that survives a rejected or failed editorial pass as successful deterministic work, not as a failed event.

### 10. Improve the pipeline based on real Michigan exceptions

After each bounded batch:

1. rank exception codes by frequency, publication impact, and operator time;
2. separate bad input, unsupported source format, missing evidence, policy ambiguity, and genuine software defects;
3. fix the existing canonical parser/service when the pattern belongs there;
4. add a new deterministic rule only when it is source-safe and regression-tested;
5. version the affected manifest, stage, route, or readiness rule;
6. retain old checkpoints and exception actions under their original versions;
7. rerun the focused synthetic proof plus the smallest Michigan regression fixture;
8. compare deterministic completion and model cost before expanding batch size.

Do not respond to exceptions by adding event-specific code, weakening identity matching, hiding conflicts, inventing facts, increasing model retries without a cap, or creating a parallel pipeline.

## Run report and operating dashboard

Each run report should include:

- immutable run/state/county/batch/manifest/orchestrator identities;
- dry-run and authorization scope;
- coarse and fine lifecycle status;
- totals by stage status and event readiness;
- per-event current stage, attempt count, canonical references, and retained output references;
- open/resolved/waived/superseded exception counts and codes;
- model reservations, usage, cost, and budget remaining;
- content-ready, art-pending, review-ready, and publication-eligible counts;
- coverage/readiness tier metrics;
- proof that publication was not attempted;
- exact resume command when incomplete.

Atlas Control should display only the smallest useful projection: recent completion runs, progress/counts, budget use, and linked exceptions. The structured report remains the detailed audit artifact.

## Exit behavior

The command has stable outcomes:

- exit `0`: dry-run or private run completed its allowed scope, including a completed report with no unresolved publication-blocking work;
- exit `2`: valid partial run waiting for exceptions;
- exit `1`: argument, validation, persistence, or system failure.

Cancelled runs remain a distinct persisted lifecycle status even though v1 intentionally exposes no cancellation mutation in the batch command.

An exception-blocked exit is resumable and must not be reported as rollback. Already valid domain records and successful checkpoints remain intact.

## Remaining operational risks

- The repository does not contain historical migration 004, so migrations 023-024 and the focused validator must use the checked deployed contract rather than reconstructing or replacing the control plane.
- Existing private package preparation and Event Hub preview currently assume approved hero art; the art-pending seam must remain private and must not weaken public validation.
- Source formats outside existing bounded adapters will continue to require human handling.
- V1 model cost can be estimated or gateway-recorded but is not an accounting/billing ledger.
- County inventories may be incomplete even when every supplied row is dispositioned.
- Historical/current-program ambiguity and shared organizer URLs will remain common Michigan exceptions.
- Existing published packages are compatibility fixtures; completion hardening must not retroactively invalidate them.

Migration 026 and the first Macomb plan-only projection are complete. The retained report at `artifacts/michigan-completion/macomb/county-operation-report-v1.json` classifies all 83 records without starting or resuming a run. Review its one identity exception, three protected records, 34 insufficient records, two canonical records, and 43 guarded-staging records before separately authorizing any dry or private execution.

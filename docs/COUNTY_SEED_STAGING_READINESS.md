# County Seed Guarded Staging Readiness

Status: **Phase C2C verified. Migrations 018 and 019 are deployed. Only the separately authorized `MAC-042` Bay-Rama canary was staged; no batch or additional pilot record is authorized.**

Baseline: Phase C0 commit `64ebd81360535e7dfd671d98d34d324b764c373d` established the narrow schema contract; Phase C1 commit `74cfc29c205e664a6b9ae18d80ac978003b585f1` added guarded staging readiness. Migration 018 was deployed in Phase C2B. Phase C2C deployed migration 019 and executed one expressly authorized candidate-intake transaction for Bay-Rama. The historical seven-event manifest and immutable three-event pilot manifest remain unchanged.

## Phase C2C execution record

- Deployed project: `hmytrcorqkqvoaedvgbf` (`us-east-2`, `ACTIVE_HEALTHY`).
- Migration 018 SHA-256: `b96691f274c93a5e9b08d93e44a51cc836411f263ce780ab1b3b002826879675`.
- Migration 019 SHA-256: `be97b94019b19b1ae55fbfc01e525de62703c316a6b4e64055afb187f8cead08`.
- Migration 019 modifies only the manifest-disposition predicate in `atlas_stage_county_seed_candidate`. It accepts exactly `provisional_batch_1_manifest_only` and `revised_three_event_pilot_manifest_only`.
- Null, suffixed, prefixed, and other scope values remain rejected. Anonymous and authenticated roles have no execute privilege; service-role execution remains required.
- The separate canary authorization SHA-256 is `69056a627914edfd258711773afd7eafd0563ba2a452129cb0fefae38b0d4dad`. It authorizes staging only `MAC-042` with payload SHA-256 `8672985d675e18749bec93030b4b2f13eda7df7a4f73d398e453d5a2fc3f6594` from immutable manifest SHA-256 `d2d1c245c1c8ac4abea3a1fef1e21a9ab8da2adf7a05d0db6c8bfbaba3079fd8`.
- Candidate `6da5b04d-013f-45d0-acc1-9bbc782de02f` was created with discovery run `e18e6ec8-53e1-4336-aec1-44c74650b7fd`, source `5f75ef27-16d8-437e-a85f-5178d3364ebb`, operation run `38cef64b-28c3-4df2-98f2-5d2c952aa6f5`, and action `48ba7bb2-6fd0-4a19-84aa-98a74a88a5c0`.
- Before/after counts were 10→11 discovery runs, 23→24 candidates, 40→41 sources, 7→8 operation runs, and 7→8 actions. Canonical events remained 19; matched candidates remained 18.
- Exact replay returned the same candidate and operation with `idempotent_replay: true`. A different payload hash on the same idempotency key returned SQLSTATE `23505` and rolled back.
- Richmond `MAC-049` and Memphis `MAC-026` remain unstaged. No canonical event, Event Factory package, Event Hub, publication, visual workflow, image, or placeholder art was created.
- The authorization, append-only JSONL audit, and integrity-hashed verification artifact are retained under `artifacts/county-seeds/macomb/`.

## Deliverables

- `lib/county-seeds/staging.ts` owns deterministic adapter output, canonical hashing, equivalence rules, preflight classification, immutable-manifest integrity, and authorization gates.
- `lib/county-seeds/stagingPreflight.ts` loads the deployed comparison snapshot using explicit HTTP `GET` requests only.
- `lib/county-seeds/stagingApply.ts` defines the future sequential executor and its durable local audit journal. It is unreachable unless a reviewed manifest is integrity-valid, schema-ready, human-authorized, preflight-clear, and confirmed by its exact SHA-256.
- `scripts/prepare-county-seed-staging.ts` creates the two local artifacts after a GET-only deployed preflight.
- `scripts/stage-county-seeds.ts` defaults to preflight. Its future apply mode requires `--apply --confirm <manifest-sha256> --actor <allowlisted administrator email>`.
- `scripts/validate-county-seed-staging.ts` exercises hashes, manifests, collision handling, authorization, resumability, and failure audit with local fixtures and injected RPC stubs.
- `artifacts/county-seeds/macomb/county-seed-batch-0-crosswalk.json` is the approved no-write Batch 0 result.
- `artifacts/county-seeds/macomb/county-seed-batch-1-staging-manifest.json` is the immutable, non-executed seven-record Batch 1 manifest.
- `supabase/migrations/018_guard_county_seed_candidate_staging.sql` is deployed and provides the candidate/source/county-identity uniqueness guards plus the service-role-only staging wrapper.
- `supabase/migrations/019_allow_revised_county_seed_pilot_manifest.sql` is deployed and adds only the second exact approved scope value.
- `lib/county-seeds/canary.ts` and the three canary scripts bind authorization, preflight, execution, replay, audit, and verification to MAC-042.

## Exact adapter contract

Every proposed RPC record targets the deployed
`public.atlas_intake_event_candidate(text,text,text,jsonb,jsonb)` argument shape. The future guarded wrapper retains the same candidate and source objects and adds batch, manifest, and payload hashes as wrapper arguments.

The candidate `raw_payload` receives a `county_seed` object containing:

- county code and Clean ID;
- Macomb County Seed Inventory v1 identity, workbook file name, workbook SHA-256, and approved-sheet SHA-256;
- source sheet and source row;
- seed and normalized names;
- original and normalized aliases;
- municipality and normalized municipality;
- original and normalized organizer and venue;
- full address;
- original, normalized, and identity-key forms of official event, organizer, and supporting URLs;
- category and tags;
- classified date information;
- spreadsheet activity, qualification, confidence, review, and existing-match statuses;
- cleanup provenance, duplicate group, decision ID, and cleanup notes;
- geocoding status;
- the complete 40-column source row;
- the reviewed C1 provisional-manifest disposition;
- adapter version, parser version, batch ID, and deterministic payload hash.

The deployed RPC ignores additional JSON keys when materializing table columns but retains the complete candidate object in `event_candidates.raw_payload`.

## Deterministic identity and hashing

Object keys are recursively sorted before canonical JSON serialization. The SHA-256 material includes the staging contract and adapter versions, deployed RPC identity, idempotency key, candidate payload, source payloads, workbook and sheet identities, Clean ID, and complete provenance. It excludes runtime timestamps, actor substitution, network state, retry counters, candidate UUIDs, and the hash field itself.

The payload hash is added to `p_candidate.county_seed.payload_hash` only after calculation. The immutable manifest receives a separate SHA-256 over all manifest content except its own hash value.

Equivalence is strict:

- same idempotency key plus the same stored payload hash and a succeeded operation is a no-op;
- the same exact county identity plus the same hash, same slug, and an unpromoted candidate is a no-op;
- an idempotency, county identity, or slug collision with a missing or different hash is an equivalence blocker;
- an existing nonterminal operation is uncertain and must be reconciled before retry;
- fuzzy similarity is only a warning and can never create a match.

## Read-only preflight

Each record checks:

1. deterministic canonical name, official URL, or alias plus location;
2. exact official URL;
3. exact normalized name and municipality;
4. alias plus municipality or venue;
5. candidate slug;
6. operation-type/idempotency-key identity and stored hash;
7. exact county-code/Clean-ID candidate identity;
8. normalized official source attached to another candidate;
9. shared organizer or venue with a different identity;
10. promoted or matched candidate state;
11. fuzzy name similarity as a warning only.

The 2026-07-27 artifact snapshot read 23 candidates, 40 candidate-source associations, 7 operation runs, and 19 canonical events. It found:

- zero duplicate non-null candidate slugs;
- zero duplicate exact candidate/source associations;
- zero duplicate operation identities;
- zero duplicate exact county-seed identities;
- zero Batch 1 deterministic canonical, candidate, slug, source, or idempotency collisions.

All seven historical Batch 1 records were preflight-clear when prepared, but the full manifest remains non-executed and unauthorized. Migration deployment does not grant execution approval.

## Constraint decision

The fresh scan made three narrowly scoped uniqueness guards safe to deploy:

- a partial unique index for non-empty `event_candidates.slug_candidate`;
- a unique index for `event_candidate_sources(candidate_id, source_url)`;
- a partial expression unique index for exact normalized county code plus Clean ID retained in `raw_payload`.

The deployed operation identity already has the authoritative unique index on `(operation_type, idempotency_key)`; no duplicate constraint is proposed there.

Migration 018 begins with deployment-time duplicate preconditions, so it fails before changing the schema if deployed data changes. It deploys a service-role-only `atlas_stage_county_seed_candidate` wrapper that:

- serializes an idempotency identity with a transaction-scoped advisory lock;
- validates batch, manifest, payload, county, Clean ID, slug, name, city, and reviewed disposition;
- rejects stored-hash mismatch and uncertain operation state;
- rejects canonical, candidate, promoted-candidate, slug, alias/location, and official-source collisions;
- returns an equivalent unpromoted county candidate as a no-op;
- delegates to the existing deployed intake RPC only after all guards pass.

Migration 018 was applied only after a separately approved Phase C2B read-only scan and remote verification. Migration 019 was then applied in Phase C2C after verifying it replaced exactly one scope predicate. Remote parity is aligned through 019, and the wrapper remains visible in PostgREST OpenAPI. Neither deployment authorizes any manifest by itself.

## Batch 0 exact plan

Batch 0 creates no candidate and calls no RPC.

| Clean ID | Existing candidate | Canonical event | Disposition |
| --- | --- | --- | --- |
| `MAC-001` | `f6c3fb7b-0d31-4c97-b335-3cffc3cd202d` | Armada Fair `46d7e6ff-bec5-4801-80da-2d21aa131092` | Retain seed-to-canonical crosswalk only |
| `MAC-050` | `f8e47b34-0187-45c3-99b9-b919ee4faf62` | Romeo Peach Festival `79fab78b-0a08-4439-8cc0-470281d69fb6` | Retain seed-to-canonical crosswalk only |

Exact official URL, normalized name and municipality, and the existing promoted-candidate link were reconfirmed by GET. The crosswalk records the human-approved no-write disposition, `rpc: null`, and an empty `database_writes` list.

## Batch 1 exact plan

Immutable batch ID:
`county-seed:macomb:batch-1:72ca71ed633d8a8d:v1`.

Manifest SHA-256:
`d0203c6b9141f068a3a4c25ad6449ed641877117d7010fefabc535fb25bae9f2`.

The manifest contains exact RPC payloads and individual payload hashes for:

- `MAC-003` — Blake's Lavender Festival
- `MAC-004` — Blake's Pickle Festival
- `MAC-008` — Chesterfield Heritage Days
- `MAC-011` — Chesterfield Vietnam Era Reenactment
- `MAC-041` — Art on the Bay
- `MAC-042` — Bay-Rama Fishfly Festival
- `MAC-049` — Richmond Good Old Days Festival

Every status is `not_executed`; every eventual candidate ID and error is null; every retry count is zero; staging and publication approvals are `not_authorized`.

The manifest preserves reviewed cohort warnings rather than merging identities. `MAC-003` and `MAC-004` share an organizer and venue. `MAC-008` and `MAC-011` are the Batch 1 members of the workbook cohort `MAC-008` through `MAC-011`, which shares the Chesterfield Historical Society event-listing URL; the two selected records also share a venue. The known Clean IDs are retained with each payload so the shared listing remains a warning for those reviewed siblings; an unrelated candidate owning the same source remains a blocker.

The exact payloads are compatible with the deployed base RPC columns and constraints. They must never be sent through the unguarded RPC. Any later execution requires a separate single-purpose authorization and the deployed guarded wrapper; the seven-event manifest remains historical preparation only.

## Transactions, retry, rollback, and audit

- Each future candidate RPC is one independent PostgreSQL transaction. The seven-record batch is intentionally not one cross-record transaction.
- A local append-only JSONL audit checkpoint is flushed before each RPC. Until a result entry is durably appended, that attempt is classified `success_response_interrupted`.
- A successful response records candidate and operation IDs. A same-hash replay records `idempotent_replay`.
- A PostgreSQL rejection records `rpc_rejected` followed by `confirmed_rollback`; the audit file is outside the failed database transaction.
- A transport failure records `network_uncertainty` and stops. It must not be blindly retried.
- Fresh preflight after uncertainty determines whether the operation succeeded, is still nonterminal, is an equivalent no-op, or conflicts.
- Preflight blockers record `preflight_blocked`; hash or identity conflicts record `equivalence_conflict`.
- The existing intake RPC records successful operation and action rows. The independent local journal preserves the failure or uncertainty state that the RPC's rethrown exception cannot retain inside its rolled-back transaction.

## Approval checkpoints

Future apply requires all of the following:

1. deployed migrations 018 and 019 with remote parity reconfirmed;
2. current schema-contract types and visible guarded RPC signature;
3. a fresh GET-only preflight;
4. no Batch 0 record, insufficient-information seed, unresolved deterministic match, promoted candidate, dirty manifest, or equivalence conflict;
5. an immutable manifest explicitly changed to human-authorized execution;
6. the exact immutable manifest SHA-256 supplied to `--confirm`;
7. an allowlisted administrator actor identity.

The default safe command is:

```powershell
npm run stage:county-seeds -- artifacts/county-seeds/macomb/county-seed-batch-1-staging-manifest.json --preflight
```

The future shape is documented but was not executed:

```powershell
npm run stage:county-seeds -- <human-approved-manifest.json> --apply --confirm <manifest-sha256> --actor <allowlisted-admin-email>
```

The Bay-Rama staging canary is complete. No further staging, research, publication, imagery, Event Hub generation, canonical promotion, or clustering follows from it without a new explicit approval.

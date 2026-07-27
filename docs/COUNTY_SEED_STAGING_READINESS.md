# County Seed Guarded Staging Readiness

Status: **Phase C1 machinery and non-executed artifacts only. No county batch is authorized. Migration 018 is proposed and review-only, is not deployed, and is not authorized for application.**

Baseline: Phase C0 commit `64ebd81360535e7dfd671d98d34d324b764c373d`. The Phase C1 preparation and validation commands use the approved Macomb County Seed Inventory v1 workbook and PostgREST `GET` requests only. No candidate-intake RPC, DML, DDL, migration apply, discovery run, candidate, source, match, verification case, or canonical event was created.

## Deliverables

- `lib/county-seeds/staging.ts` owns deterministic adapter output, canonical hashing, equivalence rules, preflight classification, immutable-manifest integrity, and authorization gates.
- `lib/county-seeds/stagingPreflight.ts` loads the deployed comparison snapshot using explicit HTTP `GET` requests only.
- `lib/county-seeds/stagingApply.ts` defines the future sequential executor and its durable local audit journal. It is unreachable unless a reviewed manifest is integrity-valid, schema-ready, human-authorized, preflight-clear, and confirmed by its exact SHA-256.
- `scripts/prepare-county-seed-staging.ts` creates the two local artifacts after a GET-only deployed preflight.
- `scripts/stage-county-seeds.ts` defaults to preflight. Its future apply mode requires `--apply --confirm <manifest-sha256> --actor <allowlisted administrator email>`.
- `scripts/validate-county-seed-staging.ts` exercises hashes, manifests, collision handling, authorization, resumability, and failure audit with local fixtures and injected RPC stubs.
- `artifacts/county-seeds/macomb/county-seed-batch-0-crosswalk.json` is the approved no-write Batch 0 result.
- `artifacts/county-seeds/macomb/county-seed-batch-1-staging-manifest.json` is the immutable, non-executed seven-record Batch 1 manifest.
- `supabase/migrations/018_guard_county_seed_candidate_staging.sql` is a **review-only, unapplied** migration proposal. Its production guard is not weakened by the existence of the file.

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

All seven Batch 1 records are preflight-clear for the proposed `stage_new_candidate` action. None is execution-eligible because migration 018 is not deployed and no staging approval exists.

## Constraint decision

The fresh scan makes three narrowly scoped uniqueness guards safe to **prepare for review**:

- a partial unique index for non-empty `event_candidates.slug_candidate`;
- a unique index for `event_candidate_sources(candidate_id, source_url)`;
- a partial expression unique index for exact normalized county code plus Clean ID retained in `raw_payload`.

The deployed operation identity already has the authoritative unique index on `(operation_type, idempotency_key)`; no duplicate constraint is proposed there.

Migration 018 begins with deployment-time duplicate preconditions, so it fails before changing the schema if deployed data changes. It also proposes a service-role-only `atlas_stage_county_seed_candidate` wrapper that:

- serializes an idempotency identity with a transaction-scoped advisory lock;
- validates batch, manifest, payload, county, Clean ID, slug, name, city, and reviewed disposition;
- rejects stored-hash mismatch and uncertain operation state;
- rejects canonical, candidate, promoted-candidate, slug, alias/location, and official-source collisions;
- returns an equivalent unpromoted county candidate as a no-op;
- delegates to the existing deployed intake RPC only after all guards pass.

The migration is not applied in Phase C1 and is required before any Batch 1 execution. Its rollback comments drop the wrapper and the three indexes in reverse dependency order. A separately approved schema task must re-run the read-only scan, review the SQL, apply it, verify remote migration parity and generated types, and confirm the wrapper in PostgREST OpenAPI before any apply manifest can be approved.

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

The exact payloads are compatible with the deployed base RPC columns and constraints. They are **not safe to send through the unguarded RPC today** because deployed slug/source races and request-overwrite hash behavior remain. Future execution must use the reviewed guarded wrapper after migration 018 is separately approved and deployed.

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

1. reviewed and deployed migration 018 with remote parity confirmed;
2. regenerated current database types and visible guarded RPC signature;
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

No staging, research, publication, imagery, or clustering follows from this readiness milestone.

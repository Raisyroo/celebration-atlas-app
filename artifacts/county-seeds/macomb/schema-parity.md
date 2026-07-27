# County seed schema-parity report

This report is generated through read-only GET requests to the deployed PostgREST OpenAPI document. It contains no credentials or secret configuration.

| Table | Deployed | Missing tracked columns | Additional deployed columns | Deployed required columns |
| --- | --- | --- | --- | --- |
| discovery_runs | Yes | None | None | approval_required, approval_status, candidates_created, created_at, duplicates_flagged, id, items_found, run_metadata, run_type, status |
| event_candidates | Yes | None | None | candidate_name, country, created_at, discovery_confidence, discovery_run_id, duplicate_status, event_type, id, needs_review, raw_payload, social_links, source_urls, state, updated_at, verification_status |
| event_candidate_sources | Yes | None | None | candidate_id, created_at, id, source_url |
| events | Yes | None | None | country, created_at, event_type, id, location_verified, name, slug, state, status, updated_at, verification_status |
| atlas_operation_runs | Yes | None | None | actor_identity, actor_type, created_at, id, idempotency_key, operation_type, request, status, summary, updated_at |
| atlas_operation_actions | Yes | None | None | action_type, created_at, id, lifecycle_state, operation_run_id, requested_payload, source_references, updated_at, warnings |

## Exposed keys and defaults

| Table | Primary/foreign-key relationships | Defaults exposed by deployed schema |
| --- | --- | --- |
| discovery_runs | id primary key; source_id → discovery_sources.id | approval_required=false; approval_status=not_required; candidates_created=0; created_at=now(); duplicates_flagged=0; id=gen_random_uuid(); items_found=0; status=pending |
| event_candidates | discovery_run_id → discovery_runs.id; id primary key; matched_event_id → events.id | country=USA; created_at=now(); discovery_confidence=0.5; duplicate_status=unique_candidate; event_type=unknown; id=gen_random_uuid(); needs_review=true; state=Michigan; updated_at=now(); verification_status=needs_review |
| event_candidate_sources | candidate_id → event_candidates.id; id primary key | created_at=now(); id=gen_random_uuid() |
| events | id primary key | country=USA; created_at=now(); id=gen_random_uuid(); location_verified=false; state=Michigan; status=active; updated_at=now(); verification_status=verified |
| atlas_operation_runs | id primary key | created_at=now(); id=gen_random_uuid(); status=planned; updated_at=now() |
| atlas_operation_actions | id primary key; operation_run_id → atlas_operation_runs.id | created_at=now(); id=gen_random_uuid(); lifecycle_state=proposed; updated_at=now() |

## Repository parity

- Foundational migration 004 tracked: No
- Generated database types tracked: No
- Column blockers: None

The deployed tables satisfy the column contract used by tracked migrations 010 and 011. The unresolved parity gap is that the foundational migration and generated database types are absent from the repository, so the deployed schema remains authoritative for the original table definitions.

## Inspection limits

- PostgREST OpenAPI exposes deployed columns, required fields, defaults, and primary/foreign-key descriptions, but not every check constraint or unique index.
- Tracked migration 010 documents the candidate-intake write contract and migration 011 documents Event Factory foreign-key usage, but neither replaces the missing foundational table definitions.
- No schema mutation, migration generation, or write RPC is performed by this inspector.

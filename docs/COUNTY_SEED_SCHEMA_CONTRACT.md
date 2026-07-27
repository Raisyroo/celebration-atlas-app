# County Seed Intake Deployed Schema Contract

Status: **Phase C0 read-only contract; no batch is approved or executed.**

Baseline: commit `e913c26e2d33851952aa60fe07eebbc1a1b7e183`. Deployed metadata was retrieved on 2026-07-27 from the linked Celebration Atlas project. PostgreSQL catalog queries ran inside `BEGIN READ ONLY`; application-row collision checks used PostgREST `GET` only; TypeScript types came from `supabase gen types typescript --linked --schema public`. No DDL, DML, mutating RPC, migration, candidate intake, or Supabase write was issued.

## Repository contract artifacts

- `artifacts/county-seeds/schema-contract/deployed-county-intake-schema.json` is the exact machine-readable catalog snapshot for the objects in this contract. It includes columns, PostgreSQL types, defaults, nullability, constraints, indexes, triggers, RLS state, effective role privileges, exact function definitions, and supporting objects. SHA-256: `6a1ff5eaba7fa30ce30627f887ce9db86b8380805dd31c9fb01901425faad66d`.
- `types/county-seed-schema-contract.generated.ts` is a narrow excerpt of the official generated public-schema types for the seven required/supporting tables and four Data API RPCs. SHA-256: `9023209875f4068765e07309bd04038b46c9eb8d476e14924b894bf23702eb87`.
- `artifacts/county-seeds/schema-contract/county-seed-batch-write-plan.json` contains the exact non-executed Batch 0 crosswalk and seven proposed Batch 1 RPC argument sets. SHA-256: `4a68179f4ce2ef33b2183adde5bff63debced49d2512a9d4dab84651c2d59911`.

The exact function bodies are retained in the machine artifact rather than duplicated below. These files are a deployed contract snapshot, **not migration 004 and not authorization to recreate or modify deployed objects**.

## Deployed object contract

### `public.atlas_operation_actions`

RLS enabled: **yes**. Forced RLS: **no**. Policies: **0**. Effective privileges are absent for `anon` and `authenticated`; `service_role` has the preserved table privilege set.

| # | Column | Deployed type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | No | `gen_random_uuid()` |
| 2 | `operation_run_id` | `uuid` | No | ? |
| 3 | `action_type` | `text` | No | ? |
| 4 | `target_entity_type` | `text` | Yes | ? |
| 5 | `target_entity_id` | `uuid` | Yes | ? |
| 6 | `lifecycle_state` | `text` | No | `'proposed'::text` |
| 7 | `source_references` | `jsonb` | No | `'[]'::jsonb` |
| 8 | `requested_payload` | `jsonb` | No | `'{}'::jsonb` |
| 9 | `before_snapshot` | `jsonb` | Yes | ? |
| 10 | `applied_payload` | `jsonb` | Yes | ? |
| 11 | `after_snapshot` | `jsonb` | Yes | ? |
| 12 | `reason` | `text` | Yes | ? |
| 13 | `warnings` | `jsonb` | No | `'[]'::jsonb` |
| 14 | `failure` | `jsonb` | Yes | ? |
| 15 | `created_at` | `timestamp with time zone` | No | `now()` |
| 16 | `applied_at` | `timestamp with time zone` | Yes | ? |
| 17 | `updated_at` | `timestamp with time zone` | No | `now()` |

| Constraint | Kind | Exact deployed definition | Validated | Deferrable |
| --- | --- | --- | --- | --- |
| `atlas_operation_actions_action_type_check` | check | `CHECK (NULLIF(btrim(action_type), ''::text) IS NOT NULL)` | Yes | No |
| `atlas_operation_actions_lifecycle_state_check` | check | `CHECK (lifecycle_state = ANY (ARRAY['proposed'::text, 'applied'::text, 'skipped'::text, 'blocked'::text, 'failed'::text]))` | Yes | No |
| `atlas_operation_actions_operation_run_id_fkey` | foreign key | `FOREIGN KEY (operation_run_id) REFERENCES atlas_operation_runs(id) ON DELETE CASCADE` | Yes | No |
| `atlas_operation_actions_pkey` | primary key | `PRIMARY KEY (id)` | Yes | No |
| `atlas_operation_actions_source_references_array_check` | check | `CHECK (jsonb_typeof(source_references) = 'array'::text)` | Yes | No |
| `atlas_operation_actions_warnings_array_check` | check | `CHECK (jsonb_typeof(warnings) = 'array'::text)` | Yes | No |

Indexes:

- `atlas_operation_actions_pkey`: `CREATE UNIQUE INDEX atlas_operation_actions_pkey ON public.atlas_operation_actions USING btree (id)`
- `atlas_operation_actions_run_idx`: `CREATE INDEX atlas_operation_actions_run_idx ON public.atlas_operation_actions USING btree (operation_run_id, created_at)`
- `atlas_operation_actions_state_idx`: `CREATE INDEX atlas_operation_actions_state_idx ON public.atlas_operation_actions USING btree (lifecycle_state, created_at DESC)`
- `atlas_operation_actions_target_idx`: `CREATE INDEX atlas_operation_actions_target_idx ON public.atlas_operation_actions USING btree (target_entity_type, target_entity_id) WHERE (target_entity_id IS NOT NULL)` Predicate: `(target_entity_id IS NOT NULL)`.

Triggers:

- `set_atlas_operation_actions_updated_at`: `CREATE TRIGGER set_atlas_operation_actions_updated_at BEFORE UPDATE ON atlas_operation_actions FOR EACH ROW EXECUTE FUNCTION set_atlas_control_plane_updated_at()`

### `public.atlas_operation_runs`

RLS enabled: **yes**. Forced RLS: **no**. Policies: **0**. Effective privileges are absent for `anon` and `authenticated`; `service_role` has the preserved table privilege set.

| # | Column | Deployed type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | No | `gen_random_uuid()` |
| 2 | `operation_type` | `text` | No | ? |
| 3 | `actor_type` | `text` | No | ? |
| 4 | `actor_identity` | `text` | No | ? |
| 5 | `status` | `text` | No | `'planned'::text` |
| 6 | `idempotency_key` | `text` | No | ? |
| 7 | `request` | `jsonb` | No | `'{}'::jsonb` |
| 8 | `summary` | `jsonb` | No | `'{}'::jsonb` |
| 9 | `error` | `jsonb` | Yes | ? |
| 10 | `created_at` | `timestamp with time zone` | No | `now()` |
| 11 | `started_at` | `timestamp with time zone` | Yes | ? |
| 12 | `completed_at` | `timestamp with time zone` | Yes | ? |
| 13 | `updated_at` | `timestamp with time zone` | No | `now()` |

| Constraint | Kind | Exact deployed definition | Validated | Deferrable |
| --- | --- | --- | --- | --- |
| `atlas_operation_runs_actor_identity_check` | check | `CHECK (NULLIF(btrim(actor_identity), ''::text) IS NOT NULL)` | Yes | No |
| `atlas_operation_runs_actor_type_check` | check | `CHECK (actor_type = ANY (ARRAY['human'::text, 'automation'::text, 'system'::text]))` | Yes | No |
| `atlas_operation_runs_idempotency_key_check` | check | `CHECK (NULLIF(btrim(idempotency_key), ''::text) IS NOT NULL)` | Yes | No |
| `atlas_operation_runs_operation_type_check` | check | `CHECK (NULLIF(btrim(operation_type), ''::text) IS NOT NULL)` | Yes | No |
| `atlas_operation_runs_pkey` | primary key | `PRIMARY KEY (id)` | Yes | No |
| `atlas_operation_runs_started_completed_check` | check | `CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)` | Yes | No |
| `atlas_operation_runs_status_check` | check | `CHECK (status = ANY (ARRAY['planned'::text, 'running'::text, 'succeeded'::text, 'partial'::text, 'failed'::text, 'cancelled'::text]))` | Yes | No |

Indexes:

- `atlas_operation_runs_operation_idempotency_uidx`: `CREATE UNIQUE INDEX atlas_operation_runs_operation_idempotency_uidx ON public.atlas_operation_runs USING btree (operation_type, idempotency_key)`
- `atlas_operation_runs_pkey`: `CREATE UNIQUE INDEX atlas_operation_runs_pkey ON public.atlas_operation_runs USING btree (id)`
- `atlas_operation_runs_status_created_idx`: `CREATE INDEX atlas_operation_runs_status_created_idx ON public.atlas_operation_runs USING btree (status, created_at DESC)`

Triggers:

- `set_atlas_operation_runs_updated_at`: `CREATE TRIGGER set_atlas_operation_runs_updated_at BEFORE UPDATE ON atlas_operation_runs FOR EACH ROW EXECUTE FUNCTION set_atlas_control_plane_updated_at()`

### `public.discovery_runs`

RLS enabled: **yes**. Forced RLS: **no**. Policies: **0**. Effective privileges are absent for `anon` and `authenticated`; `service_role` has the preserved table privilege set.

| # | Column | Deployed type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | No | `gen_random_uuid()` |
| 2 | `run_type` | `text` | No | ? |
| 3 | `source_id` | `uuid` | Yes | ? |
| 4 | `status` | `text` | No | `'pending'::text` |
| 5 | `started_at` | `timestamp with time zone` | Yes | ? |
| 6 | `completed_at` | `timestamp with time zone` | Yes | ? |
| 7 | `items_found` | `integer` | No | `0` |
| 8 | `candidates_created` | `integer` | No | `0` |
| 9 | `duplicates_flagged` | `integer` | No | `0` |
| 10 | `estimated_cost` | `numeric(12,2)` | Yes | ? |
| 11 | `actual_cost` | `numeric(12,2)` | Yes | ? |
| 12 | `approval_required` | `boolean` | No | `false` |
| 13 | `approval_status` | `text` | No | `'not_required'::text` |
| 14 | `error_message` | `text` | Yes | ? |
| 15 | `notes` | `text` | Yes | ? |
| 16 | `run_metadata` | `jsonb` | No | `'{}'::jsonb` |
| 17 | `created_at` | `timestamp with time zone` | No | `now()` |

| Constraint | Kind | Exact deployed definition | Validated | Deferrable |
| --- | --- | --- | --- | --- |
| `discovery_runs_pkey` | primary key | `PRIMARY KEY (id)` | Yes | No |
| `discovery_runs_source_id_fkey` | foreign key | `FOREIGN KEY (source_id) REFERENCES discovery_sources(id) ON DELETE SET NULL` | Yes | No |

Indexes:

- `discovery_runs_pkey`: `CREATE UNIQUE INDEX discovery_runs_pkey ON public.discovery_runs USING btree (id)`

Triggers:

- None.

### `public.discovery_sources`

RLS enabled: **yes**. Forced RLS: **no**. Policies: **0**. Effective privileges are absent for `anon` and `authenticated`; `service_role` has the preserved table privilege set.

| # | Column | Deployed type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | No | `gen_random_uuid()` |
| 2 | `name` | `text` | No | ? |
| 3 | `source_url` | `text` | No | ? |
| 4 | `source_type` | `text` | No | ? |
| 5 | `region` | `text` | Yes | ? |
| 6 | `city` | `text` | Yes | ? |
| 7 | `county` | `text` | Yes | ? |
| 8 | `state` | `text` | No | `'Michigan'::text` |
| 9 | `priority` | `text` | No | `'medium'::text` |
| 10 | `trust_score` | `numeric(3,2)` | No | `0.50` |
| 11 | `is_active` | `boolean` | No | `true` |
| 12 | `notes` | `text` | Yes | ? |
| 13 | `last_checked_at` | `timestamp with time zone` | Yes | ? |
| 14 | `created_at` | `timestamp with time zone` | No | `now()` |
| 15 | `updated_at` | `timestamp with time zone` | No | `now()` |

| Constraint | Kind | Exact deployed definition | Validated | Deferrable |
| --- | --- | --- | --- | --- |
| `discovery_sources_pkey` | primary key | `PRIMARY KEY (id)` | Yes | No |
| `discovery_sources_source_url_key` | unique | `UNIQUE (source_url)` | Yes | No |
| `discovery_sources_trust_score_check` | check | `CHECK (trust_score >= 0::numeric AND trust_score <= 1::numeric)` | Yes | No |

Indexes:

- `discovery_sources_pkey`: `CREATE UNIQUE INDEX discovery_sources_pkey ON public.discovery_sources USING btree (id)`
- `discovery_sources_source_url_key`: `CREATE UNIQUE INDEX discovery_sources_source_url_key ON public.discovery_sources USING btree (source_url)`

Triggers:

- None.

### `public.event_candidate_sources`

RLS enabled: **yes**. Forced RLS: **no**. Policies: **0**. Effective privileges are absent for `anon` and `authenticated`; `service_role` has the preserved table privilege set.

| # | Column | Deployed type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | No | `gen_random_uuid()` |
| 2 | `candidate_id` | `uuid` | No | ? |
| 3 | `source_name` | `text` | Yes | ? |
| 4 | `source_url` | `text` | No | ? |
| 5 | `source_type` | `text` | Yes | ? |
| 6 | `source_excerpt` | `text` | Yes | ? |
| 7 | `trust_score` | `numeric(3,2)` | Yes | ? |
| 8 | `last_accessed` | `timestamp with time zone` | Yes | ? |
| 9 | `created_at` | `timestamp with time zone` | No | `now()` |

| Constraint | Kind | Exact deployed definition | Validated | Deferrable |
| --- | --- | --- | --- | --- |
| `event_candidate_sources_candidate_id_fkey` | foreign key | `FOREIGN KEY (candidate_id) REFERENCES event_candidates(id) ON DELETE CASCADE` | Yes | No |
| `event_candidate_sources_pkey` | primary key | `PRIMARY KEY (id)` | Yes | No |
| `event_candidate_sources_trust_score_check` | check | `CHECK (trust_score >= 0::numeric AND trust_score <= 1::numeric)` | Yes | No |

Indexes:

- `event_candidate_sources_pkey`: `CREATE UNIQUE INDEX event_candidate_sources_pkey ON public.event_candidate_sources USING btree (id)`

Triggers:

- None.

### `public.event_candidates`

RLS enabled: **yes**. Forced RLS: **no**. Policies: **0**. Effective privileges are absent for `anon` and `authenticated`; `service_role` has the preserved table privilege set.

| # | Column | Deployed type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | No | `gen_random_uuid()` |
| 2 | `discovery_run_id` | `uuid` | No | ? |
| 3 | `candidate_name` | `text` | No | ? |
| 4 | `normalized_name` | `text` | Yes | ? |
| 5 | `slug_candidate` | `text` | Yes | ? |
| 6 | `event_type` | `text` | No | `'unknown'::text` |
| 7 | `category` | `text` | Yes | ? |
| 8 | `subcategory` | `text` | Yes | ? |
| 9 | `city` | `text` | Yes | ? |
| 10 | `county` | `text` | Yes | ? |
| 11 | `state` | `text` | No | `'Michigan'::text` |
| 12 | `country` | `text` | No | `'USA'::text` |
| 13 | `venue_name` | `text` | Yes | ? |
| 14 | `start_date` | `date` | Yes | ? |
| 15 | `end_date` | `date` | Yes | ? |
| 16 | `typical_month` | `text` | Yes | ? |
| 17 | `typical_season` | `text` | Yes | ? |
| 18 | `probable_recurrence` | `text` | Yes | ? |
| 19 | `description` | `text` | Yes | ? |
| 20 | `official_website_candidate` | `text` | Yes | ? |
| 21 | `social_links` | `jsonb` | No | `'[]'::jsonb` |
| 22 | `source_urls` | `jsonb` | No | `'[]'::jsonb` |
| 23 | `discovery_confidence` | `numeric(3,2)` | No | `0.50` |
| 24 | `verification_status` | `text` | No | `'needs_review'::text` |
| 25 | `duplicate_status` | `text` | No | `'unique_candidate'::text` |
| 26 | `matched_event_id` | `uuid` | Yes | ? |
| 27 | `needs_review` | `boolean` | No | `true` |
| 28 | `semantic_notes` | `text` | Yes | ? |
| 29 | `raw_payload` | `jsonb` | No | `'{}'::jsonb` |
| 30 | `created_at` | `timestamp with time zone` | No | `now()` |
| 31 | `updated_at` | `timestamp with time zone` | No | `now()` |

| Constraint | Kind | Exact deployed definition | Validated | Deferrable |
| --- | --- | --- | --- | --- |
| `event_candidates_discovery_confidence_check` | check | `CHECK (discovery_confidence >= 0::numeric AND discovery_confidence <= 1::numeric)` | Yes | No |
| `event_candidates_discovery_run_id_fkey` | foreign key | `FOREIGN KEY (discovery_run_id) REFERENCES discovery_runs(id) ON DELETE CASCADE` | Yes | No |
| `event_candidates_matched_event_id_fkey` | foreign key | `FOREIGN KEY (matched_event_id) REFERENCES events(id) ON DELETE SET NULL` | Yes | No |
| `event_candidates_pkey` | primary key | `PRIMARY KEY (id)` | Yes | No |

Indexes:

- `event_candidates_pkey`: `CREATE UNIQUE INDEX event_candidates_pkey ON public.event_candidates USING btree (id)`
- `idx_event_candidates_run`: `CREATE INDEX idx_event_candidates_run ON public.event_candidates USING btree (discovery_run_id)`

Triggers:

- None.

### `public.events`

RLS enabled: **yes**. Forced RLS: **no**. Policies: **0**. Effective privileges are absent for `anon` and `authenticated`; `service_role` has the preserved table privilege set.

| # | Column | Deployed type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | No | `gen_random_uuid()` |
| 2 | `name` | `text` | No | ? |
| 3 | `slug` | `text` | No | ? |
| 4 | `event_type` | `text` | No | ? |
| 5 | `category` | `text` | Yes | ? |
| 6 | `subcategory` | `text` | Yes | ? |
| 7 | `city` | `text` | Yes | ? |
| 8 | `county` | `text` | Yes | ? |
| 9 | `state` | `text` | No | `'Michigan'::text` |
| 10 | `country` | `text` | No | `'USA'::text` |
| 11 | `venue_name` | `text` | Yes | ? |
| 12 | `official_website` | `text` | Yes | ? |
| 13 | `facebook_url` | `text` | Yes | ? |
| 14 | `instagram_url` | `text` | Yes | ? |
| 15 | `typical_month` | `text` | Yes | ? |
| 16 | `typical_season` | `text` | Yes | ? |
| 17 | `recurrence_pattern` | `text` | Yes | ? |
| 18 | `short_description` | `text` | Yes | ? |
| 19 | `long_description` | `text` | Yes | ? |
| 20 | `status` | `text` | No | `'active'::text` |
| 21 | `verification_status` | `text` | No | `'verified'::text` |
| 22 | `confidence_score` | `numeric(3,2)` | Yes | ? |
| 23 | `first_discovered_at` | `timestamp with time zone` | Yes | ? |
| 24 | `last_verified_at` | `timestamp with time zone` | Yes | ? |
| 25 | `created_at` | `timestamp with time zone` | No | `now()` |
| 26 | `updated_at` | `timestamp with time zone` | No | `now()` |
| 27 | `latitude` | `double precision` | Yes | ? |
| 28 | `longitude` | `double precision` | Yes | ? |
| 29 | `location_confidence` | `numeric(3,2)` | Yes | ? |
| 30 | `location_source` | `text` | Yes | ? |
| 31 | `geocoded_at` | `timestamp with time zone` | Yes | ? |
| 32 | `location_verified` | `boolean` | No | `false` |

| Constraint | Kind | Exact deployed definition | Validated | Deferrable |
| --- | --- | --- | --- | --- |
| `events_confidence_score_check` | check | `CHECK (confidence_score >= 0::numeric AND confidence_score <= 1::numeric)` | Yes | No |
| `events_latitude_range_check` | check | `CHECK (latitude IS NULL OR latitude >= '-90'::integer::double precision AND latitude <= 90::double precision)` | Yes | No |
| `events_location_confidence_range_check` | check | `CHECK (location_confidence IS NULL OR location_confidence >= 0::numeric AND location_confidence <= 1::numeric)` | Yes | No |
| `events_longitude_range_check` | check | `CHECK (longitude IS NULL OR longitude >= '-180'::integer::double precision AND longitude <= 180::double precision)` | Yes | No |
| `events_pkey` | primary key | `PRIMARY KEY (id)` | Yes | No |
| `events_slug_key` | unique | `UNIQUE (slug)` | Yes | No |

Indexes:

- `events_pkey`: `CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id)`
- `events_slug_key`: `CREATE UNIQUE INDEX events_slug_key ON public.events USING btree (slug)`
- `idx_events_map_coordinates`: `CREATE INDEX idx_events_map_coordinates ON public.events USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL))` Predicate: `((latitude IS NOT NULL) AND (longitude IS NOT NULL))`.

Triggers:

- None.

## RPCs and supporting functions

- `atlas_assert_service_role()` ? `void`; STABLE; SECURITY DEFINER; search path is empty; effective EXECUTE: service_role.
- `atlas_intake_event_candidate(text,text,text,jsonb,jsonb)` ? `jsonb`; VOLATILE; SECURITY DEFINER; search path is empty; effective EXECUTE: service_role.
- `atlas_require_source_evidence(jsonb)` ? `void`; IMMUTABLE; security invoker; search path is empty; effective EXECUTE: service_role.
- `atlas_start_operation(text,text,text,text,jsonb)` ? `atlas_operation_runs`; VOLATILE; SECURITY DEFINER; search path is empty; effective EXECUTE: service_role.
- `set_atlas_control_plane_updated_at()` ? `trigger`; VOLATILE; security invoker; search path is empty; effective EXECUTE: service_role.

Direct dependency chain for intake: `atlas_intake_event_candidate` calls `atlas_assert_service_role`, `atlas_require_source_evidence`, and `atlas_start_operation`; `atlas_start_operation` returns the `atlas_operation_runs` composite type. The trigger function `set_atlas_control_plane_updated_at` is required by the two operation-ledger update triggers but is not exposed by generated PostgREST types. No required public enum exists; all constrained lifecycle values are text checks.

The deployed `atlas_intake_event_candidate(text,text,text,jsonb,jsonb) returns jsonb` and `atlas_assert_service_role() returns void` function bodies match tracked migrations 010 and 009 respectively after normalizing formatting and dollar-quote tags. The deployed ACL for all five functions is PostgreSQL owner plus `service_role`; `anon` and `authenticated` have no effective EXECUTE.

## Tracked versus deployed findings

| Area | Tracked repository | Deployed truth | Finding |
| --- | --- | --- | --- |
| Foundational control plane | Migration 004 is absent; later files only reference it | Tables, checks, indexes, helper functions, triggers, RLS, and grants are present | The machine snapshot closes the reviewability gap but is not a replacement migration. Exact historical creation order and original 004 text remain unknown. |
| Service-role assertion | Migration 009 | Exact deployed body match | No difference. |
| Candidate intake RPC | Migration 010 | Exact deployed body match and service-role-only ACL | No function-body difference. |
| Later Event Factory migrations | Migrations 011, 014, and 017 reference candidates/events; migrations 015?016 harden public access | Target columns are not altered; all target tables have RLS enabled, no policies, no browser-role access, and preserved service-role access | Deployed access posture matches the later hardening contract. |
| County parser assumptions | Phase B expects the six primary table column sets and stable seed provenance | Every expected column exists with the retrieved type | Column assumptions match. The parser intentionally carries more provenance than relational candidate columns. |
| Database types | No generated database types were tracked at the Phase B baseline | Full public types generated successfully: 4,958 lines, SHA-256 `4b3d1db2cd33c4169f50c7b285ed51bed4f92e7c6769db2b98599824dbb1408e` | The narrow relevant excerpt is now present as a repository file; this does not claim to be a full-application generated type file. |

## County parser and `candidateIntake.ts` mapping

| Concern | Phase B seed | Current generic mapper | Contract decision for proposed Batch 1 |
| --- | --- | --- | --- |
| Name normalization | NFKD, punctuation/diacritic removal, whitespace normalization | Lowercase only | Use the Phase B `normalizedName`; do not run the generic lowercasing mapper over it. |
| Slug | Stable name + municipality + MI candidate | Same shape only when no explicit event key is supplied | Use the exact Phase B `proposedSlugCandidate`. |
| State | Canonical `Michigan` | Accepts MI/Michigan, emits Michigan | Emit `Michigan`. |
| Dates | Exact range, year-only, unresolved, or other | Accepts optional exact dates | Only MAC-004 and MAC-041 send dates; year-only records send null dates. |
| Category, venue, month/season | Preserved | Generic mapper omits them | Map exact seed values; do not infer event type or subcategory. |
| Recurrence | Retained annual evidence | Optional recurrence pattern | Emit `annual` only for these seven because every selected seed contains explicit annual evidence. |
| Description | No approved Event Hub prose | Generic mapper copies a source excerpt | Send null; no prose is generated in this phase. |
| Confidence | Spreadsheet value remains intake metadata, not approval | Defaults candidate confidence to 0.8 and source trust to 0.9 | Use those existing adapter defaults without converting spreadsheet ?High? into a numeric publication judgment. |
| Provenance | Clean ID, workbook/sheet hashes, row, aliases, sources, address, cleanup decision | Generic mapper drops them | Preserve them under extra `p_candidate.county_seed`; the RPC stores the full candidate JSON in `raw_payload`. |
| Sources | Official, organizer, and supporting URLs are distinct | Requires at least one source and marks the supplied source official | Send only the workbook's official-event source to `p_sources`; retain organizer/supporting URLs in raw provenance because the helper rejects non-official entries. |

The existing `toRpcPayload` function is therefore too lossy for these exact county payloads. A later approved staging task must use the reviewed argument objects in the plan artifact or add a narrowly tested county adapter; this phase changes neither component API nor intake code.

## Batch 0 ? exact match-reconciliation plan

**Decision: create no candidate rows and call no RPC.** Both source candidates already have `verification_status=promoted`, `duplicate_status=unique_candidate`, and the correct `matched_event_id`.

| Seed | Existing candidate | Canonical event | Action |
| --- | --- | --- | --- |
| MAC-001 Armada Fair | `f6c3fb7b-0d31-4c97-b335-3cffc3cd202d` | `46d7e6ff-bec5-4801-80da-2d21aa131092` / `armada-fair` | Retain crosswalk only. |
| MAC-050 Romeo Peach Festival | `f8e47b34-0187-45c3-99b9-b919ee4faf62` | `79fab78b-0a08-4439-8cc0-470281d69fb6` / `romeo-peach-festival` | Retain crosswalk only. |

The repository plan and Phase B dry-run artifact are the crosswalk record for review. There is no deployed county-seed crosswalk table. Do not overload `event_candidates`, change `matched_event_id`, or create operation-ledger entries merely to duplicate an already completed match. A database crosswalk would require a separately approved schema design.

## Batch 1 ? exact proposed staging payloads

All seven complete argument objects are in `county-seed-batch-write-plan.json`. `p_actor_identity` is deliberately a runtime placeholder that must be bound to the authenticated, allowlisted Atlas administrator. It is not an event fact and must not be guessed.

| Seed | Candidate slug | Proposed date fields | Stable idempotency key | Candidate/sources request SHA-256 |
| --- | --- | --- | --- | --- |
| MAC-003 | `blake-s-lavender-festival-armada-mi` | Unresolved; both date fields remain null | `county:macomb:MAC-003:72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27` | `ef074c24d1380aa483230bf3e55dd7c7cad30c7a1060e19c588da9660ee229d1` |
| MAC-004 | `blake-s-pickle-festival-armada-mi` | 2026-08-08 through 2026-08-16 | `county:macomb:MAC-004:72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27` | `80a961149946d49cb34599dbf88a467e0b0d6b68845d7e3ed174de3346cc2a21` |
| MAC-008 | `chesterfield-heritage-days-chesterfield-township-mi` | Unresolved; both date fields remain null | `county:macomb:MAC-008:72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27` | `feffc19f548ab383f4fee166f4c9207d133555119574f6bb4668c84a188e4ebf` |
| MAC-011 | `chesterfield-vietnam-era-reenactment-chesterfield-township-mi` | Unresolved; both date fields remain null | `county:macomb:MAC-011:72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27` | `a57a430cdbab97c0bbe55b56dacc739fbb1580249dfb7b0f3cb288697805eeb9` |
| MAC-041 | `art-on-the-bay-new-baltimore-mi` | 2026-09-05 through 2026-09-06 | `county:macomb:MAC-041:72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27` | `63e5fd6ddd3422e2242023856f201a94821b46c2855552a0496f0d750efa81fd` |
| MAC-042 | `bay-rama-fishfly-festival-new-baltimore-mi` | Unresolved; both date fields remain null | `county:macomb:MAC-042:72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27` | `5105f4442576ac76c65e6828680ef30047bb558c27d01a4947fba552a4c487c5` |
| MAC-049 | `richmond-good-old-days-festival-richmond-mi` | Unresolved; both date fields remain null | `county:macomb:MAC-049:72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27` | `97e0aba151e5993e899c14bbafb2e503fcf1d101ebba192693181896f58afc1a` |

Read-only preflight found zero existing candidate-slug collisions, zero operation idempotency-key collisions, zero canonical name/official-URL collisions, and zero candidate name/official-URL collisions for these seven payloads. Every planned value fits the retrieved nullability and numeric checks. This is a point-in-time finding, not an execution reservation.

### Can Batch 1 safely call the current RPC?

**Schema compatibility: yes. Execution approval: not yet.** The exact seven payloads fit the deployed function signature and constraints, and no current identity/key collision was found. However, the current RPC and tables have four material staging risks that must be explicitly accepted or corrected in a later approved write phase:

1. `event_candidates.slug_candidate` has no unique constraint. The RPC's select-then-insert duplicate check is race-prone.
2. `event_candidate_sources` has no unique `(candidate_id, source_url)` constraint. Its `where not exists` insert is also race-prone.
3. Idempotency is unique on `(operation_type, idempotency_key)`, but `atlas_start_operation` does not compare the incoming request with the stored request and updates `request` even for a succeeded replay. The tracked request SHA-256 must be checked by the caller; a changed payload must never reuse a key.
4. The RPC exception handler re-raises. PostgreSQL rolls back the call, including its attempted failed-run update, so failed calls do not leave the intended persistent failure audit row.

The seven-event pilot must remain unexecuted until the next approved task chooses a guarded sequential execution policy or approves an exact schema/RPC correction. No replacement migration is proposed here.

## Transaction, retry, rollback, audit, and approval contract

### Transaction boundaries

- Batch 0 has no database transaction because it performs no write.
- One future `atlas_intake_event_candidate` call is one PostgreSQL transaction covering the operation run/action, discovery run, candidate insert-or-update, source insert, and successful audit updates.
- The seven calls are seven independent transactions. There is no deployed all-or-nothing county-batch RPC. A failure on record N cannot roll back already committed records 1 through N?1.

### Idempotency and retries

- Use exactly the workbook-fingerprinted keys in the plan artifact and exactly the associated request SHA-256.
- Before any future call, repeat the identity, slug, and operation-key preflight.
- After a network timeout, read `atlas_operation_runs` by `operation_type='candidate_intake'` and the exact key. If it succeeded, accept the stored summary; do not create a new key. If state is absent, running, failed, cancelled, or payload hash cannot be proven equal, stop for human review.
- Retry only the identical payload with the identical key. A changed workbook or payload requires a new reviewed version/key. Do not blind-retry constraint, cast, evidence, or identity failures.

### Rollback

- Any error before commit rolls back the complete individual RPC transaction.
- There is no deployed undo RPC for a successful candidate intake. Never delete or directly rewrite a committed candidate as an ad hoc rollback. A post-commit correction requires a separately reviewed compensating action that preserves the original audit trail.

### Audit records

A successful new-candidate call should create one `atlas_operation_runs` row, one applied `atlas_operation_actions` row, one completed `discovery_runs` row, one `event_candidates` row with the exact raw county provenance, and one official `event_candidate_sources` row. A succeeded idempotent replay returns the stored summary with `idempotent_replay=true` and should add no candidate. Failed-call persistence is the unresolved behavior described above.

### Duplicate protection

Use the Phase B deterministic crosswalk plus a fresh read-only check of Clean ID/provenance, normalized official URL, normalized name + municipality, alternate name + location, slug, existing candidate identity, and operation key. Shared organizer, venue, or listing URL never establishes identity. Execute sequentially with one operator if later approved; current database constraints do not provide complete concurrency protection.

### Human approval checkpoints

1. Approve the Batch 0 crosswalk-only decision.
2. Approve each Batch 1 identity, official URL, slug, exact date/null-date choice, provenance block, idempotency key, and request hash.
3. Explicitly accept or correct the four staging risks above.
4. Bind `p_actor_identity` to the authenticated allowlisted administrator at execution time.
5. After each future call, review the returned candidate/run/action identifiers and re-read the candidate/source/audit records before proceeding.
6. Candidate intake remains research-only. Verification cases, canonical events, Event Hubs, publication, and clustering require their own later approvals.

## Unknowns and limits

- The original migration 004 file and exact historical deployment sequence remain unavailable. The retrieved deployed definitions are current truth, not proof of the missing file's original text.
- The narrow generated type file intentionally excludes unrelated public objects; it does not close the repository's broader full-database type gap.
- Live preflight results can change after this snapshot.
- No current-edition facts or coordinates were verified in C0. All 83 county seeds retain those Phase B requirements.

## Zero-write attestation

C0 executed metadata reads in a read-only PostgreSQL transaction, PostgREST GET reads, local artifact generation, and official read-only type generation only. It issued no Supabase insert, update, delete, DDL, migration, storage mutation, or mutating RPC. Batch 0 and Batch 1 remain unexecuted.

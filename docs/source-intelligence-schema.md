# Source intelligence schema

Migration `supabase/migrations/006_event_source_intelligence.sql` adds the persistent evidence layer between official websites, candidate intake, and Event Hub publication. Apply it after migrations 004 and 005.

The design intentionally does not add scraped fields directly to the canonical `events` table. Source material can be incomplete, contradictory, stale, or misidentified; it remains evidence until reviewed.

## Records

### `event_source_bundles`

A bundle groups all official pages and claims being assembled for one event investigation. It may exist before a canonical event or candidate exists, then attach to either later.

Lifecycle states:

- `collecting`
- `ready_for_synthesis`
- `synthesis_in_progress`
- `draft_ready`
- `archived`

### `event_source_snapshots`

Each row is an immutable capture of one inspected page. It stores URLs, source type, fetch time, content hash, sanitized inspection JSON, parser metadata, bounded response metadata such as ETag and Last-Modified, and a pointer to the private raw-source archive.

The same content hash is idempotent within a bundle. Repeated collection cannot create duplicate snapshots.

### `event_source_claims`

Claims decompose a snapshot into queryable field assertions such as:

- `identity.name`
- `timing.startDate`
- `location.city`
- `location.venue`
- `sources.officialUrl`

Every claim retains its original JSON value, normalized text, extraction method, confidence level and score, source locator, and review state. Conflicting values can coexist until one is accepted and the others are rejected or superseded.

### `event_source_links`

Links discovered on official pages are recorded once per bundle with a kind and crawl state. Capturing a linked page connects it to its snapshot and moves the link from `discovered` to `inspected`.

### `event_schedule_candidates`

Schedule observations remain separate from general claims because they need date, venue, tag, deduplication, and review behavior at much greater volume. The table accepts deterministic or later AI-assisted schedule candidates without placing them into a published Event Hub schedule.

### `event_source_bundle_actions`

This append-only ledger records bundle creation, source capture, synthesis readiness, synthesis generation and acceptance, reopening, archival, and links to candidate or Event Hub records.

### Synthesis proposal records

Migration `supabase/migrations/007_event_source_synthesis.sql` adds immutable `event_source_syntheses` proposals and the append-only `event_source_synthesis_actions` review ledger. Reconciled profiles, conflicts, missing fields, manifest validation, quality scores, and review decisions remain separate from publication records. See `docs/event-source-synthesis.md`.

## Private source archive

Migration 006 creates the private `event-source-archive` Supabase Storage bucket. When an administrator saves an inspection, the backend re-fetches the public page, gzip-compresses its HTML, and uploads it under:

```text
bundles/<bundle-id>/<sha256>.html.gz
```

The bucket has no public read policy. Raw HTML never enters a browser response or the public Event Hub. It is retained privately so extraction can be reproduced with future parsers while the database stores bounded, sanitized, queryable data.

## Mutation boundary

The service role has direct read access for Atlas Control views. All database mutations use fixed `security definer` RPCs with an empty search path:

- `atlas_create_event_source_bundle`
- `atlas_add_event_source_snapshot`
- `atlas_reprocess_event_source_schedule`
- `atlas_transition_event_source_bundle`
- `atlas_attach_event_source_bundle_candidate`
- `atlas_list_event_source_bundles`

Direct access is revoked from `anon`, `authenticated`, and `service_role` before the minimum read and execute permissions are granted. Every HTTP route independently requires Atlas administrator authorization.

When a newer deterministic parser can recover schedule rows from an already
retained immutable snapshot, `atlas_reprocess_event_source_schedule` binds the
derived rows to the exact snapshot SHA-256. It requires the bundle to be
reopened, inserts only new deduplicated private schedule candidates, and
appends a `schedule_reprocessed` audit action. It cannot alter source evidence,
canonical events, packages, pages, media, or publication state.

## Collection workflow

1. Inspect an official homepage in Atlas Control.
2. Associate the source with an existing Event Hub scaffold when one is available.
3. Start a source bundle. A bounded collector privately archives the homepage and up to five prioritized same-site official pages while recording claims and useful links.
4. Manually inspect and append only official pages that were not collected or need a retry.
5. Load the reviewed identity into candidate intake; the resulting candidate is attached to the bundle.
6. Mark the bundle `ready_for_synthesis` when collection is sufficient.
7. Generate a deterministic, versioned synthesis proposal from the ready bundle.
8. Review conflicts, missing fields, and manifest validation; reopen collection when evidence needs correction.
9. Submit and accept only a valid proposal. Acceptance does not create or publish an Event Hub version.

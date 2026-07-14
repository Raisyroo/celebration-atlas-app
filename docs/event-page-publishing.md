# Event Hub page publishing

Event Hub pages are authored as typed manifests and published through immutable Supabase versions. The public route accepts only a valid version in `published` state. A checked-in local manifest remains the fallback whenever Supabase is unavailable, migration 005 has not been applied, no version has been published, or a returned manifest fails runtime validation.

## Apply the database foundation

Apply migrations in order through the existing Supabase migration workflow:

1. Migration 004: Atlas Control Plane.
2. `supabase/migrations/005_event_page_publishing.sql`.

Migration 005 creates:

- `event_pages`: stable event identity and the atomic current-publication pointer.
- `event_page_versions`: immutable manifest snapshots and review metadata.
- `event_page_version_transitions`: append-only lifecycle audit records.
- Fixed RPCs for draft creation, review transitions, publication, and published-page reads.

All three tables have RLS enabled. Direct `anon` and `authenticated` access is revoked. The backend service role has direct read access for readiness and review views, while lifecycle mutations are available only through fixed RPCs. Every administrative HTTP route independently requires an authorized Atlas administrator.

## Validate and seed checked-in pages

Validate both checked-in manifests:

```powershell
npm run validate:event-pages
```

Preview the hashes and records that would be synchronized:

```powershell
npm run sync:event-pages
npm run sync:event-pages -- detroit-jazz
```

Create drafts after migration 005 is applied and backend Supabase variables are available:

```powershell
npm run sync:event-pages -- all --apply --summary "Initial Event Hub seed"
```

The sync command is idempotent by event and content hash. It never submits, approves, or publishes a version.

## Review and publish

Use `/atlas-control` as an authorized administrator:

1. Create or reuse a draft from a checked-in manifest.
2. Submit the draft for review.
3. Approve or reject it with optional review notes.
4. Publish an approved version.

Publication occurs in one database transaction. The prior published version is archived and the stable page pointer moves only when the approved replacement can be published successfully.

Lifecycle states are `draft`, `in_review`, `approved`, `published`, `rejected`, and `archived`. Rejected and archived records remain available for audit; corrections are created as a new draft.

## Source synthesis boundary

Migration 007 source synthesis proposals are deliberately outside this publication lifecycle. An accepted synthesis records a human-reviewed reconciliation of source evidence, but it does not create an Event Hub draft or move a public-page pointer. Promotion into `event_page_versions` must remain a separate explicit operation, after which every migration 005 review and publication gate still applies.

## Content contract

`data/eventPageManifestValidation.ts` validates the manifest before draft creation and again before rendering a database publication. It checks required renderer fields, enum values, unique record ids, module and filter references, source provenance references, dates, URLs, serialized size, and event sponsor language.

The public route also verifies that the manifest `eventId` and `slug` match the stable database page identity. A mismatch cannot replace the checked-in fallback.

# Approved-List Fast Track

## Purpose

Fast Track is the Codex-operated lane for a list of events Ray has already
approved for Celebration Atlas inclusion. It prepares each event through a
complete private Event Hub package as quickly as its own facts allow. It never
publishes.

List approval authorizes event inclusion work and private workflow records. It
does not approve a hero, approve a package, materialize a canonical event, add
an event to public discovery, or publish an Event Page. Every event stops at
its own private package preview for an explicit human decision.

## What Fast Track Removes

Fast Track does not repeat discovery qualification, wait for a county or list
cohort, require a second source when one organizer-controlled source proves
the necessary facts, or send a fact-complete event through a separate
verification queue. The existing verification case remains only because the
deployed Event Factory package contract uses it. Codex fills and clears that
record from the same retained official evidence pass.

These are still event-local blockers because removing them could produce the
wrong page or break publication:

- exact identity and slug collision clearance;
- retained official evidence for identity, annual recurrence, current-edition
  dates, and location;
- source-backed coordinates and visible factual disagreement handling;
- complete manifest grounding, schedule, sponsor, schema, and editorial
  validation;
- the existing Supabase visual review boundary for any attached hero; and
- explicit human package approval before publication.

A blocked event never holds another event in the approved list.

## Approved List Contract

The planner accepts JSON with this minimum shape:

```json
{
  "schemaVersion": "celebration-atlas-approved-event-list/v1",
  "listId": "ray-approved-august-2026",
  "approvedBy": "Ray",
  "approvedAt": "2026-08-02T16:00:00.000Z",
  "defaultState": "Michigan",
  "defaultTargetYear": 2026,
  "events": [
    {
      "name": "Event Name",
      "city": "City",
      "officialUrl": "https://official.example/event"
    }
  ]
}
```

`officialUrl` is preferred but may be omitted when Codex must resolve the
organizer-controlled source. `eventKey`, `sourceRecordId`, state, target year,
county, venue, additional source URLs, known visual constraints, retained UUID
references, notes, and metadata are optional when the list defaults or local
records supply them. A generated event key always includes name, city, and
state, then the identity preflight resolves any existing canonical identity.

The parser normalizes the list, computes immutable list and per-event hashes,
rejects duplicate identities, and always fixes the authorization boundary to:

```json
{
  "approvalScope": "inclusion_and_private_preparation_only",
  "publicationAuthorized": false
}
```

## Prepare The Handoffs

```text
npm run atlas:prepare-fast-track -- --input <approved-events.json>
```

The command is intentionally local and non-networked. It writes a normalized
approved list, one aggregate plan, and an isolated operator, Ultra, and hero
handoff for every event under:

```text
artifacts/fast-track/<list-id>/<list-hash>/
```

It has no Supabase mutation, approval, canonicalization, or publication path.
Codex uses the artifacts to operate the existing source, synthesis, visual,
and package services. The package is a thin final review envelope, not another
authoring stage.

## Per-Event Execution

1. Reuse an exact candidate or canonical event, or retain a unique candidate.
2. Start with the organizer-controlled home page, then retain the useful
   official subpages that reveal the event: schedule, visitor planning,
   history, traditions, competitions, stages, lineup, parade, or equivalent
   event-specific material. This is one focused official-site exploration,
   not another discovery qualification pass.
3. Reconcile facts and populate the existing verification record from that
   same evidence pass.
4. Give the complete protected dossier to `gpt-5.6-sol` at Ultra reasoning
   before a Factory layout becomes authoritative. Ultra owns the full
   visitor-facing manifest, not a small rewrite allowlist or a four-topic
   form. It chooses four to six useful topics, their order and labels, and any
   source-backed schedule presentation groups such as actual stages, venues,
   days, or competition classes.
   Identity, dates, location, schedule facts, source identities, approved art,
   and lifecycle state remain protected.
5. Run the existing immutable-fact, grounding, content, citation, sponsor,
   schedule, and semantic-quality validators. Permit one targeted Ultra repair
   only after a concrete validation failure.
6. At the hero-image stage, invoke
   `$create-celebration-atlas-hero` with GPT-5.6 Luna at Max reasoning. Generate
   one image. Create at most one focused alternative only after rejection or a
   low-confidence result, reusing the original motif brief.
7. Validate the 1024 x 1536 asset and use the existing Supabase visual workflow.
   A local image is never approval. Hero failure may leave this event art
   pending, but it does not hold content preparation or other events.
8. Freeze the existing Event Factory package and open its combined private
   review surface. The exact phone-width Event Hub and the event's hero appear
   in one session, but the page-content/layout decision and hero decision are
   recorded independently. An approved page may wait on a pending or rejected
   hero without losing its decision.
9. If a hero is approved after the page, rebuild only the private package's
   hero fields. Preserve the page decision when the normalized reviewed
   manifest is unchanged; automatically reset it when page content changes.
10. Stop. The combined review surface has no publication action. Publication
    remains a later, separate explicit human package action.

## Grouped Supplied Hero Upload

Ray may attach a batch of finished hero images directly to the Codex task. No
image-generation gateway is involved. Use either the full event key or the
event-name slug as each filename, for example:

```text
yale-bologna-festival.jpg
algonac-lions-pickerel-tournament-festival.png
blue-water-fest.webp
bayview-mackinac-race.jpg
st-clair-river-classic-offshore-powerboat-race.png
```

Codex first runs the batch attachment command without write authorization to
prove every filename has one unambiguous private visual workflow. After image
specification, full-frame, event identity, text/mark, mobile crop, and supplied
asset rights checks are complete, Codex repeats it with the explicit private
write flags. The command uploads each image to Supabase and moves only its
existing visual workflow back to `ready_for_review`; it does not approve the
hero, approve the page, attach art to a package, or publish.

```text
npm run atlas:attach-fast-track-heroes -- \
  --input <file-or-directory> \
  --actor <identity>
```

Atlas Control remains the fallback for individual self-service uploads or any
filename whose event mapping is ambiguous.

## Required Checks

The focused contract check is:

```text
npm run validate:fast-track-events
```

The required repository checkpoint remains:

```text
npm run build
```

Do not run the visual smoke suite unless Ray explicitly asks for it. When real
events reach private preview, inspect each actual route at phone width for
missing media, rendering errors, and horizontal overflow.

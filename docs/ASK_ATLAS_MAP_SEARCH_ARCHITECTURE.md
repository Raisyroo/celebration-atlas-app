# ASK Celebration Atlas Map Search Architecture

Last updated: August 9, 2026

## Product Contract

ASK Celebration Atlas is an invisible event-matching engine attached to the
map. It does not answer with prose. Its public result is one ordered set of
Celebration Atlas event IDs, and that exact set drives map markers, geographic
cluster counts, cards, and the Experience Deck.

The durable boundary is:

```text
Celebration Atlas candidate membership
        +
Atlas knowledge and identity-bound research knowledge
        +
the user's natural-language request
        ↓
ordered Celebration Atlas event IDs
        ↓
map clusters + event cards + existing Event Hubs
```

Candidate membership and matching evidence are separate decisions. An event
does not need a dedicated boolean, search category, or matching-field approval
to qualify for an ASK result. Confidence affects internal rank. It does not
create a second publication or verification maze.

ASK may eventually research beyond the Atlas to understand an existing Atlas
event. That does not authorize it to place a completely unknown web event on
the map.

## Implemented Search Boundary

`POST /api/atlas-search` returns schema version 2 from `data/atlasSearch.ts`:

```json
{
  "schemaVersion": 2,
  "query": "...",
  "normalizedQuery": "...",
  "stateSlug": "michigan",
  "source": "atlas-fast-path | atlas-model | atlas-fallback",
  "eventIds": ["..."],
  "resultCount": 1,
  "ranking": [{
    "eventId": "...",
    "score": 0.92,
    "matchCues": ["Waterfront", "Fireworks", "Jul 18"]
  }]
}
```

There is deliberately no explanation, interpreted-filter object, model prose,
or user-facing reasoning field. Match cues are compact Atlas facts selected by
validated evidence ID; they are not model-authored explanations.

The browser supplies only the query and state identity. The server resolves the
authoritative complete public state catalog from the checked-in compatibility
catalog reconciled with publication-gated database discovery. The browser
cannot narrow, expand, or substitute that candidate universe.

For richer matching, the server attaches the exact Event Factory package ID
and version already selected by public discovery. The package must still be
published and its manifest must validate against the same event ID and slug.
Drafts, approved-only packages, private previews, and write-test rows cannot
enter ASK knowledge through this path.

## Knowledge And Matching

The request follows three paths:

1. Exact identity and complete structured intents use the existing
   deterministic state resolver as the fast path.
2. Open-ended intents use the configured Vercel AI Gateway model. The model
   receives compact event knowledge documents and may return only supplied
   candidate IDs, scores, and evidence fact IDs belonging to that candidate.
3. If the model is unavailable, the generalized fallback searches recursively
   indexed textual and scalar event knowledge. It is not limited to a fixed
   category enum or field whitelist.

The knowledge document builder automatically reads nested event/profile values
and the matching published Event Hub manifest while omitting presentation
assets and technical identities. It pairs common factual label/value and
title/summary structures into stable facts. New useful knowledge can therefore
participate without adding another hardcoded filter.

The public route is rate bounded, query-length bounded, server-catalog bounded,
and non-cacheable. Foreign IDs are rejected again by the client before display.

## Diagnostics And Evaluation

Every valid ASK request emits one schema-versioned operational outcome made
only of broad, low-cardinality buckets: matcher source, query-token range,
candidate-count range, result-count range, grounded-cue coverage, latency
range, and state slug. The record contains no query text or query hash, event
identity, location, IP address, user agent, account, device, session, timestamp,
or persistent identifier. There is no application analytics table, cookie, or
client SDK for this checkpoint.

The response exposes a smaller safe summary in
`X-Atlas-Search-Diagnostic`. `Server-Timing` reports only the duration of the
caller's own request. Operators can aggregate structured hosting-log records by
their low-cardinality fields without reconstructing an individual's searches.

The permanent benchmark bank uses a synthetic, non-public candidate corpus so
published event changes cannot make evaluation flaky or turn fixture text into
a claim about a real celebration. It preserves the original smart-result
examples plus an additional price/music/access intersection. Ordinary builds
run deterministic grounding probes for result identity, order, evidence IDs,
and retained-fact cues. Benchmarks marked `model-required` remain explicit live
semantic evaluations and use a frozen reference date when that runner is
connected.

The complete operator and benchmark contract is in
`docs/ASK_ATLAS_SEARCH_DIAGNOSTICS_AND_BENCHMARKS.md`.

## Research Boundary

Live identity-bound outside research is not connected in this milestone. The
knowledge contract retains official source URLs as research hints, but the
model is explicitly told that their contents were not supplied. It may not
invent what those pages say.

The next research layer should:

- run only when Atlas knowledge is insufficient for the actual query;
- remain bound to existing Atlas event IDs;
- prefer official pages, schedules, PDFs, applications, and official social
  sources before reputable secondary reporting;
- retain source URL, captured claim, date, and confidence;
- cache reusable event knowledge rather than repeating research for every
  query;
- let confidence influence ordering without creating a new eligibility gate;
- return only the same structured result contract to the client.

## Geographic Cluster Contract

`data/atlasMapClustering.ts` owns cluster membership.

- It receives only the current visible event set. A cluster number can never
  count hidden nonmatches.
- Membership uses canonical latitude/longitude in zoom-dependent Web Mercator
  space.
- Spatial hashing keeps grouping near linear for ordinary distributions rather
  than comparing every event with every other event.
- Zoom is quantized into stable steps so clusters do not flicker during small
  gesture updates.
- At close scale, every group resolves to an individual event.
- Cluster identity is deterministic from member event IDs.

Cluster placement does not introduce another illustrated-map projection. The
UI averages the existing calibrated artwork positions of its members, so the
same presentation path still owns stars, individual markers, and cluster
anchors.

Tapping a cluster opens the finished shared Atlas Experience Deck with that
cluster's real, ranked events. Tapping an individual marker uses its existing
event interaction and Event Hub route.

## Visible Experience

- ASK remains in its approved location.
- The submitted query remains in the input until the user presses the inline
  clear control.
- While the structured result is resolving, only the compass motion changes.
  No explanatory AI copy is added.
- Statewide event-name fields are no longer the production broad-query answer.
  Numbered clusters and coded individual markers carry the result.
- Mobile cards switch from live/upcoming events to the ordered ASK result set
  while a query is active and surface the strongest compact factual cues.
  Clearing restores the normal dated rail.
- Desktop discovery cards and cluster Experience Deck cards consume the same
  ordered ASK result set and its retained-fact cues.
- Pinch zoom and desktop wheel zoom split geographic clusters. Close scale
  resolves to individual markers.

## Scaling Follow-Up

The current model pass is intentionally capped at 220 candidates. Larger state
and national catalogs require indexed retrieval or embeddings to create a
high-recall candidate shortlist before model reasoning. The structured result
contract, cluster engine, and UI do not need to change when that retrieval
layer arrives.

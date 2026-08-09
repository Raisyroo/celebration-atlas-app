# ASK Atlas Search Diagnostics And Benchmarks

Last updated: August 9, 2026

## Purpose

ASK needs enough operational visibility to reveal zero-result spikes, matcher
fallbacks, missing factual cues, and slow searches without creating a search
history or a second user-identity system. It also needs a stable way to protect
the kinds of natural-language requests that motivated smart map search.

This checkpoint adds two independent contracts:

1. a privacy-safe, bucketed diagnostic outcome for each valid ASK request; and
2. a permanent synthetic benchmark bank for intent, evidence, result ordering,
   and compact factual cues.

Neither contract changes candidate eligibility, publication state, the ASK box
location, the map, or the existing Experience Deck.

## Diagnostic Contract

`data/atlasSearchDiagnostics.ts` creates schema-versioned outcome records. A
typical hosting-log line is:

```text
[atlas-search-diagnostic] {"schemaVersion":1,"kind":"atlas-search-outcome","stateSlug":"michigan","source":"atlas-model","queryTokenBucket":"4-7","candidateCountBucket":"51-220","resultCountBucket":"2-5","cueCoverage":"full","latencyBucket":"750-1999ms"}
```

The event contains only these low-cardinality dimensions:

- state slug;
- matcher source: fast path, model, or fallback;
- broad query-token, candidate-count, result-count, and latency buckets; and
- whether none, some, or all returned events have grounded match cues.

It deliberately contains no query text or hash, returned event name or ID,
coordinates, request URL, IP address, user agent, referrer, account, device,
session, timestamp, or persistent identifier. Hashing query text is not an
acceptable substitute because uncommon searches can be guessed.

The route also returns `X-Atlas-Search-Diagnostic` with a smaller bucketed
summary and the standard `Server-Timing` duration for the caller's own request.
Both response headers are diagnostic only and never affect map results.

Operators can filter deployment logs by `[atlas-search-diagnostic]` and group
the JSON dimensions to answer questions such as:

- Did the zero-result bucket increase?
- Is the model falling back more frequently?
- Are grounded cues missing from returned results?
- Which latency range dominates?

There is no application database table, cookie, browser storage, or client
analytics SDK for this checkpoint. Provider infrastructure may still process
ordinary request metadata as disclosed on the public Privacy page; that data
is not copied into the ASK diagnostic event.

Run the focused privacy contract with:

```text
npm run validate:atlas-search-diagnostics
```

## Permanent Benchmark Bank

`data/atlasSearchBenchmarkBank.ts` owns a synthetic, publication-independent
candidate corpus and seven durable prompts:

- waterside events with fireworks;
- tattoo events;
- events with parades;
- oldest events;
- events where a participant can make money;
- family-friendly events this weekend; and
- free jazz reachable by public transit.

The records are intentionally fictional and clearly named as benchmark
fixtures. They cannot publish or enter public discovery. This keeps the suite
stable when real Michigan packages or dates change and prevents a product test
from asserting unreviewed facts about a real event.

Each benchmark has:

- the durable natural-language product query;
- its intent and evaluation mode;
- a deterministic grounding probe;
- expected ordered fixture event IDs; and
- expected retained-fact cue fragments.

`offline-grounding` means the request can be protected entirely by the local
knowledge matcher. `model-required` marks semantic work such as paraphrase,
superlative comparison, goal interpretation, or relative dates. The required
build does not call a model: it runs every grounding probe to protect knowledge
extraction, AND matching, evidence IDs, order, and cue derivation. A future
live-model evaluator can use the same fixtures and the frozen reference date
`2026-08-08T12:00:00-04:00` without redefining success.

Run the permanent build-safe suite with:

```text
npm run validate:atlas-search-benchmarks
```

Both focused validators are included in `npm run build`.

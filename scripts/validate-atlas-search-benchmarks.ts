import assert from 'node:assert/strict';
import {
  ATLAS_SEARCH_BENCHMARK_EVENTS,
  ATLAS_SEARCH_BENCHMARK_KNOWLEDGE,
  ATLAS_SEARCH_BENCHMARK_PROFILES,
  ATLAS_SEARCH_BENCHMARK_REFERENCE_DATE,
  ATLAS_SEARCH_BENCHMARKS,
} from '../data/atlasSearchBenchmarkBank.ts';
import {
  createAtlasSearchKnowledgeDocuments,
  deriveAtlasSearchMatchCues,
  searchAtlasKnowledgeDocuments,
} from '../data/atlasSearchKnowledge.ts';
import { normalizeHomeAtlasSearchValue } from '../data/homeAtlasSearch.ts';

assert(
  !Number.isNaN(Date.parse(ATLAS_SEARCH_BENCHMARK_REFERENCE_DATE)),
  'the relative-date benchmark has a valid frozen reference date',
);
assert(
  ATLAS_SEARCH_BENCHMARKS.length >= 7,
  'the bank retains a broad set of smart-search intents',
);
assert.equal(
  new Set(ATLAS_SEARCH_BENCHMARKS.map((benchmark) => benchmark.id)).size,
  ATLAS_SEARCH_BENCHMARKS.length,
  'benchmark IDs are unique',
);
assert.equal(
  new Set(ATLAS_SEARCH_BENCHMARKS.map((benchmark) => benchmark.query)).size,
  ATLAS_SEARCH_BENCHMARKS.length,
  'benchmark prompts are unique',
);
assert(
  ATLAS_SEARCH_BENCHMARKS.some(
    (benchmark) => benchmark.evaluationMode === 'offline-grounding',
  )
    && ATLAS_SEARCH_BENCHMARKS.some(
      (benchmark) => benchmark.evaluationMode === 'model-required',
    ),
  'the bank separates build-safe grounding checks from semantic model checks',
);

const fixtureEventIds = new Set(
  ATLAS_SEARCH_BENCHMARK_EVENTS.map((event) => event.id),
);
const documents = createAtlasSearchKnowledgeDocuments({
  events: ATLAS_SEARCH_BENCHMARK_EVENTS,
  profiles: ATLAS_SEARCH_BENCHMARK_PROFILES,
  supplementalKnowledgeByEventId: ATLAS_SEARCH_BENCHMARK_KNOWLEDGE,
});
const documentsByEventId = new Map(
  documents.map((document) => [document.eventId, document]),
);

for (const benchmark of ATLAS_SEARCH_BENCHMARKS) {
  assert(benchmark.query.trim(), `${benchmark.id} has a public benchmark query`);
  assert(
    benchmark.groundingProbeQuery.trim(),
    `${benchmark.id} has a deterministic grounding probe`,
  );
  assert(
    benchmark.expectedEventIds.every((eventId) => fixtureEventIds.has(eventId)),
    `${benchmark.id} refers only to benchmark-corpus events`,
  );

  const matches = searchAtlasKnowledgeDocuments(
    benchmark.groundingProbeQuery,
    documents,
  );
  assert.deepEqual(
    matches.map((match) => match.eventId),
    [...benchmark.expectedEventIds],
    `${benchmark.id} retains its expected grounded event order`,
  );

  for (const match of matches) {
    const document = documentsByEventId.get(match.eventId);
    assert(document, `${benchmark.id} match has a knowledge document`);
    assert(
      match.evidenceFactIds.length > 0,
      `${benchmark.id} retains evidence fact IDs`,
    );
    const cues = deriveAtlasSearchMatchCues({
      query: benchmark.groundingProbeQuery,
      document,
      evidenceFactIds: match.evidenceFactIds,
    });
    const normalizedCues = cues.map(normalizeHomeAtlasSearchValue);
    const expectedCuesByEventId: Readonly<Record<string, readonly string[]>> =
      benchmark.expectedCueFragmentsByEventId;
    const expectedCueFragments =
      expectedCuesByEventId[match.eventId] ?? [];
    for (const expectedCue of expectedCueFragments) {
      const normalizedExpected = normalizeHomeAtlasSearchValue(expectedCue);
      assert(
        normalizedCues.some((cue) => cue.includes(normalizedExpected)),
        `${benchmark.id} cue set ${JSON.stringify(cues)} includes ${expectedCue}`,
      );
    }
  }
}

console.log(
  `Atlas search benchmark validation passed (${ATLAS_SEARCH_BENCHMARKS.length} prompts).`,
);

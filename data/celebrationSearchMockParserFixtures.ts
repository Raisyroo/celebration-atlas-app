import { parseCelebrationSearchMock } from './celebrationSearchMockParser';
import type { AtlasSearchResult } from './celebrationSearchTypes';

// Safe Celebration Search mock parser fixtures for manual diagnostics only.
//
// These fixtures intentionally do not run at app startup, do not wire into UI,
// and do not execute map, marker, constellation, route, or event behavior. They
// provide a small set of parser inputs and captured parser results for future
// diagnostics to inspect manually.
//
// Fixture notes avoid exact-date assertions and keep partial national/current
// coverage warnings visible through the parser result.

type CelebrationSearchMockParserFixtureDefinition = {
  queryText: string;
  notes: string;
};

export type CelebrationSearchMockParserFixture = CelebrationSearchMockParserFixtureDefinition & {
  result: AtlasSearchResult;
};

const CELEBRATION_SEARCH_MOCK_PARSER_FIXTURE_DEFINITIONS: CelebrationSearchMockParserFixtureDefinition[] = [
  {
    queryText: 'Show me music festivals in Michigan',
    notes: 'Safe state/category query; confirms Michigan music intent without asserting exact event dates.',
  },
  {
    queryText: 'Show me county fairs in Michigan',
    notes: 'Safe state/category query; confirms Michigan county fair intent against current partial Atlas data.',
  },
  {
    queryText: 'Show me fireworks in Michigan',
    notes: 'Safe state/category query; confirms Michigan fireworks intent without claiming current schedule accuracy.',
  },
  {
    queryText: 'Show me food festivals in Michigan',
    notes: 'Safe state/category query; confirms Michigan food festival intent without expanding event coverage.',
  },
  {
    queryText: 'Show me all music festivals in the US',
    notes: 'National partial-coverage query; result should visibly warn that Atlas data is not nationally complete.',
  },
  {
    queryText: 'Show me fairs across the United States',
    notes: 'National partial-coverage query; result should not imply a complete United States fair inventory.',
  },
  {
    queryText: 'Romeo Peach Festival',
    notes: 'Known event query; confirms direct event matching without touching the Romeo page or event data.',
  },
  {
    queryText: 'Electric Forest',
    notes: 'Known event query; confirms direct event matching without changing marker or map behavior.',
  },
  {
    queryText: 'County Fair Trail',
    notes: 'Constellation query; confirms existing constellation matching without rendering or interaction changes.',
  },
  {
    queryText: 'Great Lakes Fireworks',
    notes: 'Constellation query; keeps editorial/review caution visible in parser warnings.',
  },
  {
    queryText: 'Small-Town Labor Day Traditions',
    notes: 'Constellation query; keeps lower-confidence/unverified constellation caution visible in parser warnings.',
  },
  {
    queryText: 'What festivals are active in Michigan?',
    notes: 'Timing caution query; result should warn that active/current timing needs verified schedule data.',
  },
  {
    queryText: 'What’s happening this weekend?',
    notes: 'Timing caution query; result should ask for safer scope and avoid claiming current weekend coverage.',
  },
  {
    queryText: 'Show me events today',
    notes: 'Timing caution query; result should warn that today/current data is incomplete.',
  },
  {
    queryText: 'Find September festivals in Michigan',
    notes: 'Month query; result may use September as intent but should not assert exact current-year dates.',
  },
  {
    queryText: 'Show me the best festivals',
    notes: 'Ambiguous quality query; result should avoid subjective ranking claims and keep coverage caution visible.',
  },
  {
    queryText: 'Find movie premieres in New York',
    notes: 'Ambiguous/no-results-adjacent query; parser should avoid inventing unsupported New York results.',
  },
  {
    queryText: 'What’s near me this weekend?',
    notes: 'Ambiguous location/timing query; result should request safer scope and avoid current-location assumptions.',
  },
];

export function getCelebrationSearchMockParserFixtures(): CelebrationSearchMockParserFixture[] {
  return CELEBRATION_SEARCH_MOCK_PARSER_FIXTURE_DEFINITIONS.map((fixture) => ({
    ...fixture,
    result: parseCelebrationSearchMock({ queryText: fixture.queryText }),
  }));
}

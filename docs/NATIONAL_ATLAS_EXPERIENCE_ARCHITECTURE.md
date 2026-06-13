# Celebration Atlas National Atlas Experience Architecture

## Purpose

The National Atlas Experience defines how Celebration Atlas grows from the current Michigan event discovery prototype into a national, AI-powered atlas of celebrations.

Near term, the product should feel like a beautiful conversational map of festivals, fairs, parades, seasonal traditions, and local gatherings.

Long term, the national atlas should become the gateway into a larger living entertainment platform, while still preserving the quiet, source-backed, map-first discovery principles established by the Michigan prototype.

This document is a north-star architecture guide. It does not describe current implementation unless explicitly noted. It should be read before changing national map behavior, Celebration Search, state transitions, state-level browsing, or AI command behavior.

## Core Experience Principle

The U.S. map is the gateway. State atlases are the places where discovery becomes useful. Event pages are where individual celebrations become understandable and experienceable.

The master user journey should be:

1. Enter through a national U.S. atlas.
2. Ask or select a broad discovery intent.
3. See national signals, state portals, clusters, or trails.
4. Transition into a state atlas when the intent becomes state-specific.
5. Open event pages when the intent becomes event-specific.
6. Let Celebration Search interpret the user's command and choose the safest map response.

The experience should feel magical, but the data should remain honest.

## Experience Hierarchy

### 1. National Scope

National scope answers broad questions across the United States.

Examples:

* “Show me all music festivals in the US”
* “Show me county fairs near the Great Lakes”
* “What’s happening this weekend?”
* “Find hidden small-town festivals in September”

National scope should usually return:

* state-level highlights
* regional clusters
* category density
* major event stars
* constellation trails
* explanatory response text
* a prompt to narrow scope if results are too broad

National scope should not try to show every event in the country at once. The national map should show interpretable signals, not an unreadable pin cloud.

### 2. State Scope

State scope answers questions inside one state atlas.

Examples:

* “What festivals are active in Michigan?”
* “Show fall harvest festivals in Michigan”
* “Find county fairs in the Thumb”
* “What’s near Detroit this weekend?”

State scope should usually return:

* state map focus
* state regions
* filtered event stars
* state-specific clusters
* state constellations
* category and timing explanations
* links into event pages

Michigan is the first canonical state atlas. It should define the reusable model for other state atlases, including state map behavior, region discovery, event stars, constellation trails, source confidence, and active-event caution.

### 3. Event Scope

Event scope answers questions about one celebration.

Examples:

* “Tell me about the Romeo Peach Festival parade”
* “When is this event active?”
* “What should I not miss?”
* “Is there a schedule?”

Event scope should return:

* the event page or event preview
* factual source-backed details
* schedule, location, and planning information when available
* media and memory layers when available
* clear missing-data explanations when unavailable

Event pages remain governed by `docs/EVENT_EXPERIENCE_ARCHITECTURE.md`.

## U.S. Map as the Gateway

The national map is the first emotional threshold into the larger Atlas.

It should support:

* state selection
* national search entry
* broad category exploration
* state-level density signals
* regional cluster glows
* national constellations
* seasonal overlays
* current-location awareness when allowed
* mobile-first interaction patterns

The national map should answer “Where should I explore?” before it answers “Which exact event should I attend?”

Rules:

* Do not render every national event by default.
* Prefer clusters, state portals, and filtered stars for broad queries.
* Prefer state zoom when the user intent becomes state-specific.
* Preserve real geography as source truth even when the visual map is illustrated.
* Make incomplete coverage visible through response text and source status rather than fake completeness.

## State Maps as Standalone Atlases

Each state should eventually be a standalone atlas with its own identity, regions, events, seasonal rhythms, trails, and practical planning paths.

State atlases should include:

* state map
* state identity and atmosphere
* state regions
* category discovery
* seasonal discovery
* event index
* event stars
* state clusters
* state constellations
* source-backed event pages

A state atlas should be able to function independently while still belonging to the national atlas hierarchy.

## Michigan as the First Canonical State Atlas

Michigan is the first canonical state atlas and should remain the reference implementation for:

* state-level event discovery
* illustrated state map behavior
* star marker meaning
* constellation trail behavior
* region and category discovery
* source and confidence treatment
* event-page relationship
* active/current-year caution
* progressive enrichment from sparse data to rich event experiences

Future state atlases should reuse the Michigan structure, not create unrelated state-specific systems.

## Current-to-Future Migration Plan

The safest national atlas migration is documentation-first and shell-first. The current homepage is Michigan-first, and a visible route-level or map-level national shell change would be risky until the component boundaries are explicit and reviewed.

### Current State

* `/` currently renders the Michigan-first `HomeAtlasExperience` through `app/page.tsx`.
* `HomeAtlasExperience` is the current Michigan state atlas implementation boundary, even though it still carries the historical homepage name.
* `AtlasMap` is the current Michigan map implementation and is tightly wired to Michigan map assets, Michigan projection behavior, Michigan event data, clustering, markers, selected-event cards, and cluster panels.
* Michigan remains the canonical state atlas prototype for future state atlas behavior, data caution, map presentation, discovery sections, and constellation interactions.

### Target Structure

Future national work should introduce explicit shell boundaries before any visible homepage change:

* `AtlasGatewayShell` — the eventual top-level gateway that decides whether the user starts in national, state, or event scope.
* `NationalAtlasShell` — the national U.S. atlas container for national search, state portals, density signals, partial-coverage messaging, and national-to-state transitions.
* `StateAtlasShell` — the reusable state-level container that can host Michigan first and future state atlases later.
* `MichiganAtlasExperience` — a wrapper or renamed boundary around the current `HomeAtlasExperience` behavior, preserving the existing Michigan-first prototype while giving it an explicit state-atlas identity.
* `CelebrationSearchPanel` — the conversational command interface that can feed the same command model into national, state, region, or event responses without becoming a simple text filter.

### Safe Migration Order

1. Complete this documentation-only migration plan so the intended boundaries, command routing, and protection rules are explicit before code changes.
2. Add non-rendered component skeletons for the national and state shells without importing them into `app/page.tsx` and without changing runtime behavior.
3. Add `MichiganAtlasExperience` as a wrapper or alias around the existing `HomeAtlasExperience` boundary, preserving behavior first and deferring any rename cleanup.
4. Add `StateAtlasShell` around `MichiganAtlasExperience` only after the wrapper is reviewed, preserving Michigan projection, clustering, marker interactions, cards, panels, and constellation behavior.
5. Prototype a hidden or dev-only `NationalAtlasShell` that can exercise command and partial-coverage states without becoming the public homepage.
6. Prototype a visible national placeholder only after the hidden shell is reviewed and approved, making clear that national coverage is partial.
7. Make the national gateway the default entry only after explicit approval that the placeholder, state transitions, coverage language, and Michigan preservation rules are safe.

### Command Routing Matrix

| User intent | Safe routing behavior | Required honesty rule |
| --- | --- | --- |
| Broad national query, such as “Show me all music festivals in the US” | Stay in national scope and show state-level highlights, density, representative stars, or partial-coverage response text. | Do not claim national completeness or imply every matching event is known. |
| Michigan query, such as “What festivals are active in Michigan?” | Transition to the Michigan state atlas and use Michigan state-level filters or highlights. | Explain timing confidence and avoid active/current claims without verified timing. |
| Michigan event query, such as “Tell me about the Romeo Peach Festival parade” | Stay inside or transition into the Michigan atlas and highlight the matching Michigan event before offering event-page navigation. | Highlight only known Michigan event IDs and preserve existing selected-card behavior. |
| Constellation query, such as “Show harvest trails in Michigan” | Activate the matching state constellation only when the trail is known and the existing state constellation behavior can be reused safely. | Do not invent relationships, trails, or event membership. |
| Timing-sensitive query, such as “What’s happening this weekend?” | Ask a clarifying question unless verified timing exists for the requested scope and date window. | Do not call events active/current from stale recurring descriptions. |
| No known results | Explain that the Atlas has no known results for the current coverage and offer a safer scope or clarification. | “No known results” must not mean “no events exist.” |

### Protection Rules

* Do not refactor `AtlasMap` projection while introducing national, gateway, or state shells.
* Do not move marker clustering while introducing shells.
* Do not change marker tap targets, selected-event card behavior, or cluster panel behavior during shell migration.
* Do not pass national event IDs, national density IDs, or non-Michigan event identifiers into the Michigan map implementation.
* Do not claim national completeness; national responses must describe partial coverage when coverage is incomplete.
* Do not claim active/current events without verified timing data for the relevant event and date window.

## Celebration Search as the Conversational Command Layer

Celebration Search is the conversational command layer that interprets user intent and decides how the atlas should respond.

It should not be treated as a simple text filter. It is a command model that can select scope, map response, event highlighting, trails, clarification prompts, and explanatory text.

Celebration Search should be able to interpret commands such as:

* “Show me all music festivals in the US”
* “What festivals are active in Michigan?”
* “Show me county fairs near the Great Lakes”
* “What’s happening this weekend?”
* “Find hidden small-town festivals in September”

For each command, the system should determine:

* whether the user is asking at national, state, region, or event scope
* whether the user wants search, zoom, filter, highlight, compare, route, explain, or open behavior
* whether the data is complete enough to answer directly
* whether the system should ask a clarifying question
* whether results should be stars, clusters, constellations, cards, event pages, or response text

## AI Command Model

The AI command model should turn natural language into a structured search command. The model should be explicit enough that map UI, event lists, and response text can all use the same interpretation.

Proposed TypeScript-style model:

```ts
type AtlasSearchScope = "national" | "state" | "region" | "event";

type AtlasSearchAction =
  | "search"
  | "filter"
  | "highlight"
  | "zoom"
  | "openEvent"
  | "showConstellation"
  | "compare"
  | "explain"
  | "clarify";

type AtlasSourceStatus =
  | "verified"
  | "sourceBacked"
  | "partial"
  | "stale"
  | "unknown"
  | "needsReview";

interface AtlasSearchCommand {
  queryText: string;
  scope: AtlasSearchScope;
  action: AtlasSearchAction;
  stateSlug?: string;
  regionSlug?: string;
  category?: string;
  eventType?: string;
  timingIntent?: string;
  constellationId?: string;
  highlightedEventIds: string[];
  responseText: string;
  confidence: number;
  needsClarification: boolean;
  sourceStatus: AtlasSourceStatus;
}
```

Field intent:

* `queryText` preserves the user's original command.
* `scope` identifies whether the response belongs to the country, state, region, or event layer.
* `action` tells the map and UI how to respond.
* `stateSlug` narrows the command to a state atlas.
* `regionSlug` narrows the command to a known state or national region.
* `category` captures broad categories such as music, food, fairs, holiday, or arts.
* `eventType` captures more specific event kinds such as parade, carnival, screening, pageant, market, or fireworks.
* `timingIntent` captures phrases such as this weekend, September, active now, fall, or current year.
* `constellationId` points to a themed trail when the command maps to a known constellation.
* `highlightedEventIds` identifies specific events to emphasize as stars or cards.
* `responseText` explains what the Atlas found and what remains uncertain.
* `confidence` indicates interpretation confidence, not event truth by itself.
* `needsClarification` prevents overconfident responses to ambiguous commands.
* `sourceStatus` summarizes whether the response is verified, source-backed, partial, stale, unknown, or review-needed.

## Map Response Model

A search command should produce a map response that chooses the safest presentation for the user's intent.

Possible responses:

### National State Highlight

Used when a query is broad and state-level signal is more useful than individual markers.

Example:

* “Show me all music festivals in the US”

Response:

* highlight states with known music festival coverage
* show national clusters where data supports them
* explain that coverage may be partial
* invite the user to choose a state

### National Cluster Glow

Used when the query implies density or region rather than individual event selection.

Example:

* “Show me county fairs near the Great Lakes”

Response:

* glow Great Lakes regions with known county fair coverage
* show representative event stars only when source-backed
* offer a state or region drill-down

### State Zoom

Used when the query identifies a state or when the best next step is state-level exploration.

Example:

* “What festivals are active in Michigan?”

Response:

* transition to Michigan atlas
* show filtered Michigan stars and clusters
* explain timing confidence and current-year limitations

### Event Star Highlight

Used when specific events are known and relevant.

Response:

* highlight matching event stars
* show cards or event previews
* dim unrelated stars
* preserve route to event pages

### Constellation Trail

Used when the query maps to a guided trail.

Response:

* reveal or select a constellation
* connect related stars only for the selected trail
* explain why the events are connected
* avoid implying relationships that are not source-backed or reviewed

### Clarification Prompt

Used when the command is too broad, ambiguous, or data-limited.

Examples:

* “Do you want events in Michigan, near you, or across the U.S.?”
* “Should I show events happening this weekend or events that usually happen in this season?”
* “I have partial national coverage. Would you like verified Michigan results first?”

## Stars, Clusters, and Constellations

### Stars as Event Visibility Outputs

Stars are event-level visibility outputs. They should be used when the Atlas can show meaningful event records.

Star intensity should come from event metadata, source status, coverage level, timing relevance, and search relevance.

Rules:

* A star should correspond to a real event record.
* A pulsing or active star should require current timing confidence.
* A dim star may indicate lower coverage or lower relevance.
* A hidden star may be revealed by search, zoom, or a constellation.

### Clusters as National and State Density Outputs

Clusters are density outputs. They describe concentrations of events, not individual event certainty.

Clusters should be used when:

* event counts are too high for individual stars
* national coverage would become visually noisy
* a region is more meaningful than a list
* the data supports density but not every exact event display

Cluster copy should be honest about coverage and source status.

### Constellations as Guided Trails

Constellations are guided trails through related celebrations.

They may be:

* curated
* AI-suggested and reviewed
* seasonal
* regional
* category-based
* historical
* practical trip paths

Constellations should reveal relationships. They should not invent events, fabricate routes, or imply unreviewed cultural meaning as fact.

## State Zoom and Transition Behavior

State transitions should help the user understand movement between scope levels.

Expected behavior:

1. National map shows the U.S. atlas.
2. User selects a state or asks a state-specific command.
3. The selected state becomes the focus.
4. The interface transitions into the state atlas.
5. State regions, stars, clusters, and constellations become available.
6. Event selection opens event scope.

Guidelines:

* Transitions should be calm, cinematic, and legible.
* The user should never feel lost about whether they are in national, state, or event scope.
* Back navigation should preserve the previous search context where possible.
* State zoom should not change event truth; it only changes presentation scope.
* Mobile behavior should prioritize clarity over simultaneous panels.

## National Search Examples

### “Show me all music festivals in the US”

Likely command:

* scope: national
* action: search or highlight
* category: music

Preferred response:

* show national music festival coverage as state highlights and clusters
* show only representative or high-confidence event stars
* explain partial coverage if the national dataset is incomplete
* offer state drill-downs

### “What festivals are active in Michigan?”

Likely command:

* scope: state
* action: zoom or filter
* stateSlug: michigan
* timingIntent: active/current

Preferred response:

* transition to Michigan atlas
* show Michigan events with current-year/date confidence
* avoid marking stale or recurring-but-unconfirmed events as active
* explain uncertainty when dates are not current

### “Show me county fairs near the Great Lakes”

Likely command:

* scope: region
* action: search or highlight
* regionSlug: great-lakes
* category: county fairs

Preferred response:

* show Great Lakes regional clusters
* highlight source-backed fair records
* ask for a state if the result set is too broad

### “What’s happening this weekend?”

Likely command:

* scope: national, state, or near-me depending on user context
* action: search
* timingIntent: this weekend

Preferred response:

* use location if permission and product design allow
* otherwise ask for a state or region
* include only events with reliable dates for the requested weekend
* do not infer current activity from old recurring descriptions

### “Find hidden small-town festivals in September”

Likely command:

* scope: national or state depending on context
* action: search or showConstellation
* category: festivals
* timingIntent: September

Preferred response:

* reveal hidden-gem or lower-visibility stars where supported
* prefer state or regional grouping
* explain why results qualify as small-town or hidden-gem when known
* avoid inventing hidden status without metadata or review

## Data Completeness and Fallback Behavior

The national atlas will be incomplete for a long time. The product should make that incompleteness understandable instead of hiding it.

Fallback rules:

* If national data is incomplete, say coverage is partial.
* If current-year dates are unknown, do not call an event active.
* If an event is recurring but not confirmed for the current year, label it carefully.
* If a region has weak data, offer a narrower state or verified subset.
* If a query asks for unsupported precision, ask a clarifying question.
* If no results exist, distinguish “no known results” from “no events exist.”
* If AI confidence is low, route to clarification instead of over-answering.

## No Fake Data Rule

Celebration Atlas must not fabricate events, dates, locations, ticket details, routes, live activity, organizer claims, media, or cultural meaning.

AI may:

* summarize known source-backed information
* suggest possible filters
* explain missing data
* ask clarifying questions
* recommend a safer scope

AI must not:

* invent event records
* imply current-year confirmation without evidence
* mark an event active based only on stale data
* create fake hidden gems
* fabricate routes, lineups, vendors, schedules, ticket access, or media rights

## Current-Year and Active-Event Caution

“Active,” “happening now,” “this weekend,” and “current year” are high-risk claims.

Rules:

* Current-year event status should require current-year dates or verified current source evidence.
* Recurring annual events should not automatically be treated as active this year.
* Search responses should distinguish confirmed dates, historical patterns, estimated seasons, and unknown timing.
* Pulsing stars should require strong timing confidence.
* If date data is missing or stale, the map may show a dim or informational star, but response text must explain uncertainty.

## Mobile-First, Eventually Responsive Layout

The national atlas should be designed mobile-first because many discovery moments happen while traveling, planning weekends, or standing near an event.

Mobile priorities:

* one clear map state at a time
* compact Celebration Search
* readable scope labels
* simple state zoom and back behavior
* bottom-sheet or card-based event previews
* limited simultaneous layers

Longer-term responsive priorities:

* richer desktop panels
* side-by-side map and results
* national-to-state comparison views
* constellation explanations
* planning and itinerary affordances

Responsive expansion should not change the underlying command or map response model.

## Relationship to Existing Michigan Map and Event Pages

Current implementation should be treated as the Michigan prototype, not as throwaway work.

The existing Michigan map and event pages establish early patterns for:

* map-first discovery
* event stars
* featured event browsing
* constellation behavior
* event page deep dives
* practical planning content
* quiet, visual-first pacing

Future national work should connect to those patterns instead of bypassing them.

This document does not require any immediate UI, routing, data, media, or runtime changes. It defines the intended architecture for future national map and Celebration Search work.

# Celebration Atlas Master Context

## Current Working State — June 25, 2026

* Main branch is stable.
* MapLibre geospatial test works on desktop and iPhone.
* `/dev/geospatial-map-test` is for map-engine testing only.
* Normal home route `/` is the Celebration Atlas app experience.
* Romeo flyer works locally when placed at `public/event-media/flyers/romeo-peach-festival.webp`.
* `public/event-media/flyers/` is intentionally ignored by git because flyer binaries are local assets for now.
* Do not use Codex/cloud to move or create binary images.
* One task = one branch = one PR.
* Never cherry-pick unless explicitly requested.
* Never use dev routes to test production UI.
* Home page and AtlasMap are sacred; audit before editing.
* Future work should focus on stabilizing the mobile event-card flow, then layering the illustrated Michigan artwork over the real map foundation.

## Development Guardrails

* One task, one branch, one PR.
* No cherry-picking unless Ray explicitly asks.
* No binary/image file handling in Codex/cloud.
* Dev routes are isolated test routes, not production UI.
* `/dev/geospatial-map-test` is only for MapLibre/map-engine testing.
* `/` is the real Celebration Atlas app route.
* Home page and AtlasMap require audit before edits.
* Do not touch MapLibre, AtlasMap, event data, routes, or package files unless the task specifically requires it.
* If a task fails, stop and report findings; do not create new branches or alternate fixes.

## Product Vision

Celebration Atlas is an AI-first celebration discovery platform.

It is not a traditional event directory.

The experience should feel like:

* map
* atlas
* travel poster
* local intelligence layer
* AI assistant

combined into one product.

The map is the primary interface.

The AI Ask Bar controls the map.

The user should ask natural-language questions and the map should respond visually.

## Core User Flow

The primary product loop is:

1. User asks a question or searches an event.
2. AI interprets the request.
3. Map reveals the relevant markers, stars, tags, counts, or regions.
4. User taps a marker, thumbnail, or event result.
5. A marketing flyer card opens.
6. User clicks `Tickets & Info`.

The user will manually decide where Tickets & Info links go.

Do not auto-invent ticket URLs.

## Current Priority

The current priority is not advanced AI.

The current priority is restoring the map product loop:

Michigan map →
search →
marker / thumbnail →
event flyer card →
Tickets & Info

Michigan must work first.

Then national map.

Then all other states.

## Diagnostic-First Development Rule

Do not assume systems are missing.

Before rebuilding anything, audit existing code.

Always ask:

Are we rebuilding something that already exists, or are we auditing and wiring what exists?

Prefer:

* audit first
* smallest fix
* narrow file scope
* explicit protected areas
* verification steps
* no architecture expansion unless requested

Do not rebuild:

* coordinate projection
* marker systems
* exact-event search
* card systems
* map zoom/pan
* event data
* AI parser
* event pages

unless an audit proves they are missing or broken.

## Existing Coordinate Philosophy

Real latitude/longitude is the source of truth.

Illustrated/artsy map placement is presentation-only.

Do not manually move event coordinates to make artwork look right.

If illustrated locations look wrong, audit the active artwork calibration.

The Michigan illustrated map artwork has changed since earlier calibration work, so old visual calibration may be stale.

Future illustrated-map fixes should recalibrate the current active artwork assets, not edit event coordinates.

## Map System Direction

Celebration Atlas needs a real map engine that can eventually handle thousands of events.

The long-term system should support:

* real lat/lon
* state and national maps
* clustering
* zoom-dependent markers
* AI-driven filtering
* event counts
* marker selection
* flyer cards
* future artifact links

The artistic maps are the visual skin.

The real geospatial system is the operational engine.

Michigan should be the first complete test case.

## Current Real Map Status

A `/dev/geospatial-map-test` route was created as an isolated laboratory.

It proved that:

* event records already have real latitude/longitude
* exact-event search can reuse existing systems
* selected-event card derivation can reuse existing systems
* geographic map logic should stay isolated from illustrated map calibration

MapLibre testing was attempted.

Runtime CDN loading became unreliable.

`maplibre-gl` could not be installed in the Codex environment because the npm registry returned 403 Forbidden.

The route currently documents that production map work requires installing `maplibre-gl` as a proper dependency when registry access works.

Do not waste time repeatedly patching CDN MapLibre loading.

When registry access works:

* install `maplibre-gl`
* import it normally
* use GeoJSON sources
* use clustering
* keep the route isolated until proven

## AI Ask Bar Philosophy

The Ask Bar is the future engine of the product.

But map functionality comes first.

The Ask Bar should eventually support:

* natural-language queries
* longer questions
* map responses
* session conversation memory
* voice input

Preferred behavior:

If the map can answer visually, use the map.

Example:
"How many music festivals are in Michigan?"

Preferred response:

* reveal music festival markers
* display count
* optionally show a short answer

Not a long paragraph.

If a question needs explanation:

* open a chat window above the Ask Bar
* answer conversationally
* preserve the session thread

Example:
"Tell me the history of the Detroit Jazz Festival."

That should open a conversation-style answer.

## Marketing Flyer System

Celebration Atlas event cards should use marketing flyer artwork.

Purpose:

* stop the scroll
* create emotion
* establish legitimacy
* drive clicks to Tickets & Info

The flyer is not meant to answer every question.

The flyer should make the user want to click.

Visual inspiration:

* vintage travel posters
* National Park posters
* tourism ads
* storybook Americana
* collectible event posters

Flyer requirements:

* large event title
* hero image
* location
* date
* one short emotional or historical line
* large `Tickets & Info` CTA
* subtle Celebration Atlas logo at bottom center

Avoid:

* schedules
* feature lists
* sponsor lists
* social icons
* raw website URLs
* clutter
* paragraphs
* excessive data

Approved flyer direction examples:

* Goodells Fair
* Detroit Jazz Festival
* Mackinac Island Lilac Festival
* National Cherry Festival
* Tulip Time
* Allendale Balloon Festival

Celebration Atlas branding should be subtle.

Only one logo.

Bottom center preferred.

The event is the hero.

## Flyer vs Artifact

There are two related but different products.

### Marketing Flyer

Purpose:

* drive attendance
* drive clicks
* support affiliate/ticket revenue
* work inside event cards and social sharing

Simple, emotional, CTA-driven.

### Collectible Artifact

Purpose:

* preserve history
* sell prints
* tell deeper stories
* support galleries and event pages

Can include:

* origin story
* traditions
* Atlas Notes
* historical facts
* timelines
* maps
* oral histories
* photos
* galleries

Do not cram artifact content into the marketing flyer.

## Event Card Direction

When a user taps a marker, thumbnail, or search result:

Open a flyer-style card.

The card should include:

* event flyer image
* event title
* date active
* location
* enticing short description
* `Tickets & Info` button

The `Tickets & Info` link destination will be chosen manually by the user.

Do not invent affiliate links or official ticket links unless provided.

Later, cards may also include:

* Gallery
* Artifacts
* Event History
* Photos
* Maps
* Ask Atlas about this event

## Michigan Event Database Goal

After maps work:

Load and coordinate as many Michigan events as possible.

Event records should include:

* name
* city
* state
* latitude
* longitude
* start date
* end date
* category
* official website
* ticket/info URL when manually approved
* thumbnail/flyer image
* short description
* tags
* source/confidence status

Categories should include:

* music festivals
* fairs
* agricultural events
* car shows
* balloon festivals
* art festivals
* cultural festivals
* holiday events
* boat races
* tattoo conventions
* local traditions

## Atlas Scout Notes

Atlas Scout is the future field-capture tool.

It should eventually help collect:

* GPS-tagged photos
* entrance photos
* vendor areas
* food menus
* parking
* stages
* schedules
* routes
* event atmosphere
* local notes

Photos should become part of the event intelligence layer.

## Development Priorities

Current order:

1. Michigan map works.
2. Search reveals correct markers.
3. Marker tap opens flyer card.
4. Thumbnail tap opens flyer card and centers map.
5. Tickets & Info button exists.
6. Michigan event database expands.
7. National map works.
8. State maps work.
9. AI Ask Bar grows into map-controlling chatbot.
10. Voice input later.

Do not skip ahead to advanced AI before the core map/flyer loop works.

## Protected Areas

Do not casually change:

* production routes
* current event pages
* illustrated Michigan map calibration
* event coordinates
* existing exact-event search logic
* existing card derivation
* flyer image assets
* homepage layout
* national dev route

without explicit reason and audit.

## Final Product Principle

Celebration Atlas should not feel like an event list.

It should feel like a living map of American celebration.

The map answers first.

The card inspires the click.

The artifact preserves the memory.

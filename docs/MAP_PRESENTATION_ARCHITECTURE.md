# Celebration Atlas Map Presentation Architecture

## Purpose

Celebration Atlas needs multiple map experiences:

* artsy illustrated state maps
* practical real maps
* event grounds maps
* future 3D/world maps
* constellation discovery layers

The same event data should support all of them.

Real coordinates are the source of truth.
Every map is a presentation layer.

This architecture defines the separation between geographic truth and visual presentation so Celebration Atlas can grow without confusing manually placed artwork with real-world location data.

## Core Rule

Event location truth:

* latitude
* longitude
* address
* venue
* city
* county
* region
* state

Map presentation:

* illustrated x/y position
* calibrated projection
* real map projection
* event grounds projection
* 3D/world position
* constellation star position

Do not treat manually placed illustrated x/y positions as real geography.

Real coordinates answer where an event exists.
Presentation coordinates answer how that event should appear in a specific map experience.

## Map Types

### 1. Illustrated Atlas Map

Purpose:
Emotional discovery and brand atmosphere.

Used for:

* state home pages
* national gateway
* discovery browsing
* constellation stars
* themed trails

Rules:

* can be stylized
* can be painterly
* can slightly distort geography
* should feel magical and explorable
* should not be used as the only practical navigation source

Illustrated atlas maps are allowed to prioritize mood, legibility, pacing, and wonder. They should remain connected to real geography through calibration, but they do not need to behave like surveying tools.

### 2. Real Geographic Map

Purpose:
Accuracy and practical planning.

Used for:

* directions
* distance
* nearby events
* parking
* venue location
* route planning

Rules:

* uses real latitude/longitude
* should support Mapbox, Google Maps, Leaflet, or similar
* should not depend on illustrated map x/y placement

Real geographic maps are the practical planning layer. They should be trusted for distances, directions, routing, and external map handoff.

### 3. Event Grounds Map

Purpose:
Help people attend the event.

Used for:

* entrances
* parking
* restrooms
* vendors
* stages
* food areas
* parade routes
* first aid
* accessibility paths
* field scout GPS points

Rules:

* may use real GPS
* may use a drawn fairground/festival map
* should support approximate/manual placement where exact GPS is unavailable
* must distinguish verified vs approximate points

Event grounds maps can mix surveyed data, Atlas Scout observations, organizer maps, and manual annotations. Their data model must make confidence and verification visible.

### 4. Constellation Map Layer

Purpose:
Turn event dots into meaningful discovery patterns.

Used for:

* themed trails
* seasonal clusters
* flagship events
* current/live events
* hidden gems
* dense regions

Definitions:

* star = event
* bright star = flagship event
* pulsing star = timely/current event
* dim star = ordinary discovery
* constellation line = relationship or trail
* starfield = dense event region
* cluster glow = many nearby discoveries

Constellation layers can sit on top of illustrated maps, real maps, or future immersive maps. Their role is interpretation: they reveal relationships, not new geographic truth.

### 5. 3D / World Map

Purpose:
Immersive exploration.

Used for:

* future state worlds
* event worlds
* animated flyovers
* AR/world-building tools
* guided tours

Rules:

* uses real coordinates as anchors
* visual position can be stylized
* must preserve relationship to source event data
* should not require hand-building every event world

3D/world maps should derive from shared event truth and reusable projection systems. They may become highly stylized, but they should remain traceable back to EventProfile geography.

## Projection Model

Each event may have:

Source truth:

* real latitude/longitude

Presentation projections:

* illustratedMapPosition
* realMapPosition
* groundsMapPosition
* constellationPosition
* worldPosition

Recommended structure:

EventProfile.geography.coordinates = real source of truth

MapPresentationProfile = how that event appears on a specific map

Example:

eventId: "romeo-peach-festival"

real coordinates:
Romeo, Michigan

illustrated Michigan map:
calibrated x/y position on artsy state map

real map:
exact lat/lng

event grounds map:
downtown Romeo festival footprint

world map:
stylized Romeo celebration node

A single event should be able to appear differently across map experiences without changing its underlying location truth.

## Calibration Rules

Illustrated maps need calibration.

Calibration should:

* convert latitude/longitude to illustrated x/y
* allow manual override when needed
* store the override as presentation data, not source truth
* preserve a note explaining why override exists
* support future recalibration when the map asset changes

Manual x/y positions are allowed, but they are display overrides only.

Calibration data should be versioned or documented enough that future map assets can be swapped without losing the event's real coordinates or the reason a marker was visually adjusted.

Marker percentages must be resolved through the artwork's actual rendered
rectangle. When responsive CSS uses `cover` or `contain`, the marker plane must
apply the same rendered width, height, and alignment offsets; viewport-relative
percentages alone will drift away from the image as browser chrome changes the
available aspect ratio.

## Event Marker Types

Marker presentation should be driven by event profile metadata.

Possible marker attributes:

* event type
* category
* season
* region
* coverage level
* featured status
* hidden gem status
* current/timely status
* confidence score
* source status
* attendance relevance
* media richness

Marker styles:

* ordinary star
* bright star
* pulsing star
* cluster glow
* constellation node
* hidden/discoverable star
* verified marker
* approximate marker

Marker styling should express discovery value, timing, confidence, and relationship context. It should not create or overwrite location truth.

## Atlas Constellations

Atlas Constellations are themed relationships between events.

Examples:

* County Fair Trail
* Great Lakes Fireworks
* Harvest & Apple Path
* Winter Lights
* Haunted Michigan
* Summer Music Arc
* Waterfront Celebrations
* Historic Parades
* Queen Pageant Trail
* Small-Town Labor Day Traditions

A constellation should include:

* id
* title
* description
* event IDs
* theme
* season
* region if applicable
* source/confidence if generated by AI
* display priority
* line style
* star intensity rules

Constellations may be curated by humans, suggested by AI, discovered from data, or created for seasonal campaigns. Generated constellations should retain source and confidence metadata.

## Scaling Rules

For small event counts:

* show individual stars
* show labels sparingly
* allow featured events to glow

For hundreds of events:

* cluster by region/category/season
* reveal individual stars on zoom/search/filter
* show discovery trails

For thousands of events:

* do not show every point at once
* use constellation layers
* use search/list/filter
* use region grouping
* use density glows
* use AI guide prompts

Map presentation should become more interpretive as event density grows. Precision should move into search, lists, filters, and real-map views instead of forcing every event marker onto a single illustrated surface.

## AI-Agent Compatibility

Agents should populate:

* real coordinates
* geocoding confidence
* region
* category
* event type
* season
* source status
* suggested marker intensity
* suggested constellation membership
* map confidence
* approximate vs verified placement

Agents should not overwrite manual illustrated-map calibration without review.

AI-generated map suggestions should be treated as proposed presentation data until reviewed or validated. Agents may suggest calibration corrections, constellation membership, and marker intensity, but geographic truth must stay source-backed.

## Responsive Behavior

### Phone Portrait

* illustrated map creates wonder
* a state may open in a reviewed enlarged pose when the full artwork remains reachable through bounded drag
* when a smaller neutral artwork view is not an approved composition, the reviewed opening pose may also define portrait's minimum zoom
* portrait panning must stop at the reviewed meaningful-geography boundary rather than expose synthetic extension fields below the state
* portrait vertical travel may expand progressively with zoom when the increased scale provides safe overscan needed to inspect southern geography behind fixed discovery controls
* artwork, marker, cluster, and label layers must share the same camera transform and transition timing
* persisted camera transforms must carry an artwork/camera profile identity so an obsolete pose cannot override the reviewed opening composition after an artwork or camera revision
* discovery sections scroll below
* stars should be legible but not noisy
* search/list handles precision

### Phone Landscape

* map must not trap the page
* discovery/list must remain reachable
* constellation layer may simplify

### Tablet

* map and discovery can appear together
* more labels and trails can be visible

### Desktop

* atlas console
* map plus discovery/list/filter panel
* constellation trails can be explored in more detail

Responsive behavior should protect discovery and usability. A beautiful map should never prevent users from reaching practical event information.

## First Implementation Priorities

1. Keep real coordinates in EventProfile.
2. Keep current artsy Michigan map as a presentation layer.
3. Treat existing manual x/y values as display overrides only.
4. Add map presentation types later.
5. Do not replace current Michigan map yet.
6. Build future constellation markers as a layer over the map.
7. Keep practical real-map needs separate from artsy discovery-map needs.

These priorities intentionally avoid replacing current map work. The first step is architectural clarity: truth stays in event geography, while map-specific display decisions stay in presentation data.

## Final Direction

Celebration Atlas should support many map experiences from one event truth layer.

The real location tells us where the event is.
The illustrated map tells us why it feels worth exploring.
The constellation layer tells us how events connect.
The event grounds map helps people attend.
The future world map lets people enter the celebration.

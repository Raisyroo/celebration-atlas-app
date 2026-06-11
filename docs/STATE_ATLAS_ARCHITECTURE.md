# Celebration Atlas State Atlas Architecture

## Purpose

Each state should eventually become its own standalone Celebration Atlas, with Michigan serving as the canonical prototype for the first complete state experience.

The country atlas should remain the magical gateway: a national entry point that creates wonder, introduces state portals, and helps people sense the full scale of the Celebration Atlas.

The state atlas should become the main operational discovery layer: the place where people browse events, regions, categories, seasons, local traditions, trails, and practical planning information for a specific state.

The event page should become the deep experience layer: the place where one celebration expands into highlights, schedules, maps, galleries, planning details, Ask Anything intelligence, media, curiosity, archives, moments, artifacts, and memory.

## Core Hierarchy

The long-term Celebration Atlas structure is:

Country Atlas

* national gateway
* state entry points
* national seasonal constellations
* major cultural trails
* broad discovery

State Atlas

* primary event discovery layer
* state map
* regions
* categories
* seasons
* local event index
* practical planning
* curiosity trails
* source-backed event intelligence

Region Layer

* county/metro/shoreline/heritage regions
* local browsing
* trip planning
* nearby events
* local clusters

Event Page

* highlights
* schedule
* map
* gallery
* plan
* Ask Anything
* media/world layer
* curiosity/archives

## Michigan as the Canonical State Template

Michigan should define the first complete reusable state model for Celebration Atlas. It is not just the first state with event data; it is the prototype that proves how a state can become its own standalone atlas while still belonging to the national Celebration Atlas system.

Michigan should establish:

* state map behavior
* state regions
* category discovery
* seasonal discovery
* event profile schema
* event detail structure
* source/confidence rules
* media slot rules
* constellation marker behavior
* practical planning structure
* AI-agent population workflow

## State Atlas Required Layers

### 1. State Identity Layer

The State Identity Layer defines the base identity, sources, and presentation inputs for a state atlas.

Fields:

* state name
* state slug
* state abbreviation
* state regions
* state cultural themes
* state map assets
* state color/atmosphere tokens
* state tourism/official source references

### 2. State Map Layer

Purpose:
The state map is the emotional entry into the state.

Rules:

* real coordinates remain the source of truth
* illustrated map projection is only a presentation layer
* markers may be stylized as stars/constellations
* do not show every event at once when event counts grow
* support clustering, filtering, and zoom/reveal behavior

### 3. Discovery Layer

Purpose:
Help people explore without knowing what to search for.

Sections:

* Featured by the Atlas
* Browse by Category
* Browse by Region
* Seasonal Discoveries
* This Weekend
* Near Me
* Hidden Gems
* Recently Added
* Family Friendly
* Free Events
* Indoor Events
* Trails and Constellations

### 4. Event Index Layer

Purpose:
Scale to thousands of events per state.

Requirements:

* search
* filters
* categories
* regions
* counties
* cities
* dates
* seasons
* event types
* tags
* map/list toggle
* source status
* confidence score
* coverage level

### 5. Curiosity Layer

Purpose:
Expose what makes the state culturally interesting.

Examples:

* oldest festivals
* famous parades
* food traditions
* county fair circuits
* queen pageants
* fireworks trails
* harvest routes
* haunted towns
* winter lights
* lost festivals
* strange local traditions
* state firsts
* historic artifacts

### 6. Constellation Layer

Purpose:
Turn event dots into meaningful discovery patterns.

Definitions:

* star = event
* bright star = flagship event
* pulsing star = timely/current event
* constellation = themed trail
* starfield = dense region or season
* dim star = ordinary discovery
* connected stars = curated or AI-detected relationship

Example constellations:

* County Fair Trail
* Great Lakes Fireworks
* Harvest & Apple Path
* Winter Lights
* Haunted Michigan
* Summer Music Arc
* Waterfront Celebrations
* Historic Parades

### 7. AI-Agent Population Layer

Purpose:
Allow agents to grow each state over time.

Agents:

* event discovery agent
* schedule extraction agent
* source verification agent
* media classification agent
* map/geocoding agent
* curiosity/history agent
* quality/confidence agent
* seasonal/trail agent

## Map Truth vs Map Presentation

Real coordinates are the source of truth.

The artsy map is a presentation projection.

The real map layer is a practical projection.

The event grounds map is a local projection.

The future 3D/world map is an immersive projection.

The same event coordinates should support:

* illustrated state map
* real map
* event grounds map
* 3D/world map
* AI routing
* field scout GPS points

Do not treat manually placed x/y artwork positions as source-of-truth geography. Artwork positions may help make a map feel beautiful, magical, or legible, but they must remain presentation data derived from or associated with real coordinates.

## Responsive State Atlas Behavior

### Phone Portrait

* emotional map entry
* discovery sections scroll below map
* compact search
* map does not trap page
* category/region/season browsing visible

### Phone Landscape

* functional fallback
* map does not consume entire viewport
* discovery/list access remains usable
* vertical scroll allowed

### Tablet

* map and discovery can sit side by side or stacked
* richer filters
* larger event previews

### Desktop

* state atlas console
* map plus discovery/list/filter panels
* optional AI guide
* not a stretched phone app

## State Atlas Coverage Levels

### Level 1 — Basic State Atlas

* state map
* basic event markers
* search
* category browsing

### Level 2 — Practical State Atlas

* dates
* schedules
* regions
* county/city filters
* plan information

### Level 3 — Curiosity State Atlas

* origins
* trails
* artifacts
* traditions
* historic moments

### Level 4 — Living State Atlas

* field scout data
* current-year photos
* live updates
* happening now
* vendor/food/parking data

### Level 5 — World-Built State Atlas

* constellation trails
* 3D state/world views
* AR artifacts
* generated media
* immersive map layers

## First Implementation Priorities

1. Treat Michigan as the canonical state template.
2. Keep the current artsy Michigan map as a presentation layer.
3. Preserve real coordinates in EventProfile.
4. Build discovery below the map, not inside the map.
5. Add structured timing and season data before seasonal UI.
6. Add source/confidence metadata before AI answers become authoritative.
7. Add map-presentation architecture before replacing the current map.
8. Eventually create reusable StateAtlasShell, StateMapStage, StateDiscoverySections, StateEventIndex, and StateConstellationLayer components.

## Final Direction

The scalable Celebration Atlas is:

Country Atlas → State Atlas → Region → Event Page → Moment / Artifact / Memory

The country creates wonder.
The state creates discovery.
The region creates local usefulness.
The event page creates deep experience.
The moment/artifact layer creates memory and collection.

Michigan is the first complete state atlas.
Every future state should inherit the same architecture.

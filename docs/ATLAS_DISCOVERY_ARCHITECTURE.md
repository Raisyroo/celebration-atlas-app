# Celebration Atlas Discovery Architecture

## Purpose

Celebration Atlas needs a scalable discovery system that can eventually cover the entire United States.

The home experience should not be only a decorative map or a handcrafted collection of featured events.

It should become a layered Atlas discovery system:

1. National discovery
2. State discovery
3. Regional / county / city discovery
4. Event discovery
5. Curiosity, media, and collection layers

Michigan is the first state prototype, but the system must eventually work the same way for every state.

The only major state-specific visual differences should be:

* the state map
* the state background atmosphere
* featured state identity
* state-specific event data and media

The structure should remain reusable.

## Core Principle

The map is the front door, not the entire discovery system.

At national scale, users should not be forced to browse thousands of pins manually.

The system should guide exploration through layers:

1. U.S. Atlas map
2. State Atlas maps
3. Featured discoveries
4. Seasonal paths
5. Regional browsing
6. Search and filters
7. Event index/list
8. AI guide
9. Saved and personalized discovery in the future

## National Layer

Purpose:
Let users enter the Celebration Atlas from the entire United States.

The national layer should support:

* beautiful U.S. map
* state selection
* national event search
* featured states
* seasonal national trails
* major celebration categories
* “near me” discovery
* national event index
* AI guide questions across states

Examples:

* What festivals are near me this weekend?
* What are the best county fairs in the Midwest?
* Show me fireworks events in July.
* What are the best fall festivals in the U.S.?
* What state has interesting small-town celebrations?

The national map should create wonder, but it should not show every event pin at once.

## State Layer

Purpose:
Each state gets its own Atlas experience.

Each state should use the same structure, but with state-specific visual identity.

State-specific elements:

* state map
* state background image or atmosphere
* state regions
* state event categories
* state seasonal trails
* state featured events
* state curiosity trails
* state event index

Example:
Michigan is the first State Atlas.

Future states should follow the same model:

* Ohio Atlas
* Pennsylvania Atlas
* Wisconsin Atlas
* Tennessee Atlas
* Texas Atlas
* California Atlas

The system should not require custom code for every state.

## Regional / County / City Layer

Purpose:
Let users explore events geographically without needing to know exact event names.

Supported geography:

* state regions
* counties
* cities
* tourism regions
* shoreline regions
* metro areas
* rural areas
* “near me” radius

Examples:

* Blue Water Area
* Detroit Metro
* Thumb region
* West Michigan
* Upper Peninsula
* county-level fair discovery
* city-level festival discovery

## Event Layer

Purpose:
Once a user selects an event, they enter the reusable Event Experience Architecture.

Every event should use the same basic structure:

* Highlights
* Schedule
* Maps
* Gallery
* Plan
* Ask Anything
* curiosity layer
* media slots
* source-backed intelligence

Not every event needs rich media at first.

The system must support basic event pages for fast national coverage, then allow selected events to grow into richer Atlas experiences over time.

## Home Page Layers

### 1. National Atlas Map Layer

Purpose:
Create the emotional sense of entering the Celebration Atlas.

Should support:

* U.S. map
* state highlights
* featured state markers
* seasonal overlays
* national trails
* search entry
* current location if allowed
* state selection
* map/list toggle

Important:
Do not show every event in the country at once.

### 2. State Atlas Map Layer

Purpose:
Create the emotional sense of entering a specific state’s celebration world.

Should support:

* state map
* state regions
* featured event markers
* event clustering
* seasonal overlays
* zoom-based reveal
* current location if allowed
* map/list toggle

Important:
Do not show every event pin at once when a state contains thousands of events.

### 3. Discovery Layer

Purpose:
Help people find events without already knowing what they want.

Discovery paths:

* This Weekend
* Near Me
* Featured by the Atlas
* County Fairs
* Fireworks
* Fall Festivals
* Food Festivals
* Art Fairs
* Music Festivals
* Historic Celebrations
* Holiday Events
* Haunted Events
* Small-Town Parades
* Hidden Gems
* Recently Added
* Family Friendly
* Free Events
* Indoor Events
* Outdoor Events
* Road Trip Worthy
* State Traditions
* Nationally Known Events
* Local Favorites

### 4. Event Index Layer

Purpose:
Scale to thousands or eventually hundreds of thousands of events.

Required:

* search
* filters
* date range
* state
* region
* county
* city
* event type
* season
* distance
* free/paid
* family friendly
* indoor/outdoor
* official source status
* saved/favorite events
* map/list toggle

### 5. Seasonal Layer

Purpose:
Let users explore by time and mood.

Seasons:

* spring openings
* summer fairs and festivals
* Independence Day / fireworks
* Labor Day traditions
* fall harvest and haunted events
* holiday lights and winter festivals

### 6. Curiosity Layer

Purpose:
Expose interesting celebration culture across the country.

Examples:

* oldest festivals
* largest parades
* best fireworks
* strange traditions
* queen pageants
* turtle races
* balloon glows
* fair food trails
* lost festivals
* state firsts
* national firsts
* historic artifacts
* unique local rituals

### 7. AI Guide Layer

Purpose:
Allow users to ask broad discovery questions.

Examples:

* What festivals are near me this weekend?
* What are the best small-town events in September?
* Where can I see fireworks?
* What county fairs have animal shows?
* What events are good for kids?
* What should I attend within 50 miles?
* What celebrations have interesting history?
* What are the best events in Michigan this month?
* What are the best events in Ohio next weekend?
* Show me a weekend trip built around festivals.

## Responsive Behavior

### Phone Portrait

* map is atmospheric entry point
* discovery sections scroll below or over the map
* search should be easy to reach
* map should not trap the page
* bottom controls should not block discovery

### Phone Landscape

* page must remain usable
* map should not consume the entire viewport
* allow vertical scroll
* collapse decorative elements
* prioritize search/list/discovery controls

### Tablet

* map and discovery panels can sit side by side
* richer filters
* event list visible with map
* state map can remain atmospheric without blocking usability

### Desktop

* full Atlas console
* U.S. or state map on one side
* discovery/search/list on the other
* persistent filters
* AI guide panel optional
* map/list/grid modes available

## Scaling Rules

When event count is small:

* show featured markers
* show featured event cards
* allow simple browsing

When event count grows:

* use clustering
* use region grouping
* use zoom-based reveal
* prioritize search and filters
* avoid showing all pins at once

When event count reaches thousands per state:

* map becomes one discovery mode
* list/search/filter becomes primary for precision
* AI guide helps users narrow choices
* curated trails help exploration

When event count reaches national scale:

* U.S. map should lead to state and regional discovery
* national search should query across all states
* state pages should own local browsing
* event pages should stay reusable
* media/world-building should be progressive enhancement, not required for coverage

## Data Requirements

Each event needs fields for discovery:

* event id
* name
* slug
* location
* coordinates
* city
* county
* state
* state slug
* region
* date start
* date end
* recurring pattern
* event type
* categories
* season
* tags
* family friendly
* indoor/outdoor
* free/paid
* source status
* confidence score
* hero media
* featured status
* hidden gem status
* official website
* schedule status
* last verified date

Each state needs fields for state-level discovery:

* state name
* state abbreviation
* state slug
* state map asset
* state background asset
* state regions
* featured categories
* seasonal trails
* featured events
* state description
* state atmosphere description

## Discovery Components

Future reusable components:

* NationalAtlasHome
* UnitedStatesMapStage
* StateAtlasHome
* StateMapStage
* EventMarkerLayer
* EventClusterLayer
* DiscoveryRail
* SeasonalDiscoverySection
* RegionalDiscoverySection
* EventSearch
* EventFilterPanel
* EventResultList
* FeaturedEventStrip
* CuriosityTrailStrip
* AtlasGuideDock
* MapListToggle
* StateSelector
* RegionSelector

## Event Coverage Levels

### Level 1 — Basic National Coverage

Goal:
Populate the country quickly.

Required:

* event name
* city
* state
* date or estimated recurrence
* event type
* coordinates or approximate location
* official website or source
* short description
* confidence score

No fancy media required.

### Level 2 — State Discovery Coverage

Adds:

* categories
* region
* season
* tags
* featured status
* schedule status
* basic map marker
* state-level browsing support

### Level 3 — Practical Event Page

Adds:

* schedule
* parking
* tickets
* map points
* plan tips
* major highlights

### Level 4 — Atlas Experience Page

Adds:

* hero media
* richer Highlights
* Gallery portals
* curiosity items
* source-backed Ask Anything
* event-specific atmosphere

### Level 5 — Living Celebration / World-Built Event

Adds:

* field scout data
* live updates
* vendor photos
* food boards
* current-year media
* happening now
* interactive map
* user memories
* 3D maps
* route animation
* AR artifacts
* generated video scenes
* collectible artifacts

## First Implementation Priorities

1. Keep Michigan as the first state prototype.
2. Diagnose current homepage/map scroll behavior.
3. Make the homepage usable in phone landscape.
4. Make the homepage vertically scrollable where needed.
5. Define national/state discovery data structure.
6. Add state-level abstraction without redesigning the whole app.
7. Add map/list discovery structure.
8. Add scalable event filtering.
9. Add region and season browsing.
10. Add AI-guide discovery later.

## Final Direction

Celebration Atlas should feel magical, but it must also scale.

The U.S. map creates national wonder.

The state maps create local identity.

The discovery system creates usability.

The event index creates scale.

The AI guide creates intelligence.

The media and world-building layers create depth over time.

The system should be able to populate the entire country quickly with basic event data, then progressively enhance selected events with richer media, stories, artifacts, maps, and immersive experiences.

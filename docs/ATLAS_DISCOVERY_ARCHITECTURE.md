# Celebration Atlas Discovery Architecture

## Purpose

The Celebration Atlas home page must become an Atlas discovery system, not just a decorative Michigan map.

The home page should welcome people into the feeling of Michigan's celebration world while also helping them find real events at statewide scale. It must support:

* emotional entry into the Atlas
* statewide event discovery
* thousands of events
* search
* filters
* categories
* regions
* seasonal exploration
* map/list switching
* future AI-agent population

This architecture defines how the home page, Michigan map, event search, event categories, regions, filters, seasonal discovery, and large-scale event browsing should work together.

## Core Principle

The Michigan map is the front door, not the entire discovery system.

The user should not be forced to browse thousands of pins manually.

The system should guide exploration through layers:

1. Map atmosphere
2. Featured discoveries
3. Seasonal paths
4. Regional browsing
5. Search and filters
6. Event index/list
7. Personalized/saved events in the future

The map creates wonder and geographic orientation. Discovery sections create invitations. Search, filters, and index views create precision. Future AI guidance should help users narrow the Atlas without requiring them to understand the full data structure.

## Home Page Layers

### 1. Atlas Map Layer

Purpose:
Create the emotional sense of entering Michigan's celebration world.

Should support:

* Michigan map
* subtle atmospheric motion
* featured markers
* region highlights
* seasonal overlays
* event clustering
* zoom-based reveal
* current location if allowed
* map/list toggle

Important:
Do not show every event pin at once when the database contains thousands of events.

The map should behave like an atmospheric gateway and geographic discovery surface. It should reveal increasing detail as the user zooms, changes region, selects a season, or asks for a narrower category. When the event database grows, clustering and curated marker selection should protect the interface from becoming visually noisy.

### 2. Discovery Layer

Purpose:
Help people find events without needing to know what they are searching for.

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
* Haunted Michigan
* Small-Town Parades
* Hidden Gems
* Recently Added
* Family Friendly
* Free Events
* Rainy Day / Indoor Events

Discovery paths should be presented as clear invitations into the Atlas. They may appear as rails, cards, chips, panels, or seasonal sections, but they should remain easy to scan and should not require the user to manipulate the map before discovering meaningful options.

### 3. Event Index Layer

Purpose:
Scale to thousands of events.

Required:

* search
* filters
* date range
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

The Event Index Layer is the precision layer of the Atlas. It should let users move from broad curiosity to specific plans. It must remain usable when the Atlas contains hundreds, thousands, and eventually tens of thousands of celebrations.

### 4. Regional Layer

Purpose:
Let users explore Michigan by geography.

Regions:

* Southeast Michigan
* Detroit Metro
* Thumb / Blue Water Area
* Mid-Michigan
* West Michigan
* Northern Lower Peninsula
* Upper Peninsula
* Great Lakes Shoreline
* County-level browsing

Regional browsing should support both emotional and practical exploration. A user may enter through a familiar region, a travel destination, a shoreline route, a county fair circuit, or a small-town discovery path.

### 5. Seasonal Layer

Purpose:
Let users explore by time and mood.

Seasons:

* Spring openings
* Summer fairs and festivals
* Labor Day traditions
* Fall harvest and haunted events
* Holiday lights and winter festivals

Seasonal discovery should help users understand what Michigan is celebrating now, what is coming soon, and what traditions define each part of the year. Seasonal views may combine date filtering, editorial curation, map overlays, and featured trails.

### 6. Curiosity Layer

Purpose:
Expose interesting facts and celebration culture from across the state.

Examples:

* Oldest festivals
* Largest parades
* Best fireworks
* Strange traditions
* Queen pageants
* Turtle races
* Balloon glows
* Fair food trails
* Lost festivals
* Michigan firsts
* Historic artifacts

The Curiosity Layer should make the Atlas feel alive even when a user is not ready to choose an event. It can connect events through shared traditions, unusual stories, historical artifacts, local rituals, and statewide celebration patterns.

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

The AI Guide Layer should eventually act as a conversational path into the same discovery system. It should use structured event data, filters, regions, source confidence, and saved preferences rather than inventing unsupported recommendations.

## Responsive Behavior

### Phone Portrait

* map is atmospheric entry point
* discovery sections scroll below or over the map
* search should be easy to reach
* map should not trap the page
* bottom controls should not block discovery

Phone portrait should prioritize fast orientation and simple exploration. The map can create the opening emotional impression, but the page must still allow users to reach search, discovery paths, and event lists without friction.

### Phone Landscape

* page must remain usable
* map should not consume the entire viewport
* allow vertical scroll
* collapse decorative elements
* prioritize search/list/discovery controls

Phone landscape is a critical usability constraint. Decorative atmosphere should yield to functional controls, readable lists, and scrollable content.

### Tablet

* map and discovery panels can sit side by side
* richer filters
* event list visible with map

Tablet layouts can support a hybrid browsing mode where users keep geographic context while scanning results and refining filters.

### Desktop

* full Atlas console
* map on one side
* discovery/search/list on the other
* persistent filters
* AI guide panel optional

Desktop should support the richest Atlas experience: persistent map context, discovery rails, search, filters, list results, saved events, and optional AI guidance.

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

When event count reaches thousands:

* map becomes one discovery mode
* list/search/filter becomes primary for precision
* AI guide helps users narrow choices
* curated trails help exploration

Scaling should be planned from the beginning. The interface should not depend on a small, manually curated event set. Every discovery surface should assume the Atlas will grow and should preserve both atmosphere and usability as density increases.

## Data Requirements

Each event needs fields for discovery:

* event id
* name
* slug
* location
* coordinates
* city
* county
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

These fields should be structured so that map markers, index results, AI recommendations, seasonal pages, region pages, and event pages can all draw from the same source-backed event model.

## Discovery Components

Future reusable components:

* AtlasHomeShell
* MichiganMapStage
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

These components should be designed as a reusable discovery system rather than one-off home page decorations. They should support progressive enhancement as the Atlas gains more events, richer filters, better media, and AI-assisted exploration.

## First Implementation Priorities

1. Diagnose current homepage/map scroll behavior.
2. Make home page usable in phone landscape.
3. Make the home page vertically scrollable where needed.
4. Add map/list discovery structure.
5. Add scalable event filtering.
6. Add region and season browsing.
7. Add AI-guide discovery later.

Implementation should protect the emotional map experience while correcting usability issues first. Discovery structure and filtering should come before advanced AI guidance.

## Final Direction

The Celebration Atlas home page should feel magical, but it must also scale.

The Michigan map creates wonder.

The discovery system creates usability.

The event index creates scale.

The AI guide creates intelligence.

Together, they let users explore thousands of celebrations without being overwhelmed.

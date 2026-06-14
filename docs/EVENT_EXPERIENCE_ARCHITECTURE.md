# Celebration Atlas Event Experience Architecture

## Purpose

Celebration Atlas is not simply an event calendar, tourism directory, or poster collection.

It is a living atlas of how communities gather, remember, perform, compete, decorate, eat, parade, and celebrate.

Every event page should help people do two things:

1. **Attend the event**
   Find the schedule, map, parking, tickets, rules, food, vendors, and practical details.

2. **Become curious about the event**
   Discover origins, traditions, rituals, artifacts, old photos, local memories, legends, hidden details, and cultural meaning.

The goal is to build a reusable event experience system that works for all events, across phones, tablets, desktops, and future AI-generated media tools.

The system must not depend on manually building a custom page, video, 3D world, or image set for every event.

Instead, each event should enter a shared Celebration Atlas structure. AI agents, data pipelines, human scouts, media tools, and future world-building systems can then populate that structure over time.

---

# Core Principle

## Structure First. Media Second.

New image, video, 3D, AR, and world-building tools will keep changing.

Celebration Atlas should not chase every tool manually.

The scalable product is the event structure:

* what information every event needs
* how that information is organized
* how curiosity is revealed
* how media slots are used
* how the page adapts to device size
* how AI agents can populate and improve the experience over time

Romeo Peach Festival should become the prototype for the reusable event system, not a one-off page.

---

# Universal Event Experience Layers

Every Celebration Atlas event should be organized into six major layers.

## 1. Event Identity Layer

This answers:

What is this celebration?

Required fields:

* Event name
* Location
* City / region
* State
* Event type
* Season
* Date range
* Recurring pattern
* Official website
* Official social links
* Organizer / host
* Short description
* Long description
* Hero image or fallback atmosphere

Optional fields:

* Anniversary year
* Founding year
* Historical names
* Alternate names
* Local nickname
* Festival slogan
* Community identity tags

Purpose:

The Identity Layer gives the event a clear place in the Atlas. It should be stable, searchable, source-backed, and reusable everywhere.

---

## 2. Event Experience Layer

This answers:

Why would someone want to go?

This layer captures the human experience of the celebration.

Examples:

* Parade
* Carnival midway
* Fireworks
* Queen pageant
* Food traditions
* Music
* Vendors
* Animal shows
* Competitions
* Rides
* Kids activities
* Main stage
* Craft show
* Car show
* Petting zoo
* Beer tent
* Cultural performances
* Community rituals
* Signature moments

Each experience item should have:

* title
* short description
* category
* importance level
* schedule connection if available
* map connection if available
* media connection if available
* source connection if available

Purpose:

The Experience Layer makes the event feel worth attending.

It should be written for real people, not like a database listing.

---

## 3. Practical Attendance Layer

This answers:

How do I actually attend?

This layer should be immediately useful.

Sections:

* Schedule
* Tickets
* Parking
* Entrances
* Maps
* Restrooms
* Accessibility
* Rules
* Weather considerations
* Best arrival time
* Family tips
* Food and drink
* Vendor areas
* Ride areas
* Seating
* What to bring
* What not to bring
* Official alerts
* “Happening Now”
* “Next Up”

The Schedule page should prioritize usefulness, not completeness.

If a current schedule exists:

* show today first
* show happening now
* show next up
* group by day
* highlight major moments

If no current schedule exists:

* show known dates
* show “daily schedule not yet released”
* optionally show last year’s pattern only if clearly labeled

Purpose:

The Practical Layer helps people attend confidently.

It should never be buried under decorative content.

---

## 4. Curiosity Layer

This answers:

Why is this event interesting?

This is where Celebration Atlas becomes different from a normal event site.

Curiosity content includes:

* origins
* local legends
* traditions
* artifacts
* old photos
* newspaper clippings
* oral histories
* strange facts
* queen history
* parade history
* food history
* mascot history
* community memory
* lost traditions
* “did you know?” moments
* timeline moments
* family stories
* hidden symbols
* founder stories
* historical turning points

Curiosity content should not overwhelm the practical event page.

It should be revealed through portals, trails, collectible artifacts, and Ask Anything.

Purpose:

The Curiosity Layer creates exploration, memory, and emotional attachment.

This is the layer that makes people linger, collect, share, and return.

---

## 5. Media and World Layer

This answers:

How does the Atlas make the event feel alive?

Media should be optional but structured.

Supported media slots:

* hero image
* intro video
* atmosphere loop
* poster artwork
* gallery image
* historical image
* artifact image
* source document
* map image
* short video
* 3D scene
* route animation
* AR object
* audio memory
* interview clip
* field scout photo
* vendor photo
* food photo
* entrance photo
* price board photo
* panoramic view

Each media item should include:

* media type
* event id
* section placement
* source
* rights / permission status
* caption
* alt text
* date
* location if known
* GPS if available
* crop preference
* aspect ratio
* device priority
* fallback behavior

Purpose:

Media should plug into the Atlas system rather than forcing custom layouts for every event.

Future tools should be able to generate or update media without changing the event-page architecture.

---

## 6. Collection Layer

This answers:

Why would someone come back?

Celebration Atlas should eventually support collection and memory.

Possible collection mechanics:

* save event
* attended event
* collect artifact
* unlock origin story
* collect local memory
* favorite photo
* festival passport
* county trail
* seasonal trail
* food trail
* fair trail
* fireworks trail
* queen history trail
* “I was there” memory
* family event scrapbook

Purpose:

The Collection Layer turns browsing into participation.

It should make the Atlas feel like something people build with over time.

---

# Standard Event Navigation

The reusable event page should use five primary navigation areas.

## Future Event Intelligence Cards

Future event cards should support richer AI-built event intelligence while remaining source-backed, compact, and safe to show from map commands. Cards are previews and decision aids, not unsourced promotional posters.

A rich event intelligence card may include:

* hero image or video
* event name
* location
* dates
* hours
* origin year
* average attendance when source-backed
* concise description
* why it matters
* source confidence
* open full event action
* live/current status only when verified for the relevant date window

AI may assemble or summarize card content only from structured event data, source records, verified timing, and reviewed media metadata. If a field is unknown, stale, or only inferred, the card should omit it or label the uncertainty instead of implying completeness.

## Highlights

Purpose:

Show the emotional and experiential reason to care.

Content:

* event title
* short atmospheric description
* top traditions
* signature moments
* current-year emphasis
* hero media if available

Highlights should not become a cluttered information dump.

It should feel like the front door to the celebration.

---

## Schedule

Purpose:

Help people know what is happening and when.

Content priority:

1. Happening Now
2. Next Up
3. Today
4. Major upcoming moments
5. Full schedule
6. Past schedule or expected schedule only when clearly labeled

Schedule should use the fewest possible cards.

Typography, spacing, and hierarchy should do most of the work.

---

## Maps

Purpose:

Help people understand where things are.

Map content:

* event grounds
* entrances
* parking
* parade routes
* stages
* vendors
* food areas
* rides
* restrooms
* first aid
* accessibility routes
* historical map overlays
* field scout GPS points

Future map modes:

* practical map
* atmosphere map
* historical map
* 3D world view
* route animation
* field scout layer

---

## Gallery

Purpose:

Reveal the event’s memory, artifacts, and deeper curiosity.

Top-level gallery portals:

* Origin Portal
* Memory Portal
* Legend Portal
* Artifact Portal

Portal behavior:

* each portal contains trails
* each trail contains moments
* each moment can include image, video, artifact, caption, source, and Ask Anything expansion

Gallery should feel discoverable, not like a normal photo grid.

---

## Plan

Purpose:

Prepare someone to attend.

Content:

* best day to go
* best time to arrive
* parking tips
* family tips
* food tips
* cost expectations
* what to bring
* accessibility notes
* weather notes
* local businesses nearby
* official links

Plan should be practical and simple.

---

# Ask Anything Layer

Ask Anything is the intelligence layer.

It should not compete with the main page.

It should answer deeper questions such as:

* When does the parade start?
* Where should I park?
* What happened in 1931?
* Who was the first Peach Queen?
* What food is this event known for?
* Is this good for kids?
* What did last year’s schedule look like?
* Where are the vendors?
* What is the story behind this tradition?

Ask Anything should be powered by:

* structured event data
* source documents
* official websites
* PDFs
* historical records
* field scout data
* user-submitted memories
* media captions
* map points

Ask Anything is where long-tail information belongs.

The visible event page should stay clean.

---

# Responsive Experience Model

Celebration Atlas must work across phones, tablets, desktops, and orientation changes.

The system should define device modes.

## Phone Portrait

Primary experience.

Design goal:

Immersive Atlas window.

Behavior:

* vertical cinematic page
* bottom navigation
* Ask Anything dock
* scroll inside event content window
* media optimized for portrait
* one major idea per screen
* minimal clutter

Phone portrait is the emotional prototype.

---

## Phone Landscape

Functional fallback first. Beautiful second.

Design goal:

Never become unusable.

Behavior:

* do not force the same portrait composition
* reduce fixed vertical assumptions
* use a compact layout
* allow content to scroll
* keep nav reachable
* avoid elements overlapping browser UI
* optionally show a simplified landscape mode

Possible landscape layout:

* event media/background on one side
* content panel on the other side
* compact nav row
* Ask Anything minimized

If a full immersive landscape design is not ready, the site should use a safe fallback layout.

---

## Tablet

Design goal:

Expanded field guide.

Behavior:

* larger event window
* more breathing room
* media and content can sit side by side
* portals can become larger cards
* schedule can show more at once
* map can be more useful
* Ask Anything can remain docked or become a side panel

---

## Desktop

Design goal:

Atlas archive / museum console.

Behavior:

* background atmosphere remains
* event content becomes a larger readable panel
* media can occupy a dedicated stage
* schedule, map, and gallery can use multi-column layouts
* Ask Anything can become a persistent guide panel
* portals can open into richer archive views

Desktop should not feel like a stretched phone app.

It should feel like opening the Celebration Atlas.

---

# Event Data Structure

Every event should eventually be stored in a structured profile.

## Core Event Profile

Fields:

* id
* slug
* name
* shortName
* eventType
* city
* region
* state
* coordinates
* venueName
* dateStart
* dateEnd
* recurrence
* officialWebsite
* officialSocialLinks
* organizer
* descriptionShort
* descriptionLong
* foundingYear
* anniversaryLabel
* status
* confidenceScore
* sourceIds

---

## Experience Items

Fields:

* id
* eventId
* title
* description
* category
* importance
* audience
* scheduleIds
* mapPointIds
* mediaIds
* sourceIds

Examples:

* Peach Parade
* Peach Queen Tradition
* Midway and Carnival
* Fireworks
* 4-H Poultry Barn
* Turtle Race
* Balloon Glow

---

## Schedule Items

Fields:

* id
* eventId
* title
* description
* startTime
* endTime
* dayLabel
* locationName
* mapPointId
* category
* isFeatured
* isOfficial
* sourceId
* confidenceScore

---

## Map Points

Fields:

* id
* eventId
* title
* description
* category
* latitude
* longitude
* approximateLocation
* source
* mediaIds
* scheduleIds

Categories:

* entrance
* parking
* restroom
* stage
* food
* vendor
* ride
* parade route
* first aid
* attraction
* historical point

---

## Curiosity Items

Fields:

* id
* eventId
* title
* shortText
* longText
* curiosityType
* year
* people
* place
* sourceIds
* mediaIds
* relatedItems
* confidenceScore

Curiosity types:

* origin
* legend
* memory
* artifact
* tradition
* local fact
* historic moment
* visual detail
* oral history

---

## Media Items

Fields:

* id
* eventId
* mediaType
* title
* caption
* fileUrl
* sourceUrl
* thumbnailUrl
* aspectRatio
* dateCaptured
* dateRepresented
* location
* rightsStatus
* credit
* altText
* placement
* devicePriority
* cropFocus
* sourceIds

Media types:

* image
* video
* audio
* poster
* document
* map
* 3D scene
* AR object

---

## Source Records

Fields:

* id
* eventId
* sourceType
* title
* url
* publisher
* datePublished
* dateAccessed
* filePath
* extractedText
* confidenceScore
* notes

Source types:

* official website
* official PDF
* Facebook page
* Instagram post
* local news
* historical archive
* user-submitted memory
* field scout capture
* organizer interview

---

# AI Agent Population Model

AI agents should eventually populate and maintain the event profile.

## Discovery Agent

Finds events and official sources.

Tasks:

* discover event websites
* identify dates
* identify location
* identify organizer
* gather official links
* create/update event profile

---

## Schedule Agent

Extracts schedules from websites, PDFs, images, and posts.

Tasks:

* parse event schedule
* normalize times
* group by day
* identify featured events
* link schedule items to map points
* flag outdated schedules

---

## Curiosity Agent

Finds interesting facts and historical material.

Tasks:

* detect origins
* identify traditions
* extract historical moments
* create curiosity items
* connect artifacts to timelines
* generate short and long summaries

---

## Media Agent

Processes media into usable slots.

Tasks:

* classify images and videos
* create captions
* generate alt text
* identify aspect ratio
* suggest placement
* create thumbnails
* flag rights issues
* recommend missing media

---

## Map Agent

Creates practical and atmospheric map layers.

Tasks:

* identify venues
* create map points
* detect entrances and parking
* process GPS scout photos
* create parade routes
* prepare future 3D map inputs

---

## Quality Agent

Checks for accuracy, duplication, and outdated data.

Tasks:

* verify official sources
* flag conflicts
* detect stale schedules
* check broken links
* assign confidence scores
* prevent hallucinated event details

---

# Required vs Enhanced Event Levels

Not every event needs the full Atlas treatment immediately.

## Level 1 — Basic Atlas Listing

Minimum:

* name
* location
* dates
* short description
* official link
* event type
* basic map point

Use for early statewide coverage.

---

## Level 2 — Practical Event Page

Adds:

* schedule
* parking
* tickets
* map
* plan tips
* major highlights

Use for events people may attend soon.

---

## Level 3 — Atlas Experience Page

Adds:

* hero media
* richer Highlights
* Gallery portals
* curiosity items
* source-backed Ask Anything
* event-specific atmosphere

Use for priority events.

---

## Level 4 — Living Celebration Page

Adds:

* field scout data
* live updates
* vendor photos
* food boards
* current-year media
* happening now
* interactive map
* user memories

Use for active partner events.

---

## Level 5 — World-Built Event

Adds:

* 3D map
* route animation
* AR artifacts
* generated video scenes
* immersive trails
* collectible artifacts
* historical overlays

Use for flagship events.

---

# Design Rules

## General

* The page itself is the canvas.
* Avoid unnecessary cards.
* Use typography, spacing, dividers, imagery, and atmosphere.
* Cards should only isolate truly important information.
* Do not clutter the visible page with long explanations.
* Let Ask Anything handle deeper questions.
* Always preserve practical usefulness.

---

## Typography

* Titles should feel premium, readable, and calm.
* Section labels should be small, spaced, and ceremonial.
* Avoid giant headings that overpower the window.
* Use consistent title scale across tabs.
* Important practical information should be readable in daylight.

---

## Media

* Media should support the event experience, not dominate it.
* Portrait media for phone portrait.
* Square or flexible media when the window shape requires safer cropping.
* Always provide fallback behavior.
* Avoid layouts that depend on one exact media crop.
* Do not make future event pages dependent on custom manual video edits.

---

## Motion

* Motion should feel atmospheric and meaningful.
* Avoid busy animation.
* Intro videos should not block practical use.
* Video transitions should not create duplicate image flashes.
* Only one major motion layer should be active at a time.
* Respect reduced-motion settings.

---

## Curiosity

* Curiosity should be discoverable.
* Do not dump history on the main page.
* Use portals, trails, and artifacts.
* Short visible text, deeper expandable intelligence.
* Every curiosity item should eventually connect to a source.

---

# Engineering Rules

## Event pages must avoid one-off hardcoding

Romeo-specific code is acceptable during prototype development, but the goal is to migrate toward reusable components and data-driven rendering.

Reusable components should include:

* EventShell
* EventHero
* EventHighlights
* EventSchedule
* EventMap
* EventGalleryPortals
* EventPlan
* AskAnythingDock
* MediaSlot
* CuriosityTrail
* ArtifactCard
* ResponsiveEventLayout

---

## Layout must be responsive by design

Do not assume:

* phone portrait only
* fixed 9:16 viewport
* one browser UI height
* one image aspect ratio
* one video aspect ratio
* one device width
* one orientation

Every page must have safe behavior for:

* phone portrait
* phone landscape
* tablet
* desktop

---

## Scroll behavior must be intentional

Define the scroll container clearly.

Avoid accidental body scroll unless intended.

For immersive event pages:

* outer shell may be fixed
* inner event content may scroll
* bottom controls stay reachable
* landscape and desktop may use different scroll models

Do not use global overflow changes without checking all device modes.

---

## Media slots must be flexible

Each media slot should define:

* preferred aspect ratio
* allowed fallback aspect ratios
* crop behavior
* focal point
* mobile behavior
* tablet behavior
* desktop behavior
* fallback media

Do not force every event to use the same hero video shape.

---

# Romeo Prototype Lessons

Romeo Peach Festival has revealed important reusable lessons:

1. Fixed phone portrait experiences are emotionally powerful but fragile.
2. Window height, bottom controls, browser UI, and orientation must be handled systematically.
3. Video crops cannot be manually fought forever.
4. Square media may be safer for certain window layouts.
5. Fade masks should be opacity-based, not fake dark shadows.
6. Content should be separated from presentation.
7. Schedule and Highlights should share a consistent title scale.
8. Ask Anything should hold deeper information.
9. Gallery should use portals, not generic photo grids.
10. The system needs a formal architecture before scaling to many events.

---

# Next Build Priorities

## Priority 1 — Stabilize the responsive event shell

Create a reusable event shell that supports:

* phone portrait
* phone landscape fallback
* tablet
* desktop

Do this before adding many more event-specific visual experiments.

---

## Priority 2 — Define the event data schema

Create a data structure that can support:

* identity
* highlights
* schedule
* map
* gallery
* plan
* curiosity
* media
* sources

---

## Priority 3 — Convert Romeo into a reusable template

Keep Romeo as the flagship prototype, but begin separating:

* Romeo data
* Romeo media
* reusable event layout
* reusable portal system
* reusable schedule system
* reusable media slots

---

## Priority 4 — Build AI-agent-ready source structure

Every fact, schedule item, artifact, and curiosity should eventually connect to sources and confidence scores.

---

## Priority 5 — Add progressive enhancement

Start simple for most events.

Only flagship events need full media/world-building treatment.

The structure should allow events to grow over time.

---

# Final Direction

Celebration Atlas should not try to manually build a custom world for every event.

It should build the structure that lets every event become explorable.

Some events will begin as simple listings.

Some will become practical guides.

Some will become living archives.

Some will become immersive worlds.

The same architecture should support all of them.

The long-term product is not only the website.

The long-term product is the Atlas system:

A source-backed, AI-populated, media-flexible, curiosity-driven way to present celebrations to the world.
# Celebration Atlas Event Experience Architecture

## Purpose

Celebration Atlas is not simply an event calendar, tourism directory, or poster collection.

It is a living atlas of how communities gather, remember, perform, compete, decorate, eat, parade, and celebrate.

Every event page should help people do two things:

1. **Attend the event**
   Find the schedule, map, parking, tickets, rules, food, vendors, and practical details.

2. **Become curious about the event**
   Discover origins, traditions, rituals, artifacts, old photos, local memories, legends, hidden details, and cultural meaning.

The goal is to build a reusable event experience system that works for all events, across phones, tablets, desktops, and future AI-generated media tools.

The system must not depend on manually building a custom page, video, 3D world, or image set for every event.

Instead, each event should enter a shared Celebration Atlas structure. AI agents, data pipelines, human scouts, media tools, and future world-building systems can then populate that structure over time.

---

# Core Principle

## Structure First. Media Second.

New image, video, 3D, AR, and world-building tools will keep changing.

Celebration Atlas should not chase every tool manually.

The scalable product is the event structure:

* what information every event needs
* how that information is organized
* how curiosity is revealed
* how media slots are used
* how the page adapts to device size
* how AI agents can populate and improve the experience over time

Romeo Peach Festival should become the prototype for the reusable event system, not a one-off page.

---

# Universal Event Experience Layers

Every Celebration Atlas event should be organized into six major layers.

## 1. Event Identity Layer

This answers:

What is this celebration?

Required fields:

* Event name
* Location
* City / region
* State
* Event type
* Season
* Date range
* Recurring pattern
* Official website
* Official social links
* Organizer / host
* Short description
* Long description
* Hero image or fallback atmosphere

Optional fields:

* Anniversary year
* Founding year
* Historical names
* Alternate names
* Local nickname
* Festival slogan
* Community identity tags

Purpose:

The Identity Layer gives the event a clear place in the Atlas. It should be stable, searchable, source-backed, and reusable everywhere.

---

## 2. Event Experience Layer

This answers:

Why would someone want to go?

This layer captures the human experience of the celebration.

Examples:

* Parade
* Carnival midway
* Fireworks
* Queen pageant
* Food traditions
* Music
* Vendors
* Animal shows
* Competitions
* Rides
* Kids activities
* Main stage
* Craft show
* Car show
* Petting zoo
* Beer tent
* Cultural performances
* Community rituals
* Signature moments

Each experience item should have:

* title
* short description
* category
* importance level
* schedule connection if available
* map connection if available
* media connection if available
* source connection if available

Purpose:

The Experience Layer makes the event feel worth attending.

It should be written for real people, not like a database listing.

---

## 3. Practical Attendance Layer

This answers:

How do I actually attend?

This layer should be immediately useful.

Sections:

* Schedule
* Tickets
* Parking
* Entrances
* Maps
* Restrooms
* Accessibility
* Rules
* Weather considerations
* Best arrival time
* Family tips
* Food and drink
* Vendor areas
* Ride areas
* Seating
* What to bring
* What not to bring
* Official alerts
* “Happening Now”
* “Next Up”

The Schedule page should prioritize usefulness, not completeness.

If a current schedule exists:

* show today first
* show happening now
* show next up
* group by day
* highlight major moments

If no current schedule exists:

* show known dates
* show “daily schedule not yet released”
* optionally show last year’s pattern only if clearly labeled

Purpose:

The Practical Layer helps people attend confidently.

It should never be buried under decorative content.

---

## 4. Curiosity Layer

This answers:

Why is this event interesting?

This is where Celebration Atlas becomes different from a normal event site.

Curiosity content includes:

* origins
* local legends
* traditions
* artifacts
* old photos
* newspaper clippings
* oral histories
* strange facts
* queen history
* parade history
* food history
* mascot history
* community memory
* lost traditions
* “did you know?” moments
* timeline moments
* family stories
* hidden symbols
* founder stories
* historical turning points

Curiosity content should not overwhelm the practical event page.

It should be revealed through portals, trails, collectible artifacts, and Ask Anything.

Purpose:

The Curiosity Layer creates exploration, memory, and emotional attachment.

This is the layer that makes people linger, collect, share, and return.

---

## 5. Media and World Layer

This answers:

How does the Atlas make the event feel alive?

Media should be optional but structured.

Supported media slots:

* hero image
* intro video
* atmosphere loop
* poster artwork
* gallery image
* historical image
* artifact image
* source document
* map image
* short video
* 3D scene
* route animation
* AR object
* audio memory
* interview clip
* field scout photo
* vendor photo
* food photo
* entrance photo
* price board photo
* panoramic view

Each media item should include:

* media type
* event id
* section placement
* source
* rights / permission status
* caption
* alt text
* date
* location if known
* GPS if available
* crop preference
* aspect ratio
* device priority
* fallback behavior

Purpose:

Media should plug into the Atlas system rather than forcing custom layouts for every event.

Future tools should be able to generate or update media without changing the event-page architecture.

---

## 6. Collection Layer

This answers:

Why would someone come back?

Celebration Atlas should eventually support collection and memory.

Possible collection mechanics:

* save event
* attended event
* collect artifact
* unlock origin story
* collect local memory
* favorite photo
* festival passport
* county trail
* seasonal trail
* food trail
* fair trail
* fireworks trail
* queen history trail
* “I was there” memory
* family event scrapbook

Purpose:

The Collection Layer turns browsing into participation.

It should make the Atlas feel like something people build with over time.

---

# Standard Event Navigation

The reusable event page should use five primary navigation areas.

## Highlights

Purpose:

Show the emotional and experiential reason to care.

Content:

* event title
* short atmospheric description
* top traditions
* signature moments
* current-year emphasis
* hero media if available

Highlights should not become a cluttered information dump.

It should feel like the front door to the celebration.

---

## Schedule

Purpose:

Help people know what is happening and when.

Content priority:

1. Happening Now
2. Next Up
3. Today
4. Major upcoming moments
5. Full schedule
6. Past schedule or expected schedule only when clearly labeled

Schedule should use the fewest possible cards.

Typography, spacing, and hierarchy should do most of the work.

---

## Maps

Purpose:

Help people understand where things are.

Map content:

* event grounds
* entrances
* parking
* parade routes
* stages
* vendors
* food areas
* rides
* restrooms
* first aid
* accessibility routes
* historical map overlays
* field scout GPS points

Future map modes:

* practical map
* atmosphere map
* historical map
* 3D world view
* route animation
* field scout layer

---

## Gallery

Purpose:

Reveal the event’s memory, artifacts, and deeper curiosity.

Top-level gallery portals:

* Origin Portal
* Memory Portal
* Legend Portal
* Artifact Portal

Portal behavior:

* each portal contains trails
* each trail contains moments
* each moment can include image, video, artifact, caption, source, and Ask Anything expansion

Gallery should feel discoverable, not like a normal photo grid.

---

## Plan

Purpose:

Prepare someone to attend.

Content:

* best day to go
* best time to arrive
* parking tips
* family tips
* food tips
* cost expectations
* what to bring
* accessibility notes
* weather notes
* local businesses nearby
* official links

Plan should be practical and simple.

---

# Ask Anything Layer

Ask Anything is the intelligence layer.

It should not compete with the main page.

It should answer deeper questions such as:

* When does the parade start?
* Where should I park?
* What happened in 1931?
* Who was the first Peach Queen?
* What food is this event known for?
* Is this good for kids?
* What did last year’s schedule look like?
* Where are the vendors?
* What is the story behind this tradition?

Ask Anything should be powered by:

* structured event data
* source documents
* official websites
* PDFs
* historical records
* field scout data
* user-submitted memories
* media captions
* map points

Ask Anything is where long-tail information belongs.

The visible event page should stay clean.

---

# Responsive Experience Model

Celebration Atlas must work across phones, tablets, desktops, and orientation changes.

The system should define device modes.

## Phone Portrait

Primary experience.

Design goal:

Immersive Atlas window.

Behavior:

* vertical cinematic page
* bottom navigation
* Ask Anything dock
* scroll inside event content window
* media optimized for portrait
* one major idea per screen
* minimal clutter

Phone portrait is the emotional prototype.

---

## Phone Landscape

Functional fallback first. Beautiful second.

Design goal:

Never become unusable.

Behavior:

* do not force the same portrait composition
* reduce fixed vertical assumptions
* use a compact layout
* allow content to scroll
* keep nav reachable
* avoid elements overlapping browser UI
* optionally show a simplified landscape mode

Possible landscape layout:

* event media/background on one side
* content panel on the other side
* compact nav row
* Ask Anything minimized

If a full immersive landscape design is not ready, the site should use a safe fallback layout.

---

## Tablet

Design goal:

Expanded field guide.

Behavior:

* larger event window
* more breathing room
* media and content can sit side by side
* portals can become larger cards
* schedule can show more at once
* map can be more useful
* Ask Anything can remain docked or become a side panel

---

## Desktop

Design goal:

Atlas archive / museum console.

Behavior:

* background atmosphere remains
* event content becomes a larger readable panel
* media can occupy a dedicated stage
* schedule, map, and gallery can use multi-column layouts
* Ask Anything can become a persistent guide panel
* portals can open into richer archive views

Desktop should not feel like a stretched phone app.

It should feel like opening the Celebration Atlas.

---

# Event Data Structure

Every event should eventually be stored in a structured profile.

## Core Event Profile

Fields:

* id
* slug
* name
* shortName
* eventType
* city
* region
* state
* coordinates
* venueName
* dateStart
* dateEnd
* recurrence
* officialWebsite
* officialSocialLinks
* organizer
* descriptionShort
* descriptionLong
* foundingYear
* anniversaryLabel
* status
* confidenceScore
* sourceIds

---

## Experience Items

Fields:

* id
* eventId
* title
* description
* category
* importance
* audience
* scheduleIds
* mapPointIds
* mediaIds
* sourceIds

Examples:

* Peach Parade
* Peach Queen Tradition
* Midway and Carnival
* Fireworks
* 4-H Poultry Barn
* Turtle Race
* Balloon Glow

---

## Schedule Items

Fields:

* id
* eventId
* title
* description
* startTime
* endTime
* dayLabel
* locationName
* mapPointId
* category
* isFeatured
* isOfficial
* sourceId
* confidenceScore

---

## Map Points

Fields:

* id
* eventId
* title
* description
* category
* latitude
* longitude
* approximateLocation
* source
* mediaIds
* scheduleIds

Categories:

* entrance
* parking
* restroom
* stage
* food
* vendor
* ride
* parade route
* first aid
* attraction
* historical point

---

## Curiosity Items

Fields:

* id
* eventId
* title
* shortText
* longText
* curiosityType
* year
* people
* place
* sourceIds
* mediaIds
* relatedItems
* confidenceScore

Curiosity types:

* origin
* legend
* memory
* artifact
* tradition
* local fact
* historic moment
* visual detail
* oral history

---

## Media Items

Fields:

* id
* eventId
* mediaType
* title
* caption
* fileUrl
* sourceUrl
* thumbnailUrl
* aspectRatio
* dateCaptured
* dateRepresented
* location
* rightsStatus
* credit
* altText
* placement
* devicePriority
* cropFocus
* sourceIds

Media types:

* image
* video
* audio
* poster
* document
* map
* 3D scene
* AR object

---

## Source Records

Fields:

* id
* eventId
* sourceType
* title
* url
* publisher
* datePublished
* dateAccessed
* filePath
* extractedText
* confidenceScore
* notes

Source types:

* official website
* official PDF
* Facebook page
* Instagram post
* local news
* historical archive
* user-submitted memory
* field scout capture
* organizer interview

---

# AI Agent Population Model

AI agents should eventually populate and maintain the event profile.

## Discovery Agent

Finds events and official sources.

Tasks:

* discover event websites
* identify dates
* identify location
* identify organizer
* gather official links
* create/update event profile

---

## Schedule Agent

Extracts schedules from websites, PDFs, images, and posts.

Tasks:

* parse event schedule
* normalize times
* group by day
* identify featured events
* link schedule items to map points
* flag outdated schedules

---

## Curiosity Agent

Finds interesting facts and historical material.

Tasks:

* detect origins
* identify traditions
* extract historical moments
* create curiosity items
* connect artifacts to timelines
* generate short and long summaries

---

## Media Agent

Processes media into usable slots.

Tasks:

* classify images and videos
* create captions
* generate alt text
* identify aspect ratio
* suggest placement
* create thumbnails
* flag rights issues
* recommend missing media

---

## Map Agent

Creates practical and atmospheric map layers.

Tasks:

* identify venues
* create map points
* detect entrances and parking
* process GPS scout photos
* create parade routes
* prepare future 3D map inputs

---

## Quality Agent

Checks for accuracy, duplication, and outdated data.

Tasks:

* verify official sources
* flag conflicts
* detect stale schedules
* check broken links
* assign confidence scores
* prevent hallucinated event details

---

# Required vs Enhanced Event Levels

Not every event needs the full Atlas treatment immediately.

## Level 1 — Basic Atlas Listing

Minimum:

* name
* location
* dates
* short description
* official link
* event type
* basic map point

Use for early statewide coverage.

---

## Level 2 — Practical Event Page

Adds:

* schedule
* parking
* tickets
* map
* plan tips
* major highlights

Use for events people may attend soon.

---

## Level 3 — Atlas Experience Page

Adds:

* hero media
* richer Highlights
* Gallery portals
* curiosity items
* source-backed Ask Anything
* event-specific atmosphere

Use for priority events.

---

## Level 4 — Living Celebration Page

Adds:

* field scout data
* live updates
* vendor photos
* food boards
* current-year media
* happening now
* interactive map
* user memories

Use for active partner events.

---

## Level 5 — World-Built Event

Adds:

* 3D map
* route animation
* AR artifacts
* generated video scenes
* immersive trails
* collectible artifacts
* historical overlays

Use for flagship events.

---

# Design Rules

## General

* The page itself is the canvas.
* Avoid unnecessary cards.
* Use typography, spacing, dividers, imagery, and atmosphere.
* Cards should only isolate truly important information.
* Do not clutter the visible page with long explanations.
* Let Ask Anything handle deeper questions.
* Always preserve practical usefulness.

---

## Typography

* Titles should feel premium, readable, and calm.
* Section labels should be small, spaced, and ceremonial.
* Avoid giant headings that overpower the window.
* Use consistent title scale across tabs.
* Important practical information should be readable in daylight.

---

## Media

* Media should support the event experience, not dominate it.
* Portrait media for phone portrait.
* Square or flexible media when the window shape requires safer cropping.
* Always provide fallback behavior.
* Avoid layouts that depend on one exact media crop.
* Do not make future event pages dependent on custom manual video edits.

---

## Motion

* Motion should feel atmospheric and meaningful.
* Avoid busy animation.
* Intro videos should not block practical use.
* Video transitions should not create duplicate image flashes.
* Only one major motion layer should be active at a time.
* Respect reduced-motion settings.

---

## Curiosity

* Curiosity should be discoverable.
* Do not dump history on the main page.
* Use portals, trails, and artifacts.
* Short visible text, deeper expandable intelligence.
* Every curiosity item should eventually connect to a source.

---

# Engineering Rules

## Event pages must avoid one-off hardcoding

Romeo-specific code is acceptable during prototype development, but the goal is to migrate toward reusable components and data-driven rendering.

Reusable components should include:

* EventShell
* EventHero
* EventHighlights
* EventSchedule
* EventMap
* EventGalleryPortals
* EventPlan
* AskAnythingDock
* MediaSlot
* CuriosityTrail
* ArtifactCard
* ResponsiveEventLayout

---

## Layout must be responsive by design

Do not assume:

* phone portrait only
* fixed 9:16 viewport
* one browser UI height
* one image aspect ratio
* one video aspect ratio
* one device width
* one orientation

Every page must have safe behavior for:

* phone portrait
* phone landscape
* tablet
* desktop

---

## Scroll behavior must be intentional

Define the scroll container clearly.

Avoid accidental body scroll unless intended.

For immersive event pages:

* outer shell may be fixed
* inner event content may scroll
* bottom controls stay reachable
* landscape and desktop may use different scroll models

Do not use global overflow changes without checking all device modes.

---

## Media slots must be flexible

Each media slot should define:

* preferred aspect ratio
* allowed fallback aspect ratios
* crop behavior
* focal point
* mobile behavior
* tablet behavior
* desktop behavior
* fallback media

Do not force every event to use the same hero video shape.

---

# Romeo Prototype Lessons

Romeo Peach Festival has revealed important reusable lessons:

1. Fixed phone portrait experiences are emotionally powerful but fragile.
2. Window height, bottom controls, browser UI, and orientation must be handled systematically.
3. Video crops cannot be manually fought forever.
4. Square media may be safer for certain window layouts.
5. Fade masks should be opacity-based, not fake dark shadows.
6. Content should be separated from presentation.
7. Schedule and Highlights should share a consistent title scale.
8. Ask Anything should hold deeper information.
9. Gallery should use portals, not generic photo grids.
10. The system needs a formal architecture before scaling to many events.

---

# Next Build Priorities

## Priority 1 — Stabilize the responsive event shell

Create a reusable event shell that supports:

* phone portrait
* phone landscape fallback
* tablet
* desktop

Do this before adding many more event-specific visual experiments.

---

## Priority 2 — Define the event data schema

Create a data structure that can support:

* identity
* highlights
* schedule
* map
* gallery
* plan
* curiosity
* media
* sources

---

## Priority 3 — Convert Romeo into a reusable template

Keep Romeo as the flagship prototype, but begin separating:

* Romeo data
* Romeo media
* reusable event layout
* reusable portal system
* reusable schedule system
* reusable media slots

---

## Priority 4 — Build AI-agent-ready source structure

Every fact, schedule item, artifact, and curiosity should eventually connect to sources and confidence scores.

---

## Priority 5 — Add progressive enhancement

Start simple for most events.

Only flagship events need full media/world-building treatment.

The structure should allow events to grow over time.

---

# Final Direction

Celebration Atlas should not try to manually build a custom world for every event.

It should build the structure that lets every event become explorable.

Some events will begin as simple listings.

Some will become practical guides.

Some will become living archives.

Some will become immersive worlds.

The same architecture should support all of them.

The long-term product is not only the website.

The long-term product is the Atlas system:

A source-backed, AI-populated, media-flexible, curiosity-driven way to present celebrations to the world.

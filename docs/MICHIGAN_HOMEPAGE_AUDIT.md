# Michigan Homepage Audit

Last reviewed: August 8, 2026

## Scope

This audit covers the public Michigan Atlas homepage, its live/upcoming event rail, illustrated-map presentation, coded marker system, and portrait, phone-landscape, tablet, and desktop behavior.

Michigan remains the canonical state prototype. The findings here should be resolved as reusable state-atlas contracts rather than copied into one-off state pages.

## Baseline Completed In This Milestone

- The bottom event rail is now time-aware. It accepts only public events with valid exact `YYYY-MM-DD` dates that are live or upcoming in the Michigan time zone.
- Rail dates are inclusive. Live events sort before upcoming events; upcoming events then sort chronologically.
- Completed, undated, estimated, recurrence-only, and invalid-date records remain available to map/search discovery when otherwise public, but they do not appear in the time-sensitive rail.
- Ask Celebration Atlas visibility no longer depends on the rail containing at least one eligible event. A state with an empty live/upcoming rail still keeps its primary command control.
- Short non-desktop landscape viewports keep menu, favorite, filter, Ask Atlas, and the live/upcoming rail visible beside a bounded full-art map.
- Desktop now preserves the illustrated artwork's portrait content box and keeps the introduction/discovery panel out of the map frame. The previous wide `object-fit: cover` crop and panel overlap are removed.

As of July 15, 2026, the Michigan rail contains:

1. Brown Trout Festival — July 17–26
2. St. Clair County 4-H & Youth Fair — July 20–25
3. Grand Haven Coast Guard Festival — July 24–August 2
4. Romeo Peach Festival — September 3–7
5. Detroit Jazz Festival — September 4–7

No event is live on that date. National Cherry Festival and Black River Tattoo Convention are complete, while the other omitted map events do not have verified exact future dates in the resolved homepage catalog.

## Rail Eligibility Contract

The live/upcoming rail is a current-planning surface, not a general featured-events carousel.

An event is eligible only when all of the following are true:

- It has already passed the public publication and verification gates.
- Its start date is an exact, valid `YYYY-MM-DD` value.
- Its optional end date is exact, valid, and not earlier than the start date.
- Today is on or before the event's end date in the event/state time zone.

The rail must not:

- infer a future edition from annual recurrence;
- turn a typical month into a current-year date;
- show `Date TBA` cards;
- keep completed events for visual variety;
- confuse database `active` status with “happening now.”

If the published database overlay is unavailable, the selector fails closed and shows only checked-in events with exact eligible dates. Future reliability work may add a generated public-discovery snapshot, but it must not restore undated cards through inference.

## Why The Star System Appears Not To Work

The artwork and the coded marker system currently communicate different things.

- Portrait mobile artwork contains decorative light points. Those points are baked into the image and are not event controls.
- Coded star visuals currently render only in the React desktop mode.
- Idle phone markers have neither a visible coded star nor an enabled tap target unless a search or presentation plan reveals a label.
- Common phone-landscape widths use the desktop artwork while remaining below the React desktop breakpoint, so they receive neither the portrait artwork's decorative lights nor desktop coded stars.
- Production markers, atmosphere effects, calibration tools, and legacy `x/y` values do not all use one presentation resolver.

This is not primarily a latitude/longitude problem. The illustrated map is intentionally distorted, so a mathematically correct geographic projection can still look wrong on the artwork.

The reusable solution is a versioned presentation profile:

```text
verified event latitude/longitude
        ↓
state + artwork asset version + viewport variant
        ↓
calibrated illustrated position
        ↓
optional reviewed editorial offset with reason
        ↓
one shared position for star, label, glow, line, and audit
```

Real coordinates remain canonical. An editorial offset is presentation data, not geographic truth. Every future state should be able to use the same resolver with its own artwork calibration and reviewed overrides.

Do not add another independent star-placement path or place stars by eye directly inside a component.

August 8 implementation note: the production homepage now renders accessible
coded cluster and event markers on mobile and desktop from the existing
calibrated artwork positions. Geographic cluster membership uses canonical real
coordinates, while a cluster anchor averages those already-resolved artwork
positions. This improves practical marker reliability without claiming that
the still-missing unified versioned presentation profile is complete.

August 9 artwork note: Michigan now uses a versioned cloud-and-water asset
from one 1024×1536 source. Desktop and compact landscape retain that source
unchanged. The phone variant keeps the complete source at the top and extends
only its lower ocean/cloud field to 1024×2216, so both peninsulas remain visible
without letterboxing or destructive cropping while the lower atmosphere frames
the ASK dock and dated rail. Presentation v3 starts portrait phones in a
reviewed enlarged pose modeled on Ray's reference: the Lower Peninsula is
centered, the eastern U.P. remains visible, and users drag horizontally to
reveal the western U.P. Drag and pinch transforms track the active gesture
without easing, pan movement is amplified to avoid repeated swipes, touch-like
WebKit pointers remain active until pointer-up/cancel, and the
portrait camera cannot move south past the reviewed pose into the synthetic
lower water. The start pose uses a moderate zoom and reduced top spacing that
keeps more of the southern Lower Peninsula above ASK without filling the frame.
That pose is also the portrait zoom floor, preventing a pinch or restored
history entry from returning to the undersized full-state view.
Beyond that floor, upward travel expands with zoom so Detroit and the southern
border can be inspected without making the synthetic lower-water extension an
unbounded destination.
Artwork and marker layers use the same transform and settle timing. Restored
camera transforms are profile-scoped so an obsolete pose cannot replace the
current reviewed opening composition.

The active two-axis projection is now named
`michigan-clouds-artwork-calibration-v2` and is scoped only to this artwork.
It adds an asset-specific Lower Peninsula perspective shear and converts
intrinsic artwork percentages through the browser's actual `cover`/`contain`
rendered rectangle before placing a marker. This keeps shoreline coordinates
stable when mobile browser chrome changes the viewport height. The former
painterly-map anchors, exact mobile U.P. anchors, old regional corrections, and
obsolete workbenches remain removed. Real coordinates remain canonical, and a
future shared presentation resolver is still required for multi-state scale.

The same August 8 ASK milestone now treats the complete publication-gated
Michigan catalog as a server-owned candidate universe; the browser no longer
submits candidate IDs. Search enrichment reads only the exact validated
published Event Hub package selected by public discovery. Ranked results may
carry up to three compact retained-fact cues across desktop rows, mobile cards,
and cluster-deck cards without moving ASK or adding AI-authored prose.

The August 9 follow-up adds privacy-safe outcome diagnostics and a permanent
synthetic smart-search benchmark bank. Diagnostic records expose only broad
matcher, volume, cue-coverage, and latency buckets; they contain no query text
or hash, event identity, request identity, or persistent identifier. The build
now protects seven representative intents, their grounded fixture results,
evidence IDs, ordering, and retained-fact cues without contacting a model.

## Responsive State-Atlas Contract

| Mode | Required behavior |
| --- | --- |
| Phone portrait | Cinematic map entry, compact command dock, reachable live/upcoming rail, reliable controls, no horizontal overflow. |
| Short phone landscape | Bounded full-art map beside compact controls and dated events; no portrait-height scroll trap; event cards remain internally scrollable. |
| Tablet | Explicit stacked or two-column map/discovery layout; never a mixture of phone React behavior and desktop CSS framing. |
| Desktop | One owned grid with a bounded map stage and a functional discovery/list/filter panel; no fixed panel overlap and no stretched phone composition. |

Essential controls should render in every mode and move through layout rules. Orientation should not conditionally remove the only navigation, search, or event-list path.

## Multi-State Scaling Blockers

### 1. State-scoped public data

The published homepage resolver is not yet scoped by state. Before a second state publishes events, the state atlas query must require a state identity and prevent non-Michigan records from being projected onto Michigan artwork.

### 2. One state configuration contract

State-specific identity should move into data/configuration:

- state name, abbreviation, and slug;
- time zone or per-event time zone;
- desktop/mobile artwork sources and asset version;
- calibration profile;
- region definitions;
- presentation copy and atmospheric tokens.

The event rail, search, result list, cards, and lifecycle classifier should remain shared.

### 3. One responsive mode model

React mode, artwork selection, CSS layout, and projection variant currently use different breakpoints. Replace them with named shared modes so a viewport cannot receive mobile behavior, desktop artwork, and tablet CSS simultaneously.

### 4. One map-presentation resolver

Stars, selected labels, atmosphere effects, constellation lines, and developer audits must consume the same resolved illustrated position. Deprecate or redefine legacy event `x/y` fields after compatibility use is audited.

### 5. Accessible coded markers on mobile

Decorative artwork lights may remain atmospheric, but real events need code-rendered, keyboard-accessible targets. Marker density should be controlled through search, focus, clustering, and selected trails rather than by permanently labeling every event.

### 6. List-first precision discovery

The map is the emotional front door, not the only index. Each state needs a real event list/filter path for date, region, city, and category precision, especially in landscape and desktop modes.

### 7. Lightweight homepage payload

The homepage currently resolves richer flyer media for the full catalog. State and national discovery should request only map/list identity, verified timing, thumbnail, and source-confidence fields, then load full Event Hub media after selection or navigation.

### 8. Component boundaries

`AtlasMap` currently owns Michigan copy, projection, gestures, search, marker rendering, cards, responsive mode, and the event rail. Extract reusable state shell, map stage, marker layer, command dock, lifecycle rail, and result-list boundaries before multiplying this component across states.

### 9. Automated viewport coverage

Add visual and functional assertions for at least:

- 390×844 phone portrait;
- 844×390 and 960×432 phone landscape;
- 768×1024 tablet portrait;
- 1024×768 minimum desktop/tablet landscape;
- 1366×768 and 1440×900 desktop.

Each check should assert visible Ask/menu/filter access, expected rail eligibility/order, no horizontal overflow, bounded map geometry, working Event Hub navigation, and no browser errors.

## Recommended Next Map Milestone

Diagnose and define the shared `StateMapPresentationProfile` and position resolver before changing marker visuals. The diagnostic should inventory every current coordinate consumer, specify asset-versioned calibration and override data, and produce acceptance fixtures for portrait, landscape, and desktop. After that contract is reviewed, implement one accessible mobile star layer from the same resolved positions.

The August 8 clustering milestone deliberately reused the current calibrated
positions rather than bypassing this recommendation. The versioned shared
presentation profile and reviewed override contract remain the next placement
milestone needed for reusable multi-state precision.

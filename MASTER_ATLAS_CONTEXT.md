# MASTER ATLAS CONTEXT — Celebration Atlas

## 1. Project Vision
Celebration Atlas is a **living experiential intelligence platform** for celebration discovery and memory. It is not just a directory of events; it is a discoverable emotional map where each marker, glow, card, and conversational cue helps people *feel* a place before they choose it.

Core intent:
- Preserve a cinematic, contemplative pace over fast/flashy UI.
- Make discovery feel guided but open-ended.
- Treat atmosphere as meaning, not decoration.
- Build toward a long-term living-atlas system where regional identity, event mood, and community memory are first-class data.

## The Wonder Principle
Celebration Atlas does not attempt to create wonder through marketing copy.

Wonder should emerge from:
- imagery
- atmosphere
- motion
- sound
- discovery
- memory
- exploration

The platform trusts users to feel emotion without being told what to feel.

### Visuals Create Emotion
Festival photography, memory imagery, atlas artwork, environmental effects, lighting, motion, cartography, and atmosphere create the emotional experience.

The interface should feel:
- discovered
- cinematic
- archival
- authentic
- mysterious
- lived-in

without requiring elaborate prose.

### Information Creates Value
Event content should primarily function as a field guide.

Users want answers to:
- What is it?
- When does it happen?
- Where is it?
- What should I not miss?
- How do I plan my visit?

Content should be concise, factual, and useful.

Example:

Parade
- Main parade through downtown Romeo.
- Best viewing near Main Street and St. Clair.
- Arrive 30–45 minutes early.

This is preferred over promotional or tourism-style language.

### Atlas AI Creates Discovery
The event page provides facts.

Atlas AI provides:
- stories
- context
- recommendations
- hidden gems
- itineraries
- local knowledge
- deeper exploration

The AI serves as the storyteller and guide.

### The Museum Rule
Celebration Atlas should feel closer to:
- a museum exhibit
- a field guide
- a living archive

than:
- a tourism website
- a marketing brochure
- an event advertisement

### The Quiet Content Rule
As visual quality increases, text volume should decrease.

The stronger the imagery becomes:
- fewer titles
- fewer labels
- fewer paragraphs
- fewer adjectives

Visuals should carry emotional weight.
Content should carry informational weight.

Implementation status:

This is a foundational design principle.
It should influence:
- event pages
- gallery design
- AI responses
- maps
- future memory layers
- future AR experiences

## 2. Storybook Americana Art Direction
The visual language blends:
- Storybook warmth (soft gradients, nostalgic glow).
- Americana festival energy (fairs, parades, fireworks, harbor nights).
- Subtle cinematic restraint (low-opacity overlays, slow drift, gentle shimmer).

Implementation cues currently reinforce this direction:
- Warm/cool category and regional theme blending for event cards.
- Layered map lighting with selective animated effects.
- Soft, non-harsh contrast in atmospheric effects.

The style should feel handcrafted and place-rooted, not generic “travel app.”

## 3. Cinematic Map Philosophy
The map is the stage; interface elements should support it, not overpower it.

Current interaction policy (intentional):
- Fixed-scale atlas rendering (no custom pinch/drag gesture system yet).
- Tap reliability prioritized over interaction complexity.
- Discovery through marker selection, featured prompts, and search highlighting.

Layering contract (must remain clear):
- Map art at base.
- Decorative atmosphere above map art.
- Interactive markers above atmosphere.
- Event card above markers.
- Search + featured discovery dock above card.

This hierarchy preserves legibility and cinematic depth.

## 4. Event Card Philosophy
The event card is an **atmospheric reveal**, not a dense info panel.

Current behavior pattern:
- Smooth staged entrance/exit timing.
- Theme color blended from event category + regional atmosphere.
- Atmosphere line (“atmosphere title/label”) treated as emotional headline.
- Media reveal delayed/faded to avoid abrupt visual jump.

Card content should stay concise and evocative. Avoid turning cards into heavy metadata tables.

## 5. Ambient Atmosphere System
Atmosphere is event-driven and region-aware:
- Event data can specify `atmosphere.effects` and intensity.
- Selected event can add a regional tonal wash (`regionAtmosphere`) over the map.
- Effects are decorative-only (`pointerEvents: none`) and must never block interaction.

Important principle:
- Atmosphere should be cumulative but restrained.
- Subtle motion + low opacity is preferred over frequent or high-amplitude animation.

## 6. Clouds / Geese / Fireworks Rules
Current rules in practice:

- **Clouds**
  - Decorative drift layer below markers.
  - Very low opacity, long-cycle movement.
  - Screen blend and slow traversal to maintain calm pacing.

- **Geese**
  - Periodic long-flight pass with low-opacity sprite.
  - Fixed cadence (currently 30s cycle) and non-interactive overlay.

- **Fireworks**
  - Spawned from event atmosphere data only.
  - Intensity profiles (`subtle`, `medium`, `signature`) change cadence/lift/bloom.
  - Short burst windows in long cycles to avoid constant visual noise.

Global rule: these effects should support emotional geography and seasonality, never compete with marker clarity.

## 7. Media Card System
The card media system is already reusable and event-driven.

Current architecture:
- Media configuration lives in `ATLAS_EVENTS` (`cardMedia` block).
- Supports image/video-oriented settings (`mediaType`, `mediaSrc`, `posterSrc`).
- Supports atmospheric tuning (`mediaPosition`, `mediaScale`, mask profiles, delay, fade duration).
- Video handling includes:
  - key-based remount on selection changes,
  - delayed play start,
  - playback failure fallback.

This system should remain data-first so new events can adopt media behavior without custom component branching.

## 8. Mobile UX Principles
Mobile is the primary reliability target.

Current mobile-oriented constraints:
- `touch-action: manipulation` and overscroll suppression.
- Hidden browser scrollbars and fixed viewport framing.
- Interaction model avoids fragile gesture complexity for now.

Principles:
- Preserve tap confidence over feature novelty.
- Keep motion soft and battery-conscious.
- Test every UI/animation change mobile-first before desktop polish.

## 9. Performance Constraints
Atmospheric performance standards:
- Prefer transform/opacity animation, avoid layout-thrashing properties.
- Keep effects low-count and deterministic where possible (seeded variation).
- Use subtle blur and blending sparingly.
- Keep decorative layers non-interactive and visually light.

Card/media constraints:
- Delay/fade media reveal to reduce abrupt paints.
- Gracefully fallback when video playback fails.

No feature should reduce responsiveness of marker interaction.

## 10. Regional Atmosphere System
Regional atmosphere is currently a core emotional-geometry mechanism.

Defined region tones:
- `lakeshore`
- `northwoods`
- `urban`
- `harvest`
- `winter`

Current behavior:
- Selection of an event can apply a region-specific radial tonal field.
- Region choice also influences card-edge/glow/wash blending.

Direction:
- Continue modeling regions as reusable atmosphere primitives.
- Keep region signatures distinct but understated.

## 11. Strategic Direction (Expanded)
Celebration Atlas is evolving into a living operational system for celebration intelligence, not a static browse app.

### 11.1 AI-First Conversational Interaction
- Primary interface direction: **conversation over menus**.
- Discovery, refinement, and confidence-building should happen through natural language prompts and responses.
- UI controls should support conversation, not replace it.
- Structured filters should stay available but secondary, lightweight, and atmosphere-safe.

### 11.2 Companion + Guide Systems
- The atlas should behave like an adaptive companion/guide, not a passive listing tool.
- Guide behavior should combine:
  - location + season context,
  - event energy and pacing,
  - audience intent (family day, date night, spontaneous local wander, etc.).
- Recommendations should feel situated, time-aware, and emotionally coherent.

### 11.3 Experienced Friend Mode
- Introduce an “experienced friend” mode as a tone and intelligence standard.
- Voice should feel local, confident, and warm rather than transactional.
- Guidance should include practical realism (parking, weather shift, crowd timing) without collapsing into dashboard-style overload.

### 11.4 Survival Guide / Event Intelligence Direction
- Extend from discovery into practical event intelligence:
  - what to expect,
  - what can go wrong,
  - how to adjust in real time,
  - where to pivot nearby.
- This should function as a lightweight survival layer that increases trust and actionability.
- Intelligence should stay contextual and conversational, never presented as dense control panels.

### 11.5 Emotional Geography as Core Data
- Emotional geography remains a core product differentiator.
- Model places by felt character, social rhythm, and seasonal mood—not only taxonomy.
- Region + event emotional signatures should inform map atmosphere, card framing, and guide responses.

### 11.6 Memory + Archive Systems
- Build toward an archive of celebration memory over time.
- Future data primitives should support:
  - recurring event memory,
  - seasonal deltas,
  - notable atmosphere snapshots,
  - community recollection threads.
- Archive systems should make the atlas feel alive across years, not reset every season.

### 11.7 Operational-System Philosophy
- Celebration Atlas should become an operational intelligence layer for real-world celebration movement.
- Prioritize systems that can continuously ingest, interpret, and guide.
- Keep architecture composable and data-first so experience intelligence can scale without UI bloat.

## 12. Deployment + Delivery Workflow
Operational workflow should support fast iteration with safe presentation quality.

- **GitHub as source of truth**
  - Feature work and context updates land via commits on tracked branches.
  - Collaboration and review happen through pull requests.

- **Codex PR workflow**
  - Codex-driven changes should include clear scope, test/build evidence, and atmosphere-impact notes when relevant.
  - Pull request descriptions should explain both technical changes and experiential intent.

- **Vercel preview deployments**
  - Every PR should produce a preview environment for quick experiential validation.
  - Preview review should explicitly check cinematic quality, emotional immersion, and mobile interaction reliability.

- **Production deployment flow**
  - Merge reviewed PRs to the production branch.
  - Validate build health and preview confidence before production promotion.
  - Treat production release as atmosphere-critical: no release should degrade map calmness, immersion, or interaction trust.

## 13. Experience Guardrails (Non-Negotiable)
- Avoid dashboard clutter.
- Preserve cinematic atmosphere.
- Preserve emotional immersion.
- Prefer conversation over deep menu trees.
- Add intelligence depth in behavior/data, not through control-surface sprawl.

## 14. Current Technical Architecture
Project currently follows a **no-`src/` architecture** with top-level domains:
- `app/` for Next App Router entrypoints and global styles.
- `components/` for map composition and effects.
- `data/` for canonical event + atmosphere configuration.
- `public/` for map/image/video assets.

Runtime flow:
- `app/page.tsx` renders `AtlasMap`.
- `AtlasMap` owns selection/search/discovery/card/media state.
- `AtmosphereLayer` derives ambient overlays from event data and selection.
- Effect components render decorative layers with strict z-index roles.

## 15. Known Working Behaviors
Verified current behaviors to preserve:
- Search terms map to highlighted event IDs; reset commands clear highlight context.
- Featured discovery rotates through prioritized events.
- Selecting a marker opens animated event card.
- Card media reveals with delay/fade and supports video fallback behavior.
- Region atmosphere overlays animate per selected region tone.
- Fireworks/ferris glow activation is event-data-driven.
- Clouds and geese remain ambient-only and non-interactive.

## 16. Future System Vision
Celebration Atlas should mature into a multi-layer experiential operating system:

- **Layer 1 — Living Atlas Surface**
  - Cinematic map + atmosphere + emotionally readable discovery.

- **Layer 2 — Conversational Intelligence**
  - AI-first companion that interprets intent and context in plain language.

- **Layer 3 — Field-Ready Guidance**
  - Survival-guide decision support for real-time celebration conditions.

- **Layer 4 — Memory + Archive Engine**
  - Longitudinal celebration memory that improves guidance quality over time.

- **Layer 5 — Operational Continuity**
  - Reliable deployment, preview validation, and production discipline that preserve atmosphere integrity release to release.

Success condition: the product should feel like a trusted local guide with cinematic emotional depth—never like a cluttered dashboard.

## 17. Things To Avoid
Avoid changes that break the atlas tone:
- Overly saturated, high-frequency, or constant-on effects.
- UI density that crowds map art.
- Gesture systems that compromise tap reliability.
- Hard, abrupt transitions that feel app-like instead of cinematic.
- One-off effect logic that bypasses event data architecture.
- Menu-heavy control paradigms that displace conversational guidance.

Atmosphere should **never become visually noisy**.

## 18. Future Ambitions
Long-horizon ambition:
- Transition to a true “living atlas” where events, regional moods, seasonal atmosphere, and community memory co-evolve.
- Implement the documented zoom/clustering roadmap in a data-driven way:
  - far view: regional glow clusters,
  - mid view: grouped category lights,
  - close view: individual event markers.
- Expand reusable media modules (image loops, short motion postcards, regional sound-ready hooks) while preserving the current event-driven card architecture.
- Add companion-grade conversation loops that reduce friction from idea to action.

Operational standards for continuity:
- Keep no-`src/` structure unless architecture strategy intentionally changes.
- Use the webpack dev workflow when running local development (`next dev --webpack`) to stay aligned with current team expectation.
- Require mobile-first testing for all interaction/atmosphere changes.

## 19. Future Gallery Intelligence System
Future gallery capabilities should be documented as a **curated intelligence system**, not an open upload feed.

Core principles:
- Celebration Atlas galleries should be intentionally curated and editorial in feel, not public image streams.
- User/fan uploads may eventually be accepted as an intelligence input source, but not as direct public dumping into galleries.
- AI agents may evaluate public sources, official media, and permitted uploads to identify emotionally strong event imagery.
- The objective is to preserve the *feeling* of an event and place, not to spotlight specific individuals.
- AI transformation may generalize or abstract people in source images to create legally safer, emotionally universal, Atlas-style visual artifacts.
- Selection logic should prioritize atmosphere, uniqueness, composition quality, cultural meaning, and emotional resonance.
- Gallery intelligence should reject boring, repetitive, blurry, generic, or social-media-style media patterns.
- The gallery AI should behave like a curator making thoughtful selections, not a feed generator maximizing volume.

Future gallery formats may include:
- Archive photography.
- Crowd-moment captures.
- Historical event imagery.
- Video snippets with strong atmosphere signal.
- AI-transformed emotional reconstructions.
- Map/image outputs generated by event guide systems.

Implementation status:
- This is a future-direction context definition only.
- Do not implement gallery ingestion, curation pipelines, or transformation tooling yet.

## 20. Future Atlas Zoom + Clustering Strategy
This roadmap defines how map scale should evolve once the current baseline is stable. It is a strategy document only; no immediate behavior change is intended.

Guiding principles:
- The current home map intentionally avoids custom pinch/drag zoom to preserve mobile tap reliability.
- Scaling to hundreds or thousands of events will require zoom and clustering support.
- The intended interaction model is guided cinematic zoom, not generic Google Maps-style behavior.
- Marker density should never become visual noise.
- Zoom behavior must protect the map’s painterly/atlas identity at every scale transition.

Target scale behavior:
- **Statewide view**: present regional glow clusters that communicate emotional geography before individual events.
- **Mid-level view**: resolve clusters into grouped category lights or celebration regions.
- **Close view**: resolve into individual event markers, with optional small category icons where clarity supports it.

Conversation-triggered focus expectations:
- Search and conversation should be able to drive map focus transitions (pan/zoom/cluster state) in response to intent-driven prompts, including examples such as:
  - “show me county fairs near the Thumb”
  - “music festivals near the lakeshore”
  - “all July fireworks”

Sequencing + implementation timing:
- Do not implement zoom/clustering until the current map-fit behavior, event page flows, and conversation layer are stable.
- When implementation begins, it should be data-driven (region/event/category metadata + intent routing), preserving current atmospheric hierarchy and mobile tap trust.


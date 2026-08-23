---
name: create-celebration-atlas-hero
description: Create or refine one evidence-grounded, text-free, portrait hero image that captures the distinctive visual essence and true scale of a Celebration Atlas event. Use when Codex needs to create, generate, replace, refresh, or repair a Celebration Atlas event-page hero image, or when an event-creation workflow reaches its hero-image stage. Prefer a supplied image-search screenshot or one top-thumbnail scan, require a distinctive iconic-moment preflight, require unmistakable physical golden-hour lighting for every outdoor scene unless a narrow documented exception applies, make exactly one image-generation call, and fail closed without automatic edits, variants, or retries.
---

# Create a Celebration Atlas Hero Image

Create one strong image that makes the viewer feel the atmosphere, character, and real scale of the actual event. Treat visual truth and event specificity as more important than spectacle for its own sake.

Keep the workflow research-light and generation-light. Use thumbnails to understand the event; do not perform deep research unless ambiguity could cause a major visual invention. The fixed budget is exactly one paid image-generation call per event.

## Preferred execution profile

Run this workflow with GPT-5.6 Luna at Max reasoning when the host surface supports that selection. Use Luna Max as the visual strategist: extract motifs, compare text-only concepts, choose the decisive moment, and construct the final prompt. The skill cannot switch its own host model, so select Luna Max before invoking it or pin Luna Max in the calling agent or configuration. Do not use the added reasoning depth to expand research or purchase extra image generations.

## Accept the inputs

Require:

- Event name
- City and state

Prefer:

- A screenshot of the top image-search results for the exact event and city

Use when available:

- Official event URL or existing Celebration Atlas event record
- Venue, date, and season
- Event-specific photos or gallery links
- Known physical constraints such as grass-only grounds, no waterfront, or an indoor hall
- Requested emphasis, format override, or existing hero image to refine
- A previously approved visual motif brief

Consume existing event data without asking the user to repeat it.

## Follow the fast workflow

### 1. Use one visual evidence pass

Choose the cheapest sufficient path:

1. If the user supplies a screenshot of top image-search results or a useful set of event-specific images, inspect it and skip web research.
2. Otherwise, run one image search using the exact event name plus city and state, then scan the top relevant thumbnails.
3. Do not open multiple sites by default.
4. Open at most one official or credible event-specific page only when the thumbnails leave a trust-sensitive fact unresolved, such as venue type, waterfront, landmark, terrain, crowd scale, or signature activity.
5. If the uncertainty remains, choose a visually tighter confirmed activity or return `Needs visual evidence` instead of expanding the research sweep.

Never claim to have inspected image results unless the images were actually inspected. Exclude generic stock images, similarly named events, other locations, and isolated details that do not recur.

Use thumbnails and screenshots as evidence, not as a composition to copy. Synthesize recurring features; do not recreate one photograph, photographer's framing, or identifiable attendee. Do not pass a search-results contact sheet to the image generator as a scene to reproduce.

### 2. Extract one compact motif brief

Record internally:

- **Setting:** confirmed venue, terrain, geography, and spatial character
- **Signature action:** the activity or subject that makes the event recognizable
- **Scale and energy:** intimate, lively, or major spectacle
- **Crowd relationship:** how participants or spectators experience the event
- **Cinematic lift:** the most flattering truthful light and atmosphere
- **Do not invent:** major features whose addition would break trust
- **Confidence:** High, Medium, or Low

Use three to five recurring motifs. Treat a feature as reliable when it repeats across event-specific thumbnails or an official source confirms it.

Do not repeat this evidence pass for revisions. Reuse the motif brief unless the event facts or source imagery change.

### 3. Pass the iconic-moment preflight

Draft three one-sentence concepts internally. These are text-only planning options, not image generations. Combine one signature action with one confirmed setting or atmospheric cue, then select the strongest concept.

Reject a concept before generation when any of these tests fail:

- **Name-removal test:** Remove the event name from the brief. If the image could just as easily advertise any generic parade, fair, festival, regatta, or convention, it is not specific enough.
- **Decisive-moment test:** Show an action, expression, interaction, or peak spectacle—not passive coverage of people standing, sitting, walking, or looking.
- **Scale-proof test:** Make the true attendance and physical breadth visible. A major event must not look like a quiet family outing or small local gathering.
- **Focal-hierarchy test:** Give the frame one unmistakable subject and an intentional camera position. Use foreground, action plane, and environmental depth without turning the image into a collage.
- **Trust test:** Every location-defining feature and signature activity must come from the motif brief.

Do not spend the image call until one concept passes all five tests. If none passes, return `Needs a stronger evidence-grounded concept — no image generated`.

Favor a photographic decision that adds drama while staying truthful: a low action angle, elevated overview, compressed crowd-and-action view, intimate close-up, backlit spray, dust, steam, fair lights, or expressive human interaction. Choose only what fits the actual event. Avoid generic eye-level coverage, passive spectator backs as the main subject, empty establishing shots, ordinary vendor aisles, posed groups, or excessive sky and dead space.

Match the composition to the event's real scale:

- For an intimate event, move close enough to capture expression, craft, or interaction.
- For a lively event, show the focal action with visible participation and environmental context.
- For a major spectacle, show breadth, crowd density, layered action, and visible energy. Do not reduce a large, highly attended event to a quiet family vignette or a nearly empty setting.

Preserve one dominant moment rather than making a collage. Let secondary details prove scale and place without competing with the focal action. The result should still read as a powerful single image at phone size.

Before generation, record exactly one internal lighting decision:

- `Golden hour required`, or
- `Exception: <specific documented reason>`

Use `Golden hour required` for every outdoor hero unless the defining visual cannot truthfully occur then. Valid exceptions are limited to an indoor event, a defining nighttime or illuminated spectacle such as fireworks, or the user's explicit request for another time of day. Ordinary daytime schedules, daytime thumbnail references, a morning or midday event, convenience, and a model preference for blue sky are not exceptions.

Golden hour is a physical lighting condition, not an orange color treatment. Require the sun low at or just above the horizon, directional side or backlight, long dimensional shadows, luminous edge light, warm reflections, and atmospheric depth.

Use a wide environmental scene only when the setting is supported. When spatial evidence is weak, tighten the camera around a confirmed activity rather than inventing a panorama.

### 4. Make exactly one image-generation call

Use the available image-generation skill and tool, following its input rules. Default to a vertical 2:3 hero image unless the user specifies otherwise.

For an outdoor scene without a valid exception, begin the generation prompt with this lighting lock:

> UNMISTAKABLE LATE GOLDEN HOUR: sun low at or just above the horizon, visible or immediately outside the frame; strong warm directional side or backlight; long dimensional shadows; luminous rim light; amber reflections; rich warm atmosphere. This must look physically photographed at golden hour, not like neutral daylight with orange color grading.

Write a short, concrete generation prompt that states:

- The image's Celebration Atlas hero purpose
- The main subject and action
- The confirmed setting
- The correct scale, crowd energy, and spatial breadth
- The decisive moment, intentional camera position, and mobile-safe focal placement
- The correct visual scale, depth, movement, and emotional energy
- The hard exclusions

Use realistic photographic detail with elevated but believable color, contrast, motion, and atmosphere. Describe what makes this frame iconic rather than padding the prompt with mood adjectives or research narrative.

For an outdoor scene without a valid exception, end the prompt with this second lighting lock:

> LIGHTING LOCK: preserve unmistakable low-sun golden hour. No midday, high, or overhead sun; no short shadows; no neutral daylight; no flat blue daylight; no weak late-afternoon light; no merely orange color grade.

Do not call the image generator for an outdoor scene until the prompt explicitly contains `late golden hour`, `sun low at or just above the horizon`, `directional side or backlight`, `long dimensional shadows`, and the prohibition on midday or neutral daylight.

Explicitly prohibit:

- Readable or pseudo-readable text
- Signs, banners, titles, captions, posters, watermarks, and event names
- Logos and recognizable branding
- Invented landmarks, geography, attractions, buildings, terrain, or event scale
- Generic stock-photo staging
- Crowded collage-like composition and unrelated visual noise
- Fantasy, painterly, plastic, or implausibly overprocessed treatment unless requested

Frame real-world structures so signage is absent rather than allowing fake or garbled lettering.

### 5. Perform one fail-closed quality check

Inspect the actual generated image and verify:

- No text, logos, or watermarks appear
- The main action and event context are immediately legible on a phone
- The image communicates the correct event scale and energy
- An outdoor image unmistakably uses physical golden-hour light unless a recorded valid exception applies
- Golden-hour light creates depth and atmosphere without becoming a flat orange wash
- Major setting details are supported by the motif brief
- Anatomy, equipment, motion direction, scale, lighting, and crowd behavior are plausible
- The result passes the name-removal, decisive-moment, scale-proof, focal-hierarchy, and trust tests in the actual pixels
- The result feels cinematic, specific, believable, elevated, energetic, and memorable rather than like routine event coverage

Treat any of these as a hard failure: text or logos, invented geography, wrong activity, implausible equipment, reversed motion, serious anatomy problems, major scale mismatch, generic or passive composition, weak focal hierarchy, or an outdoor image that does not unmistakably read as golden hour. A broad midday-blue sky, high or overhead sun, short shadows, neutral illumination, or mild warmth without low directional sunlight is not golden hour.

Never make an automatic edit, variation, or second generation after the one image call—even for a hard failure. Do not call the image tool again unless the user explicitly authorizes another paid attempt after seeing the failure. For batch work, stop only the failed event at private review; do not block successful events and do not silently consume another credit.

## Return the result

If the image passes, return in this order:

1. **Final hero image** — the single selected image
2. **Hero concept** — one or two sentences explaining the chosen moment
3. **Recurring motifs** — three to five short bullets
4. **Do not invent** — only the meaningful event-specific warnings
5. **Lighting decision** — `Golden hour required` or the recorded exception
6. **Confidence** — High, Medium, or Low, with one sentence based on the visual evidence

If the image fails, do not call it final, selected, approved, or ready. Return:

1. **Rejected hero — no additional generation performed**
2. **Failure reason** — one concrete sentence naming the failed rule
3. **Hero concept, motifs, do-not-invent warnings, lighting decision, and confidence** — retain these for a user-authorized future attempt without repeating research

Keep the report concise. When a web page was opened, cite the key event-specific source close to the claim it supports.

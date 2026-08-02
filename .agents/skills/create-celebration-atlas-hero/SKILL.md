---
name: create-celebration-atlas-hero
description: Create or refine one evidence-grounded, text-free, portrait hero image that captures the distinctive visual essence and true scale of a Celebration Atlas event. Use when Codex needs to create, generate, replace, refresh, or repair a Celebration Atlas event-page hero image, or when an event-creation workflow reaches its hero-image stage. Prefer a supplied image-search screenshot or one top-thumbnail scan, extract recurring motifs and do-not-invent constraints, choose one cinematic moment with golden-hour lighting by default for outdoor scenes, generate once, and verify mobile suitability.
---

# Create a Celebration Atlas Hero Image

Create one strong image that makes the viewer feel the atmosphere, character, and real scale of the actual event. Treat visual truth and event specificity as more important than spectacle for its own sake.

Keep the workflow research-light and generation-light. Use thumbnails to understand the event; do not perform deep research unless ambiguity could cause a major visual invention.

## Preferred execution profile

Run this workflow with GPT-5.6 Luna at Max reasoning when the host surface supports that selection. The skill cannot switch its own host model, so select Luna Max before invoking it or pin Luna Max in the calling agent or configuration. Use the added reasoning depth to judge motifs, scale, truthfulness, and composition—not to expand the research pass or generate extra images by default.

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

### 3. Choose one cinematic hero moment

Combine one signature action with one signature setting or atmospheric cue. Consider possible concepts internally, then select only the strongest.

Match the composition to the event's real scale:

- For an intimate event, move close enough to capture expression, craft, or interaction.
- For a lively event, show the focal action with visible participation and environmental context.
- For a major spectacle, show breadth, crowd density, layered action, and visible energy. Do not reduce a large, highly attended event to a quiet family vignette or a nearly empty setting.

Preserve one dominant moment rather than making a collage. Let secondary details communicate scale and place without competing with the focal action.

Use golden hour as the production default for outdoor Celebration Atlas heroes—roughly nine out of ten outdoor images. If an outdoor concept can plausibly exist at golden hour, choose golden hour without asking or comparing a daytime alternative. Use believable low-angle side or backlight, luminous atmosphere, dimensional shadows, warm highlights, and event-specific colors that remain recognizable. Create directional light and depth rather than applying a flat orange tint.

Depart from golden hour only when another condition defines the event: night lighting or fireworks, an indoor setting, a sunrise tradition, a morning- or midday-only activity whose time is visually important, defining weather, or an explicit user request. Treat ordinary daytime reference photos as identity evidence, not a requirement to copy their lighting.

Use a wide environmental scene only when the setting is supported. When spatial evidence is weak, tighten the camera around a confirmed activity rather than inventing a panorama.

### 4. Generate once

Use the available image-generation skill and tool, following its input rules. Default to a vertical 2:3 hero image unless the user specifies otherwise.

Write a short, concrete generation prompt that states:

- The image's Celebration Atlas hero purpose
- The main subject and action
- The confirmed setting
- The correct scale, crowd energy, and spatial breadth
- The composition and mobile-safe focal placement
- The cinematic light and atmosphere
- The hard exclusions

Use realistic photographic detail with elevated but believable color, contrast, motion, and atmosphere. Do not overload the generation prompt with the research narrative.

Explicitly prohibit:

- Readable or pseudo-readable text
- Signs, banners, titles, captions, posters, watermarks, and event names
- Logos and recognizable branding
- Invented landmarks, geography, attractions, buildings, terrain, or event scale
- Generic stock-photo staging
- Crowded collage-like composition and unrelated visual noise
- Fantasy, painterly, plastic, or implausibly overprocessed treatment unless requested

Frame real-world structures so signage is absent rather than allowing fake or garbled lettering.

### 5. Perform one economical quality check

Inspect the actual generated image and verify:

- No text, logos, or watermarks appear
- The main action and event context are immediately legible on a phone
- The image communicates the correct event scale and energy
- An outdoor image uses golden-hour light unless a genuine exception applies
- Golden-hour light creates depth and atmosphere without becoming a flat orange wash
- Major setting details are supported by the motif brief
- Anatomy, equipment, motion direction, scale, lighting, and crowd behavior are plausible
- The result feels cinematic, specific, believable, elevated, and memorable

Make one focused edit or regeneration only for a hard failure such as text, invented geography, wrong activity, implausible equipment, reversed motion, serious anatomy problems, or a major scale mismatch. Do not automatically create variations or regenerate for minor subjective preferences. Reuse the same motif brief without researching again.

If the corrected image still violates a hard rule, state the issue instead of presenting it as finished.

## Return the result

Return, in this order:

1. **Final hero image** — the single selected image
2. **Hero concept** — one or two sentences explaining the chosen moment
3. **Recurring motifs** — three to five short bullets
4. **Do not invent** — only the meaningful event-specific warnings
5. **Confidence** — High, Medium, or Low, with one sentence based on the visual evidence

Keep the report concise. When a web page was opened, cite the key event-specific source close to the claim it supports.

# Event Hub image specification

Status: authoritative contract for finished Event Hub hero assets.

## Required file

| Property | Requirement |
| --- | --- |
| Canvas | Exactly 1024 x 1536 pixels |
| Aspect ratio | 2:3 portrait |
| Formats | JPEG/JPG, PNG, or WebP |
| Maximum size | 8 MB (8,388,608 bytes) |
| Animation/pages | One still image only |
| Storage | Existing `celebration-atlas-media` Supabase bucket |

The uploaded bytes must decode to the declared format. Renaming another file type is not accepted. Atlas Control validates MIME type, decoded format, dimensions, page count, and byte size before storage.

## Composition and viewport behavior

Prepare the entire 1024 x 1536 canvas as the finished composition. Do not depend on transparent padding, upload-time cropping, or a later repositioning step.

The Event Hub renders the asset with `object-fit: contain` in its responsive hero frame. A conforming canvas is therefore never cropped at a supported viewport size. Wider hero frames may show Celebration Atlas gradient space beside the portrait canvas; that is intentional. Atlas Control uses the same complete-canvas presentation for review.

Event name, date, and location remain HTML content over the lower portion of the hero. Keep critical faces, symbols, and other indispensable detail inside the central horizontal 76 percent and upper 68 percent of the canvas. The lower 32 percent may sit behind the Event Hub copy and readability scrim. Do not bake event titles, dates, sponsor marks, or interface copy into the image unless they have been separately reviewed as part of the supplied artwork.

## Finished-asset pathway

```text
finished image asset
-> specification validation
-> existing visual workflow
-> human approval
-> immutable Event Factory package revision
-> existing Event Hub hero on the same URL
```

Manual uploads retain the uploader, upload timestamp, source filename, dimensions, byte size, MIME type, storage identity, visual review, and package/page publication audit. Replacement creates linked visual, package, and Event Page revisions. Removal publishes an image-free manifest revision while retaining the event, prior media object, public URL, and audit history.

An improved event-image generation skill must submit its finished output through this same contract. It receives no separate publication or media pathway.

# Event Intake Workbench

The Event Intake Workbench is the first source-to-review step for scaling Event Hub coverage. An authorized Atlas administrator enters an official event URL in `/atlas-control`; the server inspects the public HTML and returns a review candidate. Inspection never creates, approves, or publishes a canonical event.

## Extraction order

The inspector uses evidence in this order:

1. Schema.org `Event` and `Festival` JSON-LD records.
2. Explicit Open Graph or event metadata.
3. Page title and primary heading for low-confidence name fallback.

Dates are accepted only from a selected structured event record or explicit event metadata, including a clearly bounded natural-language range in that metadata. Dates found in unrelated cards, sidebars, article publication fields, and general page prose are not promoted to event facts.

Every returned fact includes its extraction method and confidence. Missing name, date, city, or state fields remain visibly unresolved. Useful first-party schedule, lineup, ticket, registration, planning, history, pageant, parade, gallery, FAQ, and rules links are surfaced for follow-up inspection.

Sponsor fields, sponsor-language sentences, sponsor links, and known structured sponsor names are excluded from reviewable candidate content. The review reports only the number of excluded references, never the sponsor identities.

## Structured schedule adapters

Server-rendered inspection remains the default. When an archived official schedule page identifies the Saffire event calendar used by many festival sites, the collector may call its same-origin JSON schedule endpoint in bounded five-day batches. The adapter is subject to the same DNS, address, timeout, response-size, date-range, and item-count restrictions as HTML inspection.

The adapter converts local event times with `America/Detroit`, preserves the official detail locator, and creates verified schedule candidates. Display titles, descriptions, and venues are normalized before storage: raw markup, sponsor naming, branded stage prefixes, stale internal year labels, and obsolete edition-year descriptions are excluded while the verified event and time remain intact.

## Network safety

Official-source inspection runs only on the protected Node route `POST /api/atlas-control/event-source-inspection`.

The fetcher:

- Allows only public HTTP and HTTPS websites on standard ports.
- Rejects credentials in URLs, local hostnames, private addresses, link-local addresses, reserved ranges, and documentation networks.
- Resolves every redirect separately and blocks HTTPS downgrade redirects.
- Pins each request to a DNS-validated public address to prevent DNS rebinding between validation and connection.
- Limits redirects, request duration, compressed bytes, decoded bytes, content types, and JSON-LD block size.
- Returns sanitized extracted fields rather than raw source HTML.

## Operator workflow

1. Inspect the official event homepage.
2. Review extracted facts, evidence methods, confidence, and unresolved warnings.
3. Choose an existing Event Hub association when the event already has a checked-in page scaffold.
4. Start an evidence bundle. The bounded collector archives the homepage and up to seven prioritized same-site program, planning, history, personalities, parade, and tradition pages.
5. Inspect and add an individual official page manually only when a useful page was not collected or needs a retry.
6. Load the current candidate into the existing source-backed intake form.
7. Correct unresolved fields before submitting the candidate to the migration 004 review queue. The candidate is attached to the selected bundle.
8. Mark the evidence bundle ready for synthesis after source collection is complete.
9. Generate and review the versioned synthesis proposal. Reopen collection if conflicts or required fields need better evidence.

The candidate intake remains separate from Event Hub publication. Migration 005 review and publication controls are used only after a complete manifest has been produced and validated. Persistent source bundles and the private raw-source archive require migration 006. Versioned synthesis proposals require migration 007; see `docs/source-intelligence-schema.md` and `docs/event-source-synthesis.md`.

## Local validation

Run contract and network-policy fixtures:

```powershell
npm run validate:event-source-inspection
npm run validate:event-source-synthesis
```

Inspect a live official page from the command line:

```powershell
npm run inspect:event-source -- "https://www.browntroutfestival.com/"
```

The CLI prints the same sanitized review object used by Atlas Control.

## Current boundary

The workbench parses server-rendered HTML and approved same-origin structured calendar responses. It can perform one bounded same-site collection pass from an official homepage. It never follows third-party links, recursively crawls a site, executes third-party JavaScript, or exceeds the configured page and calendar caps. Deterministic synthesis reconciles claims, preserves real conflicts, and proposes a validated manifest. The optional evidence-bound editorial pass can refine allowlisted copy but cannot promote a proposal into an Event Hub draft or publish content.

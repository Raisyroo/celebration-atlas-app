# Event source synthesis

Migration `supabase/migrations/007_event_source_synthesis.sql` adds the review-gated layer between source bundles and Event Hub page versions. Migration `012_model_assisted_editorial_synthesis.sql` adds evidence-bound editorial children without weakening that boundary.

Synthesis creates an immutable proposal. It does not create an `event_page_version`, change a public URL, approve content, or publish an Event Hub page.

## Deterministic engine

`lib/event-intake/synthesisEngine.ts` reconciles the source bundle without an AI provider. It:

1. Excludes rejected and superseded claims from selection.
2. Gives operator-accepted claims priority over unreviewed claims.
3. Ranks remaining claims by confidence, confidence score, source fetch time, and a stable id tie-breaker.
4. Groups equivalent normalized values so corroborating sources support one result.
5. Preserves every distinct active value as a visible conflict instead of hiding disagreement.
6. Builds a nested reconciled profile with field-level claim and snapshot provenance.
7. Produces a conservative Event Hub manifest proposal and runs the normal manifest validator.
8. Classifies archived official pages as identity, schedule, history, personalities, gallery, or planning evidence.
9. Separates confirmed current-edition facts, the latest complete historical program, and enduring traditions.
10. Selects a simple, current-program, reference-rich, or tradition-rich editorial mode before composing modules.

Known events can use a published or checked-in manifest as their visual and editorial scaffold while source-backed identity, date, location, and schedule fields are overlaid. A new event receives only source-derived structure plus any explicitly registered Celebration Atlas visual. Required visual, timezone, identity, or provenance gaps remain empty and make the proposal invalid; the engine does not invent them.

When a current program is explicitly pending but an earlier complete program remains online, exact historical times may be composed only into a year-labeled `referenceSchedule`. They never enter current `scheduleItems`. Official history, personalities, and gallery pages can produce a dedicated `Traditions` module when at least two source-backed traditions are found.

Sponsor-bearing evidence remains in the reconciled profile for audit but is not copied into generated display text. The standard manifest validator also rejects sponsor language if it appears elsewhere in a proposal.

## Evidence-bound editorial pass

The optional `model_assisted` pass is a child of one unsubmitted deterministic proposal. It receives a bounded package of official source excerpts, current schedule rows, the deterministic editorial plan, and an allowlist of prose targets. It may:

1. Rewrite the hero tagline and existing module copy.
2. Rewrite existing Scout prompt labels and responses.
3. Add up to two source-backed Why Go audience groups when none exist.
4. Add one source-backed Scout Spotlight when none exists.

It cannot change identity, dates, locations, lifecycle, media, links, navigation, modules, filters, commands, source records, or schedule rows. The application hashes that immutable projection before and after applying model output and rejects the result if it moves.

Every proposed copy change must cite retained source snapshot ids. The application independently rejects unknown targets, unknown sources, duplicate targets, sponsor language, speculative language, and numeric claims that do not appear in the cited evidence. The normal Event Page Manifest validator then runs again. Model output remains a private proposal and never publishes content.

Vercel AI Gateway supplies the production model call through `VERCEL_OIDC_TOKEN` or `AI_GATEWAY_API_KEY`. The default model is `openai/gpt-5.4-mini`; `AI_GATEWAY_EDITORIAL_MODEL` can override it. Vercel currently requires the team to have a valid card on file before Gateway will serve requests, including free-credit usage.

## Records

### `event_source_syntheses`

Each row stores a version number, input hash, engine identity, reconciled profile, conflicts, manifest proposal, validation report, quality score, and review state. The input hash makes generation idempotent for the same bundle evidence and engine version.

Lifecycle states are:

- `generated`
- `in_review`
- `accepted`
- `rejected`
- `superseded`

Only a valid manifest proposal can be accepted. Acceptance records that the evidence synthesis passed human review; it is not a publication action.

The protected fact generator is deterministic and requires no model API key. A retained `model_assisted` child stores its parent synthesis id, provider, model, response id, prompt version, changed targets, rejected-copy count, and safeguard results. It uses the same validation, versioning, review, and audit gates.

### `event_source_synthesis_actions`

This append-only audit ledger records generation, review submission, acceptance, rejection, and supersession with the actor and transition states.

## Mutation boundary

The service role can read proposal and audit records. Mutations use only fixed `security definer` RPCs with an empty search path:

- `atlas_create_event_source_synthesis`
- `atlas_create_model_assisted_synthesis`
- `atlas_transition_event_source_synthesis`
- `atlas_list_event_source_syntheses`

The protected `/api/atlas-control/source-syntheses` route independently requires Atlas administrator authorization and sends private, non-cacheable responses.

## Operator workflow

1. Collect and review official sources in an evidence bundle.
2. Mark the bundle `ready_for_synthesis`.
3. Generate a proposal in Atlas Control.
4. Review its quality score, conflicts, missing fields, and manifest validation issues.
5. Review the proposed editorial mode, truth layers, reference year, tradition coverage, recommended tabs, and editorial readiness checks.
6. Choose `Polish with AI` when the deterministic structure is sound and the prose needs refinement.
7. Open `Preview Event Hub` to inspect the exact valid proposal through the mobile Event Hub renderer before submitting it for review.

The evidence-bound editorial pass also keeps research narration out of visitor-facing copy, requires Scout Spotlights to cite history or tradition evidence rather than schedule-only listings, and reassigns public source IDs whenever rewritten copy changes its supporting citations.
7. Review the model, changed targets, rejected copy, citations, and five safeguard checks on the child proposal.
8. Reopen the bundle and add or correct evidence when the proposal is incomplete.
9. Submit a valid proposal for review.
10. Accept or reject it with review notes.

An accepted proposal can be frozen into a private Event Factory package. Acceptance still does not create an Event Hub page version or publish a URL. Only final package approval invokes the existing migration 005 draft, review, and publication gates.

## Validation

Run deterministic reconciliation and safety fixtures:

```powershell
npm run validate:event-source-synthesis
```

The fixtures cover accepted-claim precedence, conflict preservation, rejected-claim exclusion, sponsor-copy filtering, incomplete new-event proposals, valid checked-in scaffolds, stable input hashes, historical schedule separation, editorial source classification, general festival traditions, source-bound rewrites, unsupported numeric rejection, immutable-fact locking, Scout enrichment, and model provenance.

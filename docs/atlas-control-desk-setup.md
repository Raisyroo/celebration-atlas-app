# Atlas Control Desk setup

The `/atlas-control` console is a protected production route for authorized Atlas administrators. The home page remains public.

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ATLAS_ADMIN_EMAILS` - comma-separated administrator email allowlist.

Evidence-bound editorial assistance also requires one of:

- `VERCEL_OIDC_TOKEN` - supplied automatically on Vercel and refreshed locally by `vercel env pull`.
- `AI_GATEWAY_API_KEY` - a Vercel AI Gateway key for non-OIDC environments.

`AI_GATEWAY_EDITORIAL_MODEL` is optional and defaults to `openai/gpt-5.4-mini`. The linked Vercel team must have a valid card on file before AI Gateway will serve requests, including requests covered by free credits. Deterministic collection and synthesis continue to work without Gateway access.

If these values are absent, the app still builds and the public Atlas experience stays available. The control route shows a configuration-needed state instead of exposing secrets or crashing.

## Supabase Auth redirect

In Supabase Auth URL configuration, allow the deployed callback URL:

- `https://<your-vercel-domain>/auth/callback`
- Current production: `https://celebration-atlas-app.vercel.app/auth/callback`

For local testing, also allow:

- `http://localhost:3000/auth/callback`

Set the Supabase Auth Site URL to the production origin, currently `https://celebration-atlas-app.vercel.app`. If the Magic Link email template has been customized, its link must use `{{ .ConfirmationURL }}`. A template built from `{{ .SiteURL }}` can discard the requested callback and strand the one-time `code` on the homepage.

The homepage includes a recovery redirect for legacy or misconfigured links that arrive as `/?code=...`, but the exact production callback should still remain in Supabase's Redirect URLs allowlist.

Magic-link sign-in uses the browser anon key only for authentication. Control-plane mutations are performed by server route handlers with the service-role key and typed RPC wrappers only.

## Database migrations

Apply the Atlas Control migrations in order through the existing Supabase migration workflow:

1. Migration 004 for the operations ledger and review queue.
2. `supabase/migrations/005_event_page_publishing.sql` for reviewed Event Hub publication.
3. `supabase/migrations/006_event_source_intelligence.sql` for evidence bundles, provenance claims, schedule candidates, and the private source archive.
4. `supabase/migrations/007_event_source_synthesis.sql` for versioned synthesis proposals and their human-review audit trail.
5. `supabase/migrations/008_event_factory_verification.sql` for annual-event due diligence, retained proof, and verification review actions.
6. `supabase/migrations/009_fix_atlas_service_role_assertion.sql` and `010_fix_atlas_candidate_intake.sql` for current PostgREST service-role claims and the current JSON-backed discovery schema.
7. `supabase/migrations/011_event_factory_packages.sql` for complete private packages, immutable review payloads, and final editorial approval.
8. `supabase/migrations/012_model_assisted_editorial_synthesis.sql` for parent-bound AI editorial proposals, retained provider metadata, and immutable safeguard audits.
9. `supabase/migrations/013_source_synthesis_map_record.sql` for source-backed private map records before canonical publication.
10. `supabase/migrations/014_event_visual_workflows.sql` for visual-signature briefs, cloud hero assets, QA, and audited human art approval.
11. `supabase/migrations/015_public_rls_hardening.sql` and `016_public_schema_security_guardrails.sql` for closed-by-default public-schema access and deploy-time security assertions.
12. `supabase/migrations/017_event_factory_revisions.sql` for immutable same-edition hero corrections and linked package revisions.

The readiness panel reports these foundations separately. Public Event Hub routes continue using checked-in manifests when migration 005 is absent or no reviewed database version has been published. See `docs/event-page-publishing.md` for the complete workflow.

The Michigan Event Factory panel reconciles discovery candidates, canonical events, retained verification, map presence, Event Hub versions, and art approvals. Its eight readiness gates and operating boundary are documented in `docs/event-factory.md`.

## Official-source inspection

Authorized administrators can inspect a public official event URL directly in Atlas Control before creating a source-backed candidate. Basic inspection does not require a database migration and never publishes an event. Persisting multi-page evidence bundles and private raw-source archives requires migration 006; versioned deterministic synthesis requires migration 007. Extraction rules, network restrictions, and current boundaries are documented in `docs/event-intake-workbench.md`; storage, synthesis, and database structure are documented in `docs/source-intelligence-schema.md` and `docs/event-source-synthesis.md`.

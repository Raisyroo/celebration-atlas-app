# Supabase media pilot

No Supabase client, environment-variable convention, storage bucket convention, or migration workflow was found in this repository during the pilot audit. This PR therefore keeps the media foundation as typed metadata and a resolver only.

## Bucket and path convention

Bucket: `celebration-atlas-media`

Initial paths:

- `brand/`
- `maps/michigan/`
- `events/brown-trout-festival/flyer/`
- `events/brown-trout-festival/cards/`
- `events/brown-trout-festival/thumbnails/`

## Deferred table recommendation

If approved later, create a media metadata table similar to:

```sql
create table event_media (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  media_role text not null check (media_role in ('flyer', 'thumbnail', 'hero', 'event-card', 'gallery', 'map-art', 'brand')),
  source text not null check (source in ('supabase', 'local')),
  url text,
  storage_path text,
  title text,
  alt_text text,
  sort_order integer,
  status text check (status in ('draft', 'approved', 'archived')) default 'draft',
  updated_at timestamptz not null default now(),
  version text
);
```

For the controlled Brown Trout pilot, approve only one Supabase flyer record with a public HTTPS `url` before expecting it to override the local flyer fallback.

## Server-side approved flyer lookup

The visual app can resolve approved Supabase flyer media before falling back to the local flyer catalog. The lookup runs only on the server and uses these server-side-only environment variables:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Do not prefix the service-role key with `NEXT_PUBLIC_`, and do not place real values in GitHub, examples, screenshots, logs, browser bundles, or docs. Browser components receive only the final approved public flyer URL/path.

For each event, the server resolver maps the app event id to its canonical slug, queries `event_media` for `source = supabase`, `status = approved`, and `media_role = flyer` joined to the matching `events.slug`, then returns an approved `public_url` or constructs a public Storage URL from `storage_bucket` and `storage_path`. If configuration is missing, malformed, unavailable, or no approved row exists, the existing local flyer catalog remains the fallback.

Developer-only Romeo diagnostics are available in local development at `/dev/romeo-media-diagnostics`. The page reports the canonical slug, whether Supabase or local fallback was used, and the final public media URL/path without printing secrets.

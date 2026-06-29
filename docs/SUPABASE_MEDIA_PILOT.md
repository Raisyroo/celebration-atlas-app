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

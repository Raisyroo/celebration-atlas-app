-- Add the private Michigan completion exception type emitted by migration 023
-- to the pre-existing Atlas Control review-type allowlist. This preserves every
-- existing review item and continues to reject arbitrary review_type text.

alter table public.atlas_review_items
  drop constraint atlas_review_items_type_check;

alter table public.atlas_review_items
  add constraint atlas_review_items_type_check check (
    review_type = any (
      array[
        'ambiguous_event_match'::text,
        'duplicate_risk'::text,
        'conflicting_source_data'::text,
        'missing_or_non_official_source'::text,
        'suspicious_date_location_change'::text,
        'media_collision'::text,
        'policy_or_validation_block'::text,
        'other'::text,
        'michigan_completion_exception'::text
      ]
    )
  );

alter table public.atlas_review_items enable row level security;

revoke all on table public.atlas_review_items
  from public, anon, authenticated, service_role;
grant select on table public.atlas_review_items to service_role;

comment on constraint atlas_review_items_type_check
  on public.atlas_review_items is
  'Narrow Atlas Control review categories, including private Michigan completion exceptions.';

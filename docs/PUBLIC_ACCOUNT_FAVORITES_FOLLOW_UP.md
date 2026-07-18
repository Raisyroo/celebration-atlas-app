# Public Accounts And Favorites Follow-Up

Status: separate future task; no public account or synchronized-favorites work is implemented by the homepage-menu cleanup.

## Current Public Reality

- Celebration Atlas has no public sign-in, registration, account, favorites, or sign-out route.
- The Supabase authentication behind `/atlas-login`, `/auth/callback`, and `/atlas-control` is private Atlas Control operator access. It must not be reused as a public account surface.
- The Michigan homepage heart stores one browser-local state preference under `celebration-atlas:michigan:favorite`.
- Event Hub hearts store isolated browser-local booleans under `celebration-atlas:event-favorite:<eventId>`.
- No page collects those toggles into a favorites list. They are not associated with a user, synchronized, recoverable on another device, or protected by user-owned RLS.

Until the work below is approved and complete, the public hamburger must not render Sign In, Create Account, Favorites, Account, or Sign Out.

## Proposed Follow-Up Task

Build a public account and event-favorites system that is explicitly isolated from Atlas Control.

### Product Decisions Required Before Implementation

1. Decide whether public launch supports email magic links, another identity provider, or both.
2. Decide whether a public profile needs any field beyond the Supabase user ID and optional display name.
3. Decide whether anonymous Event Hub favorite toggles should be imported after sign-in, kept local, or discarded. Import must require a clear user choice.
4. Decide whether “favorite Michigan” remains a distinct state-following feature. It must never be silently converted into an event favorite.
5. Approve account-facing privacy, deletion, retention, recovery, and terms copy before enabling registration.

### Required Public Surface

- A public sign-in route.
- A public create-account route if registration is open.
- A public auth callback and recovery flow with names and redirects distinct from Atlas Control.
- A Favorites route showing the signed-in user’s currently public, reviewed events.
- An Account route with the approved profile and account-management controls.
- A public sign-out action that returns safely to the public Atlas.
- A session provider or server boundary that exposes only public-user state to public components.
- Logged-out menu: Sign in / Create account, About Celebration Atlas, Privacy, Terms.
- Logged-in menu: Favorites, Account, Sign out, Privacy, Terms.

No public route may redirect ordinary users to `/atlas-login` or `/atlas-control`. A person who separately has Atlas Control authorization must still enter that operator system through its private access flow.

### Required Data Contract

- Use a stable public user ID tied to `auth.users.id`.
- Add a minimal public profile table only if the approved account UI needs profile data.
- Add an event-favorites table keyed by `(user_id, event_id)` with creation timestamps and a foreign key or validation path to the canonical reviewed event identity.
- Keep publication truth authoritative: an unpublished or removed event must not leak through a favorites response.
- Add explicit RLS policies allowing an authenticated public user to select, insert, and delete only rows whose `user_id = auth.uid()`.
- Deny anonymous and cross-user reads and writes.
- Keep service-role Event Factory and Atlas Control access separate from public-user policies.
- Add a numbered migration and verify local/remote migration parity before deployment.

### Anonymous Favorite Reconciliation

- Inventory only recognized `celebration-atlas:event-favorite:<eventId>` keys on the current device.
- Validate every candidate event ID against the reviewed public catalog before import.
- Ask for explicit consent before copying local toggles into the account.
- Make import idempotent and preserve a clear retry/error state.
- Decide separately what to do with `celebration-atlas:michigan:favorite`; it has state-level semantics.
- Remove or migrate the legacy UI that reuses the Michigan key while describing it as “My Events.”

### Acceptance Checks

- Public registration, sign-in, callback, recovery, account, favorites, and sign-out work without entering any Atlas Control route.
- Logged-out and logged-in menus match their approved contracts exactly.
- Favorites persist across supported browsers/devices after sign-in and remain private to their owner.
- RLS tests prove anonymous denial and cross-user isolation for select, insert, update if allowed, and delete.
- Local favorite import is explicit, idempotent, catalog-validated, and does not reinterpret the Michigan state key.
- Account deletion and data-retention behavior match approved privacy copy.
- Browser Back/Forward, Event Hub navigation, homepage discovery restoration, keyboard access, and mobile safe areas remain intact.
- `npm run lint` and `npm run build` pass, followed by focused public-auth and RLS tests and targeted browser review.

## Explicit Non-Goals For The Menu Cleanup

The menu cleanup must not create Supabase account tables, public authentication, session plumbing, favorites APIs, persistence synchronization, or RLS policies. Browser-local favorite controls remain as-is until this follow-up is selected.

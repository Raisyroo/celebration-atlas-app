# Atlas Control Desk setup

The `/atlas-control` console is a protected production route for authorized Atlas administrators. The home page remains public.

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ATLAS_ADMIN_EMAILS` — comma-separated administrator email allowlist.

If these values are absent, the app still builds and the public Atlas experience stays available. The control route shows a configuration-needed state instead of exposing secrets or crashing.

## Supabase Auth redirect

In Supabase Auth URL configuration, allow the deployed callback URL:

- `https://<your-vercel-domain>/auth/callback`

For local testing, also allow:

- `http://localhost:3000/auth/callback`

Magic-link sign-in uses the browser anon key only for authentication. Control-plane mutations are performed by server route handlers with the service-role key and typed RPC wrappers only.

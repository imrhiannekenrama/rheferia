# Supabase setup for Rheferia

Rheferia needs Supabase for accounts, private projects, saved research,
citation lists, conversion records, and durable guest limits. Everything
else (search, source pages) works without it.

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com) (free tier works).
2. Note your **Project URL**, **publishable (anon) key**, and **service role key**
   from *Project Settings → API*. The service role key must never reach the
   browser bundle; Rheferia only reads it server-side.

## 2. Apply the schema

In the Supabase SQL editor (or `supabase db push` if you use the CLI), run:

```
supabase/migrations/0001_schema.sql
```

This creates the 17-table schema with row-level security on every user
table, the signup trigger (`handle_new_user`), notes-count maintenance,
and the two server-side limit helpers (`bump_rate_limit`,
`bump_guest_usage`). The helpers are revoked from `anon`/`authenticated`;
only the service role may call them.

## 3. Configure auth

- In *Authentication → Providers*, enable **Email**. Password sign-in
  needs no extra setup.
- In *Authentication → URL Configuration*, set the **Site URL** to your
  deployed origin, and add `https://<your-domain>/auth/callback` to
  **Redirect URLs**.
- Email confirmation is recommended: Rheferia's sign-up flow shows the
  "check your email" notice when no session is returned.

## 4. Environment variables

Add to `.env.local` (see `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service key>     # server-only; enables durable guest limits
RATE_LIMIT_SECRET=<long random string>      # peppers the IP hash
```

Deploy the same values in your hosting provider's dashboard. Supabase
keys are environment-provided, never hardcoded.

## 5. Verify

1. `npm run build` should succeed either way.
2. Visit `/signup`, create an account, confirm via email, and you should
   land on `/account` with your display name, auto-created first project,
   and preferences loaded from `user_settings` (this proves the
   `handle_new_user` trigger ran).
3. With `SUPABASE_SERVICE_ROLE_KEY` set, guest limits run in Postgres
   (`rate_limits` / `guest_usage` rows appear as guests search). Without
   it, the limiter falls back to an in-process counter that protects a
   single instance only — the UI and API stay honest about that.

## Security notes

- RLS is deny-by-default; every table has explicit policies.
- `guest_usage` stores only a salted SHA-256 hash of the IP, never the IP.
- Project members can read shared items but only owners can delete
  projects or manage membership.
- `search_history` writes only happen when the account opted in
  (`user_settings.save_search_history`), which is off by default.

# PastQ architecture

PastQ never stores question content in any form. Only identity, sessions, profiles and timestamps are stored. Questions come from the PastQ Bank API at request time.

## Accounts
PastQ uses a server-owned identity layer backed by Supabase Postgres, not Supabase Auth. Server routes use the service role only; all identity tables have RLS enabled, no policies, and anon/authenticated access revoked. Browser sessions contain a random `__Host-pastq_session` token; only its SHA-256 hash is persisted. Email codes are HMAC-SHA256 digests, single-use, short-lived and rate-limited. Google sign-in uses authorization code + PKCE and verifies the ID token against Google's JWKS before linking by verified email.

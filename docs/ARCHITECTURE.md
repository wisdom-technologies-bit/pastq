# PastQ architecture

PastQ never stores question content in any form. Only session IDs, users, timestamps and score summaries may be stored. Questions only come from the PastQ Bank API at request time.

## Accounts and authentication
PastQ uses a server-owned identity layer backed by Supabase Postgres, not Supabase Auth. Users, profiles, one-time email codes, hashed session tokens, and rate limits live in private RLS-enabled tables with anon and authenticated access revoked. The browser receives only a Secure, HttpOnly `__Host-pastq_session` cookie containing a random token; the server stores only its SHA-256 hash. Email codes are CSPRNG-generated, HMAC-SHA256 hashed, single-use, short-lived, attempt-limited, and sent through Brevo. State-changing routes enforce same-origin requests. Session lookup is centralized in `lib/auth/session.ts`, and protected pages use `requireUser()` or the route matcher.

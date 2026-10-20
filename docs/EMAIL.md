# PastQ email system

Transactional email uses the typed registry in `lib/email/templates` and `sendEmail({ to, template, data })`. The shared table layout is inline CSS only, 560px wide, uses the hosted PastQ PNG, and always includes a plain-text alternative. The registry contains sign-in code, welcome, and account-deleted copy; payment receipt, activation confirmed, payment failed, renewal reminder, and price change are typed TODO slots.

Every attempt is recorded in `email_log` with recipient, template, status, provider id, and a generic error. Bodies and codes are never stored. Brevo 5xx responses receive one retry. Email failures should be surfaced by the sign-in flow without exposing provider details.

Voice: short notes from a small team in Nigeria. Plain words, warm, no exclamation marks, emoji, marketing phrases, or formal greetings.

When a sending domain exists, add SPF, DKIM, and DMARC DNS records supplied by Brevo. Start DMARC with monitoring (`p=none`), review reports, then tighten it after SPF and DKIM pass consistently.

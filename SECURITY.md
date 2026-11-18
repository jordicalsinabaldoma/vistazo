# Security

## Reporting a vulnerability

Please do not open a public issue. Use **GitHub → Security → Report a vulnerability** (private report) on this repo.
Tell me what you saw, how to reproduce it and how far you think it reaches. I will answer as soon as I can; this is a
personal project with no guaranteed response times.

Especially interesting:
- Bypassing permissions: a guest who sees another review, a reviewer who approves their own work, an agent key that
  comments or approves.
- Prompt injection: a comment that manages to break out of the data block or slip through without the "looks like an
  instruction" warning.
- XSS or reading private files (screenshots, videos) without access.

## How it is designed

- No secrets in the repo: everything goes in environment variables (see `.env.example`). The server will not start
  without `SESSION_SECRET` (≥ 32 characters) and database credentials.
- Passwords with scrypt. JWT session in an `httpOnly` cookie, `secure` in production and `SameSite=Lax`.
- Guest links and agent keys: only the hash is stored; the secret is shown once and can be revoked at once (which also
  cuts off screenshots and videos, served with access control).
- Comments are third-party data. The prompt for the agent isolates them (see README, "Security") and tests check it
  (`npm test`).
- Links published by an agent cannot use `javascript:`, `data:` or `file:`; QR codes are generated in the browser.
- Dependencies: `npm audit --omit=dev` shows no high or critical issues. Some moderate warnings remain in an internal
  `firebase-admin` chain (google-gax → rimraf → glob/minimatch) that never receives user data.

## Known limits (before using it with real data)

- Open sign-up and no rate limiting on login and links.
- No email: no password recovery.
- Attachments do not expire.

Details in `docs/LIMITATIONS.md`.

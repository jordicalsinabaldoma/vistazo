# Limitations and next steps

## Not included or limited (said plainly)
- **No email**: no password recovery and no email invitations. To add a member, they need an account (you add them by
  email in Settings). Guest links are copied and sent by hand.
- **Open sign-up**: anyone can create an account, but they only see projects where they are a member. For use with real
  companies: a domain allowlist or mandatory invitations.
- **No rate limiting** on login, sign-up or links. Needed before exposing it with real data (Vercel Firewall or a
  counter in Firestore).
- **Verdicts**: written in a transaction. Comments saved before the redesign are not cleaned of invisible characters
  when saved, but they are when the prompt is generated.
- **Files and guests**: a guest of one review could open an attachment from another review of the same app only if they
  know its path (16 random characters). Closing this fully needs the review in the blob path.
- **Editing a published version**: versions are not edited; you fix things by publishing another one ("Start from vN"
  in the form copies flows and attachments so you can reorder, remove or add). That way history is never rewritten.
- **Commenting live on a native app**: would need emulator streaming. Current path: QR/deep link + screenshots.
- **Visual diff**: compares at low resolution and groups into zones (numbered boxes); it still does not tolerate shifts
  (if something pushes content down, the zone covers everything below). Next step: region alignment or SSIM, and
  running it in a worker.
- **GitHub PR**: only a link (by hand or read with `gh` by the CLI). No state sync, on purpose. A possible next step: a
  read-only GitHub App (state kept up to date) and, only if a team asks for it, a write check.
- **Behaviour test** (`scripts/redteam-feedback.ts`): written, not run (needs an API key and costs money).
- **CLI**: used from the repo (`node cli/bin/vistazo.mjs`); not published on npm.
- **Retention**: blobs do not expire. Add `ttlDays` or per-project cleanup.
- **Protected deployments**: reviewing protected Vercel previews would need a bypass token per project (not
  implemented, on purpose).

## Suggested next iteration
1. Rate limiting + domain allowlist.
2. A CI webhook/action to publish per PR and return the approval state as a check.
3. Notifications (email/Slack) to reviewers when something is published.
4. A tolerant diff and video comparison by keyframes.

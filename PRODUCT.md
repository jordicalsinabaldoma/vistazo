# Vistazo: product

The visual pull request for your app. For people who build with agents (vibe coding) and for people who review what
they see (design, product, clients).

## Model

**App → Review → Version**, like repository → pull request → commits.

- **App**: a project (site or app). It holds what is permanent: what the app is, its critical flows, who has an
  account, guest links and agent keys. All of that lives in "Settings", in the background.
- **Review**: a change or feature with its purpose. Title, what changes, what to test, test data, branch and,
  optionally, a link to the PR (only a link: no state is synced). Comments belong to the review.
- **Version**: each round after fixing things from the feedback (v1, v2…). Screenshots per step, live link, check
  results and verdicts. Open comments carry over on their own to the next version of the same review; the diff compares
  with the previous version of the same review.

## A review, in three tabs

- **Overview**: what changes, what to test and the whole conversation in order. A single comment box, at the end.
- **Review**: the main one. Screenshots, the app live or on mobile (QR), or what changed. On the side, comments, test
  kit and checks. To comment on something specific you click the screenshot or the site: no forms in sight.
- **Versions**: each round, with who published it and what each reviewer said.

The **test kit** is the data needed to test (users, codes, products…), each with its own QR, one at a time. It is
agnostic: each app defines its data types, and it accepts the QR label page format.

## The loop

Publish → Review → Fix → Approve. The state is computed (never set by hand):
Pending review / With comments / Changes requested / Approved / Closed.

- **One main action per screen**, depending on who is looking and the state:
  author with no reviewers: Share; with comments or changes requested: Feedback for your agent; approved: Close.
  Reviewer: Start reviewing, or Review what changed if there is a new version.
- **The state guides, it does not block.** Everything else stays at hand. Only permissions block: authors cannot
  approve their own work, guests cannot approve, the agent cannot comment.
- **Finish review** ends the reviewer's turn: Approve, Request changes or Comment only (guests: Send comments). A new
  version cancels the previous approval. Approving with open notes is allowed, with a warning, and the state says so:
  "Approved, 2 open notes".

## Who does what

- Author: publishes (agent or form), shares, takes the feedback, publishes another version.
- Reviewer with an account: tests, comments, approves or requests changes.
- Guest: comes in with a link that opens a single review; tests and comments.
- Agent: one key per app; publishes versions and reads feedback. Nothing else.

## Principles

- Agnostic product: any site or app (mobile: screenshots + Expo/Metro QR, EAS Update, deep link or download).
  Nothing tied to one customer: what is specific to each team lives in its `vistazo.json` and its data types.
- Plain language, no jargon. In English.
- Comments are third-party data: the prompt for the agent isolates them (see README, "Security").

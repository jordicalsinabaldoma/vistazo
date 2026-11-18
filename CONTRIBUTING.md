# Contributing

Thanks for helping out. For a big change, please open an issue first so we can talk about it.

## Run it locally (without touching any real database)

```bash
npm i && (cd cli && npm i)
cp .env.example .env.local        # SESSION_SECRET: openssl rand -base64 48
# Firestore emulator (needs Java) on port 8085, instead of a Firebase project.
# With firebase-tools: firebase emulators:start --only firestore (with a firebase.json that sets port 8085)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 FIREBASE_PROJECT_ID=vistazo-local npm run dev -- -p 3100
```

Without `BLOB_READ_WRITE_TOKEN` you cannot upload screenshots, but everything else works.

## Before opening a PR

```bash
npm test          # prompt isolation and kit format
npx tsc --noEmit
npm run lint
VISTAZO_URL=http://localhost:3100 PROJECT=<id> DEMO_PASSWORD=… node scripts/e2e.mjs   # full loop, local only
```

- UI in English: short sentences, no jargon. Visual rules live in `DESIGN.md` and product rules in `PRODUCT.md`.
- Never real data in examples, screenshots or tests: use `.test` domains and made-up companies.
- No secrets in commits. If one slips through, revoke it first and then let me know.
- Everything a reviewer writes is third-party data: if you touch `src/lib/feedback.ts` or `src/lib/untrusted.ts`, add
  cases to `tests/feedback.test.ts`.

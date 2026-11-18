#!/usr/bin/env node
// vistazo: publish visual reviews from your agent and collect the feedback.
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { capture, client, env, fromDir, gitBranch, latestRevision, loadConfig, loadKit, prForBranch, publish } from "../lib/core.mjs";

const HELP = `vistazo: visual review for people who build with agents

Variables: VISTAZO_API_KEY (the app's agent key; never in the repo).
URL and app come from VISTAZO_URL / VISTAZO_PROJECT or from vistazo.json at the repo root:
  { "url": "https://…", "project": "…", "platform": "web|mobile", "kit": "path or https://…",
    "open": [{ "kind": "qr", "label": "Expo", "url": "exp+app://…" }],
    "kinds": [{ "key": "pallet", "name": "Pallet", "color": "orange", "icon": "stack" }],
    "baseUrl": "…", "flows": [ … flows for --capture … ] }

  vistazo capture  --config vistazo.config.json [--live-url URL] [--out dir]
      Walks the flows with Playwright on YOUR machine and leaves screenshots + video +
      manifest.json. Review, delete or reorder anything before publishing.

  vistazo publish  --title "…" [--summary "…" | --summary-file f.md] [--live-url URL]
                   [--config vistazo.config.json] [--capture | --shots dir]
                   [--branch name | --review id] [--pr URL] [--test-data "…"]
                   [--kit kit.json|labels.html|https://…]
                   [--qr URL [--qr-label "…"]] [--deeplink URL] [--download URL]
                   [--meta key=value]...
      Publishes a version. It goes to the open review for the current git branch (or
      creates one); --review sends it to a specific review. --capture walks the flows
      first; --shots publishes an existing folder (by hand, simulator, Appium,
      Maestro…: <flow>__<step>.png; --assets is the same). --kit attaches the test kit
      (QR label page format: its JSON or the whole HTML page). --qr / --deeplink /
      --download: how to open the version on a phone (Expo or Metro QR, EAS Update
      link, TestFlight, APK…). The review's open comments carry over to the new
      version on their own. Without --pr, if you have gh, the branch's PR is linked
      (read only; no state is synced).

  vistazo feedback [<versionId>] [--json]
      Prompt for your agent (default) or JSON, for your branch's review. Comments that
      look like instructions for an agent are set aside; review them on the web. The
      summary for people is only on the web.

  vistazo reviews          Lists the app's reviews.
  vistazo mcp              MCP server over stdio (for Claude Code, Cursor…).
`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: "string", short: "c" },
    title: { type: "string", short: "t" },
    summary: { type: "string", short: "s" },
    "summary-file": { type: "string" },
    "live-url": { type: "string" },
    capture: { type: "boolean" },
    assets: { type: "string" },
    shots: { type: "string" },
    kit: { type: "string" },
    deeplink: { type: "string" },
    download: { type: "string" },
    platform: { type: "string" },
    out: { type: "string" },
    qr: { type: "string" },
    "qr-label": { type: "string" },
    meta: { type: "string", multiple: true },
    branch: { type: "string" },
    review: { type: "string" },
    pr: { type: "string" },
    "test-data": { type: "string" },
    json: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
  strict: false,
});

const [cmd, arg] = positionals;
const log = (...a) => console.error(...a);

async function main() {
  if (!cmd || o.help) return console.log(HELP);
  if (cmd === "mcp") return (await import("../lib/mcp.mjs")).serve();

  const e = env();
  const cfg = await loadConfig(o.config);
  e.url ||= (cfg.url || "").replace(/\/$/, "");
  const project = e.project || cfg.project;
  const baseUrl = o["live-url"] || cfg.baseUrl;

  if (cmd === "capture") {
    const out = o.out || path.join(os.tmpdir(), `vistazo-${Date.now()}`);
    await capture(cfg, { baseUrl, outDir: out, log });
    return console.log(out);
  }

  const api = client(e);
  if (!project) throw new Error("Missing VISTAZO_PROJECT");

  if (cmd === "publish") {
    if (!o.title) throw new Error("Missing --title");
    let flows = [];
    let origin = "playwright";
    if (o.capture) {
      const out = o.out || path.join(os.tmpdir(), `vistazo-${Date.now()}`);
      log(`Capturing ${baseUrl} …`);
      flows = await capture(cfg, { baseUrl, outDir: out, log });
    } else if (o.assets || o.shots) {
      flows = await fromDir(o.assets || o.shots, cfg);
      origin = "external";
    }
    const summary = o["summary-file"] ? await readFile(o["summary-file"], "utf8") : o.summary || "";
    const previews = [
      ...(cfg.open || []),
      ...(o.qr ? [{ kind: "qr", label: o["qr-label"] || "Open on your phone", url: o.qr }] : []),
      ...(o.deeplink ? [{ kind: "deeplink", label: "Deep link", url: o.deeplink }] : []),
      ...(o.download ? [{ kind: "download", label: "Download the app", url: o.download }] : []),
    ];
    const testKit = await loadKit(o.kit || cfg.kit, o.kit ? process.cwd() : cfg._dir);
    const platform = o.platform || cfg.platform;
    const app = platform || cfg.kinds ? { ...(platform ? { platform } : {}), ...(cfg.kinds ? { kinds: cfg.kinds } : {}) } : undefined;
    const meta = Object.fromEntries((o.meta || []).map((m) => m.split(/=(.*)/s).slice(0, 2)));
    const branch = o.branch || gitBranch();
    const review = o.review
      ? { id: o.review }
      : { branch, prUrl: o.pr || prForBranch(), testData: o["test-data"], testKit };
    if (o.review && testKit) review.testKit = testKit;
    if (branch && !meta.branch) meta.branch = branch;
    const r = await publish(api, project, { title: o.title, summary, liveUrl: baseUrl, previews, meta, flows, origin, review, app, log });
    log(
      r.review.created
        ? `✓ New review #${r.review.number} "${r.review.title}" with its v1`
        : `✓ v${r.number} in review #${r.review.number}${r.carried ? ` (${r.carried} open comment(s) carried over to this version)` : ""}`,
    );
    return console.log(r.url);
  }

  if (cmd === "feedback") {
    const id = !arg || arg === "latest" ? await latestRevision(api, project, o.branch || gitBranch()) : arg;
    const fb = await api.get(`/api/revisions/${id}/feedback`);
    if (fb.flagged?.length) log(`⚠ ${fb.flagged.length} comment(s) set aside because they look like instructions for an agent. Review them on the web.`);
    return console.log(o.json ? JSON.stringify(fb.json, null, 2) : fb.prompt);
  }

  if (cmd === "reviews" || cmd === "revisions") {
    const { reviews } = await api.get(`/api/projects/${project}/reviews`);
    for (const r of reviews) console.log(`#${r.number}\tv${r.version}\t${r.stageLabel}\t${r.branch ?? "-"}\t${r.title}`);
    return;
  }
  console.log(HELP);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});

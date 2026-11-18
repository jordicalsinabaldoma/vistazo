// CLI core: Vistazo HTTP client, attachment upload, screenshot runner.
// The runner runs in YOUR environment (not on the hosted backend): Playwright needs a
// real browser and Vercel serverless functions are not the place for that.
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { put } from "@vercel/blob/client";

export function env() {
  const url = (process.env.VISTAZO_URL || "").replace(/\/$/, "");
  const key = process.env.VISTAZO_API_KEY || "";
  const project = process.env.VISTAZO_PROJECT || "";
  return { url, key, project };
}

export function client({ url, key }) {
  if (!url) throw new Error("Missing VISTAZO_URL");
  if (!key) throw new Error("Missing VISTAZO_API_KEY (the app's agent key; never store it in the repo)");
  const call = async (method, p, body) => {
    const res = await fetch(url + p, {
      method,
      headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${data.error || ""}${data.issues ? " " + JSON.stringify(data.issues) : ""}`);
    return data;
  };
  return { get: (p) => call("GET", p), post: (p, b) => call("POST", p, b) };
}

const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", webm: "video/webm", mp4: "video/mp4", mov: "video/quicktime", pdf: "application/pdf", zip: "application/zip", html: "text/html", json: "application/json", txt: "text/plain" };
export const typeOf = (f) => TYPES[path.extname(f).slice(1).toLowerCase()] || "application/octet-stream";
const kindOf = (t) => (t.startsWith("image/") ? "image" : t.startsWith("video/") ? "video" : "artifact");

function pngSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  return {};
}

export async function upload(api, project, file, origin = "playwright", caption) {
  const buf = await readFile(file);
  const contentType = typeOf(file);
  const { pathname, clientToken } = await api.post(`/api/projects/${project}/uploads`, {
    filename: path.basename(file),
    contentType,
    size: buf.length,
  });
  await put(pathname, buf, { access: "private", token: clientToken, contentType, multipart: buf.length > 8e6 });
  return { pathname, kind: kindOf(contentType), name: path.basename(file), contentType, size: buf.length, origin, caption, ...pngSize(buf) };
}

// ---------- Configuration ----------
/**
 * Repo configuration: --config, or vistazo.json / vistazo.config.json in the current
 * folder or at the git root. No secrets: the key goes in VISTAZO_API_KEY.
 */
export async function loadConfig(file) {
  const tries = file ? [file] : ["vistazo.json", "vistazo.config.json"].flatMap((f) => [f, path.join(gitRoot() || ".", f)]);
  for (const f of tries) {
    try {
      const cfg = JSON.parse(await readFile(f, "utf8"));
      cfg.flows ||= [];
      cfg._dir = path.dirname(path.resolve(f));
      return cfg;
    } catch (e) {
      if (file) throw new Error(`Cannot read ${file}: ${e.message}`);
    }
  }
  return { flows: [], _dir: process.cwd() };
}

function gitRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/** Data of a QR label page: the <script id="page-data"> block in its HTML. */
export function kitFromHtml(html) {
  const m = /<script[^>]*id=["']page-data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) throw new Error("Cannot find the page-data block in the kit HTML");
  return JSON.parse(m[1]);
}

/**
 * Test kit: a JSON file (QR label page format), the HTML page itself, or an https link
 * to an already published page.
 */
export async function loadKit(ref, base = process.cwd()) {
  if (!ref) return undefined;
  if (/^https:\/\//.test(ref)) return { pages: [], url: ref };
  const file = path.resolve(base, ref);
  const text = await readFile(file, "utf8");
  return /\.html?$/i.test(file) || text.trimStart().startsWith("<") ? kitFromHtml(text) : JSON.parse(text);
}

const sub = (v) => (typeof v === "string" ? v.replace(/\$\{env:([A-Z0-9_]+)\}/g, (_, n) => process.env[n] ?? "") : v);

function hostAllowed(baseUrl, allow) {
  if (!allow?.length) return true;
  const h = new URL(baseUrl).hostname;
  return allow.some((p) => (p.startsWith("*.") ? h.endsWith(p.slice(1)) : h === p));
}

/**
 * Walks the flows with Playwright and saves screenshots (and a video per flow).
 * The agent writes the actions from the plain-language description.
 */
export async function capture(cfg, { baseUrl, outDir, log = console.error }) {
  if (!baseUrl) throw new Error("Missing baseUrl (in the config or --live-url)");
  if (!hostAllowed(baseUrl, cfg.allowHosts))
    throw new Error(`Host not allowed for screenshots: ${new URL(baseUrl).hostname}. Check allowHosts (protects against capturing real environments).`);
  let chromium;
  try {
    // First the Playwright of the project under review; otherwise the CLI's own.
    let mod;
    try {
      const req = createRequire(path.join(process.cwd(), "package.json"));
      mod = await import(pathToFileURL(req.resolve("playwright")).href);
    } catch {
      mod = await import("playwright");
    }
    chromium = mod.chromium ?? mod.default.chromium;
  } catch {
    throw new Error("Playwright is not installed here: npm i -D playwright && npx playwright install chromium");
  }
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const viewport = cfg.viewport || { width: 1280, height: 800 };
  const result = [];
  try {
    for (const flow of cfg.flows) {
      const ctx = await browser.newContext({
        viewport,
        deviceScaleFactor: cfg.deviceScaleFactor || 1,
        isMobile: !!cfg.isMobile,
        hasTouch: !!cfg.isMobile,
        locale: cfg.locale || "en-US",
        ...(cfg.video !== false ? { recordVideo: { dir: path.join(outDir, "video"), size: viewport } } : {}),
      });
      const page = await ctx.newPage();
      const steps = [];
      for (const step of flow.steps || []) {
        for (const a of step.actions || []) {
          const [op] = Object.keys(a);
          const v = a[op];
          if (op === "goto") await page.goto(new URL(sub(v), baseUrl).toString(), { waitUntil: "networkidle" });
          else if (op === "click") await page.locator(sub(v)).first().click();
          else if (op === "fill") await page.locator(sub(v[0])).first().fill(sub(v[1]));
          else if (op === "select") await page.locator(sub(v[0])).first().selectOption(sub(v[1]));
          else if (op === "press") await page.keyboard.press(v);
          else if (op === "waitFor") await page.locator(sub(v)).first().waitFor();
          else if (op === "wait") await page.waitForTimeout(Number(v));
          else if (op === "expectText") await page.getByText(sub(v)).first().waitFor({ timeout: 5000 });
          else throw new Error(`Unknown action in ${flow.key}/${step.key}: ${op}`);
        }
        const s = { key: step.key, title: step.title, notes: step.notes, url: page.url(), files: [] };
        if (step.capture !== false) {
          await page.waitForTimeout(cfg.settleMs ?? 250);
          const f = path.join(outDir, `${flow.key}__${step.key}.png`);
          await page.screenshot({
            path: f,
            fullPage: !!step.fullPage,
            animations: "disabled",
            mask: (cfg.mask || []).map((m) => page.locator(m)),
          });
          s.files.push(f);
          log(`  📸 ${flow.key}/${step.key}`);
        }
        steps.push(s);
      }
      const video = page.video();
      await ctx.close();
      if (video) {
        const vp = await video.path();
        steps.push({ key: "video", title: "Flow video", notes: "Recorded by Playwright (no audio).", files: [vp] });
      }
      result.push({ key: flow.key, title: flow.title, description: flow.description, steps });
    }
  } finally {
    await browser.close();
  }
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify({ baseUrl, flows: result }, null, 2));
  return result;
}

/**
 * Folder of screenshots taken elsewhere (by hand, Appium, Maestro, simulator…).
 * Naming: <flow>__<step>[__n].<ext>, or a manifest.json like the one `capture` writes.
 */
export async function fromDir(dir, cfg) {
  const names = (await readdir(dir)).sort();
  if (names.includes("manifest.json")) {
    const m = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    return m.flows.map((f) => ({ ...f, steps: f.steps.map((s) => ({ ...s, files: s.files.map((x) => (path.isAbsolute(x) ? x : path.join(dir, x))) })) }));
  }
  const flows = new Map();
  for (const n of names) {
    const full = path.join(dir, n);
    if (!(await stat(full)).isFile()) continue;
    const base = n.replace(/\.[^.]+$/, "");
    const [fk, sk = base] = base.includes("__") ? base.split("__") : ["screenshots", base];
    const cf = cfg.flows.find((f) => f.key === fk);
    if (!flows.has(fk)) flows.set(fk, { key: fk, title: cf?.title || fk, description: cf?.description, steps: [] });
    const f = flows.get(fk);
    let s = f.steps.find((x) => x.key === sk);
    if (!s) {
      const cs = cf?.steps?.find((x) => x.key === sk);
      s = { key: sk, title: cs?.title || sk, notes: cs?.notes, files: [] };
      f.steps.push(s);
    }
    s.files.push(full);
  }
  return [...flows.values()];
}

/** Current git branch (or undefined outside a repo). Read only. */
export function gitBranch(cwd = process.cwd()) {
  try {
    const b = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return b && b !== "HEAD" ? b : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Link to the open PR of the current branch, if `gh` is installed and signed in.
 * Read ONLY (gh pr view): never creates or touches PRs. Without gh or a PR, returns undefined.
 */
export function prForBranch(cwd = process.cwd()) {
  try {
    const u = execFileSync("gh", ["pr", "view", "--json", "url", "-q", ".url"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 8000 }).trim();
    return /^https:\/\//.test(u) ? u : undefined;
  } catch {
    return undefined;
  }
}

/** Open review for a branch (or null). */
export async function reviewForBranch(api, project, branch) {
  if (!branch) return null;
  const { reviews } = await api.get(`/api/projects/${project}/reviews`);
  return reviews.find((r) => r.branch === branch && r.status === "open") ?? null;
}

/**
 * Uploads the files and publishes a version. Same API as the form.
 * `review`: { id } for a specific review, or { branch, title, purpose, testData, testKit, prUrl }:
 * the version goes to the open review for that branch, or creates a new one.
 */
export async function publish(api, project, { title, summary, liveUrl, previews, meta, flows, origin, review = {}, app, log = console.error }) {
  const out = [];
  for (const f of flows) {
    const steps = [];
    for (const s of f.steps) {
      const assets = [];
      for (const file of s.files || []) {
        assets.push(await upload(api, project, file, origin));
        log(`  ⬆ ${path.basename(file)}`);
      }
      steps.push({ key: s.key, title: s.title, notes: s.notes, url: s.url, assets });
    }
    out.push({ key: f.key, title: f.title, description: f.description, steps });
  }
  return api.post(`/api/projects/${project}/revisions`, { title, summary, liveUrl, previews, meta, flows: out, source: "agent", review, ...(app ? { app } : {}) });
}

/**
 * Version to read feedback from: the latest one of the current branch's review;
 * otherwise, the one of the app's most recent open review.
 */
export async function latestRevision(api, project, branch = gitBranch()) {
  const { reviews } = await api.get(`/api/projects/${project}/reviews`);
  const r = reviews.find((x) => x.branch === branch && x.status === "open") ?? reviews.find((x) => x.status === "open") ?? reviews[0];
  if (!r) throw new Error("The app has no reviews");
  return r.latestRevisionId;
}

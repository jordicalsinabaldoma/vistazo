// Núcleo de la CLI: cliente HTTP de Vistazo, subida de adjuntos, runner de capturas.
// El runner corre en TU entorno (no en el backend alojado): Playwright necesita un
// navegador real y las funciones serverless de Vercel no son sitio para eso.
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
  if (!url) throw new Error("Falta VISTAZO_URL");
  if (!key) throw new Error("Falta VISTAZO_API_KEY (clave de agente del proyecto; nunca la guardes en el repo)");
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

// ---------- Configuración ----------
export async function loadConfig(file) {
  if (!file) return { flows: [] };
  const cfg = JSON.parse(await readFile(file, "utf8"));
  cfg.flows ||= [];
  return cfg;
}

const sub = (v) => (typeof v === "string" ? v.replace(/\$\{env:([A-Z0-9_]+)\}/g, (_, n) => process.env[n] ?? "") : v);

function hostAllowed(baseUrl, allow) {
  if (!allow?.length) return true;
  const h = new URL(baseUrl).hostname;
  return allow.some((p) => (p.startsWith("*.") ? h.endsWith(p.slice(1)) : h === p));
}

/**
 * Recorre los flujos con Playwright y guarda capturas (y vídeo por recorrido).
 * Las acciones las escribe el agente a partir de la descripción en lenguaje natural.
 */
export async function capture(cfg, { baseUrl, outDir, log = console.error }) {
  if (!baseUrl) throw new Error("Falta baseUrl (en la config o --live-url)");
  if (!hostAllowed(baseUrl, cfg.allowHosts))
    throw new Error(`Host no permitido para capturar: ${new URL(baseUrl).hostname}. Revisa allowHosts (protección contra capturar entornos reales).`);
  let chromium;
  try {
    // Primero el Playwright del proyecto que se revisa; si no, el de la CLI.
    let mod;
    try {
      const req = createRequire(path.join(process.cwd(), "package.json"));
      mod = await import(pathToFileURL(req.resolve("playwright")).href);
    } catch {
      mod = await import("playwright");
    }
    chromium = mod.chromium ?? mod.default.chromium;
  } catch {
    throw new Error("Playwright no está instalado en este entorno: npm i -D playwright && npx playwright install chromium");
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
        locale: cfg.locale || "es-ES",
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
          else throw new Error(`Acción desconocida en ${flow.key}/${step.key}: ${op}`);
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
        steps.push({ key: "video", title: "Vídeo del recorrido", notes: "Grabado por Playwright (sin audio).", files: [vp] });
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
 * Carpeta de capturas hechas fuera (a mano, Appium, Maestro, simulador…).
 * Convención: <recorrido>__<paso>[__n].<ext>, o un manifest.json como el que genera `capture`.
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
    const [fk, sk = base] = base.includes("__") ? base.split("__") : ["capturas", base];
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

/** Rama actual de git (o undefined fuera de un repo). Solo lee. */
export function gitBranch(cwd = process.cwd()) {
  try {
    const b = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return b && b !== "HEAD" ? b : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Enlace a la PR abierta de la rama actual, si `gh` está instalado y autenticado.
 * Solo LEE (gh pr view): nunca crea ni toca PRs. Sin gh, o sin PR, devuelve undefined.
 */
export function prForBranch(cwd = process.cwd()) {
  try {
    const u = execFileSync("gh", ["pr", "view", "--json", "url", "-q", ".url"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 8000 }).trim();
    return /^https:\/\//.test(u) ? u : undefined;
  } catch {
    return undefined;
  }
}

/** Revisión abierta de una rama (o null). */
export async function reviewForBranch(api, project, branch) {
  if (!branch) return null;
  const { reviews } = await api.get(`/api/projects/${project}/reviews`);
  return reviews.find((r) => r.branch === branch && r.status === "open") ?? null;
}

/**
 * Sube los ficheros y publica una versión. Misma API que el formulario.
 * `review`: { id } para una revisión concreta, o { branch, title, purpose, testData, prUrl }:
 * la versión va a la revisión abierta de esa rama, o crea una nueva.
 */
export async function publish(api, project, { title, summary, liveUrl, previews, meta, flows, origin, review = {}, log = console.error }) {
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
  return api.post(`/api/projects/${project}/revisions`, { title, summary, liveUrl, previews, meta, flows: out, source: "agent", review });
}

/**
 * Versión de la que leer el feedback: la última de la revisión de la rama actual;
 * si no hay, la de la revisión abierta más reciente de la app.
 */
export async function latestRevision(api, project, branch = gitBranch()) {
  const { reviews } = await api.get(`/api/projects/${project}/reviews`);
  const r = reviews.find((x) => x.branch === branch && x.status === "open") ?? reviews.find((x) => x.status === "open") ?? reviews[0];
  if (!r) throw new Error("La app no tiene revisiones");
  return r.latestRevisionId;
}

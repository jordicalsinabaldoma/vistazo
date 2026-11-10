#!/usr/bin/env node
// vistazo — publica revisiones visuales desde tu agente y recoge el feedback.
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { capture, client, env, fromDir, latestRevision, loadConfig, publish } from "../lib/core.mjs";

const HELP = `vistazo — revisión visual para quien programa con agentes

Variables: VISTAZO_URL, VISTAZO_PROJECT, VISTAZO_API_KEY (clave de agente del proyecto)

  vistazo capture  --config vistazo.config.json [--live-url URL] [--out dir]
      Recorre los flujos con Playwright en TU máquina y deja capturas + vídeo + manifest.json.
      Revisa, borra o reordena lo que quieras antes de publicar.

  vistazo publish  --title "…" [--summary "…" | --summary-file f.md] [--live-url URL]
                   [--config vistazo.config.json] [--capture | --assets dir]
                   [--qr URL --qr-label "…"] [--meta clave=valor]...
      Publica una revisión. --capture recorre los flujos antes; --assets publica una
      carpeta ya hecha (manual, simulador, Appium, Maestro…: <recorrido>__<paso>.png).
      Los comentarios pendientes de la versión anterior se arrastran solos.

  vistazo feedback [latest|<idRevisión>] [--json | --summary]
      Prompt recomendado (por defecto), comentario-resumen o JSON estructurado.

  vistazo revisions        Lista las revisiones del proyecto.
  vistazo mcp              Servidor MCP por stdio (para Claude Code, Cursor…).
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
    out: { type: "string" },
    qr: { type: "string" },
    "qr-label": { type: "string" },
    meta: { type: "string", multiple: true },
    json: { type: "boolean" },
    summaryOnly: { type: "boolean" },
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
  const project = e.project || cfg.project;
  const baseUrl = o["live-url"] || cfg.baseUrl;

  if (cmd === "capture") {
    const out = o.out || path.join(os.tmpdir(), `vistazo-${Date.now()}`);
    await capture(cfg, { baseUrl, outDir: out, log });
    return console.log(out);
  }

  const api = client(e);
  if (!project) throw new Error("Falta VISTAZO_PROJECT");

  if (cmd === "publish") {
    if (!o.title) throw new Error("Falta --title");
    let flows = [];
    let origin = "playwright";
    if (o.capture) {
      const out = o.out || path.join(os.tmpdir(), `vistazo-${Date.now()}`);
      log(`Capturando ${baseUrl} …`);
      flows = await capture(cfg, { baseUrl, outDir: out, log });
    } else if (o.assets) {
      flows = await fromDir(o.assets, cfg);
      origin = "external";
    }
    const summary = o["summary-file"] ? await readFile(o["summary-file"], "utf8") : o.summary || "";
    const previews = o.qr ? [{ kind: "qr", label: o["qr-label"] || "Abrir en el dispositivo", url: o.qr }] : [];
    const meta = Object.fromEntries((o.meta || []).map((m) => m.split(/=(.*)/s).slice(0, 2)));
    const r = await publish(api, project, { title: o.title, summary, liveUrl: baseUrl, previews, meta, flows, origin, log });
    log(`✓ Publicada v${r.number}${r.carried ? ` (${r.carried} comentario(s) pendiente(s) arrastrado(s))` : ""}`);
    return console.log(r.url);
  }

  if (cmd === "feedback") {
    const id = !arg || arg === "latest" ? await latestRevision(api, project) : arg;
    const fb = await api.get(`/api/revisions/${id}/feedback`);
    return console.log(o.json ? JSON.stringify(fb.json, null, 2) : o.summaryOnly || process.argv.includes("--summary") ? fb.summary : fb.prompt);
  }

  if (cmd === "revisions") {
    const { revisions } = await api.get(`/api/projects/${project}/revisions`);
    for (const r of revisions) console.log(`v${r.number}\t${r.approved ? "✓" : " "}\t${r.id}\t${r.title}`);
    return;
  }
  console.log(HELP);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});

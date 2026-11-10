"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Comment } from "@/lib/model";
import Composer from "./Composer";
import type { Ctx } from "./types";

type Live = Extract<Comment["anchor"], { type: "live" }>;
type Picked = { x: number; y: number; selector?: string; text?: string; url: string; viewport?: { w: number; h: number } };

const DEVICES = [
  ["Escritorio", "100%"],
  ["Tablet", "820px"],
  ["Móvil", "390px"],
] as const;

const samePage = (a: string, b: string) => {
  try {
    const u = new URL(a), v = new URL(b);
    return u.host === v.host && u.pathname.replace(/\/$/, "") === v.pathname.replace(/\/$/, "");
  } catch {
    return a === b;
  }
};

/**
 * Web en vivo dentro de Vistazo. Dos modos:
 * - Con el puente (bridge.js incluido en la app): el revisor señala un ELEMENTO;
 *   se guardan URL real, selector, texto y posición. Los pines se pintan dentro de la app.
 * - Sin puente (cualquier web que se deje enmarcar): capa transparente encima del iframe;
 *   se guarda la posición en la ventana y la URL que indique el revisor.
 */
export default function LiveView({ ctx, url }: { ctx: Ctx; url: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [bridge, setBridge] = useState(false);
  const [current, setCurrent] = useState(url);
  const [mode, setMode] = useState(false);
  const [device, setDevice] = useState<string>("100%");
  const [draft, setDraft] = useState<Picked | null>(null);
  const origin = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return "*";
    }
  })();

  const live = ctx.data.comments.filter((c) => c.anchor.type === "live");
  const here = live.filter((c) => samePage((c.anchor as Live).url, current));

  const post = useCallback((msg: unknown) => frame.current?.contentWindow?.postMessage(msg, origin), [origin]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== origin || !e.data || typeof e.data !== "object" || !("vz" in e.data)) return;
      const d = e.data as { vz: string } & Picked;
      if (d.vz === "hello" || d.vz === "nav") {
        setBridge(true);
        if (typeof d.url === "string") setCurrent(d.url);
      }
      if (d.vz === "picked") {
        setMode(false);
        setDraft({ x: d.x, y: d.y, selector: d.selector, text: d.text, url: d.url, viewport: d.viewport });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [origin]);

  // Pines dentro de la app (solo con puente).
  useEffect(() => {
    if (!bridge) return;
    post({
      vz: "pins",
      pins: here.map((c) => {
        const a = c.anchor as Live;
        return { n: ctx.numberOf(c), selector: a.selector, x: a.x, y: a.y, resolved: c.status === "resolved", id: c.id };
      }),
    });
  }, [bridge, here, post, ctx]);

  const toggle = () => {
    const on = !mode;
    setMode(on);
    setDraft(null);
    if (bridge) post({ vz: "pick", on });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className={`btn ${mode ? "btn-accent" : "btn-primary"}`} onClick={toggle} disabled={!ctx.data.me.can.comment}>
          {mode ? (bridge ? "Haz clic en un elemento…" : "Haz clic donde quieras comentar…") : "Comentar sobre la web"}
        </button>
        <div className="flex rounded-md border border-line bg-card p-0.5 text-xs">
          {DEVICES.map(([l, w]) => (
            <button key={l} onClick={() => setDevice(w)} className={`rounded px-2 py-1 ${device === w ? "bg-ink text-white" : ""}`}>
              {l}
            </button>
          ))}
        </div>
        <span className={`chip ${bridge ? "bg-okbg text-ok" : "bg-paper text-muted"}`} title="bridge.js en la app revisada">
          {bridge ? "● Puente conectado: anclaje a elementos" : "○ Sin puente: anclaje por posición"}
        </span>
        <input
          className="input min-w-[200px] flex-1 font-mono text-xs"
          value={current}
          readOnly={bridge}
          onChange={(e) => setCurrent(e.target.value)}
          title={bridge ? "URL real de la app" : "Indica en qué pantalla estás (sin puente no se puede leer)"}
        />
        <a className="btn" href={current} target="_blank" rel="noreferrer">
          Abrir aparte ↗
        </a>
      </div>
      <div className="flex justify-center rounded-xl border border-line bg-[repeating-linear-gradient(45deg,#ecebe6_0,#ecebe6_8px,#f5f4f0_8px,#f5f4f0_16px)] p-3">
        <div className="relative h-[78vh] bg-card shadow-sm" style={{ width: device, maxWidth: "100%" }}>
          <iframe ref={frame} src={url} title="App en vivo" className="h-full w-full rounded" onLoad={() => post({ vz: "ping" })} />
          {/* Capa para webs sin puente */}
          {mode && !bridge && (
            <div
              data-testid="live-overlay"
              className="absolute inset-0 cursor-crosshair bg-accent/5 outline-2 outline-dashed outline-accent"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setMode(false);
                setDraft({
                  x: (e.clientX - r.left) / r.width,
                  y: (e.clientY - r.top) / r.height,
                  url: current,
                  viewport: { w: Math.round(r.width), h: Math.round(r.height) },
                });
              }}
            />
          )}
          {!bridge &&
            here.map((c) => {
              const a = c.anchor as Live;
              return (
                <button
                  key={c.id}
                  onClick={() => ctx.setFocus(c.id)}
                  className={`pin z-10 ${c.status === "resolved" ? "pin-resolved" : ""}`}
                  style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
                  title={c.body}
                >
                  {ctx.numberOf(c)}
                </button>
              );
            })}
          {draft && (
            <div className="absolute inset-0">
              <Composer
                x={draft.x}
                y={draft.y}
                hint={draft.selector ? `${draft.selector}${draft.text ? ` · «${draft.text.slice(0, 40)}»` : ""}` : draft.url}
                onCancel={() => setDraft(null)}
                onSave={async (body) => {
                  await ctx.addComment({ type: "live", ...draft }, body);
                  setDraft(null);
                }}
              />
            </div>
          )}
        </div>
      </div>
      {live.length > here.length && (
        <p className="mt-2 text-xs text-muted">{live.length - here.length} comentario(s) en vivo en otras pantallas: ver la lista.</p>
      )}
    </div>
  );
}

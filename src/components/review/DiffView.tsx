"use client";
import { useEffect, useRef, useState } from "react";
import { fileUrl } from "@/lib/client";
import type { Asset, Revision } from "@/lib/model";

type Pair = { flow: string; step: string; key: string; before?: Asset; after?: Asset };

/** Empareja capturas por recorrido/paso (claves estables) entre dos revisiones. */
function pairs(prev: Revision, cur: Revision): Pair[] {
  const img = (s?: { assets: Asset[] }) => s?.assets.find((a) => a.kind === "image");
  const out: Pair[] = [];
  const seen = new Set<string>();
  for (const f of cur.flows)
    for (const s of f.steps) {
      const pf = prev.flows.find((x) => x.key === f.key);
      const ps = pf?.steps.find((x) => x.key === s.key);
      const k = `${f.key}/${s.key}`;
      seen.add(k);
      if (img(s) || img(ps)) out.push({ flow: f.title, step: s.title, key: k, before: img(ps), after: img(s) });
    }
  for (const f of prev.flows)
    for (const s of f.steps) {
      const k = `${f.key}/${s.key}`;
      if (!seen.has(k) && img(s)) out.push({ flow: f.title, step: s.title, key: k, before: img(s) });
    }
  return out;
}

export default function DiffView({ prev, cur }: { prev: Revision | null; cur: Revision }) {
  if (!prev) return <p className="p-6 text-muted">Es la primera revisión: no hay versión anterior con la que comparar.</p>;
  const ps = pairs(prev, cur);
  if (!ps.length) return <p className="p-6 text-muted">No hay capturas que comparar.</p>;
  return (
    <div className="grid gap-8">
      <p className="text-sm text-muted">
        v{prev.number} → v{cur.number}. Se emparejan por clave de recorrido y paso. En rojo, los píxeles que cambian.
      </p>
      {ps.map((p) => (
        <section key={p.key}>
          <h3 className="mb-2 font-medium">
            {p.flow} › {p.step}
          </h3>
          {p.before && p.after ? (
            <ImageDiff before={p.before} after={p.after} />
          ) : p.after ? (
            <Single asset={p.after} label={`Nuevo en v${cur.number}`} cls="bg-okbg text-ok" />
          ) : (
            <Single asset={p.before!} label={`Ya no está en v${cur.number}`} cls="bg-badbg text-bad" />
          )}
        </section>
      ))}
    </div>
  );
}

function Single({ asset, label, cls }: { asset: Asset; label: string; cls: string }) {
  return (
    <div className="max-w-md">
      <span className={`chip ${cls}`}>{label}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fileUrl(asset.pathname)} alt="" className="mt-2 w-full rounded-lg border border-line" />
    </div>
  );
}

function load(src: string) {
  return new Promise<HTMLImageElement>((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = ko;
    i.src = src;
  });
}

function ImageDiff({ before, after }: { before: Asset; after: Asset }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [sizeNote, setSizeNote] = useState("");
  const [mode, setMode] = useState<"diff" | "side" | "slider">("diff");
  const [cut, setCut] = useState(50);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [a, b] = await Promise.all([load(fileUrl(before.pathname)), load(fileUrl(after.pathname))]);
      if (!alive || !canvas.current) return;
      const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
      if (a.width !== b.width || a.height !== b.height) setSizeNote(`Tamaño: ${a.width}×${a.height} → ${b.width}×${b.height}`);
      const mk = (img: HTMLImageElement) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const x = c.getContext("2d")!;
        x.fillStyle = "#fff";
        x.fillRect(0, 0, w, h);
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, w, h);
      };
      const A = mk(a), B = mk(b);
      const out = canvas.current.getContext("2d")!;
      canvas.current.width = w;
      canvas.current.height = h;
      const D = out.createImageData(w, h);
      let changed = 0;
      for (let i = 0; i < A.data.length; i += 4) {
        const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
        const g = 0.299 * B.data[i] + 0.587 * B.data[i + 1] + 0.114 * B.data[i + 2];
        if (d > 48) {
          changed++;
          D.data[i] = 255; D.data[i + 1] = 40; D.data[i + 2] = 20; D.data[i + 3] = 255;
        } else {
          const v = 200 + g * 0.2;
          D.data[i] = v; D.data[i + 1] = v; D.data[i + 2] = v; D.data[i + 3] = 255;
        }
      }
      out.putImageData(D, 0, 0);
      setPct((changed / (w * h)) * 100);
    })().catch(() => setSizeNote("No se pudieron cargar las imágenes"));
    return () => {
      alive = false;
    };
  }, [before.pathname, after.pathname]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={`chip ${pct === null ? "bg-paper" : pct < 0.05 ? "bg-okbg text-ok" : "bg-warnbg text-warn"}`}>
          {pct === null ? "Calculando…" : pct < 0.05 ? "Sin cambios visibles" : `${pct.toFixed(1)} % de píxeles cambian`}
        </span>
        {sizeNote && <span className="chip bg-paper">{sizeNote}</span>}
        <div className="ml-auto flex rounded-md border border-line bg-card p-0.5">
          {(
            [
              ["diff", "Diferencias"],
              ["side", "Lado a lado"],
              ["slider", "Deslizador"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`rounded px-2 py-1 ${mode === k ? "bg-ink text-white" : ""}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <canvas ref={canvas} className={`w-full max-w-3xl rounded-lg border border-line ${mode === "diff" ? "" : "hidden"}`} />
      {mode === "side" && (
        <div className="grid grid-cols-2 gap-3">
          {[before, after].map((x, i) => (
            <div key={x.id}>
              <p className="mb-1 text-xs text-muted">{i ? "Ahora" : "Antes"}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(x.pathname)} alt="" className="w-full rounded-lg border border-line" />
            </div>
          ))}
        </div>
      )}
      {mode === "slider" && (
        <div className="max-w-3xl">
          <div className="relative overflow-hidden rounded-lg border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(after.pathname)} alt="" className="block w-full" />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - cut}% 0 0)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(before.pathname)} alt="" className="block w-full bg-white" />
            </div>
            <div className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${cut}%` }} />
          </div>
          <input type="range" min={0} max={100} value={cut} onChange={(e) => setCut(+e.target.value)} className="mt-2 w-full" />
          <p className="flex justify-between text-xs text-muted"><span>← Antes</span><span>Ahora →</span></p>
        </div>
      )}
    </div>
  );
}

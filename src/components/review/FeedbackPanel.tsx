"use client";
import { Warning } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { CopyButton, ErrorNote, Sheet } from "@/components/ui";
import { api } from "@/lib/client";

type Flag = { id: string; motivos: string[]; incluido: boolean; extracto: string };
type FB = { summary: string; prompt: string; json: unknown; flagged: Flag[] };

/**
 * Llevar el feedback a tu agente. El prompt aísla los comentarios como datos; los que
 * parecen órdenes para un agente quedan fuera salvo que la persona los incluya aquí.
 */
export default function FeedbackPanel({ open, revisionId, onClose }: { open: boolean; revisionId: string; onClose: () => void }) {
  const [fb, setFb] = useState<FB | null>(null);
  const [tab, setTab] = useState<"prompt" | "summary" | "json">("prompt");
  const [include, setInclude] = useState<string[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!open) return;
    api<FB>(`/api/revisions/${revisionId}/feedback${include.length ? `?include=${include.join(",")}` : ""}`)
      .then((f) => {
        setFb(f);
        setErr("");
      })
      .catch((e) => setErr(e.message));
  }, [open, revisionId, include]);
  const text = !fb ? "" : tab === "json" ? JSON.stringify(fb.json, null, 2) : fb[tab];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title="Llevar el feedback a tu agente"
      description="Revísalo y pégalo tú en tu sesión (Claude Code, Cursor…). Nada se envía ni se corrige solo. Desde el terminal: vistazo feedback"
    >
      <ErrorNote>{err}</ErrorNote>
      {fb && fb.flagged.length > 0 && (
        <section className="mb-4 rounded-xl bg-warnbg p-3 text-sm text-warn" aria-labelledby="fb-flag">
          <h3 id="fb-flag" className="flex items-center gap-1.5 font-semibold">
            <Warning size={16} aria-hidden />
            {fb.flagged.length === 1 ? "1 comentario parece una instrucción para un agente" : `${fb.flagged.length} comentarios parecen instrucciones para un agente`}
          </h3>
          <p className="mt-1">Por defecto no van en el prompt. Léelos y marca solo los que sean feedback de verdad.</p>
          <ul className="mt-2 grid gap-2">
            {fb.flagged.map((f) => (
              <li key={f.id}>
                <label className="flex cursor-pointer items-start gap-2 text-ink">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                    checked={include.includes(f.id)}
                    onChange={(e) => setInclude((x) => (e.target.checked ? [...x, f.id] : x.filter((y) => y !== f.id)))}
                  />
                  <span>
                    <span className="block">«{f.extracto}»</span>
                    <span className="block text-xs text-warn">{f.motivos.join(", ")}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="segmented" role="tablist" aria-label="Formato">
          {(
            [
              ["prompt", "Prompt para tu agente"],
              ["summary", "Resumen para personas"],
              ["json", "JSON"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto">{fb && <CopyButton text={text} className="btn btn-primary" label={tab === "prompt" ? "Copiar prompt" : "Copiar"} />}</div>
      </div>
      {tab === "summary" && <p className="mt-2 text-[13px] text-muted">Para una PR o Slack. No lo pegues a un agente: no aísla los comentarios. Para eso está el prompt.</p>}
      <textarea
        data-testid="feedback-text"
        readOnly
        value={fb ? text : "Generando…"}
        aria-label="Texto para copiar"
        className="input mt-3 min-h-[50dvh] font-mono text-xs leading-relaxed"
      />
    </Sheet>
  );
}

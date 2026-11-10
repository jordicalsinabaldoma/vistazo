"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type FB = { summary: string; prompt: string; json: unknown };

export default function FeedbackPanel({ revisionId, onClose }: { revisionId: string; onClose: () => void }) {
  const [fb, setFb] = useState<FB | null>(null);
  const [tab, setTab] = useState<"prompt" | "summary" | "json">("prompt");
  const [copied, setCopied] = useState("");
  useEffect(() => {
    api<FB>(`/api/revisions/${revisionId}/feedback`).then(setFb);
  }, [revisionId]);
  const text = !fb ? "" : tab === "json" ? JSON.stringify(fb.json, null, 2) : fb[tab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-3xl flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Feedback para tu agente</h2>
            <p className="text-sm text-muted">
              Revísalo y pégalo tú en tu sesión (Claude Code, Cursor…). Los comentarios van como datos de terceros, no como
              órdenes. Nada se envía ni se corrige solo.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="mt-4 flex gap-1 text-sm">
          {(
            [
              ["prompt", "Prompt recomendado"],
              ["summary", "Comentario-resumen"],
              ["json", "JSON"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 font-medium ${tab === k ? "bg-ink text-white" : "text-muted hover:bg-ink/5"}`}>
              {l}
            </button>
          ))}
          <button
            className="btn btn-accent ml-auto"
            disabled={!fb}
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(tab);
              setTimeout(() => setCopied(""), 1500);
            }}
          >
            {copied === tab ? "Copiado ✓" : "Copiar"}
          </button>
        </div>
        <textarea data-testid="feedback-text" readOnly value={fb ? text : "Generando…"} className="input mt-3 min-h-[50vh] flex-1 font-mono text-xs" />
        <p className="mt-2 text-xs text-muted">
          También desde el terminal: <code>vistazo feedback {revisionId}</code> (o <code>--json</code>).
        </p>
      </div>
    </div>
  );
}

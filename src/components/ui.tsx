"use client";
import { Check, CheckCircle, Circle, Copy, GitPullRequest, X, XCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { CIRCUIT, circuitStep, stageTone, type Stage } from "@/lib/flow";

const TONE = {
  neutral: "bg-neutral text-ink",
  attention: "bg-warnbg text-warn",
  done: "bg-okbg text-ok",
  muted: "bg-neutral text-muted",
} as const;

const ICON = {
  neutral: Circle,
  attention: XCircle,
  done: CheckCircle,
  muted: Circle,
} as const;

/** Etiqueta de estado de una revisión. Siempre igual: mismo color, mismo texto. */
export function StateLabel({ stage, label, size = "md" }: { stage: Stage; label: string; size?: "md" | "lg" }) {
  const tone = stageTone[stage];
  const I = ICON[tone];
  return (
    <span
      data-testid="state"
      data-stage={stage}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${TONE[tone]} ${size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
    >
      <I size={size === "lg" ? 16 : 14} weight={tone === "done" ? "fill" : "regular"} aria-hidden />
      {label}
    </span>
  );
}

/** Tira del circuito: Publicar → Revisar → Corregir → Aprobar, con el paso actual marcado. */
export function Circuit({ stage, version }: { stage: Stage; version: number }) {
  const cur = circuitStep(stage);
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:gap-x-1" aria-label="Circuito de la revisión">
      {CIRCUIT.map((s, i) => {
        const done = i < cur || stage === "closed";
        const now = i === cur && stage !== "closed";
        return (
          <li key={s} className="flex items-center gap-1" aria-current={now ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={`mx-1 hidden h-px w-5 sm:block sm:w-8 ${done || now ? "bg-ink/40" : "bg-line"}`} />}
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                done ? "border-ink bg-ink text-paper" : now ? "border-accent bg-accent text-on-accent" : "border-field/60 text-muted"
              }`}
            >
              {done ? <Check size={13} weight="bold" aria-hidden /> : i + 1}
            </span>
            <span className={now ? "font-semibold text-ink" : done ? "text-ink" : "text-muted"}>
              {s}
              {s === "Corregir" && version > 1 && <span className="text-muted"> (v{version})</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Diálogo nativo: Esc cierra, el foco queda dentro y el fondo es inerte. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      style={wide ? { width: "min(100% - 2rem, 60rem)" } : undefined}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="sheet-title"
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-start gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id="sheet-title" className="text-lg font-semibold">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
            <button className="btn btn-quiet -mr-2 -mt-1 px-2" onClick={onClose} aria-label="Cerrar">
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function CopyButton({ text, label = "Copiar", className = "btn btn-sm" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      <span aria-live="polite">{done ? "Copiado" : label}</span>
    </button>
  );
}

export function PrLink({ url }: { url: string }) {
  let label = "PR";
  const m = /\/pull\/(\d+)|\/merge_requests\/(\d+)/.exec(url);
  if (m) label = `PR #${m[1] ?? m[2]}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
      <GitPullRequest size={15} aria-hidden />
      {label}
    </a>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-badbg px-3 py-2 text-sm text-bad">
      {children}
    </p>
  );
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

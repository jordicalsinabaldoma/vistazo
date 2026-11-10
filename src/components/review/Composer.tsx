"use client";
import { useState } from "react";

/** Caja flotante para escribir un comentario en el punto marcado. */
export default function Composer({
  x,
  y,
  onSave,
  onCancel,
  hint,
}: {
  x: number;
  y: number;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
  hint?: string;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const left = x > 0.6 ? undefined : `calc(${x * 100}% + 16px)`;
  const right = x > 0.6 ? `calc(${(1 - x) * 100}% + 16px)` : undefined;
  return (
    <>
      <span className="pin" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
        +
      </span>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setBusy(true);
          try {
            await onSave(body);
          } finally {
            setBusy(false);
          }
        }}
        className="absolute z-20 w-72 rounded-lg border border-line bg-card p-3 shadow-xl"
        style={{ left, right, top: `min(calc(${y * 100}% - 12px), calc(100% - 170px))` }}
      >
        {hint && <p className="mb-2 truncate text-[11px] text-muted">{hint}</p>}
        <textarea
          autoFocus
          data-testid="composer"
          className="input text-sm"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="¿Qué ves aquí?"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-accent" disabled={busy || !body.trim()}>
            Comentar
          </button>
        </div>
      </form>
    </>
  );
}

"use client";
import { useState } from "react";

/** Floating box to write a comment on the marked spot. */
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
      <span className="pin" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-hidden>
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
        className="absolute z-20 w-[min(18rem,calc(100vw-3rem))] rounded-xl border border-line bg-card p-3 shadow-[0_16px_40px_rgb(var(--shadow)/0.25)]"
        style={{ left, right, top: `min(calc(${y * 100}% - 12px), calc(100% - 170px))` }}
      >
        {hint && <p className="mb-2 truncate text-xs text-muted">{hint}</p>}
        <textarea
          autoFocus
          data-testid="composer"
          className="input text-sm"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What do you see here?"
          aria-label="Comment"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn btn-quiet" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-strong" disabled={busy || !body.trim()}>
            Comment
          </button>
        </div>
      </form>
    </>
  );
}

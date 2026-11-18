"use client";
import { Check, X } from "@phosphor-icons/react";
import { useState } from "react";
import { CopyButton } from "@/components/ui";
import { api } from "@/lib/client";
import type { Ctx } from "./types";

/** What to test: this review's items first, then the app's critical flows. */
export function TestPlan({ ctx, compact }: { ctx: Ctx; compact?: boolean }) {
  const { project: p, review: rv, revision: r, me } = ctx.data;
  const [busy, setBusy] = useState("");
  const items = [...(rv.testPlan ?? []).map((i) => ({ ...i, from: "review" as const })), ...p.checklist.map((i) => ({ ...i, from: "app" as const }))];
  const done = items.filter((i) => r.checks[i.id]?.status === "ok").length;
  if (!items.length)
    return <p className="text-sm text-muted">{me.can.publish ? "Nothing defined yet. Add what to test in \"Edit review and test kit\"." : "There is no list of things to test. Try what \"What changed\" describes."}</p>;

  const mark = async (id: string, status: "ok" | "fail") => {
    setBusy(id);
    try {
      await api(`/api/revisions/${r.id}/checks`, { method: "POST", json: { itemId: id, status: r.checks[id]?.status === status ? "pending" : status } });
      await ctx.reload();
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <p className="text-[13px] text-muted tabular" aria-live="polite">
          {done} of {items.length} tested on v{r.number}
        </p>
        <span className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-neutral" aria-hidden>
          <span className="block h-full rounded-full bg-ok transition-[width]" style={{ width: `${(done / items.length) * 100}%` }} />
        </span>
      </div>
      <ul className={`grid ${compact ? "gap-1" : "gap-1.5"}`}>
        {items.map((i) => {
          const c = r.checks[i.id];
          return (
            <li key={i.id} className="flex items-start gap-3 rounded-lg px-1 py-1.5">
              <div className="flex shrink-0 gap-1 pt-0.5">
                {(["ok", "fail"] as const).map((s) => {
                  const on = c?.status === s;
                  return (
                    <button
                      key={s}
                      disabled={!me.can.comment || busy === i.id}
                      aria-pressed={on}
                      aria-label={`${s === "ok" ? "Works" : "Fails"}: ${i.title}`}
                      title={s === "ok" ? "Works" : "Fails"}
                      onClick={() => mark(i.id, s)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
                        on ? (s === "ok" ? "border-ok bg-ok text-okbg" : "border-bad bg-bad text-badbg") : "border-field/60 text-muted hover:border-ink/50 hover:text-ink"
                      }`}
                    >
                      {s === "ok" ? <Check size={15} weight="bold" aria-hidden /> : <X size={15} weight="bold" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              <div className="min-w-0 text-sm">
                <p className={c?.status === "ok" ? "text-muted" : "text-ink"}>{i.title}</p>
                <p className="text-xs text-muted">
                  {i.from === "app" ? "Critical flow of the app" : "From this review"}
                  {c && c.status !== "pending" ? `. ${c.status === "ok" ? "Works" : "Fails"} for ${c.by}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Test notes with a copy button. */
export function TestData({ ctx, onEdit }: { ctx: Ctx; onEdit?: () => void }) {
  const t = ctx.data.review.testData?.trim();
  if (!t)
    return onEdit ? (
      <p className="text-sm text-muted">
        No test data.{" "}
        <button className="font-medium text-accent-ink underline" onClick={onEdit}>
          Add them
        </button>
      </p>
    ) : (
      <p className="text-sm text-muted">No test data.</p>
    );
  return (
    <div className="rounded-lg bg-sunken p-3">
      <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">{t}</pre>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">Test data only, never real data.</span>
        <CopyButton text={t} />
      </div>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import type { Comment } from "@/lib/model";
import type { Ctx } from "./types";

const where = (c: Comment, ctx: Ctx) => {
  const a = c.anchor;
  const flow = "flowKey" in a ? ctx.data.revision.flows.find((f) => f.key === a.flowKey) : undefined;
  const step = flow && "stepKey" in a ? flow.steps.find((s) => s.key === a.stepKey) : undefined;
  if (a.type === "live") {
    let p = a.url;
    try {
      p = new URL(a.url).pathname;
    } catch {}
    return `En vivo · ${p}${a.selector ? ` · ${a.selector}` : ""}`;
  }
  if (a.type === "general") return "General";
  return `${flow?.title ?? a.flowKey} › ${step?.title ?? a.stepKey}${a.type === "asset" && a.t != null ? ` · ${a.t.toFixed(1)} s` : ""}`;
};

const badge = (k: string) =>
  k === "guest" ? <span className="chip bg-warnbg text-warn">invitado</span> : k === "agent" ? <span className="chip bg-paper">agente</span> : null;

export default function CommentList({ ctx, reload }: { ctx: Ctx; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const list = ctx.data.comments.filter((c) => filter === "all" || c.status === filter);
  const open = ctx.data.comments.filter((c) => c.status === "open").length;
  return (
    <div>
      <div className="flex items-center gap-1 text-xs">
        {(
          [
            ["open", `Pendientes ${open}`],
            ["resolved", `Resueltos ${ctx.data.comments.length - open}`],
            ["all", "Todos"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-md px-2 py-1 font-medium ${filter === k ? "bg-ink text-white" : "text-muted hover:bg-ink/5"}`}>
            {l}
          </button>
        ))}
      </div>
      <ul className="mt-3 grid gap-2">
        {list.map((c) => (
          <Item key={c.id} c={c} ctx={ctx} reload={reload} />
        ))}
        {!list.length && <li className="py-6 text-center text-sm text-muted">Nada por aquí.</li>}
      </ul>
      {ctx.data.me.can.comment && <General ctx={ctx} />}
    </div>
  );
}

function General({ ctx }: { ctx: Ctx }) {
  const [body, setBody] = useState("");
  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await ctx.addComment({ type: "general" }, body);
        setBody("");
      }}
    >
      <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Comentario general…" />
      <button className="btn" disabled={!body.trim()}>
        Enviar
      </button>
    </form>
  );
}

function Item({ c, ctx, reload }: { c: Comment; ctx: Ctx; reload: () => Promise<void> }) {
  const ref = useRef<HTMLLIElement>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");
  const rev = ctx.data.revision;
  const focused = ctx.focus === c.id;
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focused]);

  const act = async (json: object) => {
    setErr("");
    try {
      await api(`/api/comments/${c.id}`, { method: "POST", json: { ...json, revisionId: rev.id } });
      setReply("");
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const carried = c.originRevisionId !== rev.id;

  return (
    <li
      ref={ref}
      id={`c-${c.id}`}
      data-testid="comment"
      onClick={() => ctx.setFocus(c.id)}
      className={`rounded-lg border bg-card p-3 text-sm transition ${focused ? "border-accent ring-2 ring-accent/20" : "border-line"} ${c.status === "resolved" ? "opacity-75" : ""}`}
    >
      <div className="flex items-start gap-2">
        <span className={`pin !static !translate-x-0 !translate-y-0 shrink-0 ${c.status === "resolved" ? "pin-resolved" : ""}`}>{ctx.numberOf(c)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-muted">{where(c, ctx)}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted">
            {c.author.name} {badge(c.author.kind)} · {fmtDate(c.createdAt)}
            {carried && <span className="chip bg-warnbg text-warn">arrastrado de v{c.originRevisionNumber}</span>}
            {c.status === "resolved" && <span className="chip bg-okbg text-ok">resuelto por {c.resolvedBy?.name}</span>}
          </p>
        </div>
      </div>
      {c.replies.length > 0 && (
        <ul className="mt-2 grid gap-1.5 border-l-2 border-line pl-3">
          {c.replies.map((r) => (
            <li key={r.id}>
              <p className="whitespace-pre-wrap break-words">{r.body}</p>
              <p className="text-[11px] text-muted">
                {r.author.name} {badge(r.author.kind)} · {fmtDate(r.at)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {focused && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          {ctx.data.me.can.comment && (
            <div className="flex gap-2">
              <input className="input" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder…" />
              <button className="btn" disabled={!reply.trim()} onClick={() => act({ action: "reply", body: reply })}>
                Responder
              </button>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            {c.status === "open" && ctx.data.me.can.resolve && (
              <button className="btn" onClick={() => act({ action: "resolve", body: reply.trim() || undefined })}>
                ✓ Resolver{reply.trim() ? " con respuesta" : ""}
              </button>
            )}
            {c.status === "resolved" && ctx.data.me.can.comment && (
              <button className="btn btn-ghost" onClick={() => act({ action: "reopen" })}>
                Reabrir
              </button>
            )}
          </div>
          {err && <p className="mt-1 text-xs text-bad">{err}</p>}
          {c.events.length > 1 && (
            <details className="mt-2 text-[11px] text-muted">
              <summary>Historial</summary>
              <ul>
                {c.events.map((e, i) => (
                  <li key={i}>
                    {fmtDate(e.at)} · {e.type}
                    {e.by ? ` · ${e.by.name}` : ""}
                    {e.revisionId ? ` · v${ctx.data.versions.find((v) => v.id === e.revisionId)?.number ?? "?"}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

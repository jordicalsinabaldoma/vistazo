"use client";
import { Warning } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import type { Comment } from "@/lib/model";
import { suspicious } from "@/lib/untrusted";
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
    return `En vivo, ${p}`;
  }
  if (a.type === "general") return "General";
  return `${flow?.title ?? a.flowKey} > ${step?.title ?? a.stepKey}${a.type === "asset" && a.t != null ? `, segundo ${a.t.toFixed(1)}` : ""}`;
};

const ROLE = (k: string) =>
  k === "guest" ? <span className="chip bg-neutral text-muted">invitado</span> : k === "agent" ? <span className="chip bg-neutral text-muted">agente</span> : null;

const EVENT: Record<string, string> = { created: "creado", reply: "respuesta", resolved: "resuelto", reopened: "reabierto", carried: "sigue abierto en" };

export default function CommentList({ ctx }: { ctx: Ctx }) {
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const all = ctx.data.comments;
  const open = all.filter((c) => c.status === "open").length;
  const list = all.filter((c) => filter === "all" || c.status === filter);
  return (
    <div>
      <div className="segmented" role="tablist" aria-label="Filtrar comentarios">
        {(
          [
            ["open", `Abiertos ${open}`],
            ["resolved", `Resueltos ${all.length - open}`],
            ["all", "Todos"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className="tabular">
            {l}
          </button>
        ))}
      </div>
      <ul className="mt-3 grid gap-2">
        {list.map((c) => (
          <Item key={c.id} c={c} ctx={ctx} />
        ))}
        {!list.length && (
          <li className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            {filter === "open" ? "No hay comentarios abiertos." : "Nada por aquí."}
            {ctx.data.me.can.comment && filter === "open" && <span className="block">Toca una captura o la web en vivo para comentar en un punto concreto.</span>}
          </li>
        )}
      </ul>
      {ctx.data.me.can.comment && <General ctx={ctx} />}
    </div>
  );
}

function General({ ctx }: { ctx: Ctx }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button className="btn btn-sm mt-4" onClick={() => setOpen(true)}>
        Comentario general
      </button>
    );
  return (
    <form
      className="mt-4 grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await ctx.addComment({ type: "general" }, body);
          setBody("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="general-comment" className="text-sm font-medium">
        Comentario general
      </label>
      <textarea id="general-comment" autoFocus className="input" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Algo que no está en un punto concreto" />
      <div className="flex gap-2">
        <button className="btn btn-strong btn-sm" disabled={!body.trim() || busy}>
          Comentar
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export const whereOf = where;

export function Item({ c, ctx, bare }: { c: Comment; ctx: Ctx; bare?: boolean }) {
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
      await ctx.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const carried = c.originRevisionId !== rev.id;
  // Al equipo autor se le avisa de lo que no irá al prompt de su agente por defecto.
  const flags = ctx.data.me.can.publish && c.status === "open" ? [...new Set([c.body, c.author.name, ...c.replies.map((r) => r.body)].flatMap(suspicious))] : [];

  return (
    <li
      ref={ref}
      id={`c-${c.id}`}
      data-testid="comment"
      className={`${bare ? "" : "rounded-xl border p-3"} bg-card text-sm transition-colors ${focused ? "border-accent ring-2 ring-accent/20" : "border-line"} ${c.status === "resolved" ? "opacity-80" : ""}`}
    >
      <button className="flex w-full items-start gap-2.5 text-left" onClick={() => ctx.setFocus(focused ? null : c.id)} aria-expanded={focused}>
        <span className={`pin !static !h-6 !w-6 !translate-x-0 !translate-y-0 shrink-0 ${c.status === "resolved" ? "pin-resolved" : ""}`} aria-hidden>
          {ctx.numberOf(c)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-muted">{where(c, ctx)}</span>
          <span className="mt-1 block whitespace-pre-wrap break-words">{c.body}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {c.author.name} {ROLE(c.author.kind)} <span>{fmtDate(c.createdAt)}</span>
            {carried && <span className="chip bg-warnbg text-warn">sigue abierto desde la v{c.originRevisionNumber}</span>}
            {c.status === "resolved" && <span className="chip bg-okbg text-ok">resuelto por {c.resolvedBy?.name}</span>}
          </span>
        </span>
      </button>
      {flags.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warnbg px-2.5 py-1.5 text-xs text-warn">
          <Warning size={14} className="mt-px shrink-0" aria-hidden />
          Parece una instrucción para un agente ({flags.join(", ")}). No irá al prompt salvo que tú lo incluyas.
        </p>
      )}
      {c.replies.length > 0 && (
        <ul className="ml-8 mt-2 grid gap-2 border-l border-line pl-3">
          {c.replies.map((r) => (
            <li key={r.id}>
              <p className="whitespace-pre-wrap break-words">{r.body}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {r.author.name} {ROLE(r.author.kind)} {fmtDate(r.at)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {focused && (
        <div className="ml-8 mt-3 grid gap-2">
          {ctx.data.me.can.comment && (
            <div className="flex gap-2">
              <input className="input" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder" aria-label="Respuesta" />
              <button className="btn btn-sm" disabled={!reply.trim()} onClick={() => act({ action: "reply", body: reply })}>
                Responder
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {c.status === "open" && ctx.data.me.can.resolve && (
              <button className="btn btn-sm" onClick={() => act({ action: "resolve", body: reply.trim() || undefined })}>
                Resolver{reply.trim() ? " y responder" : ""}
              </button>
            )}
            {c.status === "resolved" && ctx.data.me.can.comment && (
              <button className="btn btn-quiet btn-sm" onClick={() => act({ action: "reopen" })}>
                Reabrir
              </button>
            )}
          </div>
          {err && <p className="text-xs text-bad">{err}</p>}
          {c.events.length > 1 && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Historial</summary>
              <ul className="mt-1 grid gap-0.5">
                {c.events.map((e, i) => (
                  <li key={i}>
                    {fmtDate(e.at)}: {EVENT[e.type] ?? e.type}
                    {e.type === "carried" ? ` v${ctx.data.versions.find((v) => v.id === e.revisionId)?.number ?? "?"}` : ""}
                    {e.by ? `, ${e.by.name}` : ""}
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

"use client";
import { ChatCircle, CheckCircle, GitBranch, LockSimple, PencilSimple, Path, UploadSimple, XCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { Ago, Avatar, CircuitList, CopyButton, PrLink } from "@/components/ui";
import { latestVerdicts, type Stage } from "@/lib/flow";
import { kitSize } from "@/lib/kit";
import type { Comment, Verdict } from "@/lib/model";
import { Item } from "./CommentList";
import OpenApp, { waysToOpen } from "./OpenApp";
import { TestPlan } from "./TestPlan";
import type { Ctx } from "./types";

export type Go = (tab: "revisar" | "versiones", opts?: { view?: "capturas" | "vivo" | "cambios"; panel?: "kit" | "test" | "comments"; flow?: string }) => void;

const VERDICT = {
  approve: { text: "aprobó", Icon: CheckCircle, cls: "bg-ok text-okbg" },
  changes: { text: "pidió cambios en", Icon: XCircle, cls: "bg-warn text-warnbg" },
  comment: { text: "envió comentarios sobre", Icon: ChatCircle, cls: "bg-neutral text-ink" },
} as const;

type Ev =
  | { at: number; t: "version"; v: Ctx["data"]["versions"][number] }
  | { at: number; t: "verdict"; v: Verdict; n: number }
  | { at: number; t: "comment"; c: Comment }
  | { at: number; t: "closed"; who: string };

/**
 * Resumen de la revisión, como la conversación de una PR: la descripción, qué probar y
 * todo lo que ha pasado (versiones, comentarios, veredictos) en orden. A la derecha,
 * lo que hace falta para orientarse: siguiente paso, quién revisa, cómo abrir la app.
 */
export default function Overview({
  ctx,
  go,
  onEdit,
  onShare,
  onFinish,
  step,
  stage,
}: {
  ctx: Ctx;
  go: Go;
  onEdit?: () => void;
  onShare?: () => void;
  onFinish?: () => void;
  step: { text: string };
  stage: Stage;
}) {
  const { revision: r, review: rv, project: p, versions, comments, me, latest } = ctx.data;

  const events: Ev[] = [
    ...versions.map((v) => ({ at: v.createdAt, t: "version" as const, v })),
    ...versions.flatMap((v) => (v.verdicts ?? []).map((x) => ({ at: x.at, t: "verdict" as const, v: x, n: v.number }))),
    ...comments.map((c) => ({ at: c.createdAt, t: "comment" as const, c })),
    ...(rv.status === "closed" && rv.closedAt ? [{ at: rv.closedAt, t: "closed" as const, who: rv.closedBy?.name ?? "" }] : []),
  ].sort((a, b) => a.at - b.at);
  // La v1 ya la cuenta la descripción; no se repite en la actividad.
  const first = versions.find((v) => v.number === 1);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_296px]">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm lg:hidden">
          <span className="block text-xs font-semibold text-muted">Siguiente paso</span>
          {step.text}
        </p>
        <article className="box">
          <header className="box-head">
            <Avatar name={rv.author.name} size={22} />
            <span className="min-w-0 flex-1 truncate">
              <b className="font-semibold">{rv.author.name}</b> <span className="text-muted">abrió la revisión</span>{" "}
              <span className="text-muted">
                <Ago t={rv.createdAt} />
              </span>
              {first && first.publishedBy.via === "apikey" && <span className="chip ml-2 bg-neutral text-muted">con su agente</span>}
            </span>
            {onEdit && (
              <button className="btn btn-quiet btn-sm" onClick={onEdit}>
                <PencilSimple size={15} aria-hidden /> Editar
              </button>
            )}
          </header>
          <div className="px-4 py-4">
            <div className="max-w-[72ch] whitespace-pre-wrap text-[15px] leading-relaxed">{rv.purpose?.trim() || <span className="text-muted">Sin descripción.</span>}</div>
            {r.summary?.trim() && r.summary.trim() !== rv.purpose?.trim() && (
              <div className="mt-4 max-w-[72ch] border-l-2 border-accent pl-3 text-[15px] leading-relaxed">
                <p className="text-[13px] font-semibold text-muted">Novedades de la v{r.number}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{r.summary}</p>
              </div>
            )}
            {r.flows.length > 0 && (
              <ul className="mt-5 grid gap-1.5 sm:grid-cols-2">
                {r.flows.map((f) => (
                  <li key={f.key}>
                    <button
                      onClick={() => go("revisar", { view: "capturas", flow: f.key })}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:border-field hover:bg-sunken/50"
                    >
                      <Path size={18} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{f.title}</span>
                        <span className="block text-[13px] text-muted">
                          {f.description ? `${f.description} · ` : ""}
                          {f.steps.length} {f.steps.length === 1 ? "pantalla" : "pantallas"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <section className="box" aria-labelledby="o-test">
          <header className="box-head">
            <h2 id="o-test" className="font-semibold">
              Qué probar
            </h2>
          </header>
          <div className="px-4 py-3">
            <TestPlan ctx={ctx} />
          </div>
        </section>

        <section aria-labelledby="o-act">
          <h2 id="o-act" className="sr-only">
            Actividad
          </h2>
          <ol className="relative grid grid-cols-[minmax(0,1fr)] gap-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
            {events.map((e, i) => {
              if (e.t === "version")
                return e.v.number === 1 ? null : (
                  <li key={i} className="relative flex gap-3 pl-0">
                    <Dot cls="bg-ink text-paper">
                      <UploadSimple size={14} weight="bold" aria-hidden />
                    </Dot>
                    <div className="min-w-0 flex-1 pt-1 text-sm">
                      <p>
                        <b className="font-semibold">{e.v.publishedBy.name}</b> <span className="text-muted">publicó la</span>{" "}
                        <a href={`/r/${e.v.id}`} className="font-semibold hover:underline">
                          v{e.v.number}
                        </a>{" "}
                        <span className="text-muted">
                          <Ago t={e.at} />
                        </span>
                      </p>
                      <p className="mt-0.5 truncate">{e.v.title}</p>
                      <a href={`/r/${e.v.id}?revisar=cambios`} className="mt-1 inline-block text-[13px] font-medium text-accent-ink hover:underline">
                        Ver qué cambió
                      </a>
                    </div>
                  </li>
                );
              if (e.t === "verdict") {
                const V = VERDICT[e.v.kind];
                return (
                  <li key={i} className="relative flex gap-3">
                    <Dot cls={V.cls}>
                      <V.Icon size={16} weight="fill" aria-hidden />
                    </Dot>
                    <div className="min-w-0 flex-1 pt-1 text-sm">
                      <p>
                        <b className="font-semibold">{e.v.author.name}</b> <span className="text-muted">{V.text} la v{e.n}</span>{" "}
                        <span className="text-muted">
                          <Ago t={e.at} />
                        </span>
                      </p>
                      {e.v.note && <p className="mt-1 whitespace-pre-wrap rounded-lg border border-line bg-card px-3 py-2">{e.v.note}</p>}
                    </div>
                  </li>
                );
              }
              if (e.t === "closed")
                return (
                  <li key={i} className="relative flex gap-3">
                    <Dot cls="bg-neutral text-muted">
                      <LockSimple size={14} weight="bold" aria-hidden />
                    </Dot>
                    <p className="pt-1 text-sm">
                      <b className="font-semibold">{e.who}</b> <span className="text-muted">cerró la revisión</span>{" "}
                      <span className="text-muted">
                        <Ago t={e.at} />
                      </span>
                    </p>
                  </li>
                );
              return (
                <li key={i} className="relative flex gap-3">
                  <span className="relative z-10 mt-0.5">
                    <Avatar name={e.c.author.name} kind={e.c.author.kind} size={32} />
                  </span>
                  <ul className="min-w-0 flex-1">
                    <Item c={e.c} ctx={ctx} />
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>

        {me.can.comment && <Composer ctx={ctx} onFinish={onFinish} />}
      </div>

      <aside className="grid content-start gap-0 text-sm lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <Side title="Siguiente paso" className="hidden lg:block">
          <p className="mb-3 text-[13px] leading-snug text-ink" data-testid="next-step">
            {step.text}
          </p>
          <CircuitList stage={stage} version={latest.number} />
        </Side>

        <Side title="Revisores">
          <Reviewers ctx={ctx} />
        </Side>

        {waysToOpen(r).length > 0 && (
          <Side title="Abrir la app">
            <OpenApp revision={r} size="compact" />
          </Side>
        )}

        <Side
          title="Kit de prueba"
          action={
            kitSize(rv.testKit) > 0 ? (
              <button className="font-medium text-accent-ink hover:underline" onClick={() => go("revisar", { panel: "kit" })}>
                Ver
              </button>
            ) : onEdit ? (
              <button className="font-medium text-accent-ink hover:underline" onClick={onEdit}>
                Añadir
              </button>
            ) : null
          }
        >
          <KitSummary ctx={ctx} />
        </Side>

        {(rv.branch || rv.prUrl) && (
          <Side title="Código">
            {rv.branch && (
              <p className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
                <GitBranch size={14} className="shrink-0" aria-hidden />
                <span className="truncate">{rv.branch}</span>
              </p>
            )}
            {rv.prUrl && (
              <p className="mt-1.5">
                <PrLink url={rv.prUrl} />
              </p>
            )}
          </Side>
        )}

        {me.can.publish && (
          <Side
            title="Invitados"
            action={
              onShare && (
                <button className="font-medium text-accent-ink hover:underline" onClick={onShare}>
                  Compartir
                </button>
              )
            }
          >
            <p className="text-[13px] text-muted">{ctx.data.shared ? "Hay alguien más que puede revisarla." : "Nadie más la ve todavía."}</p>
          </Side>
        )}

        {p.context?.trim() && (
          <Side title="Sobre la app">
            <details className="text-[13px]">
              <summary className="cursor-pointer text-muted">Contexto permanente</summary>
              <p className="mt-2 whitespace-pre-wrap">{p.context}</p>
            </details>
          </Side>
        )}
      </aside>
    </div>
  );
}

function Dot({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-paper ${cls}`}>{children}</span>;
}

function Side({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border-b border-line py-4 first:pt-0 last:border-0 ${className}`}>
      <h3 className="side-title">
        {title}
        {action && <span className="text-[13px]">{action}</span>}
      </h3>
      {children}
    </section>
  );
}

function Reviewers({ ctx }: { ctx: Ctx }) {
  const { latest, comments, review } = ctx.data;
  const vs = latestVerdicts(latest.verdicts);
  const seen = new Set(vs.map((v) => `${v.author.kind}:${v.author.name}`));
  const others = [...new Map(comments.filter((c) => c.author.name !== review.author.name).map((c) => [`${c.author.kind}:${c.author.name}`, c.author])).entries()]
    .filter(([k]) => !seen.has(k))
    .map(([, a]) => a);
  if (!vs.length && !others.length) return <p className="text-[13px] text-muted">Nadie ha revisado la v{latest.number} todavía.</p>;
  return (
    <ul className="grid gap-2">
      {vs.map((v, i) => {
        const V = VERDICT[v.kind];
        return (
          <li key={i} className="flex items-center gap-2">
            <Avatar name={v.author.name} kind={v.author.kind} size={22} />
            <span className="min-w-0 flex-1 truncate">{v.author.name}</span>
            <span title={`${V.text} la v${latest.number}`} className={v.kind === "approve" ? "text-ok" : v.kind === "changes" ? "text-warn" : "text-muted"}>
              <V.Icon size={18} weight="fill" aria-label={V.text} />
            </span>
          </li>
        );
      })}
      {others.map((a, i) => (
        <li key={`o${i}`} className="flex items-center gap-2">
          <Avatar name={a.name} kind={a.kind} size={22} />
          <span className="min-w-0 flex-1 truncate">{a.name}</span>
          <span className="text-xs text-muted">{a.kind === "guest" ? "invitado, comentó" : "comentó"}</span>
        </li>
      ))}
    </ul>
  );
}

function KitSummary({ ctx }: { ctx: Ctx }) {
  const rv = ctx.data.review;
  const n = kitSize(rv.testKit);
  const notes = rv.testData?.trim();
  if (!n && !notes) return <p className="text-[13px] text-muted">Sin datos de prueba.</p>;
  return (
    <div className="grid gap-2">
      {n > 0 && (
        <p className="text-[13px]">
          {n} {n === 1 ? "etiqueta" : "etiquetas"}
          {rv.testKit!.pages.length > 1 ? ` en ${rv.testKit!.pages.length} páginas` : ""}: usuarios, códigos y lo que haga falta, con su QR.
        </p>
      )}
      {notes && (
        <div className="rounded-lg bg-sunken px-2.5 py-2">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{notes}</pre>
          <div className="mt-1.5">
            <CopyButton text={notes} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Caja para comentar, al final de la conversación (como en una PR). */
function Composer({ ctx, onFinish }: { ctx: Ctx; onFinish?: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const me = ctx.data.me;
  return (
    <form
      className="flex gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        try {
          await ctx.addComment({ type: "general" }, body);
          setBody("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="mt-1 hidden sm:block">
        <Avatar name={me.name} kind={me.kind} size={32} />
      </span>
      <div className="box min-w-0 flex-1">
        <label htmlFor="o-comment" className="sr-only">
          Comentario
        </label>
        <textarea
          id="o-comment"
          className="block min-h-24 w-full resize-y bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Deja un comentario general. Para señalar algo concreto, márcalo en Revisar."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }}
        />
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-sunken/40 px-3 py-2">
          {onFinish && (
            <button type="button" className="btn btn-sm" onClick={onFinish}>
              Terminar revisión
            </button>
          )}
          <button className="btn btn-strong btn-sm" disabled={busy || !body.trim()}>
            Comentar
          </button>
        </div>
      </div>
    </form>
  );
}

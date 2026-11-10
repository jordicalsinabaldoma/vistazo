"use client";
import { useState } from "react";
import { fileUrl } from "@/lib/client";
import type { Comment, Step } from "@/lib/model";
import AssetViewer from "./AssetViewer";
import type { Ctx } from "./types";

export default function FlowsView({ ctx }: { ctx: Ctx }) {
  const { revision } = ctx.data;
  const [sel, setSel] = useState(() => {
    const f = revision.flows[0];
    return f ? `${f.key}/${f.steps[0]?.key ?? ""}` : "";
  });
  if (!revision.flows.length)
    return <p className="p-6 text-muted">Esta revisión no tiene recorridos con capturas. Usa la pestaña «En vivo».</p>;

  const [fk, sk] = sel.split("/");
  const flow = revision.flows.find((f) => f.key === fk) ?? revision.flows[0];
  const step = flow.steps.find((s) => s.key === sk) ?? flow.steps[0];
  const countFor = (fKey: string, sKey: string) =>
    ctx.data.comments.filter(
      (c) => c.status === "open" && "stepKey" in c.anchor && c.anchor.flowKey === fKey && c.anchor.stepKey === sKey,
    ).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <nav className="grid content-start gap-4 text-sm">
        {revision.flows.map((f) => (
          <div key={f.key}>
            <p className="font-semibold">{f.title}</p>
            {f.description && <p className="mt-0.5 text-xs text-muted">{f.description}</p>}
            <ol className="mt-2 grid gap-0.5">
              {f.steps.map((s, i) => {
                const n = countFor(f.key, s.key);
                const active = f.key === flow.key && s.key === step?.key;
                return (
                  <li key={s.key}>
                    <button
                      onClick={() => setSel(`${f.key}/${s.key}`)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left ${active ? "bg-ink text-white" : "hover:bg-ink/5"}`}
                    >
                      <span className="w-4 font-mono text-[11px] opacity-60">{i + 1}</span>
                      <span className="flex-1 truncate">{s.title}</span>
                      {n > 0 && <span className="chip bg-accent text-white">{n}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </nav>
      {step && <StepView ctx={ctx} flowKey={flow.key} step={step} />}
    </div>
  );
}

function StepView({ ctx, flowKey, step }: { ctx: Ctx; flowKey: string; step: Step }) {
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const here = (c: Comment) => "stepKey" in c.anchor && c.anchor.flowKey === flowKey && c.anchor.stepKey === step.key;
  const ids = new Set(step.assets.map((a) => a.id));
  // Comentarios de este paso hechos sobre capturas de versiones anteriores (arrastrados).
  const carried = ctx.data.comments.filter(
    (c) => here(c) && c.anchor.type === "asset" && !ids.has(c.anchor.assetId),
  );
  const stepComments = ctx.data.comments.filter((c) => here(c) && c.anchor.type === "step");

  return (
    <section className="min-w-0">
      <header className="mb-3 flex flex-wrap items-baseline gap-3">
        <h3 className="text-lg font-semibold">{step.title}</h3>
        {step.url && <code className="truncate text-xs text-muted">{step.url}</code>}
      </header>
      {step.notes && <p className="mb-3 text-sm text-muted">{step.notes}</p>}
      <div className={`grid max-w-5xl gap-4 ${step.assets.length > 1 ? "xl:grid-cols-2" : ""}`}>
        {step.assets.map((a) => (
          <AssetViewer key={a.id} ctx={ctx} asset={a} flowKey={flowKey} stepKey={step.key} />
        ))}
      </div>
      {!step.assets.length && <p className="card p-6 text-sm text-muted">Paso sin capturas: pruébalo en la pestaña «En vivo».</p>}

      {carried.length > 0 && (
        <div className="mt-4 rounded-lg border border-warn/30 bg-warnbg p-3 text-sm">
          <p className="font-medium text-warn">Pendientes arrastrados de versiones anteriores en este paso</p>
          <ul className="mt-2 grid gap-2">
            {carried.map((c) => {
              const a = c.anchor as Extract<typeof c.anchor, { type: "asset" }>;
              return (
                <li key={c.id} className="flex gap-3">
                  {a.pathname && (
                    <a href={fileUrl(a.pathname)} target="_blank" className="relative block h-16 w-24 shrink-0 overflow-hidden rounded border border-line bg-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fileUrl(a.pathname)} alt="" className="h-full w-full object-cover object-top" />
                      <span className="pin !h-4 !w-4 !text-[9px]" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }} />
                    </a>
                  )}
                  <button className="text-left" onClick={() => ctx.setFocus(c.id)}>
                    <b>#{ctx.numberOf(c)}</b> {c.body} <span className="text-muted">— v{c.originRevisionNumber}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4">
        {stepComments.map((c) => (
          <button key={c.id} onClick={() => ctx.setFocus(c.id)} className="mb-1 block text-left text-sm">
            <b>#{ctx.numberOf(c)}</b> {c.body}
          </button>
        ))}
        {ctx.data.me.can.comment &&
          (writing ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await ctx.addComment({ type: "step", flowKey, stepKey: step.key }, body);
                setBody("");
                setWriting(false);
              }}
            >
              <input autoFocus className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Comentario sobre el paso entero" />
              <button className="btn btn-accent" disabled={!body.trim()}>
                Comentar
              </button>
            </form>
          ) : (
            <button className="btn mt-2" onClick={() => setWriting(true)}>
              Comentar el paso
            </button>
          ))}
      </div>
    </section>
  );
}

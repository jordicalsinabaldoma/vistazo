"use client";
import { ArrowLeft, Browser, GitDiff, Images } from "@phosphor-icons/react";
import { useState } from "react";
import { StateLabel } from "@/components/ui";
import type { Stage } from "@/lib/flow";
import CommentList from "./CommentList";
import DiffView from "./DiffView";
import FlowsView from "./FlowsView";
import LiveView from "./LiveView";
import { TestData, TestPlan } from "./TestPlan";
import type { Ctx } from "./types";

export type View = "capturas" | "vivo" | "cambios";

/**
 * Modo revisión: lo que se prueba en el centro, y al lado qué probar, los datos de
 * prueba y los comentarios. «Terminar revisión» siempre a mano.
 */
export default function Workspace({
  ctx,
  view,
  setView,
  onBack,
  onFinish,
  label,
  stage,
}: {
  ctx: Ctx;
  view: View;
  setView: (v: View) => void;
  onBack: () => void;
  onFinish: () => void;
  label: string;
  stage: Stage;
}) {
  const { revision: r, review: rv, previous, me, comments } = ctx.data;
  const [panel, setPanel] = useState<"test" | "comments">(ctx.data.review.testPlan?.length || ctx.data.project.checklist.length || rv.testData ? "test" : "comments");
  const open = comments.filter((c) => c.status === "open").length;
  // Al crear o señalar un comentario, el panel enseña los comentarios
  // (ajuste de estado durante el render, el patrón que recomienda React).
  const [seen, setSeen] = useState(ctx.focus);
  if (ctx.focus !== seen) {
    setSeen(ctx.focus);
    if (ctx.focus) setPanel("comments");
  }
  const tabs: [View, string, React.ReactNode, boolean][] = [
    ["capturas", "Capturas", <Images key="i" size={16} aria-hidden />, r.flows.length > 0],
    ["vivo", "En vivo", <Browser key="b" size={16} aria-hidden />, !!r.liveUrl],
    ["cambios", previous ? `Cambios desde v${previous.number}` : "Cambios", <GitDiff key="d" size={16} aria-hidden />, !!previous],
  ];

  return (
    <>
      <div className="sticky top-14 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          <button className="btn btn-quiet btn-sm -ml-2" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden /> Resumen
          </button>
          <span className="hidden text-sm font-medium sm:inline tabular">
            #{rv.number} v{r.number}
          </span>
          <span className="hidden md:inline">
            <StateLabel stage={stage} label={label} />
          </span>
          <div className="segmented order-last w-full overflow-x-auto sm:order-none sm:w-auto" role="tablist" aria-label="Qué mirar">
            {tabs.map(([k, l, icon, ok]) => (
              <button key={k} role="tab" aria-selected={view === k} disabled={!ok} onClick={() => setView(k)} className="disabled:opacity-40">
                {icon}
                {l}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            {me.can.comment && !me.isAuthor && (
              <button className="btn btn-primary" onClick={onFinish} data-testid="finish">
                Terminar revisión
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0">
          {view === "capturas" && <FlowsView ctx={ctx} />}
          {view === "vivo" && r.liveUrl && <LiveView ctx={ctx} url={r.liveUrl} />}
          {view === "cambios" && <DiffView prev={previous} cur={r} />}
        </main>
        <aside className="min-w-0 xl:sticky xl:top-[7.5rem] xl:max-h-[calc(100dvh-8.5rem)] xl:overflow-y-auto xl:pr-1" aria-label="Panel de revisión">
          <div className="segmented mb-4 w-full" role="tablist">
            <button role="tab" aria-selected={panel === "test"} onClick={() => setPanel("test")} className="flex-1 justify-center">
              Qué probar
            </button>
            <button role="tab" aria-selected={panel === "comments"} onClick={() => setPanel("comments")} className="flex-1 justify-center">
              Comentarios <span className="tabular">{open}</span>
            </button>
          </div>
          {panel === "test" ? (
            <div className="grid gap-6">
              <TestPlan ctx={ctx} compact />
              <div>
                <h3 className="mb-2 text-sm font-semibold">Datos de prueba</h3>
                <TestData ctx={ctx} />
              </div>
              {rv.purpose?.trim() && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold">Qué cambia</summary>
                  <p className="mt-2 whitespace-pre-wrap text-muted">{rv.purpose}</p>
                </details>
              )}
            </div>
          ) : (
            <CommentList ctx={ctx} />
          )}
        </aside>
      </div>
    </>
  );
}

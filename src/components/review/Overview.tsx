"use client";
import { ArrowSquareOut, Browser, GitDiff, Images } from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/client";
import { latestVerdicts } from "@/lib/flow";
import type { PreviewLink } from "@/lib/model";
import CommentList from "./CommentList";
import { TestData, TestPlan } from "./TestPlan";
import type { Ctx } from "./types";
import type { View } from "./Workspace";

const VERDICT = { approve: "aprobó", changes: "pidió cambios", comment: "envió comentarios" } as const;

/** Resumen de la revisión: qué cambia, qué probar, datos de prueba, comentarios e historial. */
export default function Overview({ ctx, onOpen, onEdit }: { ctx: Ctx; onOpen: (v: View) => void; onEdit?: () => void }) {
  const { revision: r, review: rv, previous, project: p } = ctx.data;
  const steps = r.flows.reduce((n, f) => n + f.steps.length, 0);

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid content-start gap-10">
        <section aria-labelledby="o-what">
          <h2 id="o-what" className="section-title">
            Qué cambia
          </h2>
          <div className="mt-2 max-w-[68ch] whitespace-pre-wrap text-[15px] leading-relaxed">{rv.purpose?.trim() || <span className="text-muted">Sin descripción.</span>}</div>
          {r.summary?.trim() && r.summary.trim() !== rv.purpose?.trim() && (
            <div className="mt-4 max-w-[68ch] rounded-lg bg-sunken/70 px-4 py-3 text-[15px] leading-relaxed">
              <p className="text-sm font-medium text-muted">En la v{r.number}</p>
              <p className="mt-1 whitespace-pre-wrap">{r.summary}</p>
            </div>
          )}
        </section>

        <section aria-labelledby="o-see">
          <h2 id="o-see" className="section-title">
            Míralo
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <OpenTile icon={<Images size={20} aria-hidden />} title="Capturas" detail={steps ? `${steps} ${steps === 1 ? "paso" : "pasos"}` : "Sin capturas"} disabled={!steps} onClick={() => onOpen("capturas")} />
            <OpenTile icon={<Browser size={20} aria-hidden />} title="En vivo" detail={r.liveUrl ? "Pruébala aquí mismo" : "Sin enlace en vivo"} disabled={!r.liveUrl} onClick={() => onOpen("vivo")} />
            <OpenTile
              icon={<GitDiff size={20} aria-hidden />}
              title={previous ? `Cambios desde v${previous.number}` : "Cambios"}
              detail={previous ? "Antes y ahora, pantalla a pantalla" : "Es la primera versión"}
              disabled={!previous}
              onClick={() => onOpen("cambios")}
            />
          </div>
          {(r.liveUrl || r.previews.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {r.liveUrl && (
                <a className="btn btn-sm" href={r.liveUrl} target="_blank" rel="noopener noreferrer">
                  <ArrowSquareOut size={15} aria-hidden /> Abrir en otra pestaña
                </a>
              )}
              {r.previews.map((pv, i) => (
                <Preview key={i} p={pv} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="o-test" className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 id="o-test" className="section-title">
              Qué probar
            </h2>
            <div className="mt-3">
              <TestPlan ctx={ctx} />
            </div>
          </div>
          <div>
            <h2 className="section-title">Datos de prueba</h2>
            <div className="mt-3">
              <TestData ctx={ctx} onEdit={onEdit} />
            </div>
          </div>
        </section>

        <History ctx={ctx} />
      </div>

      <aside className="grid content-start gap-6 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
        <section aria-labelledby="o-comments">
          <h2 id="o-comments" className="section-title mb-3">
            Comentarios
          </h2>
          <CommentList ctx={ctx} />
        </section>
        {p.context?.trim() && (
          <details className="rounded-xl border border-line bg-card p-4 text-sm">
            <summary className="cursor-pointer font-medium">Sobre la app</summary>
            <p className="mt-2 whitespace-pre-wrap text-muted">{p.context}</p>
          </details>
        )}
      </aside>
    </div>
  );
}

function OpenTile({ icon, title, detail, disabled, onClick }: { icon: React.ReactNode; title: string; detail: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 text-left transition-colors hover:border-field disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-ink">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-[13px] text-muted">{detail}</span>
      </span>
    </button>
  );
}

function Preview({ p }: { p: PreviewLink }) {
  const [src, setSrc] = useState("");
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (p.kind === "qr" && show) QRCode.toDataURL(p.url, { margin: 1, width: 200 }).then(setSrc);
  }, [p, show]);
  if (p.kind !== "qr")
    return (
      <a className="btn btn-sm" href={p.url} target="_blank" rel="noopener noreferrer" title={p.instructions}>
        <ArrowSquareOut size={15} aria-hidden /> {p.label || p.url}
      </a>
    );
  return (
    <div className="relative">
      <button className="btn btn-sm" onClick={() => setShow((v) => !v)} aria-expanded={show}>
        QR: {p.label || "abrir en el móvil"}
      </button>
      {show && src && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-line bg-card p-3 shadow-[0_12px_32px_rgb(var(--shadow)/0.18)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Código QR para abrir ${p.label || "la app"}`} className="mx-auto h-48 w-48 rounded bg-white p-1" />
          <p className="mt-2 break-all text-xs text-muted">{p.url}</p>
          {p.instructions && <p className="mt-1 whitespace-pre-wrap text-xs">{p.instructions}</p>}
        </div>
      )}
    </div>
  );
}

/** Historial: versiones y lo que hizo cada persona en cada una. */
function History({ ctx }: { ctx: Ctx }) {
  const { versions, revision: r, latest } = ctx.data;
  return (
    <section aria-labelledby="o-hist">
      <h2 id="o-hist" className="section-title">
        Historial
      </h2>
      <ol className="mt-3 grid gap-0 border-l border-line pl-5">
        {versions.map((v) => {
          const verdicts = v.id === latest.id ? latestVerdicts(latest.verdicts) : v.id === r.id ? latestVerdicts(r.verdicts) : [];
          return (
            <li key={v.id} className="relative pb-5 last:pb-0">
              <span aria-hidden className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-paper ${v.id === r.id ? "bg-accent" : "bg-field"}`} />
              <p className="text-sm">
                <a href={`/r/${v.id}`} className={`font-medium hover:underline ${v.id === r.id ? "text-ink" : ""}`}>
                  v{v.number}
                </a>{" "}
                {v.title} <span className="text-muted">· {fmtDate(v.createdAt)}</span>
              </p>
              {verdicts.length > 0 && (
                <ul className="mt-1 grid gap-0.5 text-[13px] text-muted">
                  {verdicts.map((x, i) => (
                    <li key={i}>
                      {x.author.name} {VERDICT[x.kind]}
                      {x.note ? `: «${x.note}»` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {verdicts.length === 0 && v.approved && <p className="mt-1 text-[13px] text-muted">Aprobada en su momento.</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

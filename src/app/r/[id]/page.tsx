"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import CommentList from "@/components/review/CommentList";
import DiffView from "@/components/review/DiffView";
import FeedbackPanel from "@/components/review/FeedbackPanel";
import FlowsView from "@/components/review/FlowsView";
import LiveView from "@/components/review/LiveView";
import type { Ctx, ReviewData } from "@/components/review/types";
import { api, fmtDate } from "@/lib/client";
import type { Anchor, Comment, PreviewLink } from "@/lib/model";

type Tab = "flows" | "live" | "diff" | "context";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [showFb, setShowFb] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<ReviewData>(`/api/revisions/${id}`);
      setData(d);
      setTab((t) => t ?? (d.revision.flows.length ? "flows" : d.revision.liveUrl ? "live" : "context"));
    } catch (e) {
      const er = e as Error & { status?: number };
      setErr(er.status === 401 ? "Necesitas iniciar sesión o abrir el enlace de invitado que te han pasado." : er.message);
    }
  }, [id]);
  useEffect(() => {
    load();
    const h = location.hash.match(/^#c-(.+)/);
    if (h) setFocus(h[1]);
  }, [load]);

  const order = useMemo(() => new Map(data?.comments.map((c, i) => [c.id, i + 1])), [data]);
  const ctx: Ctx | null = data
    ? {
        data,
        focus,
        setFocus,
        numberOf: (c: Comment) => order.get(c.id) ?? 0,
        addComment: async (anchor: Anchor, body: string) => {
          const r = await api<{ comment: Comment }>(`/api/revisions/${id}/comments`, { method: "POST", json: { anchor, body } });
          await load();
          setFocus(r.comment.id);
        },
      }
    : null;

  if (err)
    return (
      <>
        <TopBar />
        <p className="card mx-auto mt-16 max-w-md p-6 text-bad">{err}</p>
      </>
    );
  if (!data || !ctx || !tab) return <p className="p-10 text-muted">Cargando revisión…</p>;

  const { revision: r, project: p, me } = data;
  const approved = r.approvals.length > 0;
  const open = data.comments.filter((c) => c.status === "open").length;
  const pendingChecks = p.checklist.filter((i) => r.checks[i.id]?.status !== "ok");

  return (
    <>
      <TopBar>
        {me.kind === "user" ? (
          <Link href={`/p/${p.id}`} className="hover:underline">
            {p.name}
          </Link>
        ) : (
          p.name
        )}{" "}
        / <span className="text-ink">v{r.number}</span>
      </TopBar>
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5">
        <header className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input w-auto py-1 font-mono text-sm font-semibold"
                value={r.id}
                onChange={(e) => router.push(`/r/${e.target.value}`)}
                aria-label="Versión"
              >
                {data.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.number} {v.approved ? "✓" : ""}
                  </option>
                ))}
              </select>
              <h1 className="text-xl font-semibold tracking-tight">{r.title}</h1>
              {approved ? (
                <span className="chip bg-okbg text-ok" data-testid="approved">
                  ✓ Aprobada visualmente por {r.approvals.map((a) => a.name).join(", ")}
                </span>
              ) : (
                <span className="chip bg-paper text-muted">En revisión</span>
              )}
              {data.versions[0]?.id !== r.id && <span className="chip bg-warnbg text-warn">Hay una versión más reciente</span>}
            </div>
            <p className="mt-1 text-xs text-muted">
              Publicada {fmtDate(r.createdAt)} por {r.publishedBy.name} {r.source === "agent" ? "desde el agente" : "desde el formulario"}
              {r.meta && Object.entries(r.meta).map(([k, v]) => ` · ${k}: ${v}`)}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setShowFb(true)}>
              Feedback para el agente
            </button>
            <Approve ctx={ctx} reload={load} open={open} pendingChecks={pendingChecks.length} />
          </div>
        </header>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
          <main className="min-w-0">
            <nav className="mb-4 flex gap-1 border-b border-line text-sm">
              {(
                [
                  ["flows", `Recorridos (${r.flows.length})`],
                  ["live", "En vivo"],
                  ["diff", data.previous ? `Cambios desde v${data.previous.number}` : "Cambios"],
                  ["context", "Contexto"],
                ] as [Tab, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  disabled={k === "live" && !r.liveUrl}
                  className={`-mb-px border-b-2 px-3 py-2 font-medium disabled:opacity-40 ${tab === k ? "border-ink" : "border-transparent text-muted"}`}
                >
                  {l}
                </button>
              ))}
            </nav>
            {tab === "flows" && <FlowsView ctx={ctx} />}
            {tab === "live" && r.liveUrl && <LiveView ctx={ctx} url={r.liveUrl} />}
            {tab === "diff" && <DiffView prev={data.previous} cur={r} />}
            {tab === "context" && <Context data={data} />}
          </main>

          <aside className="grid content-start gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            {p.checklist.length > 0 && <Checklist ctx={ctx} reload={load} />}
            <section>
              <h2 className="mb-2 text-sm font-semibold">Comentarios</h2>
              <CommentList ctx={ctx} reload={load} />
            </section>
          </aside>
        </div>
      </div>
      {showFb && <FeedbackPanel revisionId={r.id} onClose={() => setShowFb(false)} />}
    </>
  );
}

function Approve({ ctx, reload, open, pendingChecks }: { ctx: Ctx; reload: () => Promise<void>; open: number; pendingChecks: number }) {
  const { revision: r, me } = ctx.data;
  const mine = r.approvals.some((a) => a.userId === me.id);
  const [err, setErr] = useState("");
  if (!me.can.approve)
    return (
      <span className="btn pointer-events-none opacity-60" title="La aprobación formal es de usuarios identificados">
        Aprobar (requiere cuenta)
      </span>
    );
  return (
    <div className="text-right">
      <button
        className={`btn ${mine ? "" : "btn-primary"}`}
        onClick={async () => {
          setErr("");
          if (!mine) {
            const warn = [open ? `${open} comentario(s) pendiente(s)` : "", pendingChecks ? `${pendingChecks} flujo(s) crítico(s) sin verificar` : ""]
              .filter(Boolean)
              .join(" y ");
            if (!confirm(`${warn ? `Quedan ${warn}.\n` : ""}¿Apruebas visualmente la v${r.number}? (No implica merge ni deploy.)`)) return;
          }
          try {
            await api(`/api/revisions/${r.id}/approve`, { method: mine ? "DELETE" : "POST", json: {} });
            await reload();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        {mine ? "Retirar mi aprobación" : "✓ Aprobar revisión"}
      </button>
      {err && <p className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}

function Checklist({ ctx, reload }: { ctx: Ctx; reload: () => Promise<void> }) {
  const { project: p, revision: r, me } = ctx.data;
  const done = p.checklist.filter((i) => r.checks[i.id]?.status === "ok").length;
  return (
    <section className="card p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Flujos críticos</h2>
        <span className={`chip ${done === p.checklist.length ? "bg-okbg text-ok" : "bg-warnbg text-warn"}`}>
          {done}/{p.checklist.length} verificados
        </span>
      </div>
      <ul className="mt-2 grid gap-1 text-sm">
        {p.checklist.map((i) => {
          const c = r.checks[i.id];
          return (
            <li key={i.id} className="flex items-center gap-2">
              <span className="flex-1">
                {i.title}
                {c && c.status !== "pending" && <span className="block text-[11px] text-muted">{c.by}</span>}
              </span>
              {(["ok", "fail"] as const).map((s) => (
                <button
                  key={s}
                  disabled={!me.can.comment}
                  title={s === "ok" ? "Funciona" : "Falla"}
                  onClick={async () => {
                    await api(`/api/revisions/${r.id}/checks`, {
                      method: "POST",
                      json: { itemId: i.id, status: c?.status === s ? "pending" : s },
                    });
                    await reload();
                  }}
                  className={`h-7 w-7 rounded-md border text-xs ${
                    c?.status === s ? (s === "ok" ? "border-ok bg-ok text-white" : "border-bad bg-bad text-white") : "border-line"
                  }`}
                >
                  {s === "ok" ? "✓" : "✕"}
                </button>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Qr({ p }: { p: PreviewLink }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(p.url, { margin: 1, width: 180 }).then(setSrc);
  }, [p.url]);
  return (
    <div className="card flex gap-4 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.kind === "qr" && src && <img src={src} alt="QR" className="h-36 w-36" />}
      <div className="min-w-0 text-sm">
        <p className="font-medium">{p.label}</p>
        <a href={p.url} className="break-all text-xs text-accent-ink underline" target="_blank" rel="noreferrer">
          {p.url}
        </a>
        {p.instructions && <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{p.instructions}</p>}
      </div>
    </div>
  );
}

function Context({ data }: { data: ReviewData }) {
  const r = data.revision;
  return (
    <div className="grid gap-6">
      {(r.previews.length > 0 || r.liveUrl) && (
        <section>
          <h3 className="mb-2 font-semibold">Cómo probarla</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {r.liveUrl && <Qr p={{ kind: "qr", label: "Abrir en el móvil", url: r.liveUrl }} />}
            {r.previews.map((p, i) => (
              <Qr key={i} p={p} />
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-2 font-semibold">Qué cambia en esta versión</h3>
        <p className="card whitespace-pre-wrap p-4 text-sm">{r.summary || "Sin descripción."}</p>
      </section>
      {data.project.context && (
        <section>
          <h3 className="mb-2 font-semibold">Contexto del proyecto</h3>
          <p className="card whitespace-pre-wrap p-4 text-sm text-muted">{data.project.context}</p>
        </section>
      )}
      {r.flows.some((f) => f.description) && (
        <section>
          <h3 className="mb-2 font-semibold">Recorridos de prueba</h3>
          <ul className="card divide-y divide-line text-sm">
            {r.flows.map((f) => (
              <li key={f.key} className="p-3">
                <b>{f.title}</b> <span className="text-muted">— {f.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

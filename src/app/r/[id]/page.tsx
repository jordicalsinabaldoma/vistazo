"use client";
import { DotsThree, GitBranch, PencilSimple, Plus, ShareNetwork } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar, { Crumb } from "@/components/TopBar";
import { EditDialog, FinishDialog, ShareDialog } from "@/components/review/Dialogs";
import FeedbackPanel from "@/components/review/FeedbackPanel";
import Overview from "@/components/review/Overview";
import type { Ctx, ReviewData } from "@/components/review/types";
import Workspace, { type View } from "@/components/review/Workspace";
import { Circuit, ErrorNote, PrLink, StateLabel } from "@/components/ui";
import { api, fmtDate } from "@/lib/client";
import { latestVerdicts, nextStep, stageLabel, stageOf, type Action } from "@/lib/flow";
import type { Anchor, Comment } from "@/lib/model";

type Dialog = "feedback" | "share" | "edit" | "finish" | null;

function readView(): View | null {
  if (typeof location === "undefined") return null;
  const q = new URLSearchParams(location.search).get("revisar");
  return q === "capturas" || q === "vivo" || q === "cambios" ? q : null;
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [err, setErr] = useState("");
  const [focus, setFocus] = useState<string | null>(() => (typeof location !== "undefined" ? (location.hash.match(/^#c-(.+)/)?.[1] ?? null) : null));
  const [dialog, setDialog] = useState<Dialog>(null);
  const [view, setView] = useState<View | null>(readView); // null = resumen; si no, modo revisión
  const [msg, setMsg] = useState("");

  const load = useCallback(
    () =>
      api<ReviewData>(`/api/revisions/${id}`)
        .then(setData)
        .catch((e: Error & { status?: number }) =>
          setErr(e.status === 401 ? "Necesitas iniciar sesión o abrir el enlace de invitado que te han pasado." : e.message),
        ),
    [id],
  );

  // Modo y vista en la URL (?revisar=capturas|vivo|cambios), para poder compartir y volver atrás.
  useEffect(() => {
    load();
    const sync = () => setView(readView());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [load]);

  const go = useCallback((v: View | null) => {
    const u = new URL(location.href);
    if (v) u.searchParams.set("revisar", v);
    else u.searchParams.delete("revisar");
    history.pushState(null, "", u);
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const order = useMemo(() => new Map(data?.comments.map((c, i) => [c.id, i + 1])), [data]);
  const ctx: Ctx | null = data
    ? {
        data,
        focus,
        setFocus,
        reload: load,
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
        <main className="mx-auto max-w-md px-4 py-16">
          <ErrorNote>{err}</ErrorNote>
        </main>
      </>
    );
  if (!data || !ctx)
    return (
      <>
        <TopBar />
        <div className="mx-auto grid max-w-[1200px] gap-4 px-4 py-8" aria-busy="true" aria-label="Cargando revisión">
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-sunken" />
          <div className="h-28 animate-pulse rounded-xl bg-sunken" />
          <div className="h-64 animate-pulse rounded-xl bg-sunken" />
        </div>
      </>
    );

  const { revision: r, review: rv, project: p, me, latest } = data;
  const isLatest = latest.id === r.id;
  const stageInput = { status: rv.status, version: latest.number, verdicts: latest.verdicts, openComments: latest.openComments, openHere: latest.openHere };
  const stage = stageOf(stageInput);
  const label = stageLabel(stage, stageInput);
  const submitted = latestVerdicts(latest.verdicts).some((v) => v.author.kind === me.kind && v.author.id === me.id);
  const step = nextStep(stage, latest.number, {
    isAuthor: me.isAuthor,
    isGuest: me.kind === "guest",
    canVerdict: me.can.approve && me.kind === "user" && !me.isAuthor,
    canPublish: me.can.publish,
    submitted,
    shared: data.shared,
  });

  const act = async (a: Action) => {
    setMsg("");
    if (a === "review") go(r.flows.length ? "capturas" : r.liveUrl ? "vivo" : "capturas");
    else if (a === "diff") go(data.previous ? "cambios" : "capturas");
    else if (a === "feedback") setDialog("feedback");
    else if (a === "share") setDialog("share");
    else if (a === "close")
      try {
        await api(`/api/reviews/${rv.id}`, { method: "PATCH", json: { status: "closed" } });
        await load();
      } catch (e) {
        setMsg((e as Error).message);
      }
    else if (a === "publish") router.push(`/p/${p.id}/nueva?revision=${rv.id}`);
  };

  const team = me.can.publish;

  return (
    <>
      <TopBar>
        {me.kind === "user" ? <Crumb href={`/p/${p.id}`}>{p.name}</Crumb> : <Crumb>{p.name}</Crumb>}
        <Crumb>
          #{rv.number} {rv.title}
        </Crumb>
      </TopBar>

      {view ? (
        <Workspace ctx={ctx} view={view} setView={(v) => go(v)} onBack={() => go(null)} onFinish={() => setDialog("finish")} label={label} stage={stage} />
      ) : (
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6">
          {!isLatest && (
            <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-warnbg px-3 py-2 text-sm text-warn">
              Estás viendo la v{r.number}. La última es la v{latest.number}.
              <Link href={`/r/${latest.id}`} className="font-medium underline">
                Ir a la v{latest.number}
              </Link>
            </p>
          )}

          <header className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-balance md:text-[28px]">
                {rv.title} <span className="font-normal text-muted tabular">#{rv.number}</span>
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                <StateLabel stage={stage} label={label} />
                <span>
                  Abierta por {rv.author.name}, {fmtDate(rv.createdAt)}
                </span>
                {rv.branch && (
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    <GitBranch size={14} aria-hidden />
                    {rv.branch}
                  </span>
                )}
                {rv.prUrl && <PrLink url={rv.prUrl} />}
              </div>
            </div>
            <Versions data={data} />
          </header>

          <section className="card mt-6 flex flex-col gap-5 p-5 lg:flex-row lg:items-center" aria-label="Siguiente paso">
            <div className="min-w-0 flex-1">
              <Circuit stage={stage} version={latest.number} />
              <p className="mt-3 text-[15px]" data-testid="next-step">
                {step.text}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {step.primary && (
                <button className="btn btn-primary min-h-10 px-4 text-[15px]" onClick={() => act(step.primary!.action)} data-testid="primary-action">
                  {step.primary.label}
                </button>
              )}
              <Secondary
                actions={[
                  !step.primary || step.primary.action !== "review" ? (me.can.comment ? { label: "Probar y comentar", on: () => act("review") } : null) : null,
                  me.can.comment && !me.isAuthor && step.primary?.action !== "review" && step.primary?.action !== "diff"
                    ? { label: "Terminar revisión", on: () => setDialog("finish") }
                    : null,
                  team && step.primary?.action !== "feedback" ? { label: "Llevar el feedback a tu agente", on: () => setDialog("feedback") } : null,
                  team && step.primary?.action !== "share" ? { label: "Compartir", icon: <ShareNetwork size={15} aria-hidden />, on: () => setDialog("share") } : null,
                  team ? { label: "Publicar nueva versión", icon: <Plus size={15} aria-hidden />, on: () => act("publish") } : null,
                  team ? { label: "Editar revisión", icon: <PencilSimple size={15} aria-hidden />, on: () => setDialog("edit") } : null,
                  team && rv.status === "open" && step.primary?.action !== "close" ? { label: "Cerrar revisión", on: () => act("close") } : null,
                  team && rv.status === "closed"
                    ? { label: "Reabrir revisión", on: async () => (await api(`/api/reviews/${rv.id}`, { method: "PATCH", json: { status: "open" } }), load()) }
                    : null,
                ]}
              />
            </div>
          </section>
          <div className="mt-3">
            <ErrorNote>{msg}</ErrorNote>
          </div>

          <Overview ctx={ctx} onOpen={(v) => go(v)} onEdit={team ? () => setDialog("edit") : undefined} />
        </main>
      )}

      <FeedbackPanel open={dialog === "feedback"} revisionId={latest.id} onClose={() => setDialog(null)} />
      <ShareDialog open={dialog === "share"} ctx={ctx} onClose={() => (setDialog(null), load())} />
      <EditDialog open={dialog === "edit"} ctx={ctx} onClose={() => (setDialog(null), load())} />
      <FinishDialog
        open={dialog === "finish"}
        ctx={ctx}
        onClose={() => setDialog(null)}
        onDone={async () => {
          setDialog(null);
          await load();
          go(null);
        }}
      />
    </>
  );
}

/** Versiones de la revisión: v1 v2 v3, la actual marcada. */
function Versions({ data }: { data: ReviewData }) {
  const vs = [...data.versions].sort((a, b) => a.number - b.number);
  if (vs.length < 2) return <span className="chip self-start bg-neutral text-ink">v{data.revision.number}</span>;
  return (
    <nav aria-label="Versiones" className="segmented self-start">
      {vs.map((v) => (
        <Link key={v.id} href={`/r/${v.id}`} aria-current={v.id === data.revision.id ? "page" : undefined} title={`${v.title}, ${fmtDate(v.createdAt)}`} className="tabular">
          v{v.number}
        </Link>
      ))}
    </nav>
  );
}

type Sec = { label: string; on: () => void; icon?: React.ReactNode } | null;

/** Acciones secundarias: las dos primeras a la vista, el resto en «Más». */
function Secondary({ actions }: { actions: Sec[] }) {
  const list = actions.filter(Boolean) as Exclude<Sec, null>[];
  const [open, setOpen] = useState(false);
  const shown = list.slice(0, 2);
  const more = list.slice(2);
  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {shown.map((a) => (
        <button key={a.label} className="btn" onClick={a.on}>
          {a.icon}
          {a.label}
        </button>
      ))}
      {more.length > 0 && (
        <>
          <button className="btn px-2" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label="Más acciones">
            <DotsThree size={20} weight="bold" aria-hidden />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
              <ul role="menu" className="absolute right-0 top-full z-40 mt-1 grid min-w-56 rounded-xl border border-line bg-card p-1 shadow-[0_12px_32px_rgb(var(--shadow)/0.18)]" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
                {more.map((a) => (
                  <li key={a.label} role="none">
                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken"
                      onClick={() => {
                        setOpen(false);
                        a.on();
                      }}
                    >
                      {a.icon}
                      {a.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}


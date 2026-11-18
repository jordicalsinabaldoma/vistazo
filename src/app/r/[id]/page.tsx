"use client";
import { ChatsCircle, GitBranch, LockSimple, LockSimpleOpen, MagnifyingGlass, PencilSimple, Plus, Robot, ShareNetwork, Stack } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar, { Crumb } from "@/components/TopBar";
import { EditDialog, FinishDialog, ShareDialog } from "@/components/review/Dialogs";
import FeedbackPanel from "@/components/review/FeedbackPanel";
import Overview, { type Go } from "@/components/review/Overview";
import Versions from "@/components/review/Versions";
import type { Ctx, ReviewData } from "@/components/review/types";
import Workspace, { type Panel, type View } from "@/components/review/Workspace";
import { Avatar, ErrorNote, MoreMenu, PrLink, StateLabel } from "@/components/ui";
import { api } from "@/lib/client";
import { latestVerdicts, nextStep, stageLabel, stageOf, type Action } from "@/lib/flow";
import type { Anchor, Comment } from "@/lib/model";

type Dialog = "feedback" | "share" | "edit" | "finish" | null;
type Tab = { tab: "resumen" | "revisar" | "versiones"; view: View; panel: Panel | null; flow: string | null };

function readTab(): Tab {
  const base: Tab = { tab: "resumen", view: "capturas", panel: null, flow: null };
  if (typeof location === "undefined") return base;
  const q = new URLSearchParams(location.search);
  const v = q.get("revisar");
  const panel = q.get("panel");
  if (v !== null)
    return {
      tab: "revisar",
      view: v === "vivo" || v === "cambios" ? v : "capturas",
      panel: panel === "kit" || panel === "test" || panel === "comments" ? panel : null,
      flow: q.get("flujo"),
    };
  if (q.has("versiones")) return { ...base, tab: "versiones" };
  return base;
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [err, setErr] = useState("");
  const [focus, setFocus] = useState<string | null>(() => (typeof location !== "undefined" ? (location.hash.match(/^#c-(.+)/)?.[1] ?? null) : null));
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tab, setTab] = useState<Tab>(readTab);
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

  // Pestaña y vista en la URL, para poder compartir y volver atrás.
  useEffect(() => {
    load();
    const sync = () => setTab(readTab());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [load]);

  const navigate = useCallback((t: Tab) => {
    const u = new URL(location.href);
    for (const k of ["revisar", "versiones", "panel", "flujo"]) u.searchParams.delete(k);
    if (t.tab === "revisar") {
      u.searchParams.set("revisar", t.view);
      if (t.panel) u.searchParams.set("panel", t.panel);
      if (t.flow) u.searchParams.set("flujo", t.flow);
    }
    if (t.tab === "versiones") u.searchParams.set("versiones", "");
    history.pushState(null, "", u.toString().replace("versiones=", "versiones"));
    setTab(t);
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
        <div className="mx-auto grid max-w-[1280px] gap-4 px-4 py-8" aria-busy="true" aria-label="Cargando revisión">
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-sunken" />
          <div className="h-6 w-1/3 animate-pulse rounded-lg bg-sunken" />
          <div className="mt-6 h-64 animate-pulse rounded-xl bg-sunken" />
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
  const canFinish = me.can.comment && !me.isAuthor;
  const team = me.can.publish;
  const go: Go = (t, o) => navigate({ tab: t, view: o?.view ?? "capturas", panel: o?.panel ?? null, flow: o?.flow ?? null });

  const act = async (a: Action) => {
    setMsg("");
    if (a === "review") go("revisar", { view: r.flows.length ? "capturas" : "vivo" });
    else if (a === "diff") go("revisar", { view: data.previous ? "cambios" : "capturas" });
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

  // En Revisar, lo principal para quien revisa es terminar; en el resto, el siguiente paso.
  const primary =
    tab.tab === "revisar" && canFinish
      ? { label: "Terminar revisión", on: () => setDialog("finish"), testid: "finish" }
      : step.primary
        ? { label: step.primary.label, on: () => act(step.primary!.action), testid: "primary-action" }
        : null;
  const screens = r.flows.reduce((n, f) => n + f.steps.length, 0);
  const openCount = data.comments.filter((c) => c.status === "open").length;

  return (
    <>
      <TopBar>
        {me.kind === "user" ? <Crumb href={`/p/${p.id}`}>{p.name}</Crumb> : <Crumb>{p.name}</Crumb>}
        <Crumb>#{rv.number}</Crumb>
      </TopBar>

      <header className="border-b border-line bg-card">
        <div className={`mx-auto w-full px-4 pt-6 ${tab.tab === "revisar" ? "max-w-[1600px]" : "max-w-[1280px]"}`}>
          {!isLatest && (
            <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-warnbg px-3 py-2 text-sm text-warn">
              Estás viendo la v{r.number}. La última es la v{latest.number}.
              <Link href={`/r/${latest.id}`} className="font-medium underline">
                Ir a la v{latest.number}
              </Link>
            </p>
          )}
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-balance md:text-[30px]">
                {rv.title} <span className="font-normal text-muted tabular">#{rv.number}</span>
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-sm text-muted">
                <StateLabel stage={stage} label={label} size="lg" />
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={rv.author.name} size={18} />
                  <b className="font-medium text-ink">{rv.author.name}</b> pide revisar la{" "}
                  <span className="font-medium text-ink tabular">v{latest.number}</span>
                </span>
                {rv.branch && (
                  <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-sunken px-1.5 py-0.5 font-mono text-xs text-ink">
                    <GitBranch size={13} aria-hidden />
                    {rv.branch}
                  </span>
                )}
                {rv.prUrl && <PrLink url={rv.prUrl} />}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {primary && (
                <button className="btn btn-primary min-h-10 px-4 text-[15px]" onClick={primary.on} data-testid={primary.testid}>
                  {primary.label}
                </button>
              )}
              {tab.tab !== "revisar" && canFinish && step.primary?.action !== "review" && step.primary?.action !== "diff" && (
                <button className="btn min-h-10" onClick={() => setDialog("finish")} data-testid={primary ? undefined : "finish"}>
                  Terminar revisión
                </button>
              )}
              {team && step.primary?.action !== "feedback" && (
                <button className="btn min-h-10" onClick={() => setDialog("feedback")}>
                  <Robot size={16} aria-hidden /> Feedback para tu agente
                </button>
              )}
              <MoreMenu
                items={[
                  team && step.primary?.action !== "share" && { label: "Compartir con invitados", icon: <ShareNetwork size={16} aria-hidden />, on: () => setDialog("share") },
                  team && { label: "Publicar nueva versión", icon: <Plus size={16} aria-hidden />, on: () => act("publish") },
                  team && { label: "Editar revisión y kit de prueba", icon: <PencilSimple size={16} aria-hidden />, on: () => setDialog("edit") },
                  team && rv.status === "open" && step.primary?.action !== "close" && { label: "Cerrar revisión", icon: <LockSimple size={16} aria-hidden />, on: () => act("close") },
                  team &&
                    rv.status === "closed" && {
                      label: "Reabrir revisión",
                      icon: <LockSimpleOpen size={16} aria-hidden />,
                      on: async () => (await api(`/api/reviews/${rv.id}`, { method: "PATCH", json: { status: "open" } }), load()),
                    },
                ]}
              />
            </div>
          </div>
          {msg && (
            <div className="mt-3">
              <ErrorNote>{msg}</ErrorNote>
            </div>
          )}
          <nav className="tabs mt-5" role="tablist" aria-label="Secciones de la revisión">
            <button role="tab" aria-selected={tab.tab === "resumen"} onClick={() => navigate({ ...tab, tab: "resumen" })}>
              <ChatsCircle size={17} aria-hidden /> Resumen {openCount > 0 && <span className="count">{openCount}</span>}
            </button>
            <button role="tab" aria-selected={tab.tab === "revisar"} onClick={() => go("revisar", { view: r.flows.length ? "capturas" : "vivo" })} data-testid="tab-revisar">
              <MagnifyingGlass size={17} aria-hidden /> Revisar {screens > 0 && <span className="count">{screens}</span>}
            </button>
            <button role="tab" aria-selected={tab.tab === "versiones"} onClick={() => navigate({ ...tab, tab: "versiones" })}>
              <Stack size={17} aria-hidden /> Versiones <span className="count">{data.versions.length}</span>
            </button>
          </nav>
        </div>
      </header>

      {tab.tab === "revisar" ? (
        <Workspace ctx={ctx} view={tab.view} setView={(v) => navigate({ ...tab, view: v })} panel={tab.panel} flow={tab.flow} key={`${tab.panel}-${tab.flow}`} />
      ) : (
        <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6">
          {tab.tab === "resumen" ? (
            <Overview
              ctx={ctx}
              go={go}
              step={step}
              stage={stage}
              onEdit={team ? () => setDialog("edit") : undefined}
              onShare={team ? () => setDialog("share") : undefined}
              onFinish={canFinish ? () => setDialog("finish") : undefined}
            />
          ) : (
            <Versions ctx={ctx} />
          )}
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
          navigate({ ...tab, tab: "resumen" });
        }}
      />
    </>
  );
}

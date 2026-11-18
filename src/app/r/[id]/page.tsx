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
type Tab = { tab: "overview" | "review" | "versions"; view: View; panel: Panel | null; flow: string | null };

function readTab(): Tab {
  const base: Tab = { tab: "overview", view: "screens", panel: null, flow: null };
  if (typeof location === "undefined") return base;
  const q = new URLSearchParams(location.search);
  // Old Spanish links (?revisar=capturas|vivo|cambios, ?versiones, flujo) still work.
  const legacy: Record<string, View> = { capturas: "screens", vivo: "live", cambios: "changes" };
  const raw = q.get("review") ?? q.get("revisar");
  const v = raw === null ? null : (legacy[raw] ?? raw);
  const panel = q.get("panel");
  if (v !== null)
    return {
      tab: "review",
      view: v === "live" || v === "changes" ? v : "screens",
      panel: panel === "kit" || panel === "test" || panel === "comments" ? panel : null,
      flow: q.get("flow") ?? q.get("flujo"),
    };
  if (q.has("versions") || q.has("versiones")) return { ...base, tab: "versions" };
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
          setErr(e.status === 401 ? "Sign in, or open the guest link you were sent." : e.message),
        ),
    [id],
  );

  // Tab and view live in the URL, so they can be shared and the back button works.
  useEffect(() => {
    load();
    const sync = () => setTab(readTab());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [load]);

  const navigate = useCallback((t: Tab) => {
    const u = new URL(location.href);
    for (const k of ["review", "versions", "panel", "flow", "revisar", "versiones", "flujo"]) u.searchParams.delete(k);
    if (t.tab === "review") {
      u.searchParams.set("review", t.view);
      if (t.panel) u.searchParams.set("panel", t.panel);
      if (t.flow) u.searchParams.set("flow", t.flow);
    }
    if (t.tab === "versions") u.searchParams.set("versions", "");
    history.pushState(null, "", u.toString().replace("versions=", "versions"));
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
        <div className="mx-auto grid max-w-[1280px] gap-4 px-4 py-8" aria-busy="true" aria-label="Loading review">
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
  const go: Go = (t, o) => navigate({ tab: t, view: o?.view ?? "screens", panel: o?.panel ?? null, flow: o?.flow ?? null });

  const act = async (a: Action) => {
    setMsg("");
    if (a === "review") go("review", { view: r.flows.length ? "screens" : "live" });
    else if (a === "diff") go("review", { view: data.previous ? "changes" : "screens" });
    else if (a === "feedback") setDialog("feedback");
    else if (a === "share") setDialog("share");
    else if (a === "close")
      try {
        await api(`/api/reviews/${rv.id}`, { method: "PATCH", json: { status: "closed" } });
        await load();
      } catch (e) {
        setMsg((e as Error).message);
      }
    else if (a === "publish") router.push(`/p/${p.id}/new?revision=${rv.id}`);
  };

  // On the Review tab, the main action for a reviewer is to finish; elsewhere, the next step.
  const primary =
    tab.tab === "review" && canFinish
      ? { label: "Finish review", on: () => setDialog("finish"), testid: "finish" }
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
        <div className={`mx-auto w-full px-4 pt-6 ${tab.tab === "review" ? "max-w-[1600px]" : "max-w-[1280px]"}`}>
          {!isLatest && (
            <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-warnbg px-3 py-2 text-sm text-warn">
              You’re looking at v{r.number}. The latest is v{latest.number}.
              <Link href={`/r/${latest.id}`} className="font-medium underline">
                Go to v{latest.number}
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
                  <b className="font-medium text-ink">{rv.author.name}</b> asks you to review{" "}
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
              {tab.tab !== "review" && canFinish && step.primary?.action !== "review" && step.primary?.action !== "diff" && (
                <button className="btn min-h-10" onClick={() => setDialog("finish")} data-testid={primary ? undefined : "finish"}>
                  Finish review
                </button>
              )}
              {team && step.primary?.action !== "feedback" && (
                <button className="btn min-h-10" onClick={() => setDialog("feedback")}>
                  <Robot size={16} aria-hidden /> Feedback for your agent
                </button>
              )}
              <MoreMenu
                items={[
                  team && step.primary?.action !== "share" && { label: "Share with guests", icon: <ShareNetwork size={16} aria-hidden />, on: () => setDialog("share") },
                  team && { label: "Publish new version", icon: <Plus size={16} aria-hidden />, on: () => act("publish") },
                  team && { label: "Edit review and test kit", icon: <PencilSimple size={16} aria-hidden />, on: () => setDialog("edit") },
                  team && rv.status === "open" && step.primary?.action !== "close" && { label: "Close review", icon: <LockSimple size={16} aria-hidden />, on: () => act("close") },
                  team &&
                    rv.status === "closed" && {
                      label: "Reopen review",
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
          <nav className="tabs mt-5" role="tablist" aria-label="Review sections">
            <button role="tab" aria-selected={tab.tab === "overview"} onClick={() => navigate({ ...tab, tab: "overview" })}>
              <ChatsCircle size={17} aria-hidden /> Overview {openCount > 0 && <span className="count">{openCount}</span>}
            </button>
            <button role="tab" aria-selected={tab.tab === "review"} onClick={() => go("review", { view: r.flows.length ? "screens" : "live" })} data-testid="tab-revisar">
              <MagnifyingGlass size={17} aria-hidden /> Review {screens > 0 && <span className="count">{screens}</span>}
            </button>
            <button role="tab" aria-selected={tab.tab === "versions"} onClick={() => navigate({ ...tab, tab: "versions" })}>
              <Stack size={17} aria-hidden /> Versions <span className="count">{data.versions.length}</span>
            </button>
          </nav>
        </div>
      </header>

      {tab.tab === "review" ? (
        <Workspace ctx={ctx} view={tab.view} setView={(v) => navigate({ ...tab, view: v })} panel={tab.panel} flow={tab.flow} key={`${tab.panel}-${tab.flow}`} />
      ) : (
        <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6">
          {tab.tab === "overview" ? (
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
          navigate({ ...tab, tab: "overview" });
        }}
      />
    </>
  );
}

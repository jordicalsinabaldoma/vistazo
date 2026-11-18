"use client";
import { Browser, DeviceMobile, GitDiff, Images } from "@phosphor-icons/react";
import { useState } from "react";
import { kitSize } from "@/lib/kit";
import CommentList from "./CommentList";
import DiffView from "./DiffView";
import FlowsView from "./FlowsView";
import { KitView } from "./Kit";
import LiveView from "./LiveView";
import OpenApp, { waysToOpen } from "./OpenApp";
import { TestPlan } from "./TestPlan";
import type { Ctx } from "./types";

export type View = "screens" | "live" | "changes";
export type Panel = "comments" | "kit" | "test";

/**
 * Review: the important part. In the middle, what is being tested (screenshots, the app live
 * or on mobile, or what changed); on the side, comments, the test kit and what to test.
 */
export default function Workspace({
  ctx,
  view,
  setView,
  panel: initial,
  flow,
}: {
  ctx: Ctx;
  view: View;
  setView: (v: View) => void;
  panel?: Panel | null;
  flow?: string | null;
}) {
  const { revision: r, review: rv, previous, comments, project: p } = ctx.data;
  const hasKit = kitSize(rv.testKit) > 0 || !!rv.testData?.trim();
  const items = (rv.testPlan?.length ?? 0) + p.checklist.length;
  const done = [...(rv.testPlan ?? []), ...p.checklist].filter((i) => r.checks[i.id]?.status === "ok").length;
  const [panel, setPanel] = useState<Panel>(initial ?? (hasKit ? "kit" : "comments"));
  const open = comments.filter((c) => c.status === "open").length;
  // When a comment is created or pointed at, the panel shows the comments
  // (state adjusted during render, the pattern React recommends).
  const [seen, setSeen] = useState(ctx.focus);
  if (ctx.focus !== seen) {
    setSeen(ctx.focus);
    if (ctx.focus) setPanel("comments");
  }
  const mobile = !r.liveUrl && waysToOpen(r).length > 0;
  const modes: [View, string, React.ReactNode, boolean][] = [
    ["screens", "Screenshots", <Images key="i" size={16} aria-hidden />, r.flows.length > 0],
    [
      "live",
      mobile || p.platform === "mobile" ? "On mobile" : "Live",
      mobile || p.platform === "mobile" ? <DeviceMobile key="m" size={16} aria-hidden /> : <Browser key="b" size={16} aria-hidden />,
      waysToOpen(r).length > 0,
    ],
    ["changes", previous ? `Changes since v${previous.number}` : "Changes", <GitDiff key="d" size={16} aria-hidden />, !!previous],
  ];
  const panels: [Panel, string, number | string | null][] = [
    ["comments", "Comments", open],
    ["kit", "Kit", kitSize(rv.testKit) || null],
    ["test", "Tests", items ? `${done}/${items}` : null],
  ];

  return (
    <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-10 pt-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="segmented max-w-full overflow-x-auto" role="tablist" aria-label="What to look at">
            {modes.map(([k, l, icon, ok]) => (
              <button key={k} role="tab" aria-selected={view === k} disabled={!ok} onClick={() => setView(k)} className="disabled:opacity-40">
                {icon}
                {l}
              </button>
            ))}
          </div>
        </div>
        {view === "screens" && <FlowsView ctx={ctx} initialFlow={flow} />}
        {view === "live" &&
          (r.liveUrl ? (
            <LiveView ctx={ctx} url={r.liveUrl} />
          ) : (
            <div className="grid gap-4">
              <p className="max-w-[70ch] text-sm text-muted">
                Open it on your phone with the QR and try it with the test kit. Comment on what you see on the screenshots or with a general comment.
              </p>
              <OpenApp revision={r} />
            </div>
          ))}
        {view === "changes" && <DiffView prev={previous} cur={r} />}
      </div>

      <aside className="min-w-0 xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100dvh-5.5rem)] xl:overflow-y-auto xl:pr-1" aria-label="Review panel">
        <div className="tabs mb-4 border-b border-line" role="tablist">
          {panels.map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={panel === k} onClick={() => setPanel(k)}>
              {l}
              {n !== null && n !== 0 && <span className="count">{n}</span>}
            </button>
          ))}
        </div>
        {panel === "comments" && <CommentList ctx={ctx} />}
        {panel === "kit" && <KitPanel ctx={ctx} />}
        {panel === "test" && <TestPlan ctx={ctx} compact />}
      </aside>
    </div>
  );
}

function KitPanel({ ctx }: { ctx: Ctx }) {
  const { review: rv, project: p, me } = ctx.data;
  const notes = rv.testData?.trim();
  if (!kitSize(rv.testKit) && !notes && !rv.testKit?.url)
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
        This review has no test data.
        {me.can.publish && <span className="block">Add it in &quot;Edit review and test kit&quot;, or publish it with your agent (vistazo publish --kit).</span>}
      </p>
    );
  return (
    <div className="grid gap-5">
      {rv.testKit && (kitSize(rv.testKit) > 0 || rv.testKit.url) && <KitView kit={rv.testKit} kinds={p.kinds} compact />}
      {notes && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">Test notes</h3>
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-sunken p-3 font-mono text-[13px] leading-relaxed">{notes}</pre>
        </div>
      )}
      <p className="text-xs text-muted">Test data only, never real data.</p>
    </div>
  );
}

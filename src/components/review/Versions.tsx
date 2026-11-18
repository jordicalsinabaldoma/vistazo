"use client";
import { Browser, ChatCircle, CheckCircle, Images, Robot, XCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { Ago, Avatar } from "@/components/ui";
import { latestVerdicts } from "@/lib/flow";
import type { Ctx } from "./types";

const V = {
  approve: { Icon: CheckCircle, cls: "text-ok", text: "approved" },
  changes: { Icon: XCircle, cls: "text-warn", text: "requested changes" },
  comment: { Icon: ChatCircle, cls: "text-muted", text: "commented" },
} as const;

/** Versions of the review, like the commits of a PR: newest on top. */
export default function Versions({ ctx }: { ctx: Ctx }) {
  const { versions, revision: r, comments } = ctx.data;
  return (
    <ol className="mx-auto grid max-w-[920px] gap-3">
      {versions.map((v) => {
        const vs = latestVerdicts(v.verdicts ?? []);
        const born = comments.filter((c) => c.originRevisionId === v.id).length;
        const meta = Object.entries(v.meta ?? {}).filter(([k]) => k !== "branch").slice(0, 4);
        return (
          <li key={v.id} className={`box ${v.id === r.id ? "border-accent/60" : ""}`}>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper tabular">v{v.number}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {v.title}
                  {v.id === r.id && <span className="chip ml-2 bg-accent-soft align-middle text-accent-ink">the one you are viewing</span>}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                  {v.publishedBy.via === "apikey" ? <Robot size={14} aria-hidden /> : <Avatar name={v.publishedBy.name} size={16} />}
                  {v.publishedBy.name}
                  {v.publishedBy.via === "apikey" ? " with their agent" : " from the form"}, <Ago t={v.createdAt} />
                </p>
                {v.summary?.trim() && <p className="mt-2 line-clamp-3 max-w-[70ch] whitespace-pre-wrap text-sm">{v.summary}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                  {v.screens > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Images size={14} aria-hidden /> {v.screens} {v.screens === 1 ? "screen" : "screens"}
                    </span>
                  )}
                  {v.live && (
                    <span className="inline-flex items-center gap-1">
                      <Browser size={14} aria-hidden /> live
                    </span>
                  )}
                  {born > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <ChatCircle size={14} aria-hidden /> {born} {born === 1 ? "new comment" : "new comments"}
                    </span>
                  )}
                  {meta.map(([k, val]) => (
                    <span key={k} className="font-mono text-xs">
                      {k}: {val.length > 14 ? val.slice(0, 12) + "…" : val}
                    </span>
                  ))}
                </p>
                {vs.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    {vs.map((x, i) => {
                      const I = V[x.kind];
                      return (
                        <li key={i} className="inline-flex items-center gap-1">
                          <I.Icon size={15} weight="fill" className={I.cls} aria-hidden />
                          {x.author.name} {I.text}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {v.number > 1 && (
                  <Link className="btn btn-sm" href={`/r/${v.id}?review=changes`}>
                    What changed
                  </Link>
                )}
                {v.id !== r.id && (
                  <Link className="btn btn-sm" href={`/r/${v.id}`}>
                    View
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

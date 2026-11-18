import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { Revision, ShareLink } from "@/lib/model";
import { revAccess } from "@/lib/revaccess";
import { commentsFor, isShared } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rev, a, review } = await revAccess(req, id);
  const [comments, prev, all, links] = await Promise.all([
    commentsFor(id),
    rev.previousRevisionId ? col.revisions().doc(rev.previousRevisionId).get() : null,
    col.revisions().where("reviewId", "==", rev.reviewId).get(),
    col.links().where("reviewId", "==", rev.reviewId).get(),
  ]);
  const p = a.project;
  const versions = all.docs
    .map((d) => d.data() as Revision)
    .sort((x, y) => y.number - x.number)
    .map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      summary: r.summary,
      createdAt: r.createdAt,
      approved: r.approvals.length > 0,
      verdicts: r.verdicts ?? [],
      publishedBy: r.publishedBy,
      source: r.source,
      meta: r.meta ?? {},
      screens: r.flows.reduce((n, f) => n + f.steps.length, 0),
      live: !!r.liveUrl,
    }));
  const latest = versions[0]?.id === rev.id ? rev : ((await col.revisions().doc(versions[0].id).get()).data() as Revision);
  const latestOpen = latest.id === rev.id ? comments : await commentsFor(latest.id);
  return ok({
    revision: rev,
    previous: prev?.exists ? (prev.data() as Revision) : null,
    review,
    latest: {
      id: latest.id,
      number: latest.number,
      verdicts: latest.verdicts ?? [],
      openComments: latestOpen.filter((c) => c.status === "open").length,
      openHere: latestOpen.filter((c) => c.status === "open" && c.originRevisionId === latest.id).length,
    },
    versions,
    comments,
    shared: isShared(p, review, links.docs.map((d) => d.data() as ShareLink)),
    project: { id: p.id, name: p.name, context: p.context, checklist: p.checklist, platform: p.platform ?? null, kinds: p.kinds ?? [] },
    me: { role: a.role, name: a.author.name, id: a.author.id, kind: a.author.kind, can: a.can, isAuthor: a.author.kind === "user" && a.author.id === review.author.id },
  });
});

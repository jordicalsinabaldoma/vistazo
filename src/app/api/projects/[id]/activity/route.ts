import { access } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { Author, Comment, Review, Revision } from "@/lib/model";
import { ensureMigrated } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

export type Activity = {
  at: number;
  type: "published" | "approve" | "changes" | "comment" | "commented" | "resolved" | "closed";
  who: Pick<Author, "kind" | "name">;
  review: { id: string; number: number; title: string };
  revisionId: string;
  version?: number;
  text?: string;
};

/** Lo último que ha pasado en la app: versiones, veredictos, comentarios y cierres. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await ensureMigrated(id);
  const a = await access(req, id);
  const [rvs, revs, coms] = await Promise.all([
    col.reviews().where("projectId", "==", id).get(),
    col.revisions().where("projectId", "==", id).get(),
    col.comments().where("projectId", "==", id).get(),
  ]);
  const reviews = new Map(rvs.docs.map((d) => d.data() as Review).filter((r) => !a.scope || r.id === a.scope).map((r) => [r.id, r]));
  const ref = (rid: string) => {
    const r = reviews.get(rid);
    return r ? { id: r.id, number: r.number, title: r.title } : null;
  };
  const out: Activity[] = [];
  for (const d of revs.docs) {
    const r = d.data() as Revision;
    const review = ref(r.reviewId);
    if (!review) continue;
    out.push({ at: r.createdAt, type: "published", who: { kind: r.publishedBy.via === "apikey" ? "agent" : "user", name: r.publishedBy.name }, review, revisionId: r.id, version: r.number, text: r.title });
    for (const v of r.verdicts ?? [])
      out.push({ at: v.at, type: v.kind, who: v.author, review, revisionId: r.id, version: r.number, text: v.note });
  }
  for (const d of coms.docs) {
    const c = d.data() as Comment;
    const review = ref(c.reviewId);
    if (!review) continue;
    out.push({ at: c.createdAt, type: "commented", who: c.author, review, revisionId: c.originRevisionId, version: c.originRevisionNumber, text: c.body.slice(0, 200) });
    if (c.status === "resolved" && c.resolvedAt && c.resolvedBy)
      out.push({ at: c.resolvedAt, type: "resolved", who: c.resolvedBy, review, revisionId: c.resolvedInRevisionId ?? c.originRevisionId, text: c.body.slice(0, 120) });
  }
  for (const r of reviews.values())
    if (r.status === "closed" && r.closedAt && r.closedBy) out.push({ at: r.closedAt, type: "closed", who: r.closedBy, review: ref(r.id)!, revisionId: r.latestRevisionId });
  out.sort((x, y) => y.at - x.at);
  return ok({ activity: out.slice(0, 60) });
});

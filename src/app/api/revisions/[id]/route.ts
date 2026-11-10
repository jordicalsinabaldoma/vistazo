import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { Revision } from "@/lib/model";
import { revAccess } from "@/lib/revaccess";
import { commentsFor } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rev, a } = await revAccess(req, id);
  const [comments, prev, all] = await Promise.all([
    commentsFor(id),
    rev.previousRevisionId ? col.revisions().doc(rev.previousRevisionId).get() : null,
    col.revisions().where("projectId", "==", rev.projectId).get(),
  ]);
  const p = a.project;
  return ok({
    revision: rev,
    previous: prev?.exists ? (prev.data() as Revision) : null,
    versions: all.docs
      .map((d) => d.data() as Revision)
      .sort((x, y) => y.number - x.number)
      .map((r) => ({ id: r.id, number: r.number, title: r.title, approved: r.approvals.length > 0 })),
    comments,
    project: { id: p.id, name: p.name, context: p.context, checklist: p.checklist },
    me: { role: a.role, name: a.author.name, id: a.author.id, kind: a.author.kind, can: a.can },
  });
});

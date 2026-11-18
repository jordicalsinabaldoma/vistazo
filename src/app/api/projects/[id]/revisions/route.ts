import { access, need } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { Revision } from "@/lib/model";
import { ensureMigrated, publishRevision, publishSchema } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

// Todas las versiones de la app (compatibilidad con CLIs anteriores).
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await ensureMigrated(id);
  const a = await access(req, id);
  const snap = await col.revisions().where("projectId", "==", id).get();
  const revisions = snap.docs
    .map((d) => d.data() as Revision)
    .filter((r) => !a.scope || r.reviewId === a.scope)
    .sort((x, y) => y.createdAt - x.createdAt)
    .map((r) => ({ id: r.id, reviewId: r.reviewId, number: r.number, title: r.title, approved: r.approvals.length > 0, createdAt: r.createdAt }));
  return ok({ revisions });
});

// Misma ruta para el agente (Authorization: Bearer vzk_…) y para el formulario (cookie).
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "publish");
  const input = publishSchema.parse(await req.json());
  const { revision, review, created, carried } = await publishRevision(a, input);
  const origin = new URL(req.url).origin;
  return ok({
    id: revision.id,
    number: revision.number,
    review: { id: review.id, number: review.number, title: review.title, created },
    url: `${origin}/r/${revision.id}`,
    carried,
  });
});

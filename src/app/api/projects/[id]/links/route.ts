import { access, need } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { Review, ShareLink } from "@/lib/model";

type Ctx = { params: Promise<{ id: string }> };

// Todos los enlaces de invitado de la app (se crean desde cada revisión).
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "publish");
  const [ls, rs] = await Promise.all([
    col.links().where("projectId", "==", id).get(),
    col.reviews().where("projectId", "==", id).get(),
  ]);
  const titles = new Map(rs.docs.map((d) => [d.id, d.data() as Review]));
  const links = ls.docs
    .map((d) => d.data() as ShareLink)
    .sort((x, y) => y.createdAt - x.createdAt)
    .map(({ tokenHash: _h, ...l }) => ({
      active: !l.revoked && (!l.expiresAt || l.expiresAt > Date.now()),
      ...l,
      review: l.reviewId && titles.get(l.reviewId) ? { number: titles.get(l.reviewId)!.number, title: titles.get(l.reviewId)!.title } : null,
    }));
  return ok({ links });
});

import { access, need } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, notFound, ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

// Revocar: el invitado pierde el acceso en su siguiente petición (también a los ficheros).
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { id, linkId } = await params;
  const a = await access(req, id);
  need(a, "manage");
  const ref = col.links().doc(linkId);
  const s = await ref.get();
  if (!s.exists || s.data()!.projectId !== id) throw notFound();
  await ref.update({ revoked: true, revokedAt: Date.now() });
  return ok({ ok: true });
});

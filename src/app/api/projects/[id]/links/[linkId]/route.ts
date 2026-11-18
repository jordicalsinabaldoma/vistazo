import { access, need } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, notFound, ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

// Revoke: the guest loses access on their next request (files included).
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { id, linkId } = await params;
  const a = await access(req, id);
  need(a, "publish"); // owner or editor
  const ref = col.links().doc(linkId);
  const s = await ref.get();
  if (!s.exists || s.data()!.projectId !== id) throw notFound();
  await ref.update({ revoked: true, revokedAt: Date.now() });
  return ok({ ok: true });
});

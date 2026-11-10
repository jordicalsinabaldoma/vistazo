import { access, need } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, notFound, ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; keyId: string }> };

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { id, keyId } = await params;
  const a = await access(req, id);
  need(a, "manage");
  const ref = col.keys().doc(keyId);
  const s = await ref.get();
  if (!s.exists || s.data()!.projectId !== id) throw notFound();
  await ref.update({ revoked: true });
  return ok({ ok: true });
});

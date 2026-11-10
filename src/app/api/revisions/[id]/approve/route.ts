import { z } from "zod";
import { need } from "@/lib/auth";
import { col } from "@/lib/db";
import { bad, handle, ok } from "@/lib/http";
import { revAccess } from "@/lib/revaccess";

type Ctx = { params: Promise<{ id: string }> };

// Aprobar es un acto explícito de un usuario identificado y miembro del proyecto.
// Resolver comentarios NO aprueba. La aprobación es visual: no hace merge ni deploy.
const schema = z.object({ note: z.string().max(1000).optional() });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rev, a } = await revAccess(req, id);
  need(a, "approve");
  if (a.actor.kind !== "user") throw bad("Solo usuarios identificados");
  const b = schema.parse(await req.json().catch(() => ({})));
  if (rev.approvals.some((x) => x.userId === a.author.id)) return ok({ ok: true, already: true });
  const approvals = [...rev.approvals, { userId: a.author.id!, name: a.author.name, at: Date.now(), note: b.note }];
  await col.revisions().doc(id).update({ approvals });
  return ok({ ok: true });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rev, a } = await revAccess(req, id);
  need(a, "approve");
  await col.revisions().doc(id).update({ approvals: rev.approvals.filter((x) => x.userId !== a.author.id) });
  return ok({ ok: true });
});

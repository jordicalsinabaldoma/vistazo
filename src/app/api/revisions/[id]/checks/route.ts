import { z } from "zod";
import { need } from "@/lib/auth";
import { col } from "@/lib/db";
import { bad, handle, ok } from "@/lib/http";
import { revAccess } from "@/lib/revaccess";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  itemId: z.string().max(40),
  status: z.enum(["ok", "fail", "pending"]),
  note: z.string().max(500).optional(),
});

// Checklist de recorridos críticos: cualquiera que pruebe (también invitados) marca.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { a } = await revAccess(req, id);
  need(a, "comment");
  const b = schema.parse(await req.json());
  if (!a.project.checklist.some((c) => c.id === b.itemId)) throw bad("Ese punto no está en la checklist");
  await col.revisions().doc(id).update({
    [`checks.${b.itemId}`]: { status: b.status, by: a.author.name, at: Date.now(), note: b.note },
  });
  return ok({ ok: true });
});

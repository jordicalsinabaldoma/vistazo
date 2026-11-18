import { z } from "zod";
import { need } from "@/lib/auth";
import { col, db } from "@/lib/db";
import { forbidden, handle, ok } from "@/lib/http";
import type { Revision, Verdict } from "@/lib/model";
import { latestVerdicts } from "@/lib/flow";
import { revAccess } from "@/lib/revaccess";
import { clean } from "@/lib/untrusted";

type Ctx = { params: Promise<{ id: string }> };

// «Terminar revisión». Pedir cambios y aprobar son actos explícitos de un usuario
// identificado y miembro, que no sea el autor de la revisión. Los invitados solo
// envían comentarios. Aprobar es visual: no hace merge ni deploy.
const schema = z.object({ kind: z.enum(["approve", "changes", "comment"]), note: z.string().max(2000).optional() });

const approvalsOf = (verdicts: Verdict[]) =>
  latestVerdicts(verdicts)
    .filter((v) => v.kind === "approve" && v.author.kind === "user")
    .map((v) => ({ userId: v.author.id!, name: v.author.name, at: v.at, ...(v.note ? { note: v.note } : {}) }));

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { a, review } = await revAccess(req, id);
  const b = schema.parse(await req.json().catch(() => ({})));
  if (b.kind === "comment") need(a, "comment");
  else {
    need(a, "approve");
    if (a.actor.kind !== "user") throw forbidden("Solo usuarios identificados");
    if (a.author.id === review.author.id) throw forbidden("No puedes aprobar ni pedir cambios en tu propia revisión");
  }
  const v: Verdict = { kind: b.kind, author: a.author, at: Date.now(), ...(b.note?.trim() ? { note: clean(b.note.trim(), 2000) } : {}) };
  const ref = col.revisions().doc(id);
  await db().runTransaction(async (tx) => {
    const r = (await tx.get(ref)).data() as Revision;
    const verdicts = [...(r.verdicts ?? []), v];
    tx.update(ref, { verdicts, approvals: approvalsOf(verdicts) });
  });
  return ok({ ok: true });
});

// Retirar mi veredicto de esta versión.
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { a } = await revAccess(req, id);
  const ref = col.revisions().doc(id);
  await db().runTransaction(async (tx) => {
    const r = (await tx.get(ref)).data() as Revision;
    const verdicts = (r.verdicts ?? []).filter((x) => !(x.author.kind === a.author.kind && x.author.id === a.author.id));
    tx.update(ref, { verdicts, approvals: approvalsOf(verdicts) });
  });
  return ok({ ok: true });
});

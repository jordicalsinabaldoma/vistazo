import { nanoid } from "nanoid";
import { z } from "zod";
import { access, need } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { User } from "@/lib/model";
import { ensureMigrated, summarizeReviews } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await ensureMigrated(id);
  const a = await access(req, id);
  let reviews = await summarizeReviews(id);
  if (a.scope) reviews = reviews.filter((r) => r.id === a.scope);
  let members: { id: string; name: string; email: string; role: string }[] = [];
  if (a.role !== "guest" && a.role !== "agent") {
    const users = await Promise.all(a.project.memberIds.map((u) => col.users().doc(u).get()));
    members = users
      .filter((s) => s.exists)
      .map((s) => s.data() as User)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, role: a.project.members[u.id] }));
  }
  const p = a.project;
  return ok({
    project: { id: p.id, name: p.name, context: p.context, checklist: p.checklist },
    members,
    reviews,
    me: { id: a.author.id, kind: a.author.kind, role: a.role, name: a.author.name, can: a.can },
  });
});

const patch = z.object({
  name: z.string().min(1).max(100).optional(),
  context: z.string().max(20000).optional(),
  checklist: z
    .array(
      z.object({
        id: z.string().max(40).optional(),
        title: z.string().trim().min(1).max(200),
        description: z.string().max(1000).optional(),
        flowKey: z.string().max(60).optional(),
      }),
    )
    .max(50)
    .optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "publish"); // propietario o editor
  const b = patch.parse(await req.json());
  await col.projects().doc(id).update({
    ...(b.name ? { name: b.name } : {}),
    ...(b.context !== undefined ? { context: b.context } : {}),
    ...(b.checklist ? { checklist: b.checklist.map((c) => ({ ...c, id: c.id || nanoid(8) })) } : {}),
  });
  return ok({ ok: true });
});

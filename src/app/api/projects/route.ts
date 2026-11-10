import { nanoid } from "nanoid";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok, unauthorized } from "@/lib/http";
import type { Project } from "@/lib/model";

export const GET = handle(async () => {
  const user = await currentUser();
  if (!user) throw unauthorized();
  const snap = await col.projects().where("memberIds", "array-contains", user.id).get();
  const projects = snap.docs
    .map((d) => d.data() as Project)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => ({ id: p.id, name: p.name, role: p.members[user.id], revisionCount: p.revisionCount }));
  return ok({ projects });
});

const schema = z.object({ name: z.string().min(1).max(100), context: z.string().max(20000).default("") });

export const POST = handle(async (req: Request) => {
  const user = await currentUser();
  if (!user) throw unauthorized();
  const b = schema.parse(await req.json());
  const p: Project = {
    id: nanoid(10),
    name: b.name,
    context: b.context,
    checklist: [],
    members: { [user.id]: "owner" },
    memberIds: [user.id],
    createdAt: Date.now(),
    createdBy: user.id,
    revisionCount: 0,
  };
  await col.projects().doc(p.id).set(p);
  return ok({ id: p.id });
});

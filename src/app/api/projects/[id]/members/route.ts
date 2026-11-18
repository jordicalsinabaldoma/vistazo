import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { access, need } from "@/lib/auth";
import { col } from "@/lib/db";
import { bad, handle, notFound, ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  role: z.enum(["editor", "reviewer"]),
});

// Access is per project: only the owner adds or removes members.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "manage");
  const b = schema.parse(await req.json());
  const snap = await col.users().where("email", "==", b.email).limit(1).get();
  if (snap.empty) throw notFound("There is no account with that email. Ask them to sign up first");
  const uid = snap.docs[0].id;
  if (a.project.members[uid] === "owner") throw bad("They are already the owner");
  await col.projects().doc(id).update({ [`members.${uid}`]: b.role, memberIds: FieldValue.arrayUnion(uid) });
  return ok({ ok: true });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "manage");
  const uid = new URL(req.url).searchParams.get("userId") ?? "";
  if (a.project.members[uid] === "owner") throw bad("The owner can't be removed");
  await col.projects().doc(id).update({ [`members.${uid}`]: FieldValue.delete(), memberIds: FieldValue.arrayRemove(uid) });
  return ok({ ok: true });
});

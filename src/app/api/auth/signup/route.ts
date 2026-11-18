import { nanoid } from "nanoid";
import { z } from "zod";
import { hashPassword, startSession } from "@/lib/auth";
import { col } from "@/lib/db";
import { bad, handle, ok } from "@/lib/http";
import type { User } from "@/lib/model";

const schema = z.object({
  email: z.string().email().max(200).transform((s) => s.toLowerCase().trim()),
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(200),
});

export const POST = handle(async (req: Request) => {
  const b = schema.parse(await req.json());
  const dup = await col.users().where("email", "==", b.email).limit(1).get();
  if (!dup.empty) throw bad("An account with that email already exists");
  const user: User = {
    id: nanoid(12),
    email: b.email,
    name: b.name,
    passwordHash: hashPassword(b.password),
    createdAt: Date.now(),
  };
  await col.users().doc(user.id).set(user);
  await startSession(user.id);
  return ok({ id: user.id, name: user.name, email: user.email });
});

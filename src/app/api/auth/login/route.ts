import { z } from "zod";
import { checkPassword, startSession } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok, unauthorized } from "@/lib/http";
import type { User } from "@/lib/model";

const schema = z.object({ email: z.string().email().transform((s) => s.toLowerCase().trim()), password: z.string() });

export const POST = handle(async (req: Request) => {
  const b = schema.parse(await req.json());
  const snap = await col.users().where("email", "==", b.email).limit(1).get();
  const user = snap.empty ? null : (snap.docs[0].data() as User);
  if (!user || !checkPassword(b.password, user.passwordHash)) throw unauthorized("Correo o contraseña incorrectos");
  await startSession(user.id);
  return ok({ id: user.id, name: user.name, email: user.email });
});

import { z } from "zod";
import { sha256, startGuest } from "@/lib/auth";
import { col } from "@/lib/db";
import { forbidden, handle, notFound, ok } from "@/lib/http";
import type { Revision, ShareLink } from "@/lib/model";

// Entrada de invitado: /s/<linkId>.<secreto>. Solo se guarda el hash del secreto.
const schema = z.object({ token: z.string().min(10).max(200), name: z.string().min(1).max(60).optional() });

async function resolve(token: string) {
  const [id, secret] = token.split(".");
  const snap = id ? await col.links().doc(id).get() : null;
  const link = snap?.exists ? (snap.data() as ShareLink) : null;
  if (!link || link.tokenHash !== sha256(secret ?? "")) throw notFound("Enlace no válido");
  if (link.revoked) throw forbidden("Este enlace se ha revocado");
  if (link.expiresAt && link.expiresAt < Date.now()) throw forbidden("Este enlace ha caducado");
  return link;
}

async function latest(projectId: string) {
  const r = await col.revisions().where("projectId", "==", projectId).get();
  const revs = r.docs.map((d) => d.data() as Revision).sort((a, b) => b.number - a.number);
  return revs[0]?.id ?? null;
}

export const GET = handle(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const link = await resolve(token);
  const p = (await col.projects().doc(link.projectId).get()).data();
  return ok({ projectName: p?.name, label: link.label });
});

export const POST = handle(async (req: Request) => {
  const b = schema.parse(await req.json());
  const link = await resolve(b.token);
  await startGuest(link, b.name?.trim() || "Invitado");
  return ok({ projectId: link.projectId, revisionId: await latest(link.projectId) });
});

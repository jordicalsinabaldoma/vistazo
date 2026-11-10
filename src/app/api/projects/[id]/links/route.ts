import { nanoid } from "nanoid";
import { z } from "zod";
import { access, need, randomToken, sha256 } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { ShareLink } from "@/lib/model";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "manage");
  const snap = await col.links().where("projectId", "==", id).get();
  const links = snap.docs
    .map((d) => d.data() as ShareLink)
    .sort((x, y) => y.createdAt - x.createdAt)
    .map(({ tokenHash: _h, ...l }) => l);
  return ok({ links });
});

const schema = z.object({ label: z.string().min(1).max(80), days: z.number().int().min(1).max(90).optional() });

// El enlace completo solo se muestra al crearlo (se guarda el hash del secreto).
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "manage");
  const b = schema.parse(await req.json());
  const secret = randomToken(18);
  const link: ShareLink = {
    id: nanoid(10),
    projectId: id,
    tokenHash: sha256(secret),
    label: b.label,
    revoked: false,
    createdAt: Date.now(),
    createdBy: a.author.id!,
    expiresAt: b.days ? Date.now() + b.days * 86400000 : undefined,
  };
  await col.links().doc(link.id).set(link);
  const origin = new URL(req.url).origin;
  return ok({ id: link.id, url: `${origin}/s/${link.id}.${secret}` });
});

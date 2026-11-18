import { nanoid } from "nanoid";
import { z } from "zod";
import { need, randomToken, sha256 } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { ShareLink } from "@/lib/model";
import { reviewAccess } from "@/lib/revaccess";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { a } = await reviewAccess(req, id);
  need(a, "publish");
  const snap = await col.links().where("reviewId", "==", id).get();
  const links = snap.docs
    .map((d) => d.data() as ShareLink)
    .sort((x, y) => y.createdAt - x.createdAt)
    .map(({ tokenHash: _h, ...l }) => ({ ...l, active: !l.revoked && (!l.expiresAt || l.expiresAt > Date.now()) }));
  return ok({ links });
});

const schema = z.object({ label: z.string().trim().min(1).max(80), days: z.number().int().min(1).max(90).optional() });

// Enlace de invitado que SOLO abre esta revisión. El secreto se muestra una vez.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { a, review } = await reviewAccess(req, id);
  need(a, "publish");
  const b = schema.parse(await req.json());
  const secret = randomToken(18);
  const link: ShareLink = {
    id: nanoid(10),
    projectId: review.projectId,
    reviewId: review.id,
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

import { nanoid } from "nanoid";
import { z } from "zod";
import { access, need, randomToken, sha256 } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { ApiKey } from "@/lib/model";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "manage");
  const snap = await col.keys().where("projectId", "==", id).get();
  const keys = snap.docs
    .map((d) => d.data() as ApiKey)
    .sort((x, y) => y.createdAt - x.createdAt)
    .map(({ keyHash: _h, ...k }) => k);
  return ok({ keys });
});

const schema = z.object({ label: z.string().min(1).max(80) });

// Agent key limited to ONE project: publish reviews and read feedback.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "manage");
  const b = schema.parse(await req.json());
  const kid = nanoid(10).replace(/_/g, "x");
  const raw = `vzk_${kid}_${randomToken(24)}`;
  const key: ApiKey = {
    id: kid,
    projectId: id,
    keyHash: sha256(raw),
    prefix: raw.slice(0, 16),
    label: b.label,
    revoked: false,
    createdAt: Date.now(),
    createdBy: a.author.id!,
  };
  await col.keys().doc(kid).set(key);
  return ok({ id: kid, key: raw });
});

import { z } from "zod";
import { need } from "@/lib/auth";
import { col } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import type { Revision } from "@/lib/model";
import { reviewAccess } from "@/lib/revaccess";
import { kitSchema } from "@/lib/kit";
import { checklistIn, httpsUrl, withIds } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { review } = await reviewAccess(req, id);
  const vs = await col.revisions().where("reviewId", "==", id).get();
  const versions = vs.docs
    .map((d) => d.data() as Revision)
    .sort((a, b) => b.number - a.number)
    .map((r) => ({ id: r.id, number: r.number, title: r.title, createdAt: r.createdAt }));
  return ok({ review, versions });
});

// Edit the review (owner or editor). The PR link is just a link:
// no state is synced with GitHub.
const patch = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  purpose: z.string().max(20000).optional(),
  testData: z.string().max(4000).optional(),
  testPlan: checklistIn.optional(),
  testKit: kitSchema.nullable().optional(),
  branch: z.string().trim().max(200).optional(),
  prUrl: httpsUrl.optional().or(z.literal("")),
  status: z.enum(["open", "closed"]).optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { a } = await reviewAccess(req, id);
  need(a, "publish");
  const b = patch.parse(await req.json());
  const upd: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of ["title", "purpose", "testData", "branch"] as const) if (b[k] !== undefined) upd[k] = b[k];
  if (b.prUrl !== undefined) upd.prUrl = b.prUrl || null;
  if (b.testPlan) upd.testPlan = withIds(b.testPlan);
  if (b.testKit !== undefined) upd.testKit = b.testKit ?? null;
  if (b.status === "closed") Object.assign(upd, { status: "closed", closedAt: Date.now(), closedBy: a.author });
  if (b.status === "open") Object.assign(upd, { status: "open", closedAt: null, closedBy: null });
  await col.reviews().doc(id).update(upd);
  return ok({ ok: true });
});

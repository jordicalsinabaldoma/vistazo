import { nanoid } from "nanoid";
import { z } from "zod";
import { need } from "@/lib/auth";
import { col } from "@/lib/db";
import { bad, handle, ok } from "@/lib/http";
import type { Anchor, Comment } from "@/lib/model";
import { revAccess } from "@/lib/revaccess";
import { clean } from "@/lib/untrusted";

type Ctx = { params: Promise<{ id: string }> };

const frac = z.number().min(0).max(1);
const anchor = z.discriminatedUnion("type", [
  z.object({ type: z.literal("general") }),
  z.object({ type: z.literal("step"), flowKey: z.string().max(60), stepKey: z.string().max(60) }),
  z.object({
    type: z.literal("asset"),
    flowKey: z.string().max(60),
    stepKey: z.string().max(60),
    assetId: z.string().max(40),
    x: frac,
    y: frac,
    t: z.number().min(0).max(36000).optional(),
  }),
  z.object({
    type: z.literal("live"),
    url: z.string().max(2000),
    x: frac,
    y: frac,
    selector: z.string().max(500).optional(),
    text: z.string().max(300).optional(),
    viewport: z.object({ w: z.number().int(), h: z.number().int() }).optional(),
  }),
]);

const schema = z.object({ anchor, body: z.string().trim().min(1).max(4000) });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rev, a } = await revAccess(req, id);
  need(a, "comment");
  const b = schema.parse(await req.json());
  const an = b.anchor as Anchor;
  // What comes from the browser is third-party data too: strip invisible characters.
  if (an.type === "live") {
    an.url = clean(an.url, 2000);
    if (an.selector) an.selector = clean(an.selector, 500);
    if (an.text) an.text = clean(an.text, 300);
  }
  if (an.type === "asset") {
    const asset = rev.flows
      .find((f) => f.key === an.flowKey)
      ?.steps.find((s) => s.key === an.stepKey)
      ?.assets.find((x) => x.id === an.assetId);
    if (!asset) throw bad("That screenshot does not belong to this review");
    an.pathname = asset.pathname;
  }
  const now = Date.now();
  const c: Comment = {
    id: nanoid(10),
    projectId: rev.projectId,
    reviewId: rev.reviewId,
    originRevisionId: rev.id,
    originRevisionNumber: rev.number,
    revisionIds: [rev.id],
    anchor: an,
    body: clean(b.body),
    author: a.author,
    status: "open",
    replies: [],
    events: [{ type: "created", at: now, by: a.author, revisionId: rev.id }],
    createdAt: now,
  };
  await col.comments().doc(c.id).set(c);
  return ok({ comment: c });
});

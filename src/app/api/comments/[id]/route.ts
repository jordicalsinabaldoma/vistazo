import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { z } from "zod";
import { access, need, needScope } from "@/lib/auth";
import { clean } from "@/lib/untrusted";
import { col } from "@/lib/db";
import { handle, notFound, ok } from "@/lib/http";
import type { Comment } from "@/lib/model";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), body: z.string().trim().min(1).max(4000), revisionId: z.string().optional() }),
  z.object({ action: z.literal("resolve"), revisionId: z.string(), body: z.string().trim().max(4000).optional() }),
  z.object({ action: z.literal("reopen"), revisionId: z.string() }),
]);

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const ref = col.comments().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("Comment not found");
  const c = snap.data() as Comment;
  const a = await access(req, c.projectId);
  if (c.reviewId) needScope(a, c.reviewId);
  const b = schema.parse(await req.json());
  const now = Date.now();
  const reply = (body: string) => ({ id: nanoid(8), body: clean(body), author: a.author, at: now });

  if (b.action === "reply") {
    need(a, "comment");
    await ref.update({
      replies: FieldValue.arrayUnion(reply(b.body)),
      events: FieldValue.arrayUnion({ type: "reply", at: now, by: a.author, revisionId: b.revisionId }),
    });
  } else if (b.action === "resolve") {
    need(a, "resolve");
    await ref.update({
      status: "resolved",
      resolvedAt: now,
      resolvedBy: a.author,
      resolvedInRevisionId: b.revisionId,
      ...(b.body ? { replies: FieldValue.arrayUnion(reply(b.body)) } : {}),
      events: FieldValue.arrayUnion({ type: "resolved", at: now, by: a.author, revisionId: b.revisionId }),
    });
  } else {
    // Reopen: whoever resolves can do it, and so can the reviewer (if they disagree).
    need(a, "comment");
    await ref.update({
      status: "open",
      resolvedAt: FieldValue.delete(),
      resolvedBy: FieldValue.delete(),
      resolvedInRevisionId: FieldValue.delete(),
      revisionIds: FieldValue.arrayUnion(b.revisionId),
      events: FieldValue.arrayUnion({ type: "reopened", at: now, by: a.author, revisionId: b.revisionId }),
    });
  }
  return ok({ comment: (await ref.get()).data() });
});

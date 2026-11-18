import { z } from "zod";
import { sha256, startGuest } from "@/lib/auth";
import { col } from "@/lib/db";
import { forbidden, handle, notFound, ok } from "@/lib/http";
import type { Project, Review, ShareLink } from "@/lib/model";
import { ensureMigrated, summarizeReviews } from "@/lib/revisions";

// Entrada de invitado: /s/<linkId>.<secreto>. Solo se guarda el hash del secreto.
const schema = z.object({ token: z.string().min(10).max(200), name: z.string().trim().min(1).max(60).optional() });

async function resolve(token: string) {
  const [id, secret] = token.split(".");
  const snap = id ? await col.links().doc(id).get() : null;
  const link = snap?.exists ? (snap.data() as ShareLink) : null;
  if (!link || link.tokenHash !== sha256(secret ?? "")) throw notFound("Enlace no válido");
  if (link.revoked) throw forbidden("Este enlace se ha revocado");
  if (link.expiresAt && link.expiresAt < Date.now()) throw forbidden("Este enlace ha caducado");
  return link;
}

async function landing(link: ShareLink) {
  await ensureMigrated(link.projectId);
  if (link.reviewId) {
    const r = (await col.reviews().doc(link.reviewId).get()).data() as Review | undefined;
    return r ? { revisionId: r.latestRevisionId, review: { number: r.number, title: r.title } } : { revisionId: null, review: null };
  }
  const open = (await summarizeReviews(link.projectId)).filter((r) => r.status === "open");
  return { revisionId: open[0]?.latestRevisionId ?? null, review: open[0] ? { number: open[0].number, title: open[0].title } : null };
}

export const GET = handle(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const link = await resolve(token);
  const p = (await col.projects().doc(link.projectId).get()).data() as Project | undefined;
  const { review } = await landing(link);
  return ok({ projectName: p?.name, label: link.label, review });
});

export const POST = handle(async (req: Request) => {
  const b = schema.parse(await req.json());
  const link = await resolve(b.token);
  await startGuest(link, b.name || "Invitado");
  return ok({ projectId: link.projectId, revisionId: (await landing(link)).revisionId });
});

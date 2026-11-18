import { access, needScope } from "./auth";
import { notFound } from "./http";
import type { Review } from "./model";
import { ensureMigrated, getReview, getRevision } from "./revisions";

/** Versión + revisión + acceso, comprobando el alcance de los enlaces de invitado. */
export async function revAccess(req: Request, revisionId: string) {
  let rev = await getRevision(revisionId);
  if (!rev) throw notFound("Versión no encontrada");
  if (!rev.reviewId) {
    await ensureMigrated(rev.projectId);
    rev = (await getRevision(revisionId))!;
  }
  const a = await access(req, rev.projectId);
  needScope(a, rev.reviewId);
  const review = (await getReview(rev.reviewId)) as Review;
  return { rev, a, review };
}

export async function reviewAccess(req: Request, reviewId: string) {
  const review = await getReview(reviewId);
  if (!review) throw notFound("Revisión no encontrada");
  const a = await access(req, review.projectId);
  needScope(a, review.id);
  return { review, a };
}

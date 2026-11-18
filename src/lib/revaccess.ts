import { access, needScope } from "./auth";
import { notFound } from "./http";
import type { Review } from "./model";
import { ensureMigrated, getReview, getRevision } from "./revisions";

/** Version + review + access, checking the scope of guest links. */
export async function revAccess(req: Request, revisionId: string) {
  let rev = await getRevision(revisionId);
  if (!rev) throw notFound("Version not found");
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
  if (!review) throw notFound("Review not found");
  const a = await access(req, review.projectId);
  needScope(a, review.id);
  return { review, a };
}

import { currentUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { nextStep } from "@/lib/flow";
import { handle, ok, unauthorized } from "@/lib/http";
import type { Project, Review, ShareLink } from "@/lib/model";
import { ensureMigrated, isShared, summarizeReviews } from "@/lib/revisions";

// "Your turn": open reviews across all your apps where the next step is yours.
export const GET = handle(async () => {
  const user = await currentUser();
  if (!user) throw unauthorized();
  const snap = await col.projects().where("memberIds", "array-contains", user.id).get();
  const projects = snap.docs.map((d) => d.data() as Project);
  const items = [];
  for (const p of projects) {
    await ensureMigrated(p.id);
    const [reviews, links] = await Promise.all([summarizeReviews(p.id), col.links().where("projectId", "==", p.id).get()]);
    const ls = links.docs.map((d) => d.data() as ShareLink);
    for (const r of reviews) {
      if (r.status !== "open") continue;
      const isAuthor = r.author.id === user.id;
      const step = nextStep(r.stage, r.version, {
        isAuthor,
        isGuest: false,
        canVerdict: !isAuthor,
        canPublish: p.members[user.id] !== "reviewer",
        submitted: r.submittedBy.includes(user.id),
        shared: isShared(p, { id: r.id, author: r.author } as Review, ls),
      });
      if (step.mine) items.push({ project: { id: p.id, name: p.name }, review: r, step });
    }
  }
  items.sort((a, b) => b.review.updatedAt - a.review.updatedAt);
  return ok({ items });
});

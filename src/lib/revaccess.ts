import { access } from "./auth";
import { notFound } from "./http";
import { getRevision } from "./revisions";

export async function revAccess(req: Request, revisionId: string) {
  const rev = await getRevision(revisionId);
  if (!rev) throw notFound("Revisión no encontrada");
  const a = await access(req, rev.projectId);
  return { rev, a };
}

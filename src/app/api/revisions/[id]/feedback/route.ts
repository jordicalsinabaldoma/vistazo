import { need } from "@/lib/auth";
import { buildFeedback } from "@/lib/feedback";
import { handle, ok } from "@/lib/http";
import { revAccess } from "@/lib/revaccess";
import { commentsFor } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

// Prompt for the agent + summary for people + JSON. Used by the authoring team
// (web) and their agent (CLI/MCP with a key). Comments that look like orders for
// an agent are set aside; only the web can include them (?include=id1,id2),
// because a person makes that call, not the agent.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rev, a, review } = await revAccess(req, id);
  need(a, "publish");
  const url = new URL(req.url);
  const include = a.actor.kind === "user" ? (url.searchParams.get("include") ?? "").split(",").filter(Boolean) : [];
  const comments = await commentsFor(id);
  const fb = buildFeedback({ project: a.project, review, rev, comments, origin: url.origin, include });
  // The agent never gets the markdown summary: it does not isolate third-party data.
  if (a.actor.kind === "apikey") return ok({ prompt: fb.prompt, json: fb.json, flagged: fb.flagged.map(({ id, motivos }) => ({ id, motivos })) });
  return ok(fb);
});

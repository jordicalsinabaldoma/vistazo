import { access } from "@/lib/auth";
import { handle, ok } from "@/lib/http";
import { ensureMigrated, summarizeReviews } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

// The app's reviews (for the CLI/MCP and for choosing where to publish).
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await ensureMigrated(id);
  const a = await access(req, id);
  const reviews = (await summarizeReviews(id)).filter((r) => !a.scope || r.id === a.scope);
  return ok({ reviews });
});

import { buildFeedback } from "@/lib/feedback";
import { handle, ok } from "@/lib/http";
import { revAccess } from "@/lib/revaccess";
import { commentsFor } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

// Comentario-resumen + prompt recomendado + JSON estructurado (para CLI/MCP/Cursor).
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rev, a } = await revAccess(req, id);
  const comments = await commentsFor(id);
  const origin = new URL(req.url).origin;
  return ok(buildFeedback(a.project, rev, comments, origin));
});

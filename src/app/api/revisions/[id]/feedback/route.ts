import { need } from "@/lib/auth";
import { buildFeedback } from "@/lib/feedback";
import { handle, ok } from "@/lib/http";
import { revAccess } from "@/lib/revaccess";
import { commentsFor } from "@/lib/revisions";

type Ctx = { params: Promise<{ id: string }> };

// Prompt para el agente + resumen para personas + JSON. Lo usan el equipo autor
// (web) y su agente (CLI/MCP con clave). Los comentarios que parecen órdenes para
// un agente se apartan; solo la web puede incluirlos (?include=id1,id2), porque
// esa decisión la toma una persona, no el agente.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rev, a, review } = await revAccess(req, id);
  need(a, "publish");
  const url = new URL(req.url);
  const include = a.actor.kind === "user" ? (url.searchParams.get("include") ?? "").split(",").filter(Boolean) : [];
  const comments = await commentsFor(id);
  const fb = buildFeedback({ project: a.project, review, rev, comments, origin: url.origin, include });
  // El agente no recibe el resumen markdown: no aísla los datos de terceros.
  if (a.actor.kind === "apikey") return ok({ prompt: fb.prompt, json: fb.json, flagged: fb.flagged.map(({ id, motivos }) => ({ id, motivos })) });
  return ok(fb);
});

import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { access, need } from "@/lib/auth";
import { handle, ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// Subida directa al almacén (sin pasar por la función: evita el límite de 4,5 MB
// del cuerpo en Vercel). El servidor firma un token de un solo fichero, privado,
// dentro de p/<proyecto>/, con tipo y tamaño acotados.
const ALLOWED = ["image/*", "video/*", "application/pdf", "application/zip", "text/html", "text/plain", "application/json"];

const schema = z.object({
  filename: z.string().min(1).max(160),
  contentType: z.string().min(3).max(100),
  size: z.number().int().positive().max(200 * 1024 * 1024),
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await access(req, id);
  need(a, "publish");
  const b = schema.parse(await req.json());
  const safe = b.filename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
  const pathname = `p/${id}/${nanoid(16)}/${safe}`;
  const clientToken = await generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: ALLOWED,
    maximumSizeInBytes: 200 * 1024 * 1024,
    validUntil: Date.now() + 30 * 60 * 1000,
  });
  return ok({ pathname, clientToken });
});

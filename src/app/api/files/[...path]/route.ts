import { get } from "@vercel/blob";
import { access } from "@/lib/auth";
import { handle, notFound } from "@/lib/http";

type Ctx = { params: Promise<{ path: string[] }> };

// Los adjuntos son blobs PRIVADOS. Se sirven siempre por aquí, comprobando el
// acceso al proyecto en cada petición: revocar un enlace de invitado corta
// también el acceso a capturas y vídeos.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { path } = await params;
  const pathname = path.map(decodeURIComponent).join("/");
  const m = /^p\/([^/]+)\//.exec(pathname);
  if (!m) throw notFound();
  await access(req, m[1]);
  const res = await get(pathname, { access: "private" });
  if (!res) throw notFound();
  const h = new Headers();
  h.set("Content-Type", res.blob.contentType || "application/octet-stream");
  if (res.blob.size != null) h.set("Content-Length", String(res.blob.size));
  h.set("Cache-Control", "private, max-age=600");
  h.set("X-Content-Type-Options", "nosniff");
  // Artifacts HTML se descargan, no se renderizan en nuestro origen.
  if (/html|javascript|svg/.test(res.blob.contentType ?? "")) h.set("Content-Disposition", "attachment");
  return new Response(res.stream, { headers: h });
});

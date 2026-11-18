import { get } from "@vercel/blob";
import { access } from "@/lib/auth";
import { handle, notFound } from "@/lib/http";

type Ctx = { params: Promise<{ path: string[] }> };

// Attachments are PRIVATE blobs. They are always served through here, checking
// project access on every request: revoking a guest link also cuts access to
// screenshots and videos.
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
  // HTML artifacts are downloaded, never rendered on our origin.
  if (/html|javascript|svg/.test(res.blob.contentType ?? "")) h.set("Content-Disposition", "attachment");
  return new Response(res.stream, { headers: h });
});

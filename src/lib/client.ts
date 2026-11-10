"use client";
import { put } from "@vercel/blob/client";

export async function api<T = any>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const fileUrl = (pathname: string) => `/api/files/${pathname.split("/").map(encodeURIComponent).join("/")}`;

export function kindOf(type: string): "image" | "video" | "artifact" {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return "artifact";
}

/** Sube un fichero directamente al almacén privado con un token de un solo uso. */
export async function uploadFile(projectId: string, file: File) {
  const contentType = file.type || "application/octet-stream";
  const { pathname, clientToken } = await api<{ pathname: string; clientToken: string }>(
    `/api/projects/${projectId}/uploads`,
    { method: "POST", json: { filename: file.name, contentType, size: file.size } },
  );
  await put(pathname, file, { access: "private", token: clientToken, contentType, multipart: file.size > 8e6 });
  let width: number | undefined, height: number | undefined;
  if (contentType.startsWith("image/")) {
    try {
      const bmp = await createImageBitmap(file);
      width = bmp.width;
      height = bmp.height;
    } catch {}
  }
  return {
    pathname,
    kind: kindOf(contentType),
    name: file.name,
    contentType,
    size: file.size,
    width,
    height,
    origin: "manual" as const,
  };
}

export const fmtDate = (t: number) =>
  new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "x";

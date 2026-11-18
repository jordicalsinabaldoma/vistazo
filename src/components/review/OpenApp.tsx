"use client";
import { ArrowSquareOut, Browser, DownloadSimple, DeviceMobile, QrCode } from "@phosphor-icons/react";
import { useState } from "react";
import { CopyButton, QrImage } from "@/components/ui";
import type { PreviewLink, Revision } from "@/lib/model";
import { QrDialog, type QrTarget } from "./Kit";

type Way = PreviewLink & { primary?: boolean };

/** Los enlaces vienen de quien publica: se permite exp+…://, https://… pero nunca javascript: ni data:. */
export function safeHref(url: string) {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim())?.[1]?.toLowerCase();
  return scheme && !["javascript", "data", "vbscript", "file", "blob"].includes(scheme) ? url : undefined;
}

/** Todas las formas de abrir esta versión: web, QR de Expo o deep link, descarga… */
export function waysToOpen(r: Pick<Revision, "liveUrl" | "previews">): Way[] {
  const out: Way[] = [];
  if (r.liveUrl) out.push({ kind: "web", label: "Web de esta versión", url: r.liveUrl, primary: true });
  for (const p of r.previews ?? []) out.push(p);
  return out;
}

const ICON = { web: Browser, qr: QrCode, deeplink: DeviceMobile, download: DownloadSimple } as const;
const KIND = { web: "Web", qr: "En el móvil", deeplink: "Deep link", download: "Descarga" } as const;

/**
 * Cómo abrir la app para probarla. En grande (pestaña «En el móvil»): cada forma con su
 * QR a la vista, para escanear con el móvil desde la pantalla. En pequeño (barra
 * lateral): una línea por forma y el QR al tocarla.
 */
export default function OpenApp({ revision, size = "full" }: { revision: Pick<Revision, "liveUrl" | "previews">; size?: "full" | "compact" }) {
  const ways = waysToOpen(revision);
  const [qr, setQr] = useState<QrTarget | null>(null);
  if (!ways.length) return <p className="text-sm text-muted">Esta versión no trae forma de abrirla: solo capturas.</p>;

  if (size === "compact")
    return (
      <>
        <ul className="grid gap-1">
          {ways.map((w, i) => {
            const I = ICON[w.kind];
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                <I size={16} className="shrink-0 text-muted" aria-hidden />
                <a href={safeHref(w.url)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline" title={w.url}>
                  {w.label || KIND[w.kind]}
                </a>
                <button
                  className="btn btn-quiet btn-sm px-1.5"
                  aria-label={`QR de ${w.label || KIND[w.kind]}`}
                  title="Ver QR"
                  onClick={() => setQr({ title: w.label || KIND[w.kind], code: w.url, note: w.instructions, href: safeHref(w.url) })}
                >
                  <QrCode size={16} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        <QrDialog target={qr} onClose={() => setQr(null)} />
      </>
    );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ways.map((w, i) => {
        const I = ICON[w.kind];
        return (
          <article key={i} className="box flex flex-col">
            <header className="box-head">
              <I size={16} aria-hidden />
              <span className="font-semibold">{w.label || KIND[w.kind]}</span>
              <span className="ml-auto text-xs text-muted">{KIND[w.kind]}</span>
            </header>
            <div className="flex flex-1 flex-col items-center gap-3 p-5 text-center">
              <QrImage value={w.url} size={200} label={`Código QR para abrir ${w.label || "la app"}`} />
              <p className="text-sm text-muted">
                {w.kind === "web"
                  ? "Escanéalo para abrirla en el móvil, o ábrela aquí."
                  : w.kind === "download"
                    ? "Escanéalo con el móvil para descargarla e instalarla."
                    : "Escanéalo con la cámara del móvil (o desde la app de desarrollo)."}
              </p>
              {w.instructions && <p className="max-w-[44ch] whitespace-pre-wrap text-left text-sm">{w.instructions}</p>}
              <p className="max-w-full break-all font-mono text-xs text-muted">{w.url}</p>
              <div className="mt-auto flex flex-wrap justify-center gap-2">
                <CopyButton text={w.url} label="Copiar enlace" />
                {safeHref(w.url) && (
                  <a className="btn btn-sm" href={safeHref(w.url)} target="_blank" rel="noopener noreferrer">
                    <ArrowSquareOut size={15} aria-hidden /> Abrir
                  </a>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

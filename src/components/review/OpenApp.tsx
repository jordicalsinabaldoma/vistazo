"use client";
import { ArrowSquareOut, Browser, DownloadSimple, DeviceMobile, QrCode } from "@phosphor-icons/react";
import { useState } from "react";
import { CopyButton, QrImage } from "@/components/ui";
import type { PreviewLink, Revision } from "@/lib/model";
import { QrDialog, type QrTarget } from "./Kit";

type Way = PreviewLink & { primary?: boolean };

/** Links come from whoever publishes: exp+…:// and https://… are fine, javascript: and data: never. */
export function safeHref(url: string) {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim())?.[1]?.toLowerCase();
  return scheme && !["javascript", "data", "vbscript", "file", "blob"].includes(scheme) ? url : undefined;
}

/** Every way to open this version: web, Expo QR or deep link, download… */
export function waysToOpen(r: Pick<Revision, "liveUrl" | "previews">): Way[] {
  const out: Way[] = [];
  if (r.liveUrl) out.push({ kind: "web", label: "Web for this version", url: r.liveUrl, primary: true });
  for (const p of r.previews ?? []) out.push(p);
  return out;
}

const ICON = { web: Browser, qr: QrCode, deeplink: DeviceMobile, download: DownloadSimple } as const;
const KIND = { web: "Web", qr: "On mobile", deeplink: "Deep link", download: "Download" } as const;

/**
 * How to open the app to test it. Full size ("On mobile" tab): each way with its QR in
 * view, to scan from the screen with a phone. Compact (sidebar): one line per way and
 * the QR on tap.
 */
export default function OpenApp({ revision, size = "full" }: { revision: Pick<Revision, "liveUrl" | "previews">; size?: "full" | "compact" }) {
  const ways = waysToOpen(revision);
  const [qr, setQr] = useState<QrTarget | null>(null);
  if (!ways.length) return <p className="text-sm text-muted">This version has no way to open it: screenshots only.</p>;

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
                  aria-label={`QR for ${w.label || KIND[w.kind]}`}
                  title="Show QR"
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
              <QrImage value={w.url} size={200} label={`QR code to open ${w.label || "the app"}`} />
              <p className="text-sm text-muted">
                {w.kind === "web"
                  ? "Scan it to open it on your phone, or open it here."
                  : w.kind === "download"
                    ? "Scan it with your phone to download and install it."
                    : "Scan it with your phone camera (or from the development app)."}
              </p>
              {w.instructions && <p className="max-w-[44ch] whitespace-pre-wrap text-left text-sm">{w.instructions}</p>}
              <p className="max-w-full break-all font-mono text-xs text-muted">{w.url}</p>
              <div className="mt-auto flex flex-wrap justify-center gap-2">
                <CopyButton text={w.url} label="Copy link" />
                {safeHref(w.url) && (
                  <a className="btn btn-sm" href={safeHref(w.url)} target="_blank" rel="noopener noreferrer">
                    <ArrowSquareOut size={15} aria-hidden /> Open
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

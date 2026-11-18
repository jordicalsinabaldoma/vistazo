"use client";
import { useRef, useState } from "react";
import { fileUrl } from "@/lib/client";
import type { Asset } from "@/lib/model";
import Composer from "./Composer";
import type { Ctx } from "./types";

/** Captura o vídeo con comentarios anclados (pines numerados). */
export default function AssetViewer({
  ctx,
  asset,
  flowKey,
  stepKey,
  stepTitle,
}: {
  ctx: Ctx;
  asset: Asset;
  flowKey: string;
  stepKey: string;
  stepTitle?: string;
}) {
  const [draft, setDraft] = useState<{ x: number; y: number; t?: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const pins = ctx.data.comments.filter((c) => c.anchor.type === "asset" && c.anchor.assetId === asset.id);
  const canComment = ctx.data.me.can.comment;

  // Teclado: Intro o espacio colocan el comentario en el centro de la captura.
  const placeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canComment || draft || e.target !== e.currentTarget) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    video.current?.pause();
    setDraft({ x: 0.5, y: 0.4, t: video.current ? video.current.currentTime : undefined });
  };
  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canComment || draft) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = video.current ? video.current.currentTime : undefined;
    video.current?.pause();
    setDraft({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, t });
  };

  if (asset.kind === "artifact")
    return (
      <a href={fileUrl(asset.pathname)} className="card flex items-center gap-3 p-4 text-sm hover:border-field" download>
        <span className="chip bg-neutral text-ink">archivo</span>
        <span className="truncate">{asset.name}</span>
        <span className="ml-auto text-muted">Descargar</span>
      </a>
    );

  return (
    <figure className="w-full">
      <div className="relative">
        {asset.kind === "video" ? (
          <video ref={video} src={fileUrl(asset.pathname)} controls preload="metadata" className="w-full rounded-xl border border-line bg-black" aria-label={`Vídeo: ${stepTitle ?? asset.name}`} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl(asset.pathname)}
            alt={asset.caption || `Captura del paso «${stepTitle ?? asset.name}» en la v${ctx.data.revision.number}`}
            width={asset.width}
            height={asset.height}
            className="h-auto w-full rounded-xl border border-line bg-white"
          />
        )}
        {/* Capa de comentarios. En vídeo deja libre la barra de controles. */}
        <div
          data-testid={`asset-${asset.id}`}
          className={`absolute inset-0 rounded-xl ${asset.kind === "video" ? "bottom-12" : ""} ${canComment ? "cursor-crosshair" : ""}`}
          onClick={place}
          onKeyDown={placeKey}
          tabIndex={canComment ? 0 : -1}
          role={canComment ? "button" : undefined}
          aria-label={canComment ? "Comentar en esta captura. Con el ratón, toca el punto; con el teclado, pulsa Intro." : undefined}
        >
          {pins.map((c) => {
            const a = c.anchor as Extract<typeof c.anchor, { type: "asset" }>;
            return (
              <button
                key={c.id}
                title={c.body}
                aria-label={`Comentario ${ctx.numberOf(c)}: ${c.body.slice(0, 80)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.setFocus(c.id);
                  if (video.current && a.t != null) video.current.currentTime = a.t;
                }}
                className={`pin ${c.status === "resolved" ? "pin-resolved" : ""} ${ctx.focus === c.id ? "ring-4 ring-accent/30" : ""}`}
                style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
              >
                {ctx.numberOf(c)}
              </button>
            );
          })}
          {draft && (
            <Composer
              x={draft.x}
              y={draft.y}
              hint={draft.t != null ? `En el segundo ${draft.t.toFixed(1)}` : undefined}
              onCancel={() => setDraft(null)}
              onSave={async (body) => {
                await ctx.addComment({ type: "asset", flowKey, stepKey, assetId: asset.id, ...draft }, body);
                setDraft(null);
              }}
            />
          )}
        </div>
      </div>
      <figcaption className="mt-1.5 flex justify-between gap-3 text-xs text-muted">
        <span className="truncate">{asset.caption || asset.name}</span>
        <span className="shrink-0">{asset.origin === "playwright" ? "Captura automática" : asset.origin === "manual" ? "Subida a mano" : "Captura externa"}</span>
      </figcaption>
    </figure>
  );
}

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
}: {
  ctx: Ctx;
  asset: Asset;
  flowKey: string;
  stepKey: string;
}) {
  const [draft, setDraft] = useState<{ x: number; y: number; t?: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const pins = ctx.data.comments.filter((c) => c.anchor.type === "asset" && c.anchor.assetId === asset.id);
  const canComment = ctx.data.me.can.comment;

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canComment || draft) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = video.current ? video.current.currentTime : undefined;
    video.current?.pause();
    setDraft({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, t });
  };

  if (asset.kind === "artifact")
    return (
      <a href={fileUrl(asset.pathname)} className="card flex items-center gap-3 p-4 text-sm hover:border-ink/40" download>
        <span className="chip bg-paper">artifact</span>
        <span className="truncate">{asset.name}</span>
        <span className="ml-auto text-muted">Descargar</span>
      </a>
    );

  return (
    <figure className="w-full">
      <div className="relative">
        {asset.kind === "video" ? (
          <video ref={video} src={fileUrl(asset.pathname)} controls className="w-full rounded-lg border border-line bg-ink" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(asset.pathname)} alt={asset.caption || asset.name} className="w-full rounded-lg border border-line" />
        )}
        {/* Capa de comentarios. En vídeo deja libre la barra de controles. */}
        <div
          data-testid={`asset-${asset.id}`}
          className={`absolute inset-0 ${asset.kind === "video" ? "bottom-12" : ""} ${canComment ? "cursor-crosshair" : ""}`}
          onClick={place}
        >
          {pins.map((c) => {
            const a = c.anchor as Extract<typeof c.anchor, { type: "asset" }>;
            return (
              <button
                key={c.id}
                title={c.body}
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
      <figcaption className="mt-1 flex justify-between text-[11px] text-muted">
        <span className="truncate">{asset.caption || asset.name}</span>
        <span>{asset.origin === "playwright" ? "captura automática" : asset.origin === "manual" ? "subida a mano" : "externa"}</span>
      </figcaption>
    </figure>
  );
}

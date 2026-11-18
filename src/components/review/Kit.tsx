"use client";
import {
  Barcode,
  CaretLeft,
  CaretRight,
  CreditCard,
  Cube,
  DeviceMobile,
  Envelope,
  File,
  GridFour,
  Handbag,
  Key,
  LinkSimple,
  MapPin,
  Package,
  QrCode,
  ShoppingCart,
  Stack,
  Storefront,
  Tag,
  TextAa,
  Ticket,
  Truck,
  Warehouse,
  User,
  Warning,
} from "@phosphor-icons/react";
import { useState } from "react";
import { CopyButton, QrImage, Sheet } from "@/components/ui";
import { kindOf, kindsFor, type KindDef, type KindIcon as KI, type KitLabel, type KitProduct, type TestKit } from "@/lib/kit";

const ICONS: Record<KI, typeof Tag> = {
  tag: Tag,
  qr: QrCode,
  barcode: Barcode,
  user: User,
  key: Key,
  link: LinkSimple,
  pin: MapPin,
  box: Cube,
  package: Package,
  stack: Stack,
  cart: ShoppingCart,
  bag: Handbag,
  warehouse: Warehouse,
  truck: Truck,
  grid: GridFour,
  card: CreditCard,
  mail: Envelope,
  phone: DeviceMobile,
  ticket: Ticket,
  text: TextAa,
  store: Storefront,
  file: File,
};

export function KindIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  const I = ICONS[icon as KI] ?? Tag;
  return <I size={size} aria-hidden />;
}

export type QrTarget = { title: string; detail?: string; code: string; secret?: boolean; kind?: KindDef; note?: string; href?: string };

/** One big QR at a time, so the scanner never reads the one next to it. */
export function QrDialog({ target, onClose }: { target: QrTarget | null; onClose: () => void }) {
  return (
    <Sheet open={!!target} onClose={onClose} title={target?.title ?? ""} description={target?.detail}>
      {target && (
        <div className="grid justify-items-center gap-4 pb-2 text-center">
          <QrImage value={target.code} size={260} label={`QR code for ${target.title}`} />
          <p className="max-w-full break-all font-mono text-[15px]">{target.secret ? "••••••••" : target.code}</p>
          {target.note && <p className="max-w-[48ch] whitespace-pre-wrap text-sm text-muted">{target.note}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <CopyButton text={target.code} className="btn" label="Copy" />
            {target.href && (
              <a className="btn btn-primary" href={target.href} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/**
 * Test kit: one page per group (with a picker), rows with their title and labels.
 * Only the name and code are shown; QR codes open one at a time.
 */
export function KitView({ kit, kinds, compact }: { kit: TestKit; kinds?: KindDef[]; compact?: boolean }) {
  const map = kindsFor(kinds);
  const [pi, setPi] = useState(0);
  const [qr, setQr] = useState<QrTarget | null>(null);
  const pages = kit.pages;
  const page = pages[Math.min(pi, pages.length - 1)];

  const openLabel = (l: KitLabel) => {
    const k = kindOf(map, l.kind);
    setQr({ title: l.name || k.name, detail: l.detail, code: l.code, secret: l.secret, kind: k });
  };
  const openProduct = (p: KitProduct) => p.code && setQr({ title: p.name, detail: p.quantity != null ? `×${p.quantity}` : undefined, code: p.code });

  return (
    <div className="grid gap-4">
      {kit.intro && <p className="text-sm text-muted">{kit.intro}</p>}
      {pages.length > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Kit pages">
          <button className="btn btn-sm px-2" disabled={pi === 0} onClick={() => setPi(pi - 1)} aria-label="Previous">
            <CaretLeft size={14} aria-hidden />
          </button>
          <select className="input min-h-8 flex-1 py-1" value={pi} onChange={(e) => setPi(Number(e.target.value))} aria-label="Page">
            {pages.map((p, i) => (
              <option key={i} value={i}>
                {p.title}
                {p.subtitle ? ` · ${p.subtitle}` : ""}
              </option>
            ))}
          </select>
          <button className="btn btn-sm px-2" disabled={pi >= pages.length - 1} onClick={() => setPi(pi + 1)} aria-label="Next">
            <CaretRight size={14} aria-hidden />
          </button>
        </nav>
      )}
      {page && (
        <section className="grid gap-4">
          {(pages.length === 1 || page.meta?.length) && (
            <header>
              {pages.length === 1 && (
                <h3 className="font-semibold">
                  {page.title} {page.subtitle && <span className="font-normal text-muted">{page.subtitle}</span>}
                </h3>
              )}
              {!!page.meta?.length && (
                <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  {page.meta.map((m, i) => (
                    <div key={i} className="min-w-0">
                      <dt className="text-muted">{m.label}</dt>
                      <dd className="break-all font-mono">{m.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </header>
          )}
          {page.notice && (
            <p className="flex items-start gap-2 rounded-lg bg-badbg px-3 py-2 text-sm text-bad">
              <Warning size={16} className="mt-0.5 shrink-0" aria-hidden />
              {page.notice}
            </p>
          )}
          {page.rows.map((r, i) => (
            <div key={i} className={`grid gap-2 ${compact ? "" : "md:grid-cols-[200px_minmax(0,1fr)] md:gap-4"}`}>
              <div className="min-w-0">
                {r.lead ? (
                  <LabelChip l={r.lead} map={map} onOpen={openLabel} onProduct={openProduct} lead />
                ) : (
                  <>
                    {r.title && (
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {r.icon && (
                          <span className="kind" style={{ ["--k" as string]: `var(--k-${kindOf(map, r.icon).color})` }}>
                            <KindIcon icon={kindOf(map, r.icon).icon} />
                          </span>
                        )}
                        {r.title}
                      </p>
                    )}
                    {r.note && <p className="text-xs text-muted">{r.note}</p>}
                  </>
                )}
              </div>
              {r.labels.length > 0 && (
                <ul className={`grid min-w-0 gap-2 ${compact ? "" : "sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"}`}>
                  {r.labels.map((l, j) => (
                    <li key={j} className="min-w-0">
                      <LabelChip l={l} map={map} onOpen={openLabel} onProduct={openProduct} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
      {kit.url && (
        <a className="text-sm font-medium text-accent-ink hover:underline" href={kit.url} target="_blank" rel="noopener noreferrer">
          Open the full kit in a new tab
        </a>
      )}
      <QrDialog target={qr} onClose={() => setQr(null)} />
    </div>
  );
}

function LabelChip({
  l,
  map,
  onOpen,
  onProduct,
  lead,
}: {
  l: KitLabel;
  map: Map<string, KindDef>;
  onOpen: (l: KitLabel) => void;
  onProduct: (p: KitProduct) => void;
  lead?: boolean;
}) {
  const k = kindOf(map, l.kind);
  return (
    <div
      className={`kind rounded-lg border bg-card ${k.dashed ? "border-dashed" : ""} ${lead ? "border-2" : ""}`}
      style={{ ["--k" as string]: `var(--k-${k.color})`, borderColor: lead || l.kind !== "other" ? "color-mix(in srgb, var(--k) 55%, var(--line))" : undefined }}
    >
      <button
        className="flex w-full min-w-0 items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-sunken/60"
        onClick={() => onOpen(l)}
        aria-label={`Show QR for ${l.name || k.name} ${l.secret ? "" : l.code}`}
      >
        <span className="mt-0.5 shrink-0">
          <KindIcon icon={k.icon} size={lead ? 22 : 18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink">
            {l.name || k.name}
            {l.detail && <span className="font-normal text-muted"> · {l.detail}</span>}
          </span>
          <span className="block truncate font-mono text-[13px] text-ink">{l.secret ? "••••••••" : l.code}</span>
        </span>
        <QrCode size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
      </button>
      {!!l.products?.length && (
        <ul className="border-t border-line px-2 py-1.5 text-[13px]">
          {l.products.map((p, i) => (
            <li key={i}>
              <button
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left text-ink hover:bg-sunken/70 disabled:cursor-default"
                onClick={() => onProduct(p)}
                disabled={!p.code}
              >
                <span className={`min-w-0 flex-1 truncate ${p.status ? "text-bad" : ""}`}>
                  {p.name}
                  {p.status && <span className="ml-1 text-xs">({p.status === "unexpected" ? "not expected" : "does not exist"})</span>}
                </span>
                {p.quantity != null && <span className="text-muted tabular">×{p.quantity}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

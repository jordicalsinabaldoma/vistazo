"use client";
import { Check, CheckCircle, Circle, Copy, DotsThree, GitPullRequest, X, XCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { CIRCUIT, circuitStep, stageTone, type Stage } from "@/lib/flow";

const TONE = {
  neutral: "bg-neutral text-ink",
  attention: "bg-warnbg text-warn",
  done: "bg-okbg text-ok",
  muted: "bg-neutral text-muted",
} as const;

const ICON = {
  neutral: Circle,
  attention: XCircle,
  done: CheckCircle,
  muted: Circle,
} as const;

/** State label of a review. Always the same: same colour, same text. */
export function StateLabel({ stage, label, size = "md" }: { stage: Stage; label: string; size?: "md" | "lg" }) {
  const tone = stageTone[stage];
  const I = ICON[tone];
  return (
    <span
      data-testid="state"
      data-stage={stage}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${TONE[tone]} ${size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
    >
      <I size={size === "lg" ? 16 : 14} weight={tone === "done" ? "fill" : "regular"} aria-hidden />
      {label}
    </span>
  );
}

/** Circuit strip: Publish → Review → Fix → Approve, with the current step marked. */
export function Circuit({ stage, version }: { stage: Stage; version: number }) {
  const cur = circuitStep(stage);
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:gap-x-1" aria-label="Review circuit">
      {CIRCUIT.map((s, i) => {
        const done = i < cur || stage === "closed";
        const now = i === cur && stage !== "closed";
        return (
          <li key={s} className="flex items-center gap-1" aria-current={now ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={`mx-1 hidden h-px w-5 sm:block sm:w-8 ${done || now ? "bg-ink/40" : "bg-line"}`} />}
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                done ? "border-ink bg-ink text-paper" : now ? "border-accent bg-accent text-on-accent" : "border-field/60 text-muted"
              }`}
            >
              {done ? <Check size={13} weight="bold" aria-hidden /> : i + 1}
            </span>
            <span className={now ? "font-semibold text-ink" : done ? "text-ink" : "text-muted"}>
              {s}
              {i === 2 && version > 1 && <span className="text-muted"> (v{version})</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Native dialog: Esc closes it, focus stays inside and the background is inert. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      style={wide ? { width: "min(100% - 2rem, 60rem)" } : undefined}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="sheet-title"
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-start gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id="sheet-title" className="text-lg font-semibold">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
            <button className="btn btn-quiet -mr-2 -mt-1 px-2" onClick={onClose} aria-label="Close">
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function CopyButton({ text, label = "Copy", className = "btn btn-sm" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}

export function PrLink({ url }: { url: string }) {
  let label = "PR";
  const m = /\/pull\/(\d+)|\/merge_requests\/(\d+)/.exec(url);
  if (m) label = `PR #${m[1] ?? m[2]}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
      <GitPullRequest size={15} aria-hidden />
      {label}
    </a>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-badbg px-3 py-2 text-sm text-bad">
      {children}
    </p>
  );
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const AVATAR = ["#c2410c", "#2f6b55", "#5b4fc4", "#1f5f99", "#8a5a00", "#9d174d", "#0f766e", "#4d5563"];

/** Avatar with initials. The colour comes from the name, so it is always the same for the same person. */
export function Avatar({ name, kind, size = 24 }: { name: string; kind?: string; size?: number }) {
  const ini =
    kind === "agent"
      ? "IA"
      : name
          .replace(/\(.*?\)/g, "")
          .trim()
          .split(/\s+/)
          .slice(0, size < 22 ? 1 : 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("") || "?";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = kind === "agent" ? "var(--ink)" : AVATAR[h % AVATAR.length];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.4),
        background: bg,
        color: kind === "agent" ? "var(--paper)" : "#fff",
        ...(kind === "guest" ? { outline: "1.5px dashed var(--field)", outlineOffset: 1 } : {}),
      }}
    >
      {ini}
    </span>
  );
}

/** "3 h ago", "yesterday", "10 Nov". The exact date goes in the title. */
export function Ago({ t }: { t: number }) {
  const [now] = useState(() => Date.now());
  const s = Math.max(0, (now - t) / 1000);
  const txt =
    s < 60
      ? "now"
      : s < 3600
        ? `${Math.floor(s / 60)} min ago`
        : s < 86400
          ? `${Math.floor(s / 3600)} h ago`
          : s < 172800
            ? "yesterday"
            : s < 604800
              ? `${Math.floor(s / 86400)} days ago`
              : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <time dateTime={new Date(t).toISOString()} title={new Date(t).toLocaleString("en-GB")} suppressHydrationWarning>
      {txt}
    </time>
  );
}

export type MenuItem = { label: string; on: () => void; icon?: React.ReactNode; danger?: boolean } | null | false;

/** "More" menu: Esc or a click outside closes it. */
export function MoreMenu({ items, label = "More actions", align = "right" }: { items: MenuItem[]; label?: string; align?: "left" | "right" }) {
  const list = items.filter(Boolean) as Exclude<MenuItem, null | false>[];
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  return (
    <div className="relative">
      <button className="btn px-2" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label={label} title={label}>
        <DotsThree size={20} weight="bold" aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="menu"
            className={`absolute top-full z-40 mt-1 grid min-w-60 rounded-xl border border-line bg-card p-1 shadow-[0_12px_32px_rgb(var(--shadow)/0.18)] ${align === "right" ? "right-0" : "left-0"}`}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          >
            {list.map((a) => (
              <li key={a.label} role="none">
                <button
                  role="menuitem"
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken ${a.danger ? "text-bad" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    a.on();
                  }}
                >
                  {a.icon}
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** QR code generated in the browser (nothing is sent to external services). */
export function QrImage({ value, size = 192, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode").then((Q) => Q.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M" }).then((u) => alive && setSrc(u)));
    return () => {
      alive = false;
    };
  }, [value, size]);
  return (
    <span className="inline-flex rounded-lg bg-white p-2" style={{ width: size + 16, height: size + 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={label} width={size} height={size} /> : <span className="h-full w-full animate-pulse rounded bg-neutral" />}
    </span>
  );
}

/** The circuit, vertical, for the sidebar. */
export function CircuitList({ stage, version }: { stage: Stage; version: number }) {
  const cur = circuitStep(stage);
  return (
    <ol className="grid gap-0" aria-label="Review circuit">
      {CIRCUIT.map((s, i) => {
        const done = i < cur || stage === "closed";
        const now = i === cur && stage !== "closed";
        return (
          <li key={s} className="relative flex items-center gap-2.5 py-1 text-sm" aria-current={now ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={`absolute left-[11px] -top-2 h-3 w-px ${done || now ? "bg-ink/40" : "bg-line"}`} />}
            <span
              className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                done ? "border-ink bg-ink text-paper" : now ? "border-accent bg-accent text-on-accent" : "border-field/60 bg-card text-muted"
              }`}
            >
              {done ? <Check size={13} weight="bold" aria-hidden /> : i + 1}
            </span>
            <span className={now ? "font-semibold text-ink" : done ? "text-ink" : "text-muted"}>
              {s}
              {i === 2 && version > 1 && <span className="font-normal text-muted"> · v{version}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** App mark: initial on a stable colour. */
export function AppMark({ name, size = 36 }: { name: string; size?: number }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hues = ["#c2410c", "#2f6b55", "#5b4fc4", "#1f5f99", "#8a5a00", "#9d174d"];
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-white" style={{ width: size, height: size, background: hues[h % hues.length], fontSize: size * 0.45 }}>
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}


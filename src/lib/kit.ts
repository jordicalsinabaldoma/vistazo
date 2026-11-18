// Test kit: what a reviewer needs at hand to test (users, codes to scan, products,
// links…). Compatible as-is with the "QR label page" format (title / intro / pages[] /
// rows[] / labels[] / products[]): JSON generated for those pages can be published
// untouched.
//
// Display rules (learned testing with scanners): only the name and the code are shown;
// the QR appears one at a time when a label is opened, so the scanner never reads the
// neighbouring code.
import { z } from "zod";

/** Colours available for a label kind (tokens in globals.css: --k-<color>). */
export const KIND_COLORS = ["orange", "green", "violet", "blue", "ink", "ochre", "grey", "red"] as const;
export type KindColor = (typeof KIND_COLORS)[number];

/** Available icons (our own names, mapped to Phosphor in the UI). */
export const KIND_ICONS = [
  "tag", "qr", "barcode", "user", "key", "link", "pin", "box", "package", "stack", "cart", "bag",
  "warehouse", "truck", "grid", "card", "mail", "phone", "ticket", "text", "store", "file",
] as const;
export type KindIcon = (typeof KIND_ICONS)[number];

export interface KindDef {
  key: string;
  name: string;
  color: KindColor;
  icon: KindIcon;
  dashed?: boolean;
}

/** Generic default kinds. Each app can add or redefine its own. */
export const DEFAULT_KINDS: KindDef[] = [
  { key: "user", name: "User", color: "blue", icon: "user" },
  { key: "password", name: "Password", color: "ink", icon: "key" },
  { key: "code", name: "Code", color: "ink", icon: "qr" },
  { key: "product", name: "Product", color: "violet", icon: "barcode" },
  { key: "card", name: "Test card", color: "green", icon: "card" },
  { key: "link", name: "Link", color: "blue", icon: "link" },
  { key: "location", name: "Location", color: "ink", icon: "pin" },
  { key: "text", name: "Data", color: "grey", icon: "text" },
  { key: "other", name: "Label", color: "grey", icon: "tag" },
];

const str = (max: number) => z.string().trim().max(max);

export const kindSchema = z.object({
  key: z.string().trim().min(1).max(40).regex(/^[a-z0-9][a-z0-9_-]*$/i, "key: letters, numbers, - and _"),
  name: str(60).min(1),
  color: z.enum(KIND_COLORS).default("grey"),
  icon: z.enum(KIND_ICONS).default("tag"),
  dashed: z.boolean().optional(),
});
export const kindsSchema = z.array(kindSchema).max(40);

const product = z
  .object({
    name: str(200).min(1),
    quantity: z.number().int().nonnegative().max(1_000_000).optional(),
    code: str(400).optional(),
    ean: str(400).optional(),
    status: z.enum(["unexpected", "unknown"]).optional(),
  })
  .transform(({ ean, code, ...p }) => ({ ...p, code: code || ean || "" }));

const label = z.object({
  kind: z.string().trim().min(1).max(40).default("other"),
  code: str(400).min(1),
  name: str(120).optional(),
  detail: str(300).optional(),
  // Do not show the code in clear (passwords): it can still be copied.
  secret: z.boolean().optional(),
  products: z.array(product).max(200).optional(),
});

const row = z.object({
  title: str(200).optional(),
  note: str(1000).optional(),
  icon: z.string().trim().max(40).optional(),
  lead: label.optional(),
  labels: z.array(label).max(400).default([]),
});

const page = z.object({
  title: str(200).min(1),
  subtitle: str(200).optional(),
  meta: z.array(z.object({ label: str(80), value: str(400) })).max(20).optional(),
  notice: str(1000).optional(),
  rows: z.array(row).max(200).default([]),
});

export const kitSchema = z.object({
  title: str(200).optional(),
  intro: str(2000).optional(),
  pages: z.array(page).max(100).default([]),
  // External page with the kit (for example a label page already published).
  url: z
    .string()
    .max(2000)
    .url()
    .refine((u) => u.startsWith("https://"), "Must be an https:// link")
    .optional(),
});

export type TestKit = z.infer<typeof kitSchema>;
export type KitPage = TestKit["pages"][number];
export type KitRow = KitPage["rows"][number];
export type KitLabel = KitRow["labels"][number];
export type KitProduct = NonNullable<KitLabel["products"]>[number];

/** How many labels a kit has (for counters). */
export function kitSize(k?: TestKit | null) {
  if (!k) return 0;
  let n = 0;
  for (const p of k.pages) for (const r of p.rows) n += r.labels.length + (r.lead ? 1 : 0);
  return n;
}

/** Effective kinds for an app: the defaults, with its own on top. */
export function kindsFor(custom?: KindDef[]) {
  const map = new Map(DEFAULT_KINDS.map((k) => [k.key, k]));
  for (const k of custom ?? []) map.set(k.key, k);
  return map;
}

export function kindOf(map: Map<string, KindDef>, key: string): KindDef {
  return map.get(key) ?? { key, name: key.charAt(0).toUpperCase() + key.slice(1), color: "grey", icon: "tag" };
}

/**
 * If an HTML label page arrives instead of the JSON, extract its data from the
 * <script type="application/json" id="page-data"> block. Used by the CLI.
 */
export function kitFromHtml(html: string): unknown {
  const m = /<script[^>]*id=["']page-data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) throw new Error("Could not find the page-data block in the HTML");
  return JSON.parse(m[1]);
}

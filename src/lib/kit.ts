// Kit de prueba: lo que quien revisa necesita a mano para probar (usuarios, códigos que
// escanear, productos, enlaces…). Compatible tal cual con el formato «página de
// etiquetas QR» (title / intro / pages[] / rows[] / labels[] / products[]): un JSON
// generado para esas páginas se puede publicar sin tocarlo.
//
// Reglas de presentación (vienen de probar con escáneres): en pantalla solo se ve el
// nombre y el código; el QR aparece de uno en uno al abrir una etiqueta, para que el
// lector nunca lea el código de al lado.
import { z } from "zod";

/** Colores disponibles para un tipo de etiqueta (tokens en globals.css: --k-<color>). */
export const KIND_COLORS = ["orange", "green", "violet", "blue", "ink", "ochre", "grey", "red"] as const;
export type KindColor = (typeof KIND_COLORS)[number];

/** Iconos disponibles (nombres propios, se traducen a Phosphor en la interfaz). */
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

/** Tipos por defecto, genéricos. Cada app puede añadir o redefinir los suyos. */
export const DEFAULT_KINDS: KindDef[] = [
  { key: "user", name: "Usuario", color: "blue", icon: "user" },
  { key: "password", name: "Contraseña", color: "ink", icon: "key" },
  { key: "code", name: "Código", color: "ink", icon: "qr" },
  { key: "product", name: "Producto", color: "violet", icon: "barcode" },
  { key: "card", name: "Tarjeta de prueba", color: "green", icon: "card" },
  { key: "link", name: "Enlace", color: "blue", icon: "link" },
  { key: "location", name: "Ubicación", color: "ink", icon: "pin" },
  { key: "text", name: "Dato", color: "grey", icon: "text" },
  { key: "other", name: "Etiqueta", color: "grey", icon: "tag" },
];

const str = (max: number) => z.string().trim().max(max);

export const kindSchema = z.object({
  key: z.string().trim().min(1).max(40).regex(/^[a-z0-9][a-z0-9_-]*$/i, "clave: letras, números, - y _"),
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
  // No mostrar el código en claro (contraseñas): se copia igual.
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
  // Página externa con el kit (por ejemplo una página de etiquetas ya publicada).
  url: z
    .string()
    .max(2000)
    .url()
    .refine((u) => u.startsWith("https://"), "Tiene que ser un enlace https://")
    .optional(),
});

export type TestKit = z.infer<typeof kitSchema>;
export type KitPage = TestKit["pages"][number];
export type KitRow = KitPage["rows"][number];
export type KitLabel = KitRow["labels"][number];
export type KitProduct = NonNullable<KitLabel["products"]>[number];

/** Cuántas etiquetas tiene un kit (para contadores). */
export function kitSize(k?: TestKit | null) {
  if (!k) return 0;
  let n = 0;
  for (const p of k.pages) for (const r of p.rows) n += r.labels.length + (r.lead ? 1 : 0);
  return n;
}

/** Tipos efectivos de una app: los de por defecto, con los suyos encima. */
export function kindsFor(custom?: KindDef[]) {
  const map = new Map(DEFAULT_KINDS.map((k) => [k.key, k]));
  for (const k of custom ?? []) map.set(k.key, k);
  return map;
}

export function kindOf(map: Map<string, KindDef>, key: string): KindDef {
  return map.get(key) ?? { key, name: key.charAt(0).toUpperCase() + key.slice(1), color: "grey", icon: "tag" };
}

/**
 * Si llega una página HTML de etiquetas en vez del JSON, saca sus datos del bloque
 * <script type="application/json" id="page-data">. Lo usa la CLI.
 */
export function kitFromHtml(html: string): unknown {
  const m = /<script[^>]*id=["']page-data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) throw new Error("No encuentro el bloque page-data en el HTML");
  return JSON.parse(m[1]);
}

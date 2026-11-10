import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Access } from "./auth";
import { col, db } from "./db";
import { bad } from "./http";
import type { Comment, Revision } from "./model";

const key = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9][a-z0-9-_]*$/i, "clave: letras, números, - y _");

const assetIn = z.object({
  pathname: z.string().min(3).max(400),
  kind: z.enum(["image", "video", "artifact"]),
  name: z.string().max(200),
  contentType: z.string().max(100),
  size: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  origin: z.enum(["playwright", "manual", "external"]).default("manual"),
  caption: z.string().max(500).optional(),
});

export const publishSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().max(20000).default(""),
  liveUrl: z.string().url().max(2000).optional().or(z.literal("").transform(() => undefined)),
  previews: z
    .array(
      z.object({
        kind: z.enum(["web", "qr", "deeplink", "download"]),
        label: z.string().max(120),
        url: z.string().max(2000),
        instructions: z.string().max(2000).optional(),
      }),
    )
    .max(10)
    .default([]),
  meta: z.record(z.string(), z.string().max(500)).optional(),
  source: z.enum(["agent", "form"]),
  flows: z
    .array(
      z.object({
        key,
        title: z.string().min(1).max(160),
        description: z.string().max(4000).optional(),
        steps: z
          .array(
            z.object({
              key,
              title: z.string().min(1).max(160),
              notes: z.string().max(4000).optional(),
              url: z.string().max(2000).optional(),
              assets: z.array(assetIn).max(30).default([]),
            }),
          )
          .max(60),
      }),
    )
    .max(40)
    .default([]),
});
export type PublishInput = z.infer<typeof publishSchema>;

/**
 * Publica una revisión. Es el ÚNICO camino: lo usan el agente (CLI/MCP con clave
 * de API) y el formulario manual, así el resultado es idéntico por ambas vías.
 * Arrastra a la nueva revisión todos los comentarios abiertos del proyecto.
 */
export async function publishRevision(a: Access, input: PublishInput) {
  const projectId = a.project.id;
  for (const f of input.flows)
    for (const s of f.steps)
      for (const as of s.assets)
        if (!as.pathname.startsWith(`p/${projectId}/`)) throw bad(`Adjunto fuera del proyecto: ${as.name}`);

  const keys = new Set<string>();
  for (const f of input.flows) {
    if (keys.has(f.key)) throw bad(`Recorrido repetido: ${f.key}`);
    keys.add(f.key);
  }

  const id = nanoid(12);
  const now = Date.now();
  const projRef = col.projects().doc(projectId);

  const revision = await db().runTransaction(async (tx) => {
    const p = (await tx.get(projRef)).data()!;
    const number = (p.revisionCount ?? 0) + 1;
    const prevSnap = await tx.get(
      col.revisions().where("projectId", "==", projectId).where("number", "==", number - 1).limit(1),
    );
    const rev: Revision = {
      id,
      projectId,
      number,
      title: input.title,
      summary: input.summary,
      liveUrl: input.liveUrl,
      previews: input.previews,
      meta: input.meta,
      source: input.source,
      flows: input.flows.map((f) => ({
        ...f,
        steps: f.steps.map((s) => ({ ...s, assets: s.assets.map((x) => ({ ...x, id: nanoid(10) })) })),
      })),
      publishedBy: {
        id: a.author.id ?? "",
        name: a.author.name,
        via: a.actor.kind === "apikey" ? "apikey" : "user",
      },
      createdAt: now,
      previousRevisionId: prevSnap.empty ? undefined : prevSnap.docs[0].id,
      approvals: [],
      checks: {},
    };
    tx.set(col.revisions().doc(id), rev);
    tx.update(projRef, { revisionCount: number });
    return rev;
  });

  // Arrastre: los comentarios abiertos siguen vigentes en la nueva versión.
  const open = await col.comments().where("projectId", "==", projectId).where("status", "==", "open").get();
  const batch = db().batch();
  for (const d of open.docs)
    batch.update(d.ref, {
      revisionIds: FieldValue.arrayUnion(id),
      events: FieldValue.arrayUnion({ type: "carried", at: now, revisionId: id }),
    });
  await batch.commit();
  return { revision, carried: open.size };
}

export async function getRevision(id: string) {
  const s = await col.revisions().doc(id).get();
  return s.exists ? (s.data() as Revision) : null;
}

export async function commentsFor(revisionId: string) {
  const snap = await col.comments().where("revisionIds", "array-contains", revisionId).get();
  return snap.docs.map((d) => d.data() as Comment).sort((x, y) => x.createdAt - y.createdAt);
}

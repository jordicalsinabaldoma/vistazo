import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Access } from "./auth";
import { col, db } from "./db";
import { latestVerdicts, stageLabel, stageOf, type Stage } from "./flow";
import { bad, notFound } from "./http";
import type { ApiKey, Comment, Project, Review, Revision, ShareLink, User, Verdict } from "./model";

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

export const httpsUrl = z
  .string()
  .max(2000)
  .url()
  .refine((u) => u.startsWith("https://"), "Tiene que ser un enlace https://");

export const checklistIn = z
  .array(
    z.object({
      id: z.string().max(40).optional(),
      title: z.string().trim().min(1).max(200),
      description: z.string().max(1000).optional(),
      flowKey: z.string().max(60).optional(),
    }),
  )
  .max(50);

export const withIds = (items: z.infer<typeof checklistIn>) => items.map((c) => ({ ...c, id: c.id || nanoid(8) }));

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
  // A qué revisión va esta versión. Sin nada: revisión nueva. Con `id`: esa revisión.
  // Con `branch`: la revisión abierta de esa rama, o una nueva si no hay.
  review: z
    .object({
      id: z.string().max(40).optional(),
      branch: z.string().trim().max(200).optional(),
      title: z.string().trim().max(160).optional(),
      purpose: z.string().max(20000).optional(),
      testData: z.string().max(4000).optional(),
      testPlan: checklistIn.optional(),
      prUrl: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
    })
    .default({}),
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

/** Usuario responsable de lo que publica un actor (el agente publica en nombre de quien creó su clave). */
async function responsible(a: Access): Promise<{ id: string; name: string }> {
  if (a.actor.kind === "user") return { id: a.actor.user.id, name: a.actor.user.name };
  if (a.actor.kind === "apikey") {
    const k: ApiKey = a.actor.key;
    const u = await col.users().doc(k.createdBy).get();
    return { id: k.createdBy, name: u.exists ? (u.data() as User).name : "Equipo" };
  }
  throw bad("Sin permiso para publicar");
}

/**
 * Datos anteriores a las revisiones: cada app tenía versiones sueltas (v1, v2…).
 * Se agrupan, una sola vez y de forma idempotente, en una revisión #1 con esas
 * versiones dentro. Se llama al leer, así un despliegue nuevo no necesita script.
 */
export async function ensureMigrated(projectId: string) {
  const pref = col.projects().doc(projectId);
  const snap = await pref.get();
  if (!snap.exists) throw notFound("App no encontrada");
  if ((snap.data() as Project).reviewCount !== undefined) return;

  await db().runTransaction(async (tx) => {
    const p = (await tx.get(pref)).data() as Project;
    if (p.reviewCount !== undefined) return;
    const revSnap = await tx.get(col.revisions().where("projectId", "==", projectId));
    const comSnap = await tx.get(col.comments().where("projectId", "==", projectId));
    const revs = revSnap.docs.map((d) => d.data() as Revision).filter((r) => !r.reviewId).sort((a, b) => a.number - b.number);
    if (!revs.length) {
      tx.update(pref, { reviewCount: 0 });
      return;
    }
    const first = revs[0], last = revs[revs.length - 1];
    let author = { id: first.publishedBy.id, name: first.publishedBy.name };
    if (first.publishedBy.via === "apikey") {
      const k = await tx.get(col.keys().doc(first.publishedBy.id));
      const uid = k.exists ? (k.data() as ApiKey).createdBy : p.createdBy;
      const u = await tx.get(col.users().doc(uid));
      author = { id: uid, name: u.exists ? (u.data() as User).name : first.publishedBy.name };
    }
    const meta = { ...(first.meta ?? {}), ...(last.meta ?? {}) };
    const pr = meta.pr || meta.PR || "";
    const review: Review = {
      id: nanoid(12),
      projectId,
      number: 1,
      title: first.title.replace(/\s*\([^)]*\)\s*$/, "") || first.title,
      purpose: first.summary,
      testPlan: [],
      testData: "",
      branch: meta.rama || meta.branch || undefined,
      prUrl: /^https:\/\//.test(pr) ? pr : undefined,
      status: "open",
      author,
      versionCount: revs.length,
      latestRevisionId: last.id,
      createdAt: first.createdAt,
      updatedAt: last.createdAt,
    };
    tx.set(col.reviews().doc(review.id), review);
    for (const r of revs)
      tx.update(col.revisions().doc(r.id), {
        reviewId: review.id,
        verdicts: (r.verdicts ?? r.approvals.map((x) => ({ kind: "approve", author: { kind: "user", id: x.userId, name: x.name }, at: x.at, note: x.note }))) as Verdict[],
      });
    for (const c of comSnap.docs) if (!(c.data() as Comment).reviewId) tx.update(c.ref, { reviewId: review.id });
    tx.update(pref, { reviewCount: 1 });
  });
}

/**
 * Publica una versión. Es el ÚNICO camino: lo usan el agente (CLI/MCP con clave de
 * API) y el formulario, así el resultado es idéntico por ambas vías. Arrastra a la
 * nueva versión los comentarios abiertos DE ESA REVISIÓN (no de otras).
 */
export async function publishRevision(a: Access, input: PublishInput) {
  const projectId = a.project.id;
  await ensureMigrated(projectId);
  for (const f of input.flows)
    for (const s of f.steps)
      for (const as of s.assets)
        if (!as.pathname.startsWith(`p/${projectId}/`)) throw bad(`Adjunto fuera de la app: ${as.name}`);
  const keys = new Set<string>();
  for (const f of input.flows) {
    if (keys.has(f.key)) throw bad(`Recorrido repetido: ${f.key}`);
    keys.add(f.key);
  }

  const who = await responsible(a);
  const id = nanoid(12);
  const now = Date.now();
  const projRef = col.projects().doc(projectId);
  const ri = input.review;

  const { revision, review, created } = await db().runTransaction(async (tx) => {
    const p = (await tx.get(projRef)).data() as Project;
    let rv: Review | null = null;
    if (ri.id) {
      const s = await tx.get(col.reviews().doc(ri.id));
      if (!s.exists || (s.data() as Review).projectId !== projectId) throw notFound("Esa revisión no existe en esta app");
      rv = s.data() as Review;
    } else if (ri.branch) {
      const s = await tx.get(col.reviews().where("projectId", "==", projectId).where("branch", "==", ri.branch));
      rv = s.docs.map((d) => d.data() as Review).filter((r) => r.status === "open").sort((x, y) => y.updatedAt - x.updatedAt)[0] ?? null;
    }
    const isNew = !rv;
    const version = (rv?.versionCount ?? 0) + 1;
    const rev: Revision = {
      id,
      projectId,
      reviewId: rv?.id ?? nanoid(12),
      number: version,
      title: input.title,
      summary: input.summary,
      liveUrl: input.liveUrl,
      previews: input.previews,
      meta: input.meta,
      source: input.source,
      flows: input.flows.map((f) => ({ ...f, steps: f.steps.map((s) => ({ ...s, assets: s.assets.map((x) => ({ ...x, id: nanoid(10) })) })) })),
      publishedBy: { id: a.author.id ?? "", name: a.author.name, via: a.actor.kind === "apikey" ? "apikey" : "user" },
      createdAt: now,
      previousRevisionId: rv?.latestRevisionId,
      approvals: [],
      verdicts: [],
      checks: {},
    };
    if (isNew) {
      rv = {
        id: rev.reviewId,
        projectId,
        number: (p.reviewCount ?? 0) + 1,
        title: ri.title || input.title,
        purpose: ri.purpose ?? input.summary,
        testPlan: withIds(ri.testPlan ?? []),
        testData: ri.testData ?? "",
        branch: ri.branch || undefined,
        prUrl: ri.prUrl,
        status: "open",
        author: who,
        versionCount: 1,
        latestRevisionId: id,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(col.reviews().doc(rv.id), rv);
      tx.update(projRef, { reviewCount: rv.number, revisionCount: (p.revisionCount ?? 0) + 1 });
    } else {
      const upd: Partial<Review> = { versionCount: version, latestRevisionId: id, updatedAt: now, status: "open" };
      if (ri.prUrl) upd.prUrl = ri.prUrl;
      if (ri.testData !== undefined) upd.testData = ri.testData;
      if (ri.purpose !== undefined) upd.purpose = ri.purpose;
      if (ri.testPlan) upd.testPlan = withIds(ri.testPlan);
      tx.update(col.reviews().doc(rv!.id), { ...upd, closedAt: FieldValue.delete(), closedBy: FieldValue.delete() });
      Object.assign(rv!, upd);
      tx.update(projRef, { revisionCount: (p.revisionCount ?? 0) + 1 });
    }
    tx.set(col.revisions().doc(id), rev);
    return { revision: rev, review: rv!, created: isNew };
  });

  // Arrastre: los comentarios abiertos de ESTA revisión siguen vigentes en la nueva versión.
  let carried = 0;
  if (!created) {
    const open = await col.comments().where("reviewId", "==", review.id).where("status", "==", "open").get();
    const batch = db().batch();
    for (const d of open.docs)
      batch.update(d.ref, {
        revisionIds: FieldValue.arrayUnion(id),
        events: FieldValue.arrayUnion({ type: "carried", at: now, revisionId: id }),
      });
    await batch.commit();
    carried = open.size;
  }
  return { revision, review, created, carried };
}

export async function getRevision(id: string) {
  const s = await col.revisions().doc(id).get();
  return s.exists ? (s.data() as Revision) : null;
}

export async function getReview(id: string) {
  const s = await col.reviews().doc(id).get();
  return s.exists ? (s.data() as Review) : null;
}

export async function commentsFor(revisionId: string) {
  const snap = await col.comments().where("revisionIds", "array-contains", revisionId).get();
  return snap.docs.map((d) => d.data() as Comment).sort((x, y) => x.createdAt - y.createdAt);
}

/** ¿Hay alguien, además del equipo autor, que pueda revisarla? */
export function isShared(project: Project, review: Review, links: ShareLink[]) {
  const now = Date.now();
  const others = Object.keys(project.members).some((uid) => uid !== review.author.id);
  const guests = links.some((l) => l.reviewId === review.id && !l.revoked && (!l.expiresAt || l.expiresAt > now));
  return others || guests;
}

export interface ReviewSummary {
  id: string;
  number: number;
  title: string;
  status: "open" | "closed";
  stage: Stage;
  stageLabel: string;
  version: number;
  latestRevisionId: string;
  branch?: string;
  prUrl?: string;
  author: { id: string; name: string };
  open: number;
  approvals: string[];
  updatedAt: number;
  submittedBy: string[]; // ids de quien ya terminó su revisión de la última versión
}

/** Resumen de las revisiones de una app (estado calculado sobre la última versión). */
export async function summarizeReviews(projectId: string): Promise<ReviewSummary[]> {
  const [rs, cs] = await Promise.all([
    col.reviews().where("projectId", "==", projectId).get(),
    col.comments().where("projectId", "==", projectId).where("status", "==", "open").get(),
  ]);
  const reviews = rs.docs.map((d) => d.data() as Review);
  if (!reviews.length) return [];
  const latest = await db().getAll(...reviews.map((r) => col.revisions().doc(r.latestRevisionId)));
  const byId = new Map(latest.filter((s) => s.exists).map((s) => [s.id, s.data() as Revision]));
  const open = cs.docs.map((d) => d.data() as Comment);
  return reviews
    .map((r) => {
      const rev = byId.get(r.latestRevisionId);
      const here = open.filter((c) => rev && c.revisionIds.includes(rev.id));
      const input = {
        status: r.status,
        version: r.versionCount,
        verdicts: rev?.verdicts ?? [],
        openComments: here.length,
        openHere: here.filter((c) => c.originRevisionId === rev?.id).length,
      };
      const stage = stageOf(input);
      return {
        id: r.id,
        number: r.number,
        title: r.title,
        status: r.status,
        stage,
        stageLabel: stageLabel(stage, input),
        version: r.versionCount,
        latestRevisionId: r.latestRevisionId,
        branch: r.branch,
        prUrl: r.prUrl,
        author: r.author,
        open: here.length,
        approvals: rev?.approvals.map((a) => a.name) ?? [],
        updatedAt: r.updatedAt,
        submittedBy: latestVerdicts(rev?.verdicts).map((v) => v.author.id ?? ""),
      };
    })
    .sort((a, b) => (a.status === b.status ? b.updatedAt - a.updatedAt : a.status === "open" ? -1 : 1));
}

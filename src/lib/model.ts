// Modelo de datos de Vistazo.
// App (colección `projects`) → Revisión (colección `reviews`, como una PR: un cambio con
// su propósito) → Versión (colección `revisions`, v1, v2… dentro de la revisión,
// inmutable salvo veredictos y checks) → Recorrido → Paso → Adjuntos.
// Los comentarios pertenecen a la REVISIÓN y llevan la lista de versiones en las que
// están vigentes (revisionIds): se arrastran entre versiones de la misma revisión sin
// duplicarse y el historial queda intacto.

export type Role = "owner" | "editor" | "reviewer";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  flowKey?: string; // recorrido asociado (opcional)
}

export interface Project {
  id: string;
  name: string;
  context: string; // contexto permanente del proyecto (markdown)
  checklist: ChecklistItem[];
  members: Record<string, Role>; // userId → rol
  memberIds: string[];
  createdAt: number;
  createdBy: string;
  revisionCount: number; // legado: versiones publicadas en total
  reviewCount?: number; // ausente = datos anteriores a las revisiones (se migran solos)
}

/** Revisión: un cambio o feature con su propósito, como una pull request. */
export interface Review {
  id: string;
  projectId: string;
  number: number; // #1, #2… dentro de la app
  title: string;
  purpose: string; // qué cambia y para qué
  testPlan: ChecklistItem[]; // qué probar en ESTA revisión (además de los flujos críticos de la app)
  testData: string; // datos de prueba: usuarios, tarjetas de test… (nunca datos reales)
  branch?: string;
  prUrl?: string; // solo un enlace: no se sincroniza estado
  status: "open" | "closed";
  closedAt?: number;
  closedBy?: Author;
  author: { id: string; name: string }; // usuario responsable (si publica un agente, quien creó su clave)
  versionCount: number;
  latestRevisionId: string;
  createdAt: number;
  updatedAt: number;
}

export interface ShareLink {
  id: string;
  projectId: string;
  reviewId?: string; // si está, el enlace solo abre esa revisión
  tokenHash: string;
  label: string;
  revoked: boolean;
  createdAt: number;
  createdBy: string;
  expiresAt?: number;
}

export interface ApiKey {
  id: string;
  projectId: string;
  keyHash: string;
  prefix: string;
  label: string;
  revoked: boolean;
  createdAt: number;
  createdBy: string;
}

export type AssetKind = "image" | "video" | "artifact";

export interface Asset {
  id: string;
  kind: AssetKind;
  pathname: string; // blob privado: p/<projectId>/...
  name: string;
  contentType: string;
  size?: number;
  width?: number;
  height?: number;
  origin: "playwright" | "manual" | "external";
  caption?: string;
}

export interface Step {
  key: string;
  title: string;
  notes?: string;
  url?: string;
  assets: Asset[];
}

export interface Flow {
  key: string;
  title: string;
  description?: string; // lenguaje natural: «entra como cliente, crea un pedido y llega al pago»
  steps: Step[];
}

export interface PreviewLink {
  kind: "web" | "qr" | "deeplink" | "download";
  label: string;
  url: string;
  instructions?: string;
}

export interface Approval {
  userId: string;
  name: string;
  at: number;
  note?: string;
}

/** Resultado de «Terminar revisión». Cuenta el último de cada persona en cada versión. */
export interface Verdict {
  kind: "approve" | "changes" | "comment";
  author: Author;
  at: number;
  note?: string;
}

export interface CheckResult {
  status: "ok" | "fail" | "pending";
  by: string;
  at: number;
  note?: string;
}

export interface Revision {
  id: string;
  projectId: string;
  reviewId: string;
  number: number; // número de versión DENTRO de la revisión (v1, v2…)
  title: string;
  summary: string; // contexto de esta versión (qué cambia, qué mirar)
  liveUrl?: string;
  previews: PreviewLink[];
  flows: Flow[];
  source: "agent" | "form";
  publishedBy: { id: string; name: string; via: "user" | "apikey" };
  createdAt: number;
  previousRevisionId?: string;
  approvals: Approval[]; // derivado de verdicts (último «approve» vigente de cada usuario)
  verdicts?: Verdict[];
  checks: Record<string, CheckResult>; // checklistItemId → resultado
  meta?: Record<string, string>; // libre: rama, commit, PR, runtimeVersion…
}

export type Anchor =
  | { type: "general" }
  | { type: "step"; flowKey: string; stepKey: string }
  | {
      type: "asset";
      flowKey: string;
      stepKey: string;
      assetId: string;
      pathname?: string; // copia del adjunto, para ver la captura original al arrastrar
      x: number; // 0..1
      y: number; // 0..1
      t?: number; // segundos (vídeo)
    }
  | {
      type: "live";
      url: string;
      x: number;
      y: number;
      selector?: string;
      text?: string;
      viewport?: { w: number; h: number };
    };

export interface Author {
  kind: "user" | "guest" | "agent";
  id?: string;
  name: string;
}

export interface CommentEvent {
  type: "created" | "reply" | "resolved" | "reopened" | "carried";
  at: number;
  by?: Author;
  revisionId?: string;
  body?: string;
}

export interface Comment {
  id: string;
  projectId: string;
  reviewId: string;
  originRevisionId: string;
  originRevisionNumber: number;
  revisionIds: string[]; // revisiones en las que está vigente
  anchor: Anchor;
  body: string;
  author: Author;
  status: "open" | "resolved";
  resolvedAt?: number;
  resolvedBy?: Author;
  resolvedInRevisionId?: string;
  replies: { id: string; body: string; author: Author; at: number }[];
  events: CommentEvent[];
  createdAt: number;
}

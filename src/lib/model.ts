// Modelo de datos de Vistazo.
// Proyecto → Revisión (versión numerada, inmutable salvo estado) → Recorrido → Paso → Adjuntos.
// Los comentarios cuelgan del PROYECTO y llevan la lista de revisiones en las que
// están vigentes (revisionIds): así se arrastran sin duplicarse y el historial queda intacto.

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
  revisionCount: number;
}

export interface ShareLink {
  id: string;
  projectId: string;
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

export interface CheckResult {
  status: "ok" | "fail" | "pending";
  by: string;
  at: number;
  note?: string;
}

export interface Revision {
  id: string;
  projectId: string;
  number: number;
  title: string;
  summary: string; // contexto de esta versión (qué cambia, qué mirar)
  liveUrl?: string;
  previews: PreviewLink[];
  flows: Flow[];
  source: "agent" | "form";
  publishedBy: { id: string; name: string; via: "user" | "apikey" };
  createdAt: number;
  previousRevisionId?: string;
  approvals: Approval[];
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

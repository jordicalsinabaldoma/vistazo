// Vistazo data model.
// App (`projects` collection) → Review (`reviews` collection, like a PR: one change with
// its purpose) → Version (`revisions` collection, v1, v2… inside the review, immutable
// except for verdicts and checks) → Flow → Step → Attachments.
// Comments belong to the REVIEW and carry the list of versions where they are still
// current (revisionIds): they carry over between versions of the same review without
// being duplicated, and the history stays intact.

import type { KindDef, TestKit } from "./kit";

export type Role = "owner" | "editor" | "reviewer";

/** How the app is tested: web (live in the browser), mobile app (QR, deep link, download) or other. */
export type Platform = "web" | "mobile" | "desktop" | "other";

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
  flowKey?: string; // related flow (optional)
}

export interface Project {
  id: string;
  name: string;
  context: string; // permanent project context (markdown)
  checklist: ChecklistItem[];
  members: Record<string, Role>; // userId → role
  memberIds: string[];
  createdAt: number;
  createdBy: string;
  revisionCount: number; // legacy: total versions published
  reviewCount?: number; // missing = data from before reviews existed (migrated automatically)
  platform?: Platform;
  kinds?: KindDef[]; // custom label types for the test kit
}

/** Review: one change or feature with its purpose, like a pull request. */
export interface Review {
  id: string;
  projectId: string;
  number: number; // #1, #2… within the app
  title: string;
  purpose: string; // what changes and why
  testPlan: ChecklistItem[]; // what to test in THIS review (on top of the app's critical flows)
  testData: string; // free-text test notes (never real data)
  testKit?: TestKit; // structured test kit: users, codes to scan, products…
  branch?: string;
  prUrl?: string; // just a link: no state is synced
  status: "open" | "closed";
  closedAt?: number;
  closedBy?: Author;
  author: { id: string; name: string }; // responsible user (if an agent publishes, whoever created its key)
  versionCount: number;
  latestRevisionId: string;
  createdAt: number;
  updatedAt: number;
}

export interface ShareLink {
  id: string;
  projectId: string;
  reviewId?: string; // if set, the link only opens that review
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
  pathname: string; // private blob: p/<projectId>/...
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
  description?: string; // plain language: "sign in as a customer, create an order and reach checkout"
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

/** Result of "Finish review". The latest one per person per version counts. */
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
  number: number; // version number WITHIN the review (v1, v2…)
  title: string;
  summary: string; // context for this version (what changes, what to look at)
  liveUrl?: string;
  previews: PreviewLink[];
  flows: Flow[];
  source: "agent" | "form";
  publishedBy: { id: string; name: string; via: "user" | "apikey" };
  createdAt: number;
  previousRevisionId?: string;
  approvals: Approval[]; // derived from verdicts (each user's latest current "approve")
  verdicts?: Verdict[];
  checks: Record<string, CheckResult>; // checklistItemId → result
  meta?: Record<string, string>; // free-form: branch, commit, PR, runtimeVersion…
}

export type Anchor =
  | { type: "general" }
  | { type: "step"; flowKey: string; stepKey: string }
  | {
      type: "asset";
      flowKey: string;
      stepKey: string;
      assetId: string;
      pathname?: string; // copy of the attachment, to show the original screenshot when carried over
      x: number; // 0..1
      y: number; // 0..1
      t?: number; // seconds (video)
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
  revisionIds: string[]; // versions where it is still current
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

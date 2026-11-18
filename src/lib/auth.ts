import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { col } from "./db";
import { forbidden, notFound, unauthorized } from "./http";
import { clean } from "./untrusted";
import type { ApiKey, Author, Project, Role, ShareLink, User } from "./model";

const SESSION = "vz_session";
const GUEST = "vz_guest";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET missing or too short");
  return new TextEncoder().encode(s);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");

export function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}
export function checkPassword(pw: string, stored: string) {
  const [, saltHex, hHex] = stored.split("$");
  const h = scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(h, Buffer.from(hHex, "hex"));
}

async function sign(payload: Record<string, unknown>, days: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
}
async function verify<T>(token?: string): Promise<T | null> {
  if (!token) return null;
  try {
    return (await jwtVerify(token, secret())).payload as T;
  } catch {
    return null;
  }
}

const cookieOpts = (days: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: days * 86400,
});

export async function startSession(userId: string) {
  (await cookies()).set(SESSION, await sign({ uid: userId }, 14), cookieOpts(14));
}
export async function endSession() {
  const c = await cookies();
  c.set(SESSION, "", { ...cookieOpts(0), maxAge: 0 });
  c.set(GUEST, "", { ...cookieOpts(0), maxAge: 0 });
}
export async function startGuest(link: ShareLink, name: string) {
  const gid = randomToken(9);
  (await cookies()).set(
    GUEST,
    await sign({ lid: link.id, pid: link.projectId, name: clean(name, 60) || "Guest", gid }, 7),
    cookieOpts(7),
  );
}

// ----- Actors -----
export type Actor =
  | { kind: "user"; user: User }
  | { kind: "guest"; linkId: string; projectId: string; name: string; gid: string; reviewId?: string }
  | { kind: "apikey"; key: ApiKey };

export async function currentUser(): Promise<User | null> {
  const c = await cookies();
  const s = await verify<{ uid: string }>(c.get(SESSION)?.value);
  if (!s) return null;
  const snap = await col.users().doc(s.uid).get();
  return snap.exists ? (snap.data() as User) : null;
}

export async function currentGuest() {
  const c = await cookies();
  const g = await verify<{ lid: string; pid: string; name: string; gid: string }>(c.get(GUEST)?.value);
  if (!g) return null;
  const ls = await col.links().doc(g.lid).get();
  const link = ls.exists ? (ls.data() as ShareLink) : null;
  // Revoking the link cuts access instantly: it is checked on every request.
  if (!link || link.revoked || (link.expiresAt && link.expiresAt < Date.now())) return null;
  return { linkId: g.lid, projectId: g.pid, name: g.name, gid: g.gid, reviewId: link.reviewId };
}

export async function actorFor(req: Request): Promise<Actor[]> {
  // Returns every identity present; permission is decided per project.
  const authz = req.headers.get("authorization");
  if (authz?.startsWith("Bearer vzk_")) {
    const raw = authz.slice(7).trim();
    const id = raw.split("_")[1];
    const snap = id ? await col.keys().doc(id).get() : null;
    const key = snap?.exists ? (snap.data() as ApiKey) : null;
    if (!key || key.revoked || key.keyHash !== sha256(raw))
      throw unauthorized("Invalid or revoked API key");
    return [{ kind: "apikey", key }];
  }
  const out: Actor[] = [];
  const user = await currentUser();
  if (user) out.push({ kind: "user", user });
  const g = await currentGuest();
  if (g) out.push({ kind: "guest", ...g });
  return out;
}

export interface Access {
  project: Project;
  actor: Actor;
  role: Role | "guest" | "agent";
  author: Author;
  /** If set, the actor (a guest) can only see that review. */
  scope?: string;
  can: {
    view: boolean;
    comment: boolean;
    publish: boolean;
    resolve: boolean;
    approve: boolean;
    manage: boolean;
  };
}

export async function getProject(projectId: string) {
  const snap = await col.projects().doc(projectId).get();
  if (!snap.exists) throw notFound("Project not found");
  return snap.data() as Project;
}

export async function access(req: Request, projectId: string): Promise<Access> {
  const actors = await actorFor(req);
  const project = await getProject(projectId);
  for (const a of actors) {
    if (a.kind === "user" && project.members[a.user.id]) {
      const role = project.members[a.user.id];
      return {
        project,
        actor: a,
        role,
        author: { kind: "user", id: a.user.id, name: a.user.name },
        can: {
          view: true,
          comment: true,
          publish: role !== "reviewer",
          resolve: role !== "reviewer",
          approve: true, // approve = signed-in member (except the review's author: see verdict)
          manage: role === "owner",
        },
      };
    }
  }
  for (const a of actors) {
    if (a.kind === "apikey" && a.key.projectId === projectId)
      return {
        project,
        actor: a,
        role: "agent",
        author: { kind: "agent", id: a.key.id, name: `Agente (${a.key.label})` },
        can: { view: true, comment: false, publish: true, resolve: false, approve: false, manage: false },
      };
    if (a.kind === "guest" && a.projectId === projectId)
      return {
        project,
        actor: a,
        role: "guest",
        author: { kind: "guest", id: a.gid, name: a.name },
        scope: a.reviewId,
        can: { view: true, comment: true, publish: false, resolve: false, approve: false, manage: false },
      };
  }
  if (actors.some((a) => a.kind === "user")) throw forbidden("You are not a member of this project");
  throw unauthorized();
}

const MSG: Record<string, string> = {
  approve: "Only a signed-in member of the app can approve or request changes",
  resolve: "Only the authoring team can resolve comments",
  publish: "You can't publish or edit reviews",
  manage: "Only the owner can change this",
  comment: "You can't comment",
};

export function need(a: Access, what: keyof Access["can"]) {
  if (!a.can[what]) throw forbidden(MSG[what] ?? "No access");
}

/** A guest with a review link only sees that review. */
export function needScope(a: Access, reviewId: string) {
  if (a.scope && a.scope !== reviewId) throw forbidden("Your link is for another review");
}

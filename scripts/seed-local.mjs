// Copia la demo de producción al emulador local de Firestore, SOLO leyendo de producción
// por la API pública con la cuenta demo. Los datos quedan en el formato anterior a las
// revisiones, así la primera carga en local prueba también la migración automática.
// Arranca el emulador vacío antes de ejecutarlo.
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 SOURCE=https://vistazo-pi.vercel.app DEMO_PASSWORD=… node scripts/seed-local.mjs
import { randomBytes, scryptSync } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Solo contra el emulador: falta FIRESTORE_EMULATOR_HOST");
const SRC = process.env.SOURCE.replace(/\/$/, "");
const PW = process.env.DEMO_PASSWORD;
const db = getFirestore(initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "vistazo-local" }));
db.settings({ ignoreUndefinedProperties: true });

const hash = (pw) => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 64).toString("hex")}`;
};

let cookie = "";
const get = async (p) => {
  const r = await fetch(SRC + p, { headers: { cookie } });
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return r.json();
};
const login = await fetch(SRC + "/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "autora+final@brasa.test", password: PW }),
});
cookie = login.headers.get("set-cookie").split(";")[0];

const { projects } = await get("/api/projects");
for (const pr of projects) {
  const d = await get(`/api/projects/${pr.id}`);
  const members = Object.fromEntries(d.members.map((m) => [m.id, m.role]));
  const owner = d.members.find((m) => m.role === "owner");
  for (const m of d.members)
    await db.collection("users").doc(m.id).set({ id: m.id, email: m.email, name: m.name, passwordHash: hash(PW), createdAt: Date.now() });
  await db.collection("projects").doc(pr.id).set({
    id: pr.id,
    name: d.project.name,
    context: d.project.context,
    checklist: d.project.checklist,
    members,
    memberIds: Object.keys(members),
    createdAt: Date.now(),
    createdBy: owner.id,
    revisionCount: d.project.revisionCount,
  });
  const seen = new Set();
  for (const r of d.revisions) {
    const full = await get(`/api/revisions/${r.id}`);
    await db.collection("revisions").doc(r.id).set(full.revision);
    for (const c of full.comments)
      if (!seen.has(c.id)) {
        seen.add(c.id);
        await db.collection("comments").doc(c.id).set(c);
      }
  }
  console.log(`✓ ${d.project.name}: ${d.revisions.length} versiones, ${seen.size} comentarios, ${d.members.length} personas`);
}

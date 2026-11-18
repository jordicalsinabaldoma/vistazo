import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Firebase se usa SOLO como base de datos (Firestore). Las credenciales llegan
// por variable de entorno (JSON de service account en base64), nunca del repo.
let _db: Firestore | null = null;

export function db(): Firestore {
  if (_db) return _db;
  // Desarrollo y pruebas: con FIRESTORE_EMULATOR_HOST se usa el emulador local
  // (sin credenciales y sin tocar la base de datos real).
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw && !emulator) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_B64");
  const app =
    getApps()[0] ??
    (emulator
      ? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "vistazo-local" })
      : (() => {
          const sa = JSON.parse(Buffer.from(raw!, "base64").toString("utf8"));
          return initializeApp({ credential: cert(sa), projectId: sa.project_id });
        })());
  _db = getFirestore(app);
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}

export const col = {
  users: () => db().collection("users"),
  projects: () => db().collection("projects"),
  links: () => db().collection("shareLinks"),
  keys: () => db().collection("apiKeys"),
  revisions: () => db().collection("revisions"),
  comments: () => db().collection("comments"),
  reviews: () => db().collection("reviews"),
};

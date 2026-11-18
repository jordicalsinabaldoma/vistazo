// Estado de una revisión y «siguiente paso». Lógica pura: la usan el servidor
// (listas, buzón «Te toca») y el cliente (cabecera de la revisión), así las dos
// vías dicen exactamente lo mismo.
//
// El estado se CALCULA, no se marca a mano, y nunca bloquea nada: solo decide qué
// botón es el principal. Todo lo demás sigue a mano en segundo plano.

import type { Author, Verdict } from "./model";

export type Stage = "pending" | "feedback" | "changes" | "approved" | "closed";

export interface StageInput {
  status: "open" | "closed";
  version: number; // número de la última versión
  verdicts: Verdict[]; // veredictos de la ÚLTIMA versión
  openComments: number; // comentarios abiertos vigentes en la última versión
  openHere: number; // de esos, los escritos sobre la última versión (no arrastrados)
}

const who = (a: Author) => `${a.kind}:${a.id ?? a.name}`;

/** Último veredicto de cada persona (una persona puede cambiar de opinión). */
export function latestVerdicts(verdicts: Verdict[] = []) {
  const m = new Map<string, Verdict>();
  for (const v of [...verdicts].sort((a, b) => a.at - b.at)) m.set(who(v.author), v);
  return [...m.values()];
}

export function stageOf(s: StageInput): Stage {
  if (s.status === "closed") return "closed";
  const last = latestVerdicts(s.verdicts);
  if (last.some((v) => v.kind === "changes")) return "changes";
  if (last.some((v) => v.kind === "approve")) return "approved";
  if (s.openHere > 0 || last.some((v) => v.kind === "comment")) return "feedback";
  return "pending";
}

export function stageLabel(stage: Stage, s: Pick<StageInput, "version" | "openComments">) {
  switch (stage) {
    case "closed":
      return "Cerrada";
    case "changes":
      return "Cambios pedidos";
    case "feedback":
      return "Con comentarios";
    case "approved":
      return s.openComments > 0 ? `Aprobada, ${s.openComments} ${s.openComments === 1 ? "nota abierta" : "notas abiertas"}` : "Aprobada";
    default:
      return s.version > 1 ? `v${s.version} sin revisar` : "Pendiente de revisar";
  }
}

/** Tono visual del estado: neutro, ámbar, verde o gris. Solo color con significado. */
export const stageTone: Record<Stage, "neutral" | "attention" | "done" | "muted"> = {
  pending: "neutral",
  feedback: "attention",
  changes: "attention",
  approved: "done",
  closed: "muted",
};

/** Pasos del circuito, en el orden en que se recorren. */
export const CIRCUIT = ["Publicar", "Revisar", "Corregir", "Aprobar"] as const;

/** Índice del paso en curso dentro de CIRCUIT (4 = todo hecho). */
export function circuitStep(stage: Stage) {
  return { pending: 1, feedback: 2, changes: 2, approved: 4, closed: 4 }[stage];
}

export type Action = "review" | "diff" | "feedback" | "share" | "close" | "publish";

export interface Viewer {
  isAuthor: boolean; // responsable de la revisión
  isGuest: boolean;
  canVerdict: boolean; // aprobar o pedir cambios
  canPublish: boolean;
  submitted: boolean; // ya terminó su revisión de la última versión
  shared: boolean; // hay alguien más que puede revisarla (revisores o enlaces activos)
}

export interface NextStep {
  text: string;
  primary?: { action: Action; label: string };
  mine: boolean; // ¿le toca a quien mira?
}

export function nextStep(stage: Stage, version: number, v: Viewer): NextStep {
  if (stage === "closed") return { text: "Revisión cerrada. El historial sigue disponible.", mine: false };

  if (v.isAuthor) {
    if (stage === "changes" || stage === "feedback")
      return {
        text: stage === "changes" ? "Han pedido cambios. Llévate el feedback a tu agente y publica una nueva versión." : "Hay comentarios nuevos. Llévatelos a tu agente y publica una nueva versión.",
        primary: { action: "feedback", label: "Llevar el feedback a tu agente" },
        mine: true,
      };
    if (stage === "approved")
      return { text: "Está aprobada. Cuando lo tengas integrado, cierra la revisión.", primary: { action: "close", label: "Cerrar revisión" }, mine: true };
    if (!v.shared)
      return { text: "Nadie más puede verla todavía. Compártela para que la revisen.", primary: { action: "share", label: "Compartir para revisar" }, mine: true };
    return { text: `Esperando a que revisen la v${version}.`, mine: false };
  }

  if (v.submitted) {
    if (stage === "approved") return { text: "Ya la revisaste. Está aprobada.", mine: false };
    return { text: `Ya enviaste tu revisión de la v${version}. Esperando la siguiente versión.`, mine: false };
  }
  if (stage === "approved" && !v.canVerdict) return { text: "Está aprobada. Aún puedes probarla y comentar.", primary: { action: "review", label: "Probar y comentar" }, mine: false };
  if (version > 1) return { text: `Hay una versión nueva (v${version}). Mira qué ha cambiado y pruébala.`, primary: { action: "diff", label: "Revisar lo que ha cambiado" }, mine: true };
  return { text: "Prueba lo que hay que probar, comenta lo que veas y termina tu revisión.", primary: { action: "review", label: "Empezar a revisar" }, mine: true };
}

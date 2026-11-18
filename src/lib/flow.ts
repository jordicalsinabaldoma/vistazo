// Review state and "next step". Pure logic: used by the server (lists, the "Your turn"
// inbox) and by the client (review header), so both say exactly the same thing.
//
// The state is COMPUTED, never set by hand, and it never blocks anything: it only
// decides which button is the primary one. Everything else stays available.

import type { Author, Verdict } from "./model";

export type Stage = "pending" | "feedback" | "changes" | "approved" | "closed";

export interface StageInput {
  status: "open" | "closed";
  version: number; // number of the latest version
  verdicts: Verdict[]; // verdicts on the LATEST version
  openComments: number; // open comments still in force on the latest version
  openHere: number; // of those, the ones written on the latest version (not carried over)
}

const who = (a: Author) => `${a.kind}:${a.id ?? a.name}`;

/** Latest verdict of each person (people can change their mind). */
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
      return "Closed";
    case "changes":
      return "Changes requested";
    case "feedback":
      return "With comments";
    case "approved":
      return s.openComments > 0 ? `Approved, ${s.openComments} ${s.openComments === 1 ? "open note" : "open notes"}` : "Approved";
    default:
      return s.version > 1 ? `v${s.version} not reviewed` : "Pending review";
  }
}

/** Visual tone of the state: neutral, amber, green or grey. Colour only when it means something. */
export const stageTone: Record<Stage, "neutral" | "attention" | "done" | "muted"> = {
  pending: "neutral",
  feedback: "attention",
  changes: "attention",
  approved: "done",
  closed: "muted",
};

/** Steps of the loop, in the order they happen. */
export const CIRCUIT = ["Publish", "Review", "Fix", "Approve"] as const;

/** Index of the current step within CIRCUIT (4 = all done). */
export function circuitStep(stage: Stage) {
  return { pending: 1, feedback: 2, changes: 2, approved: 4, closed: 4 }[stage];
}

export type Action = "review" | "diff" | "feedback" | "share" | "close" | "publish";

export interface Viewer {
  isAuthor: boolean; // owner of the review
  isGuest: boolean;
  canVerdict: boolean; // approve or request changes
  canPublish: boolean;
  submitted: boolean; // already finished their review of the latest version
  shared: boolean; // someone else can review it (reviewers or active links)
}

export interface NextStep {
  text: string;
  primary?: { action: Action; label: string };
  mine: boolean; // is it the viewer's turn?
}

export function nextStep(stage: Stage, version: number, v: Viewer): NextStep {
  if (stage === "closed") return { text: "Review closed. The history is still available.", mine: false };

  if (v.isAuthor) {
    if (stage === "changes" || stage === "feedback")
      return {
        text:
          stage === "changes"
            ? "Changes were requested. Take the feedback to your agent and publish a new version."
            : "There are new comments. Take them to your agent and publish a new version.",
        primary: { action: "feedback", label: "Take the feedback to your agent" },
        mine: true,
      };
    if (stage === "approved")
      return { text: "It's approved. Once it's merged, close the review.", primary: { action: "close", label: "Close review" }, mine: true };
    if (!v.shared)
      return { text: "Nobody else can see it yet. Share it so it gets reviewed.", primary: { action: "share", label: "Share for review" }, mine: true };
    return { text: `Waiting for v${version} to be reviewed.`, mine: false };
  }

  if (v.submitted) {
    if (stage === "approved") return { text: "You already reviewed it. It's approved.", mine: false };
    return { text: `You already sent your review of v${version}. Waiting for the next version.`, mine: false };
  }
  if (stage === "approved" && !v.canVerdict) return { text: "It's approved. You can still try it and comment.", primary: { action: "review", label: "Try and comment" }, mine: false };
  if (version > 1) return { text: `There's a new version (v${version}). See what changed and try it.`, primary: { action: "diff", label: "Review what changed" }, mine: true };
  return { text: "Try what needs testing, comment on what you see and finish your review.", primary: { action: "review", label: "Start reviewing" }, mine: true };
}

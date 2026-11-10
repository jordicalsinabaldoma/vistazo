import type { Anchor, Comment, Revision } from "@/lib/model";

export type Me = {
  role: string;
  name: string;
  id?: string;
  kind: string;
  can: { view: boolean; comment: boolean; publish: boolean; resolve: boolean; approve: boolean; manage: boolean };
};

export type ReviewData = {
  revision: Revision;
  previous: Revision | null;
  versions: { id: string; number: number; title: string; approved: boolean }[];
  comments: Comment[];
  project: { id: string; name: string; context: string; checklist: { id: string; title: string; description?: string; flowKey?: string }[] };
  me: Me;
};

export type Ctx = {
  data: ReviewData;
  numberOf: (c: Comment) => number;
  addComment: (anchor: Anchor, body: string) => Promise<void>;
  focus: string | null;
  setFocus: (id: string | null) => void;
};

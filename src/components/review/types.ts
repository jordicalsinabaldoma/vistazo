import type { KindDef } from "@/lib/kit";
import type { Anchor, Comment, Platform, Review, Revision, Verdict } from "@/lib/model";

export type Me = {
  role: string;
  name: string;
  id?: string;
  kind: string;
  isAuthor: boolean;
  can: { view: boolean; comment: boolean; publish: boolean; resolve: boolean; approve: boolean; manage: boolean };
};

export type Check = { id: string; title: string; description?: string; flowKey?: string };

export type ReviewData = {
  revision: Revision;
  previous: Revision | null;
  review: Review;
  latest: { id: string; number: number; verdicts: Verdict[]; openComments: number; openHere: number };
  versions: {
    id: string;
    number: number;
    title: string;
    summary: string;
    createdAt: number;
    approved: boolean;
    verdicts: Verdict[];
    publishedBy: Revision["publishedBy"];
    source: Revision["source"];
    meta: Record<string, string>;
    screens: number;
    live: boolean;
  }[];
  comments: Comment[];
  shared: boolean;
  project: { id: string; name: string; context: string; checklist: Check[]; platform: Platform | null; kinds: KindDef[] };
  me: Me;
};

export type Ctx = {
  data: ReviewData;
  numberOf: (c: Comment) => number;
  addComment: (anchor: Anchor, body: string) => Promise<void>;
  focus: string | null;
  setFocus: (id: string | null) => void;
  reload: () => Promise<void>;
};

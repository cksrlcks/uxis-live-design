export type { Proposal } from "@drizzle/schema";

// A single rendered page: public read URL + native pixel dimensions + page order.
export type ProposalPage = {
  id: string;
  url: string;
  width: number;
  height: number;
  pageOrder: number;
};

// One 안(variant) with its current version's pages — the viewer shape.
export type ViewerVariant = {
  id: string;
  slug: string;
  label: string;
  currentVersionId: string | null;
  pages: ProposalPage[];
};

// Editor view also needs the per-variant version history.
export type EditorVariant = ViewerVariant & {
  versions: { id: string; versionNo: number; note: string | null }[];
};

// The proposal subset the editor detail view renders (no timestamps are shown).
export type ProposalDetailHeader = {
  id: string;
  title: string;
  publicId: string;
  visibility: string;
  hasPassword: boolean;
};

// Full editor detail payload returned by GET /api/proposals/[id].
export type ProposalDetail = {
  proposal: ProposalDetailHeader;
  variants: EditorVariant[];
};

import type { Proposal } from "@drizzle/schema";

export type { Proposal };

// 목록 행 = 시안 + 태깅 완성도(0~100). 서버에서 구분 커버리지로 계산해 내려준다.
export type ProposalListItem = Proposal & { taggingProgress: number };

// 목록 페이징 공통 형태.
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export const PROPOSALS_PAGE_SIZE = 20;

// A single rendered page: public read URL + native pixel dimensions + page order.
export type ProposalPage = {
  id: string;
  url: string;
  width: number;
  height: number;
  pageOrder: number;
};

// One version of a 안(variant): its ordered pages plus history metadata.
export type ProposalVersionView = {
  id: string;
  versionNo: number;
  note: string | null;
  pages: ProposalPage[];
};

// One 안(variant) with its full version history. `pages` is the current
// (default) version's pages — kept for list thumbnails and 나란히 보기; the
// single view selects among `versions` (each carries its own pages).
export type ViewerVariant = {
  id: string;
  slug: string;
  label: string;
  currentVersionId: string | null;
  pages: ProposalPage[];
  versions: ProposalVersionView[];
};

// Editor view uses the same shape (per-variant version history + pages).
export type EditorVariant = ViewerVariant;

// The proposal subset the editor detail view renders (no timestamps are shown).
export type ProposalDetailHeader = {
  id: string;
  title: string;
  participants: string | null;
  workYear: number | null;
  figmaUrl: string | null;
  publicId: string;
  domain: string | null;
  visibility: string;
  hasPassword: boolean;
  whiteboardEnabled: boolean;
  exposedToUxisworks: boolean;
};

// Full editor detail payload returned by GET /api/proposals/[id].
export type ProposalDetail = {
  proposal: ProposalDetailHeader;
  variants: EditorVariant[];
};

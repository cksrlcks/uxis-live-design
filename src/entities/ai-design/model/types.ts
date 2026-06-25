import type { PageType, AiDesignStatus } from "./constants";

// 생성에 넘기는 입력.
export type GenerationInput = {
  title: string;
  company: string | null;
  pageType: PageType;
  tagLabels: string[];
  extraNotes: string | null;
};

// 목록 행 DTO(클라이언트로 반환; 내부 컬럼 일부 제외).
export type AiDesignListItem = {
  id: string;
  title: string;
  company: string | null;
  pageType: PageType;
  status: AiDesignStatus;
  hasHtml: boolean;
  errorMessage: string | null;
  requestedBy: string | null; // 요청자 표시명(없으면 이메일, 둘 다 없으면 null)
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export const AI_DESIGNS_PAGE_SIZE = 20;

// 목록 페이징 응답 형태(시안 목록과 동일한 모양).
export type PaginatedAiDesigns = {
  items: AiDesignListItem[];
  total: number;
  page: number;
  pageSize: number;
};

// 상세에서 보여줄 '선택했던 사전정보'의 태그 묶음(구분별 선택 옵션).
export type AiDesignTagGroupView = {
  groupId: string;
  groupLabel: string;
  options: { id: string; label: string }[];
};

// OpenAI에 실제로 전달한 참고 시안 이미지 스냅샷.
export type AiDesignReferenceProposal = {
  proposalId: string | null; // 시안 삭제 후에는 null
  proposalTitle: string;
  imageUrl: string;
  sortOrder: number;
};

// 상세 DTO — 생성 시 입력한 사전정보 + 상태/결과 메타.
export type AiDesignDetail = {
  id: string;
  title: string;
  company: string | null;
  pageType: PageType;
  extraNotes: string | null;
  status: AiDesignStatus;
  errorMessage: string | null;
  model: string | null;
  hasHtml: boolean;
  requestedBy: string | null;
  tagGroups: AiDesignTagGroupView[];
  referenceProposals: AiDesignReferenceProposal[]; // 생성에 사용된 참고 시안 (없으면 빈 배열)
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

import type { PageType, AiDesignStatus } from "./constants";

// 생성 step에 넘기는 입력(직렬화 가능해야 함 — workflow step 경계를 넘음).
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
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

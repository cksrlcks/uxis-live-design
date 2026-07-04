import type { SectionType } from "./constants";

// list-pending-pages가 반환하는, 분석이 필요한 페이지 1건.
export type PendingPage = {
  pageId: string;
  proposalId: string;
  versionId: string;
  storagePath: string;
  proposalTitle: string;
};

// 분석 스크립트 1건 처리 결과.
export type AnalyzeOutcome = "analyzed" | "failed" | "skipped";

// 검색 결과 — 생성 프롬프트에 넣을 섹션 패턴 1건.
export type RetrievedSection = {
  proposalId: string;
  proposalTitle: string;
  sectionType: SectionType;
  layoutType: string | null;
  summary: string | null;
  promptSnippet: string | null;
};

// 생성 경로가 소비하는 검색 결과. patternSnippets는 프롬프트에 바로 넣을 수 있는 텍스트 줄들.
export type AnalyzedPatterns = {
  patternSnippets: string[];
  sections: RetrievedSection[];
};

// studio 분석 데이터 뷰어용 — 분석된 페이지 1건 + 그 섹션들(중첩).
export type AnalysisOverviewSection = {
  sectionType: string;
  layoutType: string | null;
  summary: string | null;
  promptSnippet: string | null;
};

export type AnalysisOverviewPage = {
  id: string;
  proposalId: string;
  proposalTitle: string;
  industry: string | null;
  tone: string | null;
  styleKeywords: string[];
  summary: string | null;
  model: string | null;
  analyzedAt: string | null;
  sections: AnalysisOverviewSection[];
};

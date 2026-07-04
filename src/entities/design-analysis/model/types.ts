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

// studio 분석 데이터 뷰어용 — 시안(proposal) 단위로 묶고, 그 안에 분석된 페이지·섹션을 중첩한다.
export type AnalysisOverviewSection = {
  sectionType: string;
  layoutType: string | null;
  summary: string | null;
  promptSnippet: string | null;
};

// 분석된 페이지 1건(그 섹션들 포함). 섹션은 페이지 내 순서(order_index)대로 정렬돼 온다.
export type AnalysisOverviewPage = {
  id: string; // proposal_page_analysis.id
  pageId: string;
  pageOrder: number;
  industry: string | null;
  tone: string | null;
  styleKeywords: string[];
  summary: string | null;
  model: string | null;
  analyzedAt: string | null;
  sections: AnalysisOverviewSection[];
};

// 시안(proposal) 단위 묶음. pages는 page_order대로 정렬돼 온다.
export type AnalysisOverviewProposal = {
  proposalId: string;
  proposalTitle: string;
  pages: AnalysisOverviewPage[];
};

// 상단 표시용 분석 커버리지(현재 버전 기준). 시안·페이지 두 기준으로 준다.
export type AnalysisCoverage = {
  proposalsTotal: number; // 현재 버전 페이지를 가진 시안 수
  proposalsAnalyzed: number; // 그중 1개 이상 페이지가 분석된 시안 수
  pagesTotal: number; // 현재 버전 페이지 총수
  pagesAnalyzed: number; // 그중 분석된 페이지 수
};

export type AnalysisOverview = {
  coverage: AnalysisCoverage;
  proposals: AnalysisOverviewProposal[];
};

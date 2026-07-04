// NOTE: 생성 경로(ai-design)와 조회 스크립트(scripts/query-patterns.mts, tsx) 양쪽에서 import한다.
// "server-only"는 tsx에서 throw하므로 넣지 않는다(analyze-page.server.ts 참고). 서버 전용은 `.server.ts`로 표시.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalTags, proposalPageAnalysis, proposalSectionAnalysis } from "@drizzle/schema";
import { ANALYSIS_VERSION } from "../model/constants";
import type { SectionType } from "../model/constants";
import type { AnalyzedPatterns, RetrievedSection } from "../model/types";

// 선택 태그(optionIds)로 매칭 시안을 찾고, 그 시안들의 사전 분석된 섹션 패턴을 모아 생성 프롬프트용으로 반환한다.
// 태그는 여기서 라이브 조인하므로(getTagMatchedImages와 동일한 매칭 로직) 태그 수정이 즉시 반영된다.
// 분석 데이터가 없으면 빈 결과 → 생성 경로는 기존 이미지 방식으로 폴백한다.
export async function getAnalyzedPatterns(
  optionIds: string[],
  opts: { proposalLimit?: number; maxSections?: number; perProposal?: number } = {},
): Promise<AnalyzedPatterns> {
  const { proposalLimit = 8, maxSections = 24, perProposal = 4 } = opts;
  if (optionIds.length === 0) return { patternSnippets: [], sections: [] };

  // 1) 태그 매칭 개수 상위 시안(getTagMatchedImages와 동일 로직).
  const matched = await db
    .select({ proposalId: proposalTags.proposalId, matches: sql<number>`count(*)::int` })
    .from(proposalTags)
    .where(inArray(proposalTags.optionId, optionIds))
    .groupBy(proposalTags.proposalId)
    .orderBy(desc(sql`count(*)`))
    .limit(proposalLimit);

  const proposalIds = matched.map((m) => m.proposalId);
  if (proposalIds.length === 0) return { patternSnippets: [], sections: [] };

  // 2) 매칭 시안들의 "현재 버전 · analyzed" 섹션 분석. section에는 analysis_version이 없으므로
  //    부모 page_analysis로 조인해 현재 버전만 남긴다.
  const rows = await db
    .select({
      proposalId: proposalSectionAnalysis.proposalId,
      proposalTitle: proposals.title,
      sectionType: proposalSectionAnalysis.sectionType,
      orderIndex: proposalSectionAnalysis.orderIndex,
      layoutType: proposalSectionAnalysis.layoutType,
      summary: proposalSectionAnalysis.summary,
      promptSnippet: proposalSectionAnalysis.promptSnippet,
    })
    .from(proposalSectionAnalysis)
    .innerJoin(
      proposalPageAnalysis,
      eq(proposalSectionAnalysis.pageAnalysisId, proposalPageAnalysis.id),
    )
    .innerJoin(proposals, eq(proposalSectionAnalysis.proposalId, proposals.id))
    .where(
      and(
        inArray(proposalSectionAnalysis.proposalId, proposalIds),
        eq(proposalPageAnalysis.analysisVersion, ANALYSIS_VERSION),
        eq(proposalPageAnalysis.status, "analyzed"),
      ),
    )
    .orderBy(asc(proposalSectionAnalysis.proposalId), asc(proposalSectionAnalysis.orderIndex));

  // 3) 시안 다양성 확보: 매칭 순위(proposalIds는 매칭수 내림차순)대로 시안별 최대 perProposal개만 뽑고,
  //    (sectionType + 스니펫) 중복은 제거한다. 페이지 많은 한 시안이 결과를 독점하지 않도록.
  type Row = (typeof rows)[number];
  const byProposal = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byProposal.get(r.proposalId);
    if (arr) arr.push(r);
    else byProposal.set(r.proposalId, [r]);
  }

  const seen = new Set<string>();
  const sections: RetrievedSection[] = [];
  for (const pid of proposalIds) {
    let taken = 0;
    const typeCount = new Map<string, number>(); // 한 시안 안에서 같은 섹션타입은 최대 2개(구조 다양성)
    for (const r of byProposal.get(pid) ?? []) {
      if (sections.length >= maxSections || taken >= perProposal) break;
      const tc = typeCount.get(r.sectionType) ?? 0;
      if (tc >= 2) continue;
      const desc = r.promptSnippet ?? r.summary ?? "";
      const key = `${r.sectionType}|${desc.toLowerCase().replace(/\s+/g, "").slice(0, 48)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      typeCount.set(r.sectionType, tc + 1);
      sections.push({
        proposalId: r.proposalId,
        proposalTitle: r.proposalTitle,
        sectionType: r.sectionType as SectionType,
        layoutType: r.layoutType,
        summary: r.summary,
        promptSnippet: r.promptSnippet,
      });
      taken += 1;
    }
    if (sections.length >= maxSections) break;
  }

  // 프롬프트에 바로 넣을 텍스트 줄. snippet/summary가 전혀 없는 섹션은 제외.
  const patternSnippets = sections
    .map((s) => {
      const desc = s.promptSnippet ?? s.summary;
      if (!desc) return null;
      const layout = s.layoutType ? ` (${s.layoutType})` : "";
      return `- [${s.sectionType}]${layout} ${desc}`;
    })
    .filter((x): x is string => x !== null);

  return { patternSnippets, sections };
}

import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalPageAnalysis, proposalSectionAnalysis } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { ANALYSIS_VERSION } from "../model/constants";
import type { AnalysisOverviewPage, AnalysisOverviewSection } from "../model/types";

// studio 분석 데이터 뷰어: 현재 버전 기준 analyzed된 페이지 + 그 섹션들을 중첩해 반환(읽기 전용, admin).
export async function getAnalysisOverview(): Promise<AnalysisOverviewPage[]> {
  await requireAdmin();

  const pages = await db
    .select({
      id: proposalPageAnalysis.id,
      proposalId: proposalPageAnalysis.proposalId,
      proposalTitle: proposals.title,
      industry: proposalPageAnalysis.industry,
      tone: proposalPageAnalysis.tone,
      styleKeywords: proposalPageAnalysis.styleKeywords,
      summary: proposalPageAnalysis.summary,
      model: proposalPageAnalysis.model,
      analyzedAt: proposalPageAnalysis.analyzedAt,
    })
    .from(proposalPageAnalysis)
    .innerJoin(proposals, eq(proposalPageAnalysis.proposalId, proposals.id))
    .where(
      and(
        eq(proposalPageAnalysis.status, "analyzed"),
        eq(proposalPageAnalysis.analysisVersion, ANALYSIS_VERSION),
      ),
    )
    .orderBy(desc(proposalPageAnalysis.analyzedAt));

  const pageIds = pages.map((p) => p.id);
  const sections = pageIds.length
    ? await db
        .select({
          pageAnalysisId: proposalSectionAnalysis.pageAnalysisId,
          sectionType: proposalSectionAnalysis.sectionType,
          layoutType: proposalSectionAnalysis.layoutType,
          summary: proposalSectionAnalysis.summary,
          promptSnippet: proposalSectionAnalysis.promptSnippet,
        })
        .from(proposalSectionAnalysis)
        .where(inArray(proposalSectionAnalysis.pageAnalysisId, pageIds))
        .orderBy(asc(proposalSectionAnalysis.orderIndex))
    : [];

  const byPage = new Map<string, AnalysisOverviewSection[]>();
  for (const s of sections) {
    const arr = byPage.get(s.pageAnalysisId) ?? [];
    arr.push({
      sectionType: s.sectionType,
      layoutType: s.layoutType,
      summary: s.summary,
      promptSnippet: s.promptSnippet,
    });
    byPage.set(s.pageAnalysisId, arr);
  }

  return pages.map((p) => ({
    id: p.id,
    proposalId: p.proposalId,
    proposalTitle: p.proposalTitle,
    industry: p.industry,
    tone: p.tone,
    styleKeywords: p.styleKeywords ?? [],
    summary: p.summary,
    model: p.model,
    analyzedAt: p.analyzedAt?.toISOString() ?? null,
    sections: byPage.get(p.id) ?? [],
  }));
}

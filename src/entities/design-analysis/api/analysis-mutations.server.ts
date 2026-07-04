// NOTE: 백필 스크립트(tsx)에서도 import하므로 "server-only"를 넣지 않는다(analyze-page.server.ts 참고).
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalPageAnalysis, proposalSectionAnalysis } from "@drizzle/schema";
import { ANALYSIS_VERSION } from "../model/constants";
import type { PageAnalysisResult } from "../model/schemas";
import type { PendingPage } from "../model/types";

// 분석 결과를 저장한다. (page_id, analysis_version) 유니크로 upsert → 페이지 분석 1행,
// 섹션은 재분석 시 이전 것을 교체(delete + insert, saveReferences와 같은 패턴).
export async function saveAnalysis(
  page: PendingPage,
  result: PageAnalysisResult,
  model: string,
): Promise<void> {
  const now = new Date();
  const overallSet = {
    proposalId: page.proposalId,
    versionId: page.versionId,
    industry: result.overall.industry ?? null,
    tone: result.overall.tone ?? null,
    styleKeywords: result.overall.styleKeywords,
    summary: result.overall.summary ?? null,
    promptSnippet: result.overall.promptSnippet ?? null,
    status: "analyzed" as const,
    model,
    errorMessage: null,
    analyzedAt: now,
    updatedAt: now,
  };

  const [row] = await db
    .insert(proposalPageAnalysis)
    .values({
      pageId: page.pageId,
      analysisVersion: ANALYSIS_VERSION,
      ...overallSet,
    })
    .onConflictDoUpdate({
      target: [proposalPageAnalysis.pageId, proposalPageAnalysis.analysisVersion],
      set: overallSet,
    })
    .returning({ id: proposalPageAnalysis.id });

  const pageAnalysisId = row.id;

  await db
    .delete(proposalSectionAnalysis)
    .where(eq(proposalSectionAnalysis.pageAnalysisId, pageAnalysisId));

  if (result.sections.length > 0) {
    await db.insert(proposalSectionAnalysis).values(
      result.sections.map((s, idx) => ({
        pageAnalysisId,
        proposalId: page.proposalId,
        sectionType: s.sectionType,
        orderIndex: idx,
        layoutType: s.layoutType ?? null,
        tone: s.tone ?? null,
        backgroundType: s.backgroundType ?? null,
        colorPalette: s.colorPalette,
        components: s.components,
        summary: s.summary ?? null,
        promptSnippet: s.promptSnippet ?? null,
      })),
    );
  }
}

// 분석 실패를 기록한다(같은 유니크로 upsert). status=failed면 다음 실행에서 재시도 대상.
export async function markPageFailed(page: PendingPage, message: string): Promise<void> {
  const now = new Date();
  await db
    .insert(proposalPageAnalysis)
    .values({
      pageId: page.pageId,
      proposalId: page.proposalId,
      versionId: page.versionId,
      analysisVersion: ANALYSIS_VERSION,
      status: "failed",
      errorMessage: message.slice(0, 500),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [proposalPageAnalysis.pageId, proposalPageAnalysis.analysisVersion],
      set: { status: "failed", errorMessage: message.slice(0, 500), updatedAt: now },
    });
}

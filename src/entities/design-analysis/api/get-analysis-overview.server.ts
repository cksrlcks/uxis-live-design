import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import {
  proposals,
  proposalVariants,
  proposalPages,
  proposalPageAnalysis,
  proposalSectionAnalysis,
} from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { ANALYSIS_VERSION } from "../model/constants";
import type {
  AnalysisOverview,
  AnalysisOverviewPage,
  AnalysisOverviewProposal,
  AnalysisOverviewSection,
} from "../model/types";

// studio 분석 데이터 뷰어(읽기 전용, admin).
// - 커버리지: "각 변형의 현재 버전 페이지"를 universe로 잡고(list-pending-pages와 동일 기준),
//   그중 몇 개가 analyzed됐는지 시안(proposal)·페이지 두 기준으로 센다.
// - 목록: analyzed된 페이지를 시안 단위로 묶고, 각 페이지 안 섹션은 order_index대로 정렬한다.
export async function getAnalysisOverview(): Promise<AnalysisOverview> {
  await requireAdmin();

  // 1) universe: 각 변형의 현재 버전 → 소속 시안 메타.
  const variantRows = await db
    .select({
      proposalId: proposals.id,
      proposalTitle: proposals.title,
      currentVersionId: proposalVariants.currentVersionId,
    })
    .from(proposalVariants)
    .innerJoin(proposals, eq(proposalVariants.proposalId, proposals.id));

  const versionMeta = new Map<string, { proposalId: string; proposalTitle: string }>();
  for (const v of variantRows) {
    if (v.currentVersionId) versionMeta.set(v.currentVersionId, { proposalId: v.proposalId, proposalTitle: v.proposalTitle });
  }
  const versionIds = [...versionMeta.keys()];

  // 2) universe 페이지(현재 버전들의 페이지, 순서대로).
  const pageRows = versionIds.length
    ? await db
        .select({ pageId: proposalPages.id, versionId: proposalPages.versionId, pageOrder: proposalPages.pageOrder })
        .from(proposalPages)
        .where(inArray(proposalPages.versionId, versionIds))
        .orderBy(asc(proposalPages.pageOrder))
    : [];

  const pageMeta = new Map<string, { proposalId: string; proposalTitle: string; pageOrder: number }>();
  const proposalIdsWithPages = new Set<string>();
  for (const p of pageRows) {
    const meta = versionMeta.get(p.versionId);
    if (!meta) continue;
    pageMeta.set(p.pageId, { ...meta, pageOrder: p.pageOrder });
    proposalIdsWithPages.add(meta.proposalId);
  }
  const universePageIds = [...pageMeta.keys()];

  // 3) universe 안에서 analyzed된 페이지 분석.
  const analyzed = universePageIds.length
    ? await db
        .select({
          id: proposalPageAnalysis.id,
          pageId: proposalPageAnalysis.pageId,
          industry: proposalPageAnalysis.industry,
          tone: proposalPageAnalysis.tone,
          styleKeywords: proposalPageAnalysis.styleKeywords,
          summary: proposalPageAnalysis.summary,
          model: proposalPageAnalysis.model,
          analyzedAt: proposalPageAnalysis.analyzedAt,
        })
        .from(proposalPageAnalysis)
        .where(
          and(
            inArray(proposalPageAnalysis.pageId, universePageIds),
            eq(proposalPageAnalysis.status, "analyzed"),
            eq(proposalPageAnalysis.analysisVersion, ANALYSIS_VERSION),
          ),
        )
        .orderBy(desc(proposalPageAnalysis.analyzedAt))
    : [];

  // 4) 섹션(분석별, 순서대로).
  const analysisIds = analyzed.map((a) => a.id);
  const sectionRows = analysisIds.length
    ? await db
        .select({
          pageAnalysisId: proposalSectionAnalysis.pageAnalysisId,
          sectionType: proposalSectionAnalysis.sectionType,
          layoutType: proposalSectionAnalysis.layoutType,
          summary: proposalSectionAnalysis.summary,
          promptSnippet: proposalSectionAnalysis.promptSnippet,
        })
        .from(proposalSectionAnalysis)
        .where(inArray(proposalSectionAnalysis.pageAnalysisId, analysisIds))
        .orderBy(asc(proposalSectionAnalysis.orderIndex))
    : [];

  const sectionsByAnalysis = new Map<string, AnalysisOverviewSection[]>();
  for (const s of sectionRows) {
    const arr = sectionsByAnalysis.get(s.pageAnalysisId) ?? [];
    arr.push({ sectionType: s.sectionType, layoutType: s.layoutType, summary: s.summary, promptSnippet: s.promptSnippet });
    sectionsByAnalysis.set(s.pageAnalysisId, arr);
  }

  // 5) 커버리지 집계.
  const analyzedProposalIds = new Set<string>();
  for (const a of analyzed) {
    const meta = pageMeta.get(a.pageId);
    if (meta) analyzedProposalIds.add(meta.proposalId);
  }
  const coverage = {
    proposalsTotal: proposalIdsWithPages.size,
    proposalsAnalyzed: analyzedProposalIds.size,
    pagesTotal: universePageIds.length,
    pagesAnalyzed: analyzed.length,
  };

  // 6) 시안 단위로 묶기(분석일 최신 시안 먼저, 시안 내부는 page_order 순).
  const byProposal = new Map<string, AnalysisOverviewProposal & { latestAnalyzedAt: number }>();
  for (const a of analyzed) {
    const meta = pageMeta.get(a.pageId);
    if (!meta) continue;
    const page: AnalysisOverviewPage = {
      id: a.id,
      pageId: a.pageId,
      pageOrder: meta.pageOrder,
      industry: a.industry,
      tone: a.tone,
      styleKeywords: a.styleKeywords ?? [],
      summary: a.summary,
      model: a.model,
      analyzedAt: a.analyzedAt?.toISOString() ?? null,
      sections: sectionsByAnalysis.get(a.id) ?? [],
    };
    const at = a.analyzedAt ? a.analyzedAt.getTime() : 0;
    const grp = byProposal.get(meta.proposalId);
    if (grp) {
      grp.pages.push(page);
      grp.latestAnalyzedAt = Math.max(grp.latestAnalyzedAt, at);
    } else {
      byProposal.set(meta.proposalId, {
        proposalId: meta.proposalId,
        proposalTitle: meta.proposalTitle,
        pages: [page],
        latestAnalyzedAt: at,
      });
    }
  }

  const proposalsOut: AnalysisOverviewProposal[] = [...byProposal.values()]
    .sort((a, b) => b.latestAnalyzedAt - a.latestAnalyzedAt)
    .map(({ latestAnalyzedAt: _drop, ...rest }) => {
      void _drop;
      return { ...rest, pages: rest.pages.sort((x, y) => x.pageOrder - y.pageOrder) };
    });

  return { coverage, proposals: proposalsOut };
}

// NOTE: 백필 스크립트(tsx)에서도 import하므로 "server-only"를 넣지 않는다(analyze-page.server.ts 참고).
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalPages, proposalPageAnalysis } from "@drizzle/schema";
import { ANALYSIS_VERSION } from "../model/constants";
import type { PendingPage } from "../model/types";
import { selectPendingPages } from "../lib/select-pending-pages";

// 현재 ANALYSIS_VERSION 기준으로 분석 대상 페이지를 조회한다.
// 대상은 각 변형의 "현재 버전" 페이지(옛 버전은 제외).
// - 기본: analyzed면 스킵, 없음/failed면 재분석 대상(미분석 전체 분석).
// - proposalId: 해당 시안만.
// - force: analyzed여도 포함(프로젝트별 재분석). 반드시 proposalId와 함께 쓴다.
// - onlyExposed=true면 exposed_to_uxisworks 시안만(대표 시안 위주 백필).
export async function listPendingPages(
  opts: { limit?: number; onlyExposed?: boolean; proposalId?: string; force?: boolean } = {},
): Promise<PendingPage[]> {
  const { limit = 200, onlyExposed = false, proposalId, force = false } = opts;

  // 1) 각 변형의 현재 버전 + 소속 시안 메타.
  const variantRows = await db
    .select({
      proposalId: proposals.id,
      proposalTitle: proposals.title,
      currentVersionId: proposalVariants.currentVersionId,
      exposed: proposals.exposedToUxisworks,
    })
    .from(proposalVariants)
    .innerJoin(proposals, eq(proposalVariants.proposalId, proposals.id));

  const versionMeta = new Map<string, { proposalId: string; proposalTitle: string }>();
  for (const v of variantRows) {
    if (!v.currentVersionId) continue;
    if (onlyExposed && !v.exposed) continue;
    if (proposalId && v.proposalId !== proposalId) continue; // 시안 좁히기(재분석 대상)
    versionMeta.set(v.currentVersionId, {
      proposalId: v.proposalId,
      proposalTitle: v.proposalTitle,
    });
  }
  const versionIds = [...versionMeta.keys()];
  if (versionIds.length === 0) return [];

  // 2) 현재 버전들의 페이지(순서대로).
  const pages = await db
    .select({
      pageId: proposalPages.id,
      versionId: proposalPages.versionId,
      storagePath: proposalPages.storagePath,
    })
    .from(proposalPages)
    .where(inArray(proposalPages.versionId, versionIds))
    .orderBy(asc(proposalPages.pageOrder));
  if (pages.length === 0) return [];

  // 3) 이미 analyzed된 page_id 집합(현재 analysis_version 기준).
  const analyzed = await db
    .select({ pageId: proposalPageAnalysis.pageId })
    .from(proposalPageAnalysis)
    .where(
      and(
        inArray(
          proposalPageAnalysis.pageId,
          pages.map((p) => p.pageId),
        ),
        eq(proposalPageAnalysis.analysisVersion, ANALYSIS_VERSION),
        eq(proposalPageAnalysis.status, "analyzed"),
      ),
    );
  const analyzedSet = new Set(analyzed.map((a) => a.pageId));

  // 4) 후보를 PendingPage로 만들고 순수 셀렉터에 위임한다.
  const candidates: PendingPage[] = [];
  for (const p of pages) {
    const meta = versionMeta.get(p.versionId);
    if (!meta) continue;
    candidates.push({
      pageId: p.pageId,
      proposalId: meta.proposalId,
      versionId: p.versionId,
      storagePath: p.storagePath,
      proposalTitle: meta.proposalTitle,
    });
  }
  return selectPendingPages(candidates, analyzedSet, { limit, proposalId, force });
}

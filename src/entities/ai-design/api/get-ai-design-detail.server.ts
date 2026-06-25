import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import {
  aiDesigns,
  aiDesignReferenceProposals,
  aiDesignTags,
  profiles,
  tagGroups,
  tagOptions,
} from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import type { AiDesignDetail, AiDesignReferenceProposal, AiDesignTagGroupView } from "../model/types";
import type { PageType, AiDesignStatus } from "../model/constants";

// 상세 — 생성 시 입력한 사전정보(제목·회사·유형·태그·추가요청)와 상태/결과 메타를 모은다.
export async function getAiDesignDetail(id: string): Promise<AiDesignDetail> {
  await requireAdmin();

  const [row] = await db
    .select({
      id: aiDesigns.id,
      title: aiDesigns.title,
      company: aiDesigns.company,
      pageType: aiDesigns.pageType,
      extraNotes: aiDesigns.extraNotes,
      status: aiDesigns.status,
      errorMessage: aiDesigns.errorMessage,
      model: aiDesigns.model,
      analysis: aiDesigns.analysis,
      approach: aiDesigns.approach,
      // 큰 html 본문은 가져오지 않고 존재 여부만 SQL로 계산한다(목록 쿼리와 동일).
      hasHtml: sql<boolean>`(${aiDesigns.html} is not null)`,
      requesterName: profiles.displayName,
      requesterEmail: profiles.email,
      createdAt: aiDesigns.createdAt,
      updatedAt: aiDesigns.updatedAt,
    })
    .from(aiDesigns)
    .leftJoin(profiles, eq(profiles.id, aiDesigns.createdBy))
    .where(eq(aiDesigns.id, id))
    .limit(1);

  if (!row) throw new Error("NOT_FOUND");

  // 선택했던 태그를 구분(group)별로 묶는다 — 구분/옵션 정렬 순서를 유지.
  const tagRows = await db
    .select({
      groupId: tagGroups.id,
      groupLabel: tagGroups.label,
      groupSort: tagGroups.sortOrder,
      optionId: tagOptions.id,
      optionLabel: tagOptions.label,
      optionSort: tagOptions.sortOrder,
    })
    .from(aiDesignTags)
    .innerJoin(tagOptions, eq(tagOptions.id, aiDesignTags.optionId))
    .innerJoin(tagGroups, eq(tagGroups.id, tagOptions.groupId))
    .where(eq(aiDesignTags.aiDesignId, id))
    .orderBy(asc(tagGroups.sortOrder), asc(tagOptions.sortOrder));

  const byGroup = new Map<string, AiDesignTagGroupView>();
  for (const t of tagRows) {
    let g = byGroup.get(t.groupId);
    if (!g) {
      g = { groupId: t.groupId, groupLabel: t.groupLabel, options: [] };
      byGroup.set(t.groupId, g);
    }
    g.options.push({ id: t.optionId, label: t.optionLabel });
  }

  const refRows = await db
    .select({
      proposalId: aiDesignReferenceProposals.proposalId,
      proposalTitle: aiDesignReferenceProposals.proposalTitle,
      imageUrl: aiDesignReferenceProposals.imageUrl,
      sortOrder: aiDesignReferenceProposals.sortOrder,
    })
    .from(aiDesignReferenceProposals)
    .where(eq(aiDesignReferenceProposals.aiDesignId, id))
    .orderBy(asc(aiDesignReferenceProposals.sortOrder));

  const referenceProposals: AiDesignReferenceProposal[] = refRows.map((r) => ({
    proposalId: r.proposalId,
    proposalTitle: r.proposalTitle,
    imageUrl: r.imageUrl,
    sortOrder: r.sortOrder,
  }));

  return {
    id: row.id,
    title: row.title,
    company: row.company,
    pageType: row.pageType as PageType,
    extraNotes: row.extraNotes,
    status: row.status as AiDesignStatus,
    errorMessage: row.errorMessage,
    model: row.model,
    analysis: row.analysis,
    approach: row.approach,
    hasHtml: row.hasHtml,
    requestedBy: row.requesterName ?? row.requesterEmail ?? null,
    tagGroups: [...byGroup.values()],
    referenceProposals,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

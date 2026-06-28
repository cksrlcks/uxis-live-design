import "server-only";
import { and, asc, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import {
  proposals,
  proposalPages,
  proposalTags,
  proposalVariants,
  tagGroups,
  tagOptions,
} from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { thumbnailUrl } from "@/shared/lib/proposals/constants";
import { taggingPercent } from "../lib/tagging-progress";
import {
  PROPOSALS_PAGE_SIZE,
  type Paginated,
  type ProposalCover,
  type ProposalListItem,
} from "../model/types";

export async function getProposals(
  page = 1,
  pageSize = PROPOSALS_PAGE_SIZE,
  search = "",
  year?: number,
  visibility?: "public" | "private",
): Promise<Paginated<ProposalListItem>> {
  await requireEditor();

  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));

  // 제목·참여자·공개 도메인을 대소문자 무시(ILIKE)로 부분 검색. 값은 바인딩되어
  // 안전하며, LIKE 메타문자(% _ \)만 이스케이프해 와일드카드 주입을 막는다.
  const term = search.trim();
  const searchWhere = term
    ? or(
        ilike(proposals.title, `%${escapeLike(term)}%`),
        ilike(proposals.participants, `%${escapeLike(term)}%`),
        ilike(proposals.domain, `%${escapeLike(term)}%`),
      )
    : undefined;

  const yearWhere = year !== undefined ? eq(proposals.workYear, year) : undefined;
  const visWhere = visibility !== undefined ? eq(proposals.visibility, visibility) : undefined;

  const where = and(searchWhere, yearWhere, visWhere);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(proposals)
    .where(where);

  // 전체 구분 수(분모). 태그 구분이 없으면 0 → 진행률 0.
  const [{ totalGroups }] = await db
    .select({ totalGroups: sql<number>`count(*)::int` })
    .from(tagGroups);

  // 시안별로 태그가 1개 이상 달린 구분 수를 집계(LEFT JOIN → 태그 없으면 0).
  const rows = await db
    .select({
      ...getTableColumns(proposals),
      taggedGroups: sql<number>`count(distinct ${tagOptions.groupId})::int`,
    })
    .from(proposals)
    .leftJoin(proposalTags, eq(proposalTags.proposalId, proposals.id))
    .leftJoin(tagOptions, eq(tagOptions.id, proposalTags.optionId))
    .where(where)
    .groupBy(proposals.id)
    // 작성일(createdAt) 기준 고정 정렬. 태그 수정 등으로 updatedAt이 바뀌어도
    // 순서가 흔들리지 않게 하고, 동률 작성일은 id로 tie-break해 결정적으로 만든다.
    .orderBy(desc(proposals.createdAt), desc(proposals.id))
    .limit(safeSize)
    .offset((safePage - 1) * safeSize);

  const coverByProposal = await getCoversByProposal(rows.map((r) => r.id));

  const items: ProposalListItem[] = rows.map(({ taggedGroups, ...p }) => ({
    ...p,
    taggingProgress: taggingPercent(taggedGroups, totalGroups),
    cover: coverByProposal.get(p.id) ?? null,
  }));

  return { items, total, page: safePage, pageSize: safeSize };
}

// 시안별 대표 이미지(커버) 1장: sortOrder 순으로 currentVersion이 있는 첫 안의 첫 페이지.
// 공개 갤러리(getPublicProposals)와 동일한 선택 규칙. url은 리사이즈 썸네일.
async function getCoversByProposal(
  proposalIds: string[],
): Promise<Map<string, ProposalCover>> {
  if (proposalIds.length === 0) return new Map();

  const variants = await db
    .select({
      proposalId: proposalVariants.proposalId,
      currentVersionId: proposalVariants.currentVersionId,
    })
    .from(proposalVariants)
    .where(inArray(proposalVariants.proposalId, proposalIds))
    .orderBy(asc(proposalVariants.proposalId), asc(proposalVariants.sortOrder));

  // 시안 → 커버 후보 버전들(sortOrder 순, currentVersion 있는 것만).
  const candidateVersionsByProposal = new Map<string, string[]>();
  for (const v of variants) {
    if (!v.currentVersionId) continue;
    const list = candidateVersionsByProposal.get(v.proposalId) ?? [];
    list.push(v.currentVersionId);
    candidateVersionsByProposal.set(v.proposalId, list);
  }

  const candidateVersionIds = [...candidateVersionsByProposal.values()].flat();
  if (candidateVersionIds.length === 0) return new Map();

  const coverRows = await db
    .select({
      versionId: proposalPages.versionId,
      storagePath: proposalPages.storagePath,
      width: proposalPages.width,
      height: proposalPages.height,
    })
    .from(proposalPages)
    .where(inArray(proposalPages.versionId, candidateVersionIds))
    .orderBy(asc(proposalPages.pageOrder));

  // 버전별 첫 페이지(정렬상 첫 행 = pageOrder 최소).
  const firstPageByVersion = new Map<string, ProposalCover>();
  for (const pg of coverRows) {
    if (firstPageByVersion.has(pg.versionId)) continue;
    firstPageByVersion.set(pg.versionId, {
      // resize:"contain" — 가로폭(640)만 제한하고 비율을 유지해 좌우가 잘리지 않게 한다.
      // (기본 "cover"는 변환 단계에서 원본을 잘라 가져오므로 너비가 보존되지 않음)
      url: thumbnailUrl(pg.storagePath, { width: 640, quality: 70, resize: "contain" }),
      width: pg.width,
      height: pg.height,
    });
  }

  const covers = new Map<string, ProposalCover>();
  for (const [proposalId, versionIds] of candidateVersionsByProposal) {
    for (const versionId of versionIds) {
      const cover = firstPageByVersion.get(versionId);
      if (cover) {
        covers.set(proposalId, cover);
        break;
      }
    }
  }
  return covers;
}

// ILIKE 패턴에서 와일드카드(%/_)와 이스케이프 문자(\)를 리터럴로 처리한다.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

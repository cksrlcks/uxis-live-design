import "server-only";
import { desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalTags, tagGroups, tagOptions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { taggingPercent } from "../lib/tagging-progress";
import { PROPOSALS_PAGE_SIZE, type Paginated, type ProposalListItem } from "../model/types";

export async function getProposals(
  page = 1,
  pageSize = PROPOSALS_PAGE_SIZE,
  search = "",
): Promise<Paginated<ProposalListItem>> {
  await requireEditor();

  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));

  // 제목·참여자·공개 도메인을 대소문자 무시(ILIKE)로 부분 검색. 값은 바인딩되어
  // 안전하며, LIKE 메타문자(% _ \)만 이스케이프해 와일드카드 주입을 막는다.
  const term = search.trim();
  const where = term
    ? or(
        ilike(proposals.title, `%${escapeLike(term)}%`),
        ilike(proposals.participants, `%${escapeLike(term)}%`),
        ilike(proposals.domain, `%${escapeLike(term)}%`),
      )
    : undefined;

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

  const items: ProposalListItem[] = rows.map(({ taggedGroups, ...p }) => ({
    ...p,
    taggingProgress: taggingPercent(taggedGroups, totalGroups),
  }));

  return { items, total, page: safePage, pageSize: safeSize };
}

// ILIKE 패턴에서 와일드카드(%/_)와 이스케이프 문자(\)를 리터럴로 처리한다.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

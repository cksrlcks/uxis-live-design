import "server-only";
import { desc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, type Proposal } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { PROPOSALS_PAGE_SIZE, type Paginated } from "../model/types";

export async function getProposals(
  page = 1,
  pageSize = PROPOSALS_PAGE_SIZE,
  search = "",
): Promise<Paginated<Proposal>> {
  await requireEditor();

  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));

  // 제목·참여자·공개 도메인을 대소문자 무시(ILIKE)로 부분 검색. 값은 바인딩되어
  // 안전하며, LIKE 메타문자(% _ \)만 이스케이프해 사용자가 와일드카드를 주입하지 못하게 한다.
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

  const items = await db
    .select()
    .from(proposals)
    .where(where)
    .orderBy(desc(proposals.updatedAt))
    .limit(safeSize)
    .offset((safePage - 1) * safeSize);

  return { items, total, page: safePage, pageSize: safeSize };
}

// ILIKE 패턴에서 와일드카드(%/_)와 이스케이프 문자(\)를 리터럴로 처리한다.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

import "server-only";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns, profiles } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { AI_DESIGNS_PAGE_SIZE, type PaginatedAiDesigns } from "../model/types";
import type { PageType, AiDesignStatus } from "../model/constants";

export async function listAiDesigns(
  page = 1,
  pageSize = AI_DESIGNS_PAGE_SIZE,
  search = "",
): Promise<PaginatedAiDesigns> {
  await requireAdmin();

  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));

  // 제목·회사명·요청자(표시명/이메일)를 대소문자 무시(ILIKE)로 부분 검색. 값은 바인딩되어
  // 안전하며, LIKE 메타문자(% _ \)만 이스케이프해 와일드카드 주입을 막는다.
  const term = search.trim();
  const where = term
    ? or(
        ilike(aiDesigns.title, `%${escapeLike(term)}%`),
        ilike(aiDesigns.company, `%${escapeLike(term)}%`),
        ilike(profiles.displayName, `%${escapeLike(term)}%`),
        ilike(profiles.email, `%${escapeLike(term)}%`),
      )
    : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(aiDesigns)
    .leftJoin(profiles, eq(profiles.id, aiDesigns.createdBy))
    .where(where);

  // 목록은 html 본문을 싣지 않는다(클 수 있음) — 존재 여부만 SQL로 계산한다.
  const rows = await db
    .select({
      id: aiDesigns.id,
      title: aiDesigns.title,
      company: aiDesigns.company,
      pageType: aiDesigns.pageType,
      status: aiDesigns.status,
      hasHtml: sql<boolean>`(${aiDesigns.html} is not null)`,
      errorMessage: aiDesigns.errorMessage,
      requesterName: profiles.displayName,
      requesterEmail: profiles.email,
      createdAt: aiDesigns.createdAt,
      updatedAt: aiDesigns.updatedAt,
    })
    .from(aiDesigns)
    .leftJoin(profiles, eq(profiles.id, aiDesigns.createdBy))
    .where(where)
    // 작성일 기준 고정 정렬, 동률은 id로 tie-break해 결정적으로 만든다.
    .orderBy(desc(aiDesigns.createdAt), desc(aiDesigns.id))
    .limit(safeSize)
    .offset((safePage - 1) * safeSize);

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    pageType: r.pageType as PageType,
    status: r.status as AiDesignStatus,
    hasHtml: r.hasHtml,
    errorMessage: r.errorMessage,
    requestedBy: r.requesterName ?? r.requesterEmail ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return { items, total, page: safePage, pageSize: safeSize };
}

// ILIKE 패턴에서 와일드카드(%/_)와 이스케이프 문자(\)를 리터럴로 처리한다.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

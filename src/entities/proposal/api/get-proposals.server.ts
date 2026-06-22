import "server-only";
import { desc, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, type Proposal } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { PROPOSALS_PAGE_SIZE, type Paginated } from "../model/types";

export async function getProposals(
  page = 1,
  pageSize = PROPOSALS_PAGE_SIZE,
): Promise<Paginated<Proposal>> {
  await requireEditor();

  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(proposals);

  const items = await db
    .select()
    .from(proposals)
    .orderBy(desc(proposals.updatedAt))
    .limit(safeSize)
    .offset((safePage - 1) * safeSize);

  return { items, total, page: safePage, pageSize: safeSize };
}

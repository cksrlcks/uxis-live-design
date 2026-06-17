import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pinComments } from "@/drizzle/schema";
import type { PinDTO } from "@/lib/pins/types";

// 한 안의 한 버전 핀 전체를 오래된→최신 순으로 DTO 반환.
export async function loadPinsForVersion(variantId: string, versionId: string): Promise<PinDTO[]> {
  const rows = await db
    .select()
    .from(pinComments)
    .where(and(eq(pinComments.variantId, variantId), eq(pinComments.versionId, versionId)))
    .orderBy(asc(pinComments.createdAt));
  return rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    versionId: r.versionId,
    pageOrder: r.pageOrder,
    xNorm: r.xNorm,
    yNorm: r.yNorm,
    authorId: r.authorId,
    authorName: r.authorName,
    authorColor: r.authorColor,
    body: r.body,
    resolved: r.resolved,
    createdAt: r.createdAt.toISOString(),
  }));
}

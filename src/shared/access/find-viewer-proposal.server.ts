import "server-only";
import { eq, or } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, type Proposal } from "@drizzle/schema";

// 뷰어 식별자 해석: publicId 또는 공개 도메인 슬러그로 시안을 찾는다.
// publicId 정확 일치를 우선해 (도메인이 다른 시안의 publicId와 충돌하는 극단적 경우) 안전하게 분기.
export async function findViewerProposal(idOrDomain: string): Promise<Proposal | null> {
  if (!idOrDomain) return null;
  const rows = await db
    .select()
    .from(proposals)
    .where(or(eq(proposals.publicId, idOrDomain), eq(proposals.domain, idOrDomain)))
    .limit(2);
  if (rows.length === 0) return null;
  return rows.find((r) => r.publicId === idOrDomain) ?? rows[0];
}

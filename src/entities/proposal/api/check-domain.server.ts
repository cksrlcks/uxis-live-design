import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { domainSchema } from "../model/create-schema";

// 도메인 슬러그 사용 가능 여부 — 형식 검증 후 자기 자신 제외하고 중복 조회.
export async function checkDomainAvailable(
  rawDomain: unknown,
  excludeId?: string,
): Promise<{ available: boolean }> {
  await requireEditor();
  const domain = domainSchema.parse(rawDomain);

  const taken = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(excludeId ? and(eq(proposals.domain, domain), ne(proposals.id, excludeId)) : eq(proposals.domain, domain))
    .limit(1);

  return { available: taken.length === 0 };
}

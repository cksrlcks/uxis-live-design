import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { variantTags } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import type { ProposalTags } from "../model/types";

// 안(variant) 단위 태그 조회.
export async function getVariantTags(variantId: string): Promise<ProposalTags> {
  await requireEditor();
  const rows = await db
    .select({ optionId: variantTags.optionId })
    .from(variantTags)
    .where(eq(variantTags.variantId, variantId));
  return { optionIds: rows.map((r) => r.optionId) };
}

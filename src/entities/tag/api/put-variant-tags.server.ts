import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { variantTags } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { proposalTagsSchema } from "../model/schemas";
import { diffSelection } from "../lib/diff-selection";

// 안(variant) 단위 태그 저장 — diff 기반 add/remove.
export async function putVariantTags(variantId: string, input: unknown): Promise<void> {
  const editor = await requireEditor();
  const { optionIds } = proposalTagsSchema.parse(input);

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ optionId: variantTags.optionId })
      .from(variantTags)
      .where(eq(variantTags.variantId, variantId));

    const { toAdd, toRemove } = diffSelection(
      existing.map((r) => r.optionId),
      optionIds,
    );

    if (toRemove.length) {
      await tx
        .delete(variantTags)
        .where(and(eq(variantTags.variantId, variantId), inArray(variantTags.optionId, toRemove)));
    }
    if (toAdd.length) {
      await tx
        .insert(variantTags)
        .values(toAdd.map((optionId) => ({ variantId, optionId, createdBy: editor.id })));
    }
  });
}

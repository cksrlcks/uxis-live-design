import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalTags } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { proposalTagsSchema } from "../model/schemas";
import { diffSelection } from "../lib/diff-selection";

export async function putProposalTags(proposalId: string, input: unknown): Promise<void> {
  const editor = await requireEditor();
  const { optionIds } = proposalTagsSchema.parse(input);

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ optionId: proposalTags.optionId })
      .from(proposalTags)
      .where(eq(proposalTags.proposalId, proposalId));

    const { toAdd, toRemove } = diffSelection(
      existing.map((r) => r.optionId),
      optionIds,
    );

    if (toRemove.length) {
      await tx
        .delete(proposalTags)
        .where(
          and(eq(proposalTags.proposalId, proposalId), inArray(proposalTags.optionId, toRemove)),
        );
    }
    if (toAdd.length) {
      await tx
        .insert(proposalTags)
        .values(toAdd.map((optionId) => ({ proposalId, optionId, createdBy: editor.id })));
    }
  });
}

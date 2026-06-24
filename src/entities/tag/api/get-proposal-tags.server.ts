import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalTags } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import type { ProposalTags } from "../model/types";

export async function getProposalTags(proposalId: string): Promise<ProposalTags> {
  await requireEditor();
  const rows = await db
    .select({ optionId: proposalTags.optionId })
    .from(proposalTags)
    .where(eq(proposalTags.proposalId, proposalId));
  return { optionIds: rows.map((r) => r.optionId) };
}

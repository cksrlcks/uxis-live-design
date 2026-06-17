import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, type Proposal } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";

export async function getProposals(): Promise<Proposal[]> {
  await requireEditor();
  return db.select().from(proposals).orderBy(desc(proposals.updatedAt));
}

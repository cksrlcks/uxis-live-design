import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { pinComments } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { getProfile } from "@/shared/auth/guards.server";

export async function deletePinComment(publicId: string, pinId: string): Promise<{ id: string }> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  const profile = await getProfile();
  if (!profile) throw new Error("LOGIN_REQUIRED");
  const rows = await db
    .select()
    .from(pinComments)
    .where(and(eq(pinComments.id, pinId), eq(pinComments.proposalId, proposal.id)))
    .limit(1);
  const pin = rows[0];
  if (!pin) throw new Error("NOT_FOUND");
  if (pin.authorId !== profile.id) throw new Error("NOT_AUTHOR");
  await db.delete(pinComments).where(eq(pinComments.id, pinId));
  return { id: pinId };
}

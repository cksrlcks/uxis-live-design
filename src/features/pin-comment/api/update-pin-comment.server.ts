import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { pinComments } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { getProfile } from "@/shared/auth/guards.server";
import { patchPinInputSchema } from "@/entities/pin";
import type { PinDTO } from "@/entities/pin";

// Verbatim from the legacy [pinId]/route.ts toDTO.
function toDTO(r: typeof pinComments.$inferSelect): PinDTO {
  return {
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
  };
}

export async function updatePinComment(
  publicId: string,
  pinId: string,
  raw: unknown,
): Promise<PinDTO> {
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

  const input = patchPinInputSchema.parse(raw);
  if ("body" in input) {
    if (pin.authorId !== profile.id) throw new Error("NOT_AUTHOR");
    await db.update(pinComments).set({ body: input.body }).where(eq(pinComments.id, pinId));
    return toDTO({ ...pin, body: input.body });
  }
  await db.update(pinComments).set({ resolved: input.resolved }).where(eq(pinComments.id, pinId));
  return toDTO({ ...pin, resolved: input.resolved });
}

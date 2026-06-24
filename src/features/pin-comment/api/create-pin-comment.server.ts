import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { pinComments, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { getProfile } from "@/shared/auth/guards.server";
import { createPinInputSchema } from "@/entities/pin";
import type { PinDTO } from "@/entities/pin";

export async function createPinComment(publicId: string, raw: unknown): Promise<PinDTO> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  const profile = await getProfile();
  if (!profile) throw new Error("LOGIN_REQUIRED");

  const { variantId, versionId, pageOrder, xNorm, yNorm, wNorm, hNorm, authorColor, body } =
    createPinInputSchema.parse(raw);

  const v = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id)))
    .limit(1);
  if (v.length === 0) throw new Error("NOT_FOUND");
  const ver = await db
    .select({ id: proposalVersions.id })
    .from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.variantId, variantId)))
    .limit(1);
  if (ver.length === 0) throw new Error("NOT_FOUND");
  const pg = await db
    .select({ id: proposalPages.id })
    .from(proposalPages)
    .where(and(eq(proposalPages.versionId, versionId), eq(proposalPages.pageOrder, pageOrder)))
    .limit(1);
  if (pg.length === 0) throw new Error("BAD_PAGE");

  const id = randomUUID();
  const createdAt = new Date();
  const authorName = profile.displayName ?? profile.email.split("@")[0] ?? "사용자";
  // 시안 밖 핀을 허용하므로 0..1로 강제하지 않는다(범위는 createPinInputSchema가 보장).
  await db.insert(pinComments).values({
    id,
    proposalId: proposal.id,
    variantId,
    versionId,
    pageOrder,
    xNorm,
    yNorm,
    wNorm: wNorm ?? null,
    hNorm: hNorm ?? null,
    authorId: profile.id,
    authorName,
    authorColor,
    body,
    createdAt,
  });
  return {
    id,
    variantId,
    versionId,
    pageOrder,
    xNorm,
    yNorm,
    wNorm: wNorm ?? null,
    hNorm: hNorm ?? null,
    authorId: profile.id,
    authorName,
    authorColor,
    body,
    resolved: false,
    createdAt: createdAt.toISOString(),
  };
}

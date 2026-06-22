import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { whiteboardStrokes, proposalVariants, proposalVersions } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import type { StrokeDTO } from "../model/types";

export async function getStrokes(
  publicId: string,
  variantId: string,
  versionId: string,
): Promise<StrokeDTO[]> {
  // Gate FIRST (legacy ordering — never validate/query before the access check).
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  if (!variantId || !versionId) throw new Error("BAD_QUERY"); // 400 (mapped in to-error-response)

  // membership: variant ∈ proposal, version ∈ variant
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

  const rows = await db
    .select()
    .from(whiteboardStrokes)
    .where(and(eq(whiteboardStrokes.variantId, variantId), eq(whiteboardStrokes.versionId, versionId)))
    .orderBy(asc(whiteboardStrokes.createdAt), asc(whiteboardStrokes.id));
  return rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    versionId: r.versionId,
    pageOrder: r.pageOrder,
    points: r.points,
    color: r.color,
    width: r.width,
    authorId: r.authorId,
    authorName: r.authorName,
    authorColor: r.authorColor,
    createdAt: r.createdAt.toISOString(),
  }));
}

import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { whiteboardStrokes, proposalVariants, proposalVersions } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import type { StrokeDTO, StoredStroke } from "../model/types";
import { flattenLayers, type LayerRow } from "./flatten";

export async function getStrokes(
  publicId: string,
  variantId: string,
  versionId: string,
): Promise<StrokeDTO[]> {
  // Gate FIRST (legacy ordering — never validate/query before the access check).
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  // 라이브 모드 OFF → 협업 데이터를 일절 제공하지 않는다(클라이언트 우회 차단).
  if (!proposal.liveMode) return [];
  if (!variantId || !versionId) throw new Error("BAD_QUERY");

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
    .orderBy(asc(whiteboardStrokes.updatedAt), asc(whiteboardStrokes.id));

  const layers: LayerRow[] = rows.map((r) => ({
    variantId: r.variantId,
    versionId: r.versionId,
    pageOrder: r.pageOrder,
    authorId: r.authorId,
    authorName: r.authorName,
    authorColor: r.authorColor,
    strokes: r.strokes as StoredStroke[],
    updatedAt: r.updatedAt,
  }));
  return flattenLayers(layers);
}

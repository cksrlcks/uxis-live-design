import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/legacy/lib/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/legacy/lib/auth/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  let editor;
  try {
    editor = await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id, variantId } = await params;
  const body = await req.json();
  const versionId = String(body.versionId ?? "");

  // Source version must belong to this variant, which must belong to this proposal.
  const src = await db.select({ id: proposalVersions.id, versionNo: proposalVersions.versionNo })
    .from(proposalVersions)
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(and(
      eq(proposalVersions.id, versionId),
      eq(proposalVariants.id, variantId),
      eq(proposalVariants.proposalId, id),
    )).limit(1);
  if (src.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const srcPages = await db.select().from(proposalPages)
    .where(eq(proposalPages.versionId, versionId)).orderBy(asc(proposalPages.pageOrder));

  const last = await db.select({ v: proposalVersions.versionNo }).from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId)).orderBy(desc(proposalVersions.versionNo)).limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const newVid = randomUUID();
  await db.insert(proposalVersions).values({
    id: newVid, variantId, versionNo: nextNo, note: `v${src[0].versionNo}에서 복원`, createdBy: editor.id,
  });
  if (srcPages.length > 0) {
    // Reuse the same storage objects (no re-upload) — copy only the rows.
    await db.insert(proposalPages).values(
      srcPages.map((p) => ({
        id: randomUUID(),
        versionId: newVid,
        pageOrder: p.pageOrder,
        storagePath: p.storagePath,
        width: p.width,
        height: p.height,
      })),
    );
  }
  await db.update(proposalVariants).set({ currentVersionId: newVid }).where(eq(proposalVariants.id, variantId));
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));

  return NextResponse.json({ ok: true, versionId: newVid, versionNo: nextNo });
}

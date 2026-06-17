import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { removeObjects } from "@/shared/storage";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id, variantId } = await params;
  const body = await req.json();

  const updates: Partial<typeof proposalVariants.$inferInsert> = {};
  if (typeof body.label === "string") {
    const l = body.label.trim();
    if (!l) return NextResponse.json({ error: "LABEL_REQUIRED" }, { status: 400 });
    updates.label = l;
  }
  if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder)) {
    updates.sortOrder = body.sortOrder;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }
  await db.update(proposalVariants).set(updates)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id, variantId } = await params;

  const all = await db.select({ id: proposalVariants.id }).from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id));
  if (all.length <= 1) return NextResponse.json({ error: "LAST_VARIANT" }, { status: 409 });
  if (!all.some((v) => v.id === variantId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const pages = await db.select({ path: proposalPages.storagePath }).from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalPages.versionId, proposalVersions.id))
    .where(eq(proposalVersions.variantId, variantId));
  await removeObjects([...new Set(pages.map((p) => p.path))]); // best-effort before row delete
  await db.delete(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id))); // cascade: versions + pages

  return NextResponse.json({ ok: true });
}

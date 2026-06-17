import { NextRequest, NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/legacy/lib/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/legacy/lib/auth/session";
import { hashPassword } from "@/legacy/lib/access/password";
import { removeObjects } from "@/legacy/lib/proposals/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const variants = await db.select().from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id)).orderBy(asc(proposalVariants.sortOrder));
  const variantIds = variants.map((v) => v.id);
  const versions = variantIds.length
    ? await db.select().from(proposalVersions)
        .where(inArray(proposalVersions.variantId, variantIds)).orderBy(asc(proposalVersions.versionNo))
    : [];
  return NextResponse.json({ proposal: rows[0], variants, versions });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const updates: Partial<typeof proposals.$inferInsert> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
    updates.title = t;
  }
  if (typeof body.visibility === "string") {
    if (body.visibility !== "private" && body.visibility !== "public") {
      return NextResponse.json({ error: "INVALID_VISIBILITY" }, { status: 400 });
    }
    updates.visibility = body.visibility;
  }
  if ("password" in body) {
    if (body.password === null) {
      updates.accessPasswordHash = null;
    } else if (typeof body.password === "string" && body.password.length >= 4) {
      updates.accessPasswordHash = hashPassword(body.password);
    } else {
      return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 400 });
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }
  updates.updatedAt = new Date();
  await db.update(proposals).set(updates).where(eq(proposals.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const pages = await db.select({ path: proposalPages.storagePath }).from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalPages.versionId, proposalVersions.id))
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(eq(proposalVariants.proposalId, id));
  const paths = [...new Set(pages.map((p) => p.path))];
  await removeObjects(paths); // best-effort cleanup before row delete
  await db.delete(proposals).where(eq(proposals.id, id)); // cascade removes versions + pages
  return NextResponse.json({ ok: true });
}

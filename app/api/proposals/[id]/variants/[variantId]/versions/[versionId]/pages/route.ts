import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { listObjectNames } from "@/shared/storage";

type PageInput = { pageId: string; pageOrder: number; path: string; width: number; height: number };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string; versionId: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id, variantId, versionId } = await params;
  const ver = await db.select({ id: proposalVersions.id }).from(proposalVersions)
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(and(
      eq(proposalVersions.id, versionId),
      eq(proposalVariants.id, variantId),
      eq(proposalVariants.proposalId, id),
    )).limit(1);
  if (ver.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json();
  const pages: PageInput[] = Array.isArray(body.pages) ? body.pages : [];
  if (pages.length === 0) return NextResponse.json({ error: "NO_PAGES" }, { status: 400 });

  // Verify every page references a real uploaded object under this version's folder
  // (path scheme unchanged: {proposalId}/{versionId}/{pageId}).
  const prefix = `${id}/${versionId}`;
  const existing = await listObjectNames(prefix);
  for (const p of pages) {
    const name = String(p.path).startsWith(`${prefix}/`) ? String(p.path).slice(prefix.length + 1) : "";
    if (!name || name.includes("/") || !existing.has(name)) {
      return NextResponse.json({ error: "OBJECT_MISSING", path: p.path }, { status: 400 });
    }
  }

  await db.insert(proposalPages).values(
    pages.map((p) => ({
      id: String(p.pageId),
      versionId,
      pageOrder: Number(p.pageOrder),
      storagePath: String(p.path),
      width: Number(p.width),
      height: Number(p.height),
    })),
  );
  await db.update(proposalVariants).set({ currentVersionId: versionId }).where(eq(proposalVariants.id, variantId));
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));

  return NextResponse.json({ ok: true });
}

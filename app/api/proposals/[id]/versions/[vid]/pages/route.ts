import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVersions, proposalPages } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";

type PageInput = { pageId: string; pageOrder: number; path: string; width: number; height: number };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id, vid } = await params;
  const ver = await db.select().from(proposalVersions)
    .where(and(eq(proposalVersions.id, vid), eq(proposalVersions.proposalId, id)))
    .limit(1);
  if (ver.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json();
  const pages: PageInput[] = Array.isArray(body.pages) ? body.pages : [];
  if (pages.length === 0) return NextResponse.json({ error: "NO_PAGES" }, { status: 400 });

  await db.insert(proposalPages).values(
    pages.map((p) => ({
      id: String(p.pageId),
      versionId: vid,
      pageOrder: Number(p.pageOrder),
      storagePath: String(p.path),
      width: Number(p.width),
      height: Number(p.height),
    })),
  );
  await db.update(proposals).set({ currentVersionId: vid, updatedAt: new Date() }).where(eq(proposals.id, id));

  return NextResponse.json({ ok: true });
}

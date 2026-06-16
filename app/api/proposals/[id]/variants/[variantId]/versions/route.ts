import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposalVariants, proposalVersions } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";
import { extForContentType, pagePath, MAX_PAGE_BYTES } from "@/lib/proposals/constants";
import { createUploadUrl } from "@/lib/proposals/storage";

type FileSpec = { contentType: string; size: number };

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
  const variant = await db.select({ id: proposalVariants.id }).from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id))).limit(1);
  if (variant.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json();
  const note = body.note ? String(body.note).trim() : null;
  const files: FileSpec[] = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) return NextResponse.json({ error: "NO_FILES" }, { status: 400 });
  for (const f of files) {
    if (!extForContentType(String(f.contentType))) return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
    if (Number(f.size) > MAX_PAGE_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const last = await db.select({ v: proposalVersions.versionNo }).from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId)).orderBy(desc(proposalVersions.versionNo)).limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const versionId = randomUUID();
  await db.insert(proposalVersions).values({ id: versionId, variantId, versionNo: nextNo, note, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(String(files[i].contentType))!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return NextResponse.json({ versionId, versionNo: nextNo, uploads });
}

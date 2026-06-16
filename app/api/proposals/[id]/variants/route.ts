import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVariants, proposalVersions } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";
import { extForContentType, pagePath, MAX_PAGE_BYTES } from "@/lib/proposals/constants";
import { createUploadUrl } from "@/lib/proposals/storage";
import { nextVariantSlug, defaultVariantLabel } from "@/lib/proposals/variant-slug";

type FileSpec = { contentType: string; size: number };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let editor;
  try {
    editor = await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const proposal = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.id, id)).limit(1);
  if (proposal.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json();
  const files: FileSpec[] = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) return NextResponse.json({ error: "NO_FILES" }, { status: 400 });
  for (const f of files) {
    if (!extForContentType(String(f.contentType))) return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
    if (Number(f.size) > MAX_PAGE_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const existing = await db.select({ slug: proposalVariants.slug }).from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id));
  const slug = nextVariantSlug(existing.map((e) => e.slug));
  const label = defaultVariantLabel(existing.length);

  const variantId = randomUUID();
  const versionId = randomUUID();
  await db.insert(proposalVariants).values({
    id: variantId, proposalId: id, label, slug, sortOrder: existing.length, createdBy: editor.id,
  });
  await db.insert(proposalVersions).values({ id: versionId, variantId, versionNo: 1, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(String(files[i].contentType))!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return NextResponse.json({ variantId, versionId, slug, label, uploads });
}

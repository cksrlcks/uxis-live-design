import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/legacy/lib/db";
import { proposals, proposalVariants, proposalVersions } from "@drizzle/schema";
import { requireEditor } from "@/legacy/lib/auth/session";
import { generatePublicId } from "@/legacy/lib/proposals/public-id";
import { extForContentType, pagePath, MAX_PAGE_BYTES } from "@/legacy/lib/proposals/constants";
import { createUploadUrl } from "@/legacy/lib/proposals/storage";

export async function GET() {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const rows = await db.select().from(proposals).orderBy(desc(proposals.updatedAt));
  return NextResponse.json(rows);
}

type FileSpec = { contentType: string; size: number };

export async function POST(req: NextRequest) {
  let editor;
  try {
    editor = await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const files: FileSpec[] = Array.isArray(body.files) ? body.files : [];
  if (!title) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });

  for (const f of files) {
    if (!extForContentType(String(f.contentType))) {
      return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
    }
    if (Number(f.size) > MAX_PAGE_BYTES) {
      return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    }
  }

  let publicId = "";
  for (let i = 0; i < 5; i++) {
    const cand = generatePublicId();
    const exists = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.publicId, cand)).limit(1);
    if (exists.length === 0) { publicId = cand; break; }
  }
  if (!publicId) return NextResponse.json({ error: "ID_GENERATION_FAILED" }, { status: 500 });

  const proposalId = randomUUID();
  const variantId = randomUUID();
  const versionId = randomUUID();
  await db.insert(proposals).values({ id: proposalId, publicId, title, ownerId: editor.id });
  await db.insert(proposalVariants).values({
    id: variantId, proposalId, label: "A", slug: "a", sortOrder: 0, createdBy: editor.id,
  });
  await db.insert(proposalVersions).values({ id: versionId, variantId, versionNo: 1, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(String(files[i].contentType))!;
    const pageId = randomUUID();
    const path = pagePath(proposalId, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return NextResponse.json({ proposalId, publicId, variantId, versionId, uploads });
}

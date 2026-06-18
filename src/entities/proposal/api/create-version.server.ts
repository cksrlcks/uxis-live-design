import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, proposalVersions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { extForContentType, pagePath } from "@/shared/lib/proposals/constants";
import { createUploadUrl } from "@/shared/storage";
import { createVersionSchema } from "../model/upload-schemas";

export async function createVersion(id: string, variantId: string, input: unknown) {
  const editor = await requireEditor();
  const { note, files } = createVersionSchema.parse(input);

  const variant = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id)))
    .limit(1);
  if (variant.length === 0) throw new Error("NOT_FOUND");

  const last = await db
    .select({ v: proposalVersions.versionNo })
    .from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId))
    .orderBy(desc(proposalVersions.versionNo))
    .limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const versionId = randomUUID();
  await db.insert(proposalVersions).values({
    id: versionId,
    variantId,
    versionNo: nextNo,
    note: note && note.length > 0 ? note : null,
    createdBy: editor.id,
  });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(files[i].contentType)!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return { versionId, versionNo: nextNo, uploads };
}

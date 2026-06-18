import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { extForContentType, pagePath } from "@/shared/lib/proposals/constants";
import { nextVariantSlug, defaultVariantLabel } from "@/shared/lib/proposals/variant-slug";
import { createUploadUrl } from "@/shared/storage";
import { createVariantSchema } from "../model/upload-schemas";

export async function createVariant(id: string, input: unknown) {
  const editor = await requireEditor();
  const { files } = createVariantSchema.parse(input);

  const proposal = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(eq(proposals.id, id))
    .limit(1);
  if (proposal.length === 0) throw new Error("NOT_FOUND");

  const existing = await db
    .select({ slug: proposalVariants.slug })
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id));
  const slug = nextVariantSlug(existing.map((e) => e.slug));
  const label = defaultVariantLabel(existing.length);

  const variantId = randomUUID();
  const versionId = randomUUID();
  await db.insert(proposalVariants).values({
    id: variantId,
    proposalId: id,
    label,
    slug,
    sortOrder: existing.length,
    createdBy: editor.id,
  });
  await db
    .insert(proposalVersions)
    .values({ id: versionId, variantId, versionNo: 1, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(files[i].contentType)!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return { variantId, versionId, slug, label, uploads };
}

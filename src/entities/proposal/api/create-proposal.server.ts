import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { generatePublicId } from "@/shared/lib/proposals/public-id";
import { extForContentType, pagePath } from "@/shared/lib/proposals/constants";
import { createUploadUrl } from "@/shared/storage";
import { createProposalSchema } from "../model/create-schema";

export async function createProposal(input: unknown) {
  const editor = await requireEditor();
  const { title, files } = createProposalSchema.parse(input);

  let publicId = "";
  for (let i = 0; i < 5; i++) {
    const cand = generatePublicId();
    const exists = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.publicId, cand))
      .limit(1);
    if (exists.length === 0) {
      publicId = cand;
      break;
    }
  }
  if (!publicId) throw new Error("ID_GENERATION_FAILED");

  const proposalId = randomUUID();
  const variantId = randomUUID();
  const versionId = randomUUID();
  await db.insert(proposals).values({ id: proposalId, publicId, title, ownerId: editor.id });
  await db.insert(proposalVariants).values({
    id: variantId,
    proposalId,
    label: "A",
    slug: "a",
    sortOrder: 0,
    createdBy: editor.id,
  });
  // 순환 FK(version.variantId ↔ variant.currentVersionId) 때문에 안→버전 순으로
  // 삽입한 뒤 currentVersionId를 채운다. 비우면 뷰어 목록이 빈 안으로 보인다.
  await db
    .insert(proposalVersions)
    .values({ id: versionId, variantId, versionNo: 1, createdBy: editor.id });
  await db
    .update(proposalVariants)
    .set({ currentVersionId: versionId })
    .where(eq(proposalVariants.id, variantId));

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(files[i].contentType)!;
    const pageId = randomUUID();
    const path = pagePath(proposalId, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return { proposalId, publicId, variantId, versionId, uploads };
}

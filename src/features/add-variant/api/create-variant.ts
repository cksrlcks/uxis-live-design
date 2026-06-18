"use client";

import { http } from "@/shared/api/http";
import { measureAll, uploadAll, type ConfirmPage } from "@/shared/storage-client";

type CreateResponse = {
  variantId: string;
  versionId: string;
  slug: string;
  label: string;
  uploads: { pageId: string; path: string; token: string; signedUrl: string; pageOrder: number }[];
};

export async function createVariantWithUploads(proposalId: string, files: File[]): Promise<void> {
  const measured = await measureAll(files);
  const created = await http<CreateResponse>(`/api/proposals/${proposalId}/variants`, {
    method: "POST",
    body: JSON.stringify({ files: files.map((f) => ({ contentType: f.type, size: f.size })) }),
  });
  const pages: ConfirmPage[] = await uploadAll(created.uploads, measured);
  await http(
    `/api/proposals/${proposalId}/variants/${created.variantId}/versions/${created.versionId}/pages`,
    { method: "POST", body: JSON.stringify({ pages }) },
  );
}

"use client";

import { http } from "@/shared/api/http";
import { measureAll, uploadAll, type ConfirmPage } from "@/shared/storage-client";

type CreateResponse = {
  versionId: string;
  versionNo: number;
  uploads: { pageId: string; path: string; token: string; signedUrl: string; pageOrder: number }[];
};

export async function createVersionWithUploads(
  proposalId: string,
  variantId: string,
  note: string,
  files: File[],
): Promise<void> {
  const measured = await measureAll(files);
  const created = await http<CreateResponse>(
    `/api/proposals/${proposalId}/variants/${variantId}/versions`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
        files: files.map((f) => ({ contentType: f.type, size: f.size })),
      }),
    },
  );
  const pages: ConfirmPage[] = await uploadAll(created.uploads, measured);
  await http(
    `/api/proposals/${proposalId}/variants/${variantId}/versions/${created.versionId}/pages`,
    { method: "POST", body: JSON.stringify({ pages }) },
  );
}

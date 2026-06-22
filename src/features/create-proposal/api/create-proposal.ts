"use client";

import { http } from "@/shared/api/http";
import { measureAll, uploadAll, type ConfirmPage } from "@/shared/storage-client";
import type { CreateProposalInput } from "@/entities/proposal/model/create-schema";

type CreateResponse = {
  proposalId: string;
  publicId: string;
  variantId: string;
  versionId: string;
  uploads: { pageId: string; path: string; token: string; signedUrl: string; pageOrder: number }[];
};

export async function createProposalWithUploads(
  title: string,
  files: File[],
): Promise<{ proposalId: string }> {
  // 이름만으로 생성 — 업로드/페이지 확정 단계를 건너뛴다.
  if (files.length === 0) {
    const created = await http<CreateResponse>("/api/proposals", {
      method: "POST",
      body: JSON.stringify({ title, files: [] } satisfies CreateProposalInput),
    });
    return { proposalId: created.proposalId };
  }

  const measured = await measureAll(files);

  const body: CreateProposalInput = {
    title,
    files: files.map((f) => ({ contentType: f.type, size: f.size })),
  };
  const created = await http<CreateResponse>("/api/proposals", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const pages: ConfirmPage[] = await uploadAll(created.uploads, measured);

  await http(
    `/api/proposals/${created.proposalId}/variants/${created.variantId}/versions/${created.versionId}/pages`,
    { method: "POST", body: JSON.stringify({ pages }) },
  );

  return { proposalId: created.proposalId };
}

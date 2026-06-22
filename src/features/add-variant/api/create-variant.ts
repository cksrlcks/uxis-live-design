"use client";

import { http } from "@/shared/api/http";

type CreateResponse = { variantId: string; versionId: string; slug: string; label: string };

// 빈 안을 생성한다 — 이미지는 생성 후 카드 그리드에서 추가/교체한다.
export async function createEmptyVariant(proposalId: string): Promise<{ variantId: string }> {
  const created = await http<CreateResponse>(`/api/proposals/${proposalId}/variants`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { variantId: created.variantId };
}

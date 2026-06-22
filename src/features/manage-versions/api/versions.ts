"use client";

import { http } from "@/shared/api/http";

// 새 버전 생성 — 빈 버전을 만들고 서버가 최신을 기본으로 전환한다. 생성된
// versionId를 반환해 호출 측이 곧바로 선택한다.
export async function createVersion(
  proposalId: string,
  variantId: string,
): Promise<{ versionId: string }> {
  const created = await http<{ versionId: string; versionNo: number }>(
    `/api/proposals/${proposalId}/variants/${variantId}/versions`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return { versionId: created.versionId };
}

export function deleteVersion(
  proposalId: string,
  variantId: string,
  versionId: string,
): Promise<void> {
  return http<void>(
    `/api/proposals/${proposalId}/variants/${variantId}/versions/${versionId}`,
    { method: "DELETE" },
  );
}

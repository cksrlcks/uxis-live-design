import { http } from "@/shared/api/http";

export function restoreVersion(
  proposalId: string,
  variantId: string,
  versionId: string,
): Promise<{ versionId: string; versionNo: number }> {
  return http(`/api/proposals/${proposalId}/variants/${variantId}/restore`, {
    method: "POST",
    body: JSON.stringify({ versionId }),
  });
}

import { http } from "@/shared/api/http";
import type { UpdateVariantInput } from "@/entities/proposal/model/edit-schemas";

export function updateVariant(
  proposalId: string,
  variantId: string,
  input: UpdateVariantInput,
): Promise<void> {
  return http<void>(`/api/proposals/${proposalId}/variants/${variantId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteVariant(proposalId: string, variantId: string): Promise<void> {
  return http<void>(`/api/proposals/${proposalId}/variants/${variantId}`, { method: "DELETE" });
}

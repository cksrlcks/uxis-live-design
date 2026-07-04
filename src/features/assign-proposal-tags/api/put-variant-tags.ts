import { http } from "@/shared/api/http";

export function putVariantTags(variantId: string, optionIds: string[]): Promise<void> {
  return http<void>(`/api/variants/${variantId}/tags`, {
    method: "PUT",
    body: JSON.stringify({ optionIds }),
  });
}

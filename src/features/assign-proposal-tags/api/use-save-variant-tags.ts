import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tagQueries } from "@/entities/tag";
import { putVariantTags } from "./put-variant-tags";

export function useSaveVariantTags(variantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionIds: string[]) => putVariantTags(variantId, optionIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagQueries.variant(variantId).queryKey }),
  });
}

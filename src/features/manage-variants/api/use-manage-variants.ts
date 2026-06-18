import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { updateVariant, deleteVariant } from "./variants";
import type { UpdateVariantInput } from "@/entities/proposal/model/edit-schemas";

export function useUpdateVariant(proposalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, input }: { variantId: string; input: UpdateVariantInput }) =>
      updateVariant(proposalId, variantId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

export function useDeleteVariant(proposalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) => deleteVariant(proposalId, variantId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

// Reorder = swap two variants' sortOrder in ONE mutation so the detail query is
// invalidated exactly once (after BOTH PATCHes land) — avoids the transient
// duplicate-sortOrder flicker that two separate mutateAsync calls would cause.
export function useReorderVariants(proposalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pairs: { variantId: string; sortOrder: number }[]) => {
      await Promise.all(
        pairs.map((p) => updateVariant(proposalId, p.variantId, { sortOrder: p.sortOrder })),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createVersion, deleteVersion } from "./versions";

export function useAddVersion(proposalId: string, variantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createVersion(proposalId, variantId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

export function useDeleteVersion(proposalId: string, variantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => deleteVersion(proposalId, variantId, versionId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

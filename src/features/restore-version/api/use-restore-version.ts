import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { restoreVersion } from "./restore";

export function useRestoreVersion(proposalId: string, variantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => restoreVersion(proposalId, variantId, versionId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createVariantWithUploads } from "./create-variant";

export function useAddVariant(proposalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => createVariantWithUploads(proposalId, files),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

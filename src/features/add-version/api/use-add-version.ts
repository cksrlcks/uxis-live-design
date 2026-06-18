import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createVersionWithUploads } from "./create-version";

export function useAddVersion(proposalId: string, variantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ note, files }: { note: string; files: File[] }) =>
      createVersionWithUploads(proposalId, variantId, note, files),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

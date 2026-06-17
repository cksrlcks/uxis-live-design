import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createProposalWithUploads } from "./create-proposal";

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, files }: { title: string; files: File[] }) =>
      createProposalWithUploads(title, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalQueries.lists() });
    },
  });
}

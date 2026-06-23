import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createProposalByName } from "./create-proposal";

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title }: { title: string }) => createProposalByName(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalQueries.lists() });
    },
  });
}

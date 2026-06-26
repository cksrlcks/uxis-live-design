import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createProposalByName } from "./create-proposal";

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, workYear }: { title: string; workYear?: number }) =>
      createProposalByName(title, workYear),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalQueries.lists() });
    },
  });
}

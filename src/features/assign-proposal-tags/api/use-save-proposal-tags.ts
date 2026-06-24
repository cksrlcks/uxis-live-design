import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tagQueries } from "@/entities/tag";
import { putProposalTags } from "./put-proposal-tags";

export function useSaveProposalTags(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionIds: string[]) => putProposalTags(proposalId, optionIds),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: tagQueries.proposal(proposalId).queryKey }),
  });
}

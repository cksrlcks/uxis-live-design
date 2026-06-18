import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { updateSettings, deleteProposal } from "./settings";
import type { UpdateSettingsInput } from "@/entities/proposal/model/edit-schemas";

export function useUpdateSettings(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => updateSettings(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(id).queryKey });
      queryClient.invalidateQueries({ queryKey: proposalQueries.lists() });
    },
  });
}

export function useDeleteProposal(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteProposal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: proposalQueries.lists() }),
  });
}

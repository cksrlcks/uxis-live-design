import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userQueries } from "@/entities/user";
import { updateUserAnalyze } from "./update-user-analyze";

export function useUpdateUserAnalyze() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allowAnalyze }: { id: string; allowAnalyze: boolean }) =>
      updateUserAnalyze(id, allowAnalyze),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userQueries.lists() }),
  });
}

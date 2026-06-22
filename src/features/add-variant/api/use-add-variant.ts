import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createEmptyVariant } from "./create-variant";

// 빈 안 생성 → 상세 쿼리 무효화. 반환된 variantId로 호출 측이 새 안을 선택한다.
export function useAddVariant(proposalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createEmptyVariant(proposalId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

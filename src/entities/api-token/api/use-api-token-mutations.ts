import { useMutation, useQueryClient } from "@tanstack/react-query";
import { regenerateTokenReq, revokeTokenReq } from "./api-token.api";
import { apiTokenQueries } from "./api-token.query";

export function useRegenerateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: regenerateTokenReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: apiTokenQueries.all() }),
  });
}

export function useRevokeToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeTokenReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: apiTokenQueries.all() }),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAiDesignReq, deleteAiDesignReq, retryAiDesignReq } from "./ai-design.api";
import { aiDesignQueries } from "./ai-design.query";

export function useCreateAiDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAiDesignReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiDesignQueries.all() }),
  });
}

export function useDeleteAiDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAiDesignReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiDesignQueries.all() }),
  });
}

export function useRetryAiDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retryAiDesignReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiDesignQueries.all() }),
  });
}

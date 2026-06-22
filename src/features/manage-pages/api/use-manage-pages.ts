import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { appendPages, replacePage, deletePage, reorderPages } from "./pages";

// 모든 페이지 mutation은 성공 시 상세 쿼리를 무효화해 카드 그리드를 최신화한다.
function useInvalidateDetail(proposalId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey });
}

export function useAppendPages(proposalId: string, variantId: string, versionId: string) {
  const invalidate = useInvalidateDetail(proposalId);
  return useMutation({
    mutationFn: (files: File[]) => appendPages(proposalId, variantId, versionId, files),
    onSuccess: invalidate,
  });
}

export function useReplacePage(proposalId: string, variantId: string, versionId: string) {
  const invalidate = useInvalidateDetail(proposalId);
  return useMutation({
    mutationFn: ({ pageId, file }: { pageId: string; file: File }) =>
      replacePage(proposalId, variantId, versionId, pageId, file),
    onSuccess: invalidate,
  });
}

export function useDeletePage(proposalId: string, variantId: string, versionId: string) {
  const invalidate = useInvalidateDetail(proposalId);
  return useMutation({
    mutationFn: (pageId: string) => deletePage(proposalId, variantId, versionId, pageId),
    onSuccess: invalidate,
  });
}

export function useReorderPages(proposalId: string, variantId: string, versionId: string) {
  const invalidate = useInvalidateDetail(proposalId);
  return useMutation({
    mutationFn: (orderedPageIds: string[]) =>
      reorderPages(proposalId, variantId, versionId, orderedPageIds),
    onSuccess: invalidate,
  });
}

import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getProposals } from "./get-proposals";
import { getProposalDetail } from "./get-proposal-detail";
import { getViewerVariants } from "./get-viewer-variants";

export const proposalQueries = {
  all: () => ["proposals"] as const,
  lists: () => [...proposalQueries.all(), "list"] as const,
  // 검색어가 없으면 기존 키([...,page]) 그대로 — 빈 검색은 키에 포함하지 않는다.
  list: (page = 1, search = "") =>
    queryOptions({
      queryKey: search
        ? [...proposalQueries.lists(), page, search]
        : [...proposalQueries.lists(), page],
      queryFn: () => getProposals(page, search),
      placeholderData: keepPreviousData,
    }),
  details: () => [...proposalQueries.all(), "detail"] as const,
  detail: (id: string) =>
    queryOptions({
      queryKey: [...proposalQueries.details(), id],
      queryFn: () => getProposalDetail(id),
    }),
  viewerVariants: (publicId: string) =>
    queryOptions({
      queryKey: [...proposalQueries.all(), "viewer-variants", publicId],
      queryFn: () => getViewerVariants(publicId),
    }),
};

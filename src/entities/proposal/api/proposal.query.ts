import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getProposals } from "./get-proposals";
import { getProposalDetail } from "./get-proposal-detail";
import { getViewerVariants } from "./get-viewer-variants";

export const proposalQueries = {
  all: () => ["proposals"] as const,
  lists: () => [...proposalQueries.all(), "list"] as const,
  list: (page = 1) =>
    queryOptions({
      queryKey: [...proposalQueries.lists(), page],
      queryFn: () => getProposals(page),
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

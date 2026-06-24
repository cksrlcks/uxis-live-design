import { queryOptions } from "@tanstack/react-query";
import { getTaxonomy } from "./get-taxonomy";
import { getProposalTags } from "./get-proposal-tags";

export const tagQueries = {
  all: () => ["tags"] as const,
  taxonomy: () =>
    queryOptions({
      queryKey: [...tagQueries.all(), "taxonomy"],
      queryFn: getTaxonomy,
    }),
  proposal: (proposalId: string) =>
    queryOptions({
      queryKey: [...tagQueries.all(), "proposal", proposalId],
      queryFn: () => getProposalTags(proposalId),
    }),
};

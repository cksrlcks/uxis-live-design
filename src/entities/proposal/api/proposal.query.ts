import { queryOptions } from "@tanstack/react-query";
import { getProposals } from "./get-proposals";

export const proposalQueries = {
  all: () => ["proposals"] as const,
  lists: () => [...proposalQueries.all(), "list"] as const,
  list: () =>
    queryOptions({
      queryKey: proposalQueries.lists(),
      queryFn: getProposals,
    }),
};

import { queryOptions } from "@tanstack/react-query";
import { getMyTokenReq } from "./api-token.api";

export const apiTokenQueries = {
  all: () => ["api-token"] as const,
  mine: () =>
    queryOptions({
      queryKey: [...apiTokenQueries.all(), "mine"] as const,
      queryFn: getMyTokenReq,
    }),
};

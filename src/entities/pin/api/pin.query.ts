import { queryOptions } from "@tanstack/react-query";
import { getPins } from "./get-pins";

export const pinQueries = {
  all: () => ["pin"] as const,
  list: (publicId: string, variantId: string, versionId: string) =>
    queryOptions({
      queryKey: [...pinQueries.all(), "list", publicId, variantId, versionId],
      queryFn: () => getPins(publicId, variantId, versionId),
    }),
};

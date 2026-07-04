import { queryOptions } from "@tanstack/react-query";
import { getTaxonomy } from "./get-taxonomy";
import { getVariantTags } from "./get-variant-tags";

export const tagQueries = {
  all: () => ["tags"] as const,
  taxonomy: () =>
    queryOptions({
      queryKey: [...tagQueries.all(), "taxonomy"],
      queryFn: getTaxonomy,
    }),
  variant: (variantId: string) =>
    queryOptions({
      queryKey: [...tagQueries.all(), "variant", variantId],
      queryFn: () => getVariantTags(variantId),
    }),
};

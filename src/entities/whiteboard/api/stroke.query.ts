import { queryOptions } from "@tanstack/react-query";
import { getStrokes } from "./get-strokes";

export const strokeQueries = {
  all: () => ["whiteboard-stroke"] as const,
  list: (publicId: string, variantId: string, versionId: string) =>
    queryOptions({
      queryKey: [...strokeQueries.all(), "list", publicId, variantId, versionId],
      queryFn: () => getStrokes(publicId, variantId, versionId),
    }),
};

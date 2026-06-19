import { queryOptions } from "@tanstack/react-query";
import { getRecentChat } from "./get-recent-chat";

export const chatQueries = {
  all: () => ["chat"] as const,
  list: (publicId: string) =>
    queryOptions({
      queryKey: [...chatQueries.all(), "list", publicId],
      queryFn: () => getRecentChat(publicId),
    }),
};

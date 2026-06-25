import { queryOptions } from "@tanstack/react-query";
import { fetchAiDesigns } from "./ai-design.api";
import type { AiDesignListItem } from "../model/types";

export const aiDesignQueries = {
  all: () => ["ai-designs"] as const,
  list: () =>
    queryOptions({
      queryKey: [...aiDesignQueries.all(), "list"],
      queryFn: fetchAiDesigns,
      // 'working' 행이 하나라도 있으면 3초마다 폴링, 전부 끝나면 폴링 중단.
      refetchInterval: (query) => {
        const data = query.state.data as AiDesignListItem[] | undefined;
        return data?.some((d) => d.status === "working") ? 3000 : false;
      },
    }),
};

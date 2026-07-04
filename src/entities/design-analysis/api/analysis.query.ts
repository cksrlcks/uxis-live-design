import { queryOptions } from "@tanstack/react-query";
import { getAnalysisOverviewReq } from "./analysis-overview.api";

export const analysisQueries = {
  all: () => ["design-analysis"] as const,
  overview: () =>
    queryOptions({
      queryKey: [...analysisQueries.all(), "overview"] as const,
      queryFn: getAnalysisOverviewReq,
    }),
};

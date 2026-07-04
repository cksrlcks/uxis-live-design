import { http } from "@/shared/api/http";
import type { AnalysisOverview } from "../model/types";

export const getAnalysisOverviewReq = (): Promise<AnalysisOverview> =>
  http<AnalysisOverview>("/api/admin/design-analysis");

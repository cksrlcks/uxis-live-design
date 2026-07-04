import { http } from "@/shared/api/http";
import type { AnalysisOverviewPage } from "../model/types";

export const getAnalysisOverviewReq = (): Promise<AnalysisOverviewPage[]> =>
  http<AnalysisOverviewPage[]>("/api/admin/design-analysis");

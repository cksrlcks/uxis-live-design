import { http } from "@/shared/api/http";
import type { ViewerVariant } from "../model/types";

export function getViewerVariants(publicId: string): Promise<ViewerVariant[]> {
  return http<ViewerVariant[]>(`/api/p/${publicId}/variants`);
}

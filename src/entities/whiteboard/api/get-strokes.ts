import { http } from "@/shared/api/http";
import type { StrokeDTO } from "../model/types";

export function getStrokes(
  publicId: string,
  variantId: string,
  versionId: string,
): Promise<StrokeDTO[]> {
  const qs = new URLSearchParams({ variant: variantId, version: versionId });
  return http<{ strokes: StrokeDTO[] }>(`/api/p/${publicId}/strokes?${qs}`).then((r) => r.strokes);
}

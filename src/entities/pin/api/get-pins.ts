import { http } from "@/shared/api/http";
import type { PinDTO } from "../model/types";

export function getPins(publicId: string, variantId: string, versionId: string): Promise<PinDTO[]> {
  const qs = new URLSearchParams({ variant: variantId, version: versionId });
  return http<{ pins: PinDTO[] }>(`/api/p/${publicId}/pins?${qs}`).then((r) => r.pins);
}

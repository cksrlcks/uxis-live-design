import { http } from "@/shared/api/http";
import type { ProposalTags } from "../model/types";

export function getVariantTags(variantId: string): Promise<ProposalTags> {
  return http<ProposalTags>(`/api/variants/${variantId}/tags`);
}

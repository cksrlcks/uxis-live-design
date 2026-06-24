import { http } from "@/shared/api/http";
import type { ProposalTags } from "../model/types";

export function getProposalTags(proposalId: string): Promise<ProposalTags> {
  return http<ProposalTags>(`/api/proposals/${proposalId}/tags`);
}

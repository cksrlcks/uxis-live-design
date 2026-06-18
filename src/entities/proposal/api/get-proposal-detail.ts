import { http } from "@/shared/api/http";
import type { ProposalDetail } from "../model/types";

export function getProposalDetail(id: string): Promise<ProposalDetail> {
  return http<ProposalDetail>(`/api/proposals/${id}`);
}

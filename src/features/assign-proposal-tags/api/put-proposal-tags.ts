import { http } from "@/shared/api/http";

export function putProposalTags(proposalId: string, optionIds: string[]): Promise<void> {
  return http<void>(`/api/proposals/${proposalId}/tags`, {
    method: "PUT",
    body: JSON.stringify({ optionIds }),
  });
}
